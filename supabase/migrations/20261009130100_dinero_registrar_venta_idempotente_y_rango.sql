-- Dinero 2/3: registrar_venta idempotente y con el rango de precio del PRD.
--
-- 1. Ventas duplicadas: con mala señal, la respuesta de registrar_venta se
--    podía perder después de guardar la venta; la app decía "no se guardó",
--    el vendedor reintentaba y la venta (stock y pagos incluidos) quedaba
--    doble. Ahora la app manda una clave por intento (p_clave_idempotencia):
--    si esa venta ya existe, se devuelve la misma con repetida = true.
--    La clave es opcional: la versión anterior de la app sigue funcionando.
-- 2. Rango de precio: el PRD v4.0 §3.1.1 fija el mínimo y el máximo del
--    calzado como topes reales del regateo. Solo lo hacía cumplir el slider;
--    ahora también el servidor (cubre rangos que cambiaron con el carrito
--    abierto y llamadas directas a la API). Granja no tiene rango.
--
-- Fuera de eso, la función es idéntica a su versión vigente (20260620002823).

alter table public.ventas add column if not exists clave_idempotencia uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ventas_clave_idempotencia_key') then
    alter table public.ventas add constraint ventas_clave_idempotencia_key unique (clave_idempotencia);
  end if;
end $$;
comment on column public.ventas.clave_idempotencia is
  'Clave que genera la app por intento de venta; un reintento con la misma clave devuelve la venta ya registrada.';

-- La firma cambia (parámetro nuevo con default): se reemplaza la anterior.
drop function if exists public.registrar_venta(jsonb, jsonb, numeric, text, text, text);

create function public.registrar_venta(p_items jsonb, p_pagos jsonb, p_efectivo_recibido numeric DEFAULT NULL::numeric, p_cliente_nombre text DEFAULT NULL::text, p_cliente_apellido text DEFAULT NULL::text, p_cliente_telefono text DEFAULT NULL::text, p_clave_idempotencia uuid DEFAULT NULL::uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'private', 'extensions'
as $function$
declare
  v_uid uuid := auth.uid();
  v_venta_id uuid;
  v_numero bigint;
  v_total numeric(12,2) := 0;
  v_total_pagos numeric(12,2) := 0;
  v_efectivo_monto numeric(12,2) := 0;
  v_efectivo_recibido numeric(12,2);
  v_cambio numeric(12,2) := 0;
  it jsonb;
  v_pago jsonb;
  v_monto numeric(12,2);
  v_tipo text;
  v_pid uuid;
  v_cant numeric(12,3);
  v_precio numeric(12,2);
  v_desc text;
  v_talla text;
  v_color text;
  v_stock numeric(12,3);
  v_min numeric(12,2);
  v_max numeric(12,2);
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  if p_pagos is null or jsonb_array_length(p_pagos) = 0 then
    raise exception 'La venta no tiene pagos';
  end if;

  -- Reintento de una venta que ya se guardó (la respuesta se perdió por la red):
  -- se devuelve la misma venta, sin volver a descontar stock ni registrar pagos.
  if p_clave_idempotencia is not null then
    select id, numero into v_venta_id, v_numero
      from public.ventas
      where clave_idempotencia = p_clave_idempotencia and vendedor_id = v_uid;
    if found then
      return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero, 'repetida', true);
    end if;
  end if;

  -- El trigger trg_ventas_caja_abierta exige la caja del día abierta.
  insert into public.ventas (vendedor_id, total, monto_pagado, saldo_pendiente, estado,
                             cliente_nombre, cliente_apellido, cliente_telefono,
                             clave_idempotencia)
    values (v_uid, 0, 0, 0, 'completada',
            p_cliente_nombre, p_cliente_apellido, p_cliente_telefono,
            p_clave_idempotencia)
    on conflict (clave_idempotencia) do nothing
    returning id, numero into v_venta_id, v_numero;

  if v_venta_id is null then
    -- Un reintento simultáneo con la misma clave ganó la carrera y ya se confirmó.
    select id, numero into v_venta_id, v_numero
      from public.ventas
      where clave_idempotencia = p_clave_idempotencia and vendedor_id = v_uid;
    if not found then
      raise exception 'Clave de venta inválida';
    end if;
    return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero, 'repetida', true);
  end if;

  for it in
    select value from jsonb_array_elements(p_items)
    order by value->>'producto_id'
  loop
    v_tipo := it->>'tipo';
    if it->>'producto_id' is null then
      raise exception 'Item sin producto_id';
    end if;
    v_pid  := (it->>'producto_id')::uuid;
    v_cant := (it->>'cantidad')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cantidad inválida';
    end if;
    if it->>'precio' is null then
      raise exception 'Item sin precio';
    end if;
    v_precio := round((it->>'precio')::numeric, 2);
    if v_precio <= 0 then
      raise exception 'Precio inválido';
    end if;
    if v_tipo = 'calzado' and v_cant <> trunc(v_cant) then
      raise exception 'La cantidad de calzado debe ser entera';
    end if;

    v_min := null;
    v_max := null;
    if v_tipo = 'calzado' then
      select descripcion, talla, color, stock_actual, precio_minimo, precio_maximo
        into v_desc, v_talla, v_color, v_stock, v_min, v_max
        from public.productos_calzado
        where id = v_pid and activo
        for update;
      if v_desc is null then
        raise exception 'Producto no disponible';
      end if;
      if v_stock < v_cant then
        raise exception 'Stock insuficiente para %', v_desc;
      end if;
      -- PRD §3.1.1: el mínimo y el máximo son topes reales del regateo.
      if v_precio < v_min or v_precio > v_max then
        raise exception 'El precio de % debe estar entre % y %. Ajusta el carrito.',
          v_desc, private.fmt_cop(v_min), private.fmt_cop(v_max);
      end if;
      update public.productos_calzado set stock_actual = stock_actual - v_cant where id = v_pid;
    elsif v_tipo = 'varios' then
      select nombre into v_desc
        from public.productos_varios
        where id = v_pid and activo;
      if v_desc is null then
        raise exception 'Producto no disponible';
      end if;
      v_talla := null;
      v_color := null;
    else
      raise exception 'Tipo de producto inválido: %', v_tipo;
    end if;

    insert into public.venta_items (venta_id, tipo_producto,
        producto_calzado_id, producto_varios_id,
        descripcion_snapshot, talla, color, cantidad, precio_unitario, subtotal,
        precio_minimo_snapshot, precio_maximo_snapshot)
      values (v_venta_id, v_tipo,
        case when v_tipo = 'calzado' then v_pid end,
        case when v_tipo = 'varios'  then v_pid end,
        v_desc, v_talla, v_color, v_cant, v_precio, round(v_precio * v_cant, 2),
        v_min, v_max);

    v_total := v_total + round(v_precio * v_cant, 2);
  end loop;

  for v_pago in select value from jsonb_array_elements(p_pagos)
  loop
    if (v_pago->>'metodo') not in ('efectivo','nequi','bre_b','otro') then
      raise exception 'Método de pago inválido';
    end if;
    v_monto := round((v_pago->>'monto')::numeric, 2);
    if v_monto <= 0 then
      raise exception 'Monto de pago inválido';
    end if;
    v_total_pagos := v_total_pagos + v_monto;
    if (v_pago->>'metodo') = 'efectivo' then
      v_efectivo_monto := v_efectivo_monto + v_monto;
    end if;
    insert into public.metodos_pago_venta (venta_id, metodo, monto, es_anticipo)
      values (v_venta_id, v_pago->>'metodo', v_monto, false);
  end loop;

  if v_total_pagos <> v_total then
    raise exception 'Los pagos no suman el total';
  end if;

  if v_efectivo_monto > 0 then
    v_efectivo_recibido := coalesce(p_efectivo_recibido, v_efectivo_monto);
    if v_efectivo_recibido < v_efectivo_monto then
      raise exception 'El efectivo recibido es menor al pago en efectivo';
    end if;
    v_cambio := v_efectivo_recibido - v_efectivo_monto;
  else
    v_efectivo_recibido := null;
    v_cambio := 0;
  end if;

  update public.ventas
    set total = v_total, monto_pagado = v_total, saldo_pendiente = 0,
        efectivo_recibido = v_efectivo_recibido, cambio = v_cambio
        where id = v_venta_id;

  return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero, 'repetida', false);
end;
$function$;

revoke all on function public.registrar_venta(jsonb, jsonb, numeric, text, text, text, uuid) from public, anon;
grant execute on function public.registrar_venta(jsonb, jsonb, numeric, text, text, text, uuid) to authenticated;
