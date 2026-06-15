-- SP-2: registrar_venta acepta `precio` por item (regateo calzado / precio Granja).
create or replace function public.registrar_venta(
  p_items jsonb,
  p_pagos jsonb,
  p_efectivo_recibido numeric default null,
  p_cliente_nombre text default null,
  p_cliente_apellido text default null,
  p_cliente_telefono text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
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

  insert into public.ventas (vendedor_id, total, monto_pagado, saldo_pendiente, estado,
                             cliente_nombre, cliente_apellido, cliente_telefono)
    values (v_uid, 0, 0, 0, 'completada',
            p_cliente_nombre, p_cliente_apellido, p_cliente_telefono)
    returning id, numero into v_venta_id, v_numero;

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
    if (v_pago->>'metodo') not in ('efectivo','nequi','daviplata') then
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

  return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero);
end;
$$;

revoke all on function public.registrar_venta(jsonb, jsonb, numeric, text, text, text) from public;
grant execute on function public.registrar_venta(jsonb, jsonb, numeric, text, text, text) to authenticated;
