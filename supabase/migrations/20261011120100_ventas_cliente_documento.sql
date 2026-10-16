-- Rediseño del carrito, B4 (docs/rediseno-carrito/README.md): el cliente de
-- una venta puede llevar su cédula, NIT o razón social (opcional).
--
-- 1. ventas.cliente_documento: texto libre, sin formato obligatorio (acepta
--    cédula, NIT o razón social). Sin índice: hoy no se busca por documento
--    (si se agrega esa búsqueda, crear uno como idx_ventas_cliente_tel).
-- 2. registrar_venta recibe p_cliente_documento (vacío = NULL). Al cambiar la
--    firma se borra la versión anterior para no dejar dos funciones ambiguas
--    (verificar_despliegue.sql exige una sola). El resto del cuerpo es el de
--    20261009150000_permisos_por_usuario.sql, sin cambios.
-- 3. Es un dato personal: el historial de acciones (auditoria) registra que
--    se guardó o cambió, pero no su valor ("(oculto)"). El resto de
--    private.registrar_auditoria queda igual que en 20261009160000_auditoria.sql.

-- ===== 1. Columna =====
alter table public.ventas add column if not exists cliente_documento text;
comment on column public.ventas.cliente_documento is
  'Cédula, NIT o razón social del cliente (opcional, texto libre). Dato personal: la auditoría no guarda su valor.';

-- ===== 2. registrar_venta con p_cliente_documento =====
drop function if exists public.registrar_venta(jsonb, jsonb, numeric, text, text, text, uuid);

CREATE FUNCTION public.registrar_venta(p_items jsonb, p_pagos jsonb, p_efectivo_recibido numeric DEFAULT NULL::numeric, p_cliente_nombre text DEFAULT NULL::text, p_cliente_apellido text DEFAULT NULL::text, p_cliente_telefono text DEFAULT NULL::text, p_clave_idempotencia uuid DEFAULT NULL::uuid, p_cliente_documento text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
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
  if not private.tiene_permiso('ventas') then
    raise exception 'No tienes permiso para vender.';
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
                             cliente_documento, clave_idempotencia)
    values (v_uid, 0, 0, 0, 'completada',
            p_cliente_nombre, p_cliente_apellido, p_cliente_telefono,
            nullif(btrim(p_cliente_documento), ''), p_clave_idempotencia)
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

revoke all on function public.registrar_venta(jsonb, jsonb, numeric, text, text, text, uuid, text) from public, anon;
grant execute on function public.registrar_venta(jsonb, jsonb, numeric, text, text, text, uuid, text) to authenticated;

-- ===== 3. Auditoría sin el valor del documento =====
create or replace function private.registrar_auditoria()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ignorar constant text[] := array['updated_at', 'updated_by'];
  -- Datos personales que el historial registra sin su valor (solo que cambiaron).
  v_ocultar constant text[] := array['cliente_documento'];
  v_antes   jsonb;
  v_despues jsonb;
  v_col     text;
begin
  if tg_op = 'INSERT' then
    v_despues := to_jsonb(new) - v_ignorar;
  elsif tg_op = 'DELETE' then
    v_antes := to_jsonb(old) - v_ignorar;
  else
    select jsonb_object_agg(n.key, o.value), jsonb_object_agg(n.key, n.value)
      into v_antes, v_despues
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o on o.key = n.key
      where n.value is distinct from o.value and n.key <> all (v_ignorar);
    if v_despues is null then
      return null;
    end if;
  end if;

  foreach v_col in array v_ocultar loop
    if v_antes is not null and v_antes ->> v_col is not null then
      v_antes := jsonb_set(v_antes, array[v_col], '"(oculto)"'::jsonb);
    end if;
    if v_despues is not null and v_despues ->> v_col is not null then
      v_despues := jsonb_set(v_despues, array[v_col], '"(oculto)"'::jsonb);
    end if;
  end loop;

  insert into public.auditoria (usuario_id, tabla, registro_id, accion, antes, despues)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'),
    case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'editar' else 'borrar' end,
    v_antes,
    v_despues
  );
  return null;
end;
$$;
