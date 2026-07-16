-- Métodos de pago: renombrar daviplata -> bre_b y agregar 'otro'.
-- Seguro: no hay datos con 'daviplata' (todo en $0). Renombrado a fondo.

-- 1) CHECK constraints (ventas + devoluciones)
alter table public.metodos_pago_venta drop constraint metodos_pago_venta_metodo_check;
alter table public.metodos_pago_venta add constraint metodos_pago_venta_metodo_check
  check (metodo = any (array['efectivo','nequi','bre_b','otro']));

alter table public.devoluciones drop constraint devoluciones_metodo_reembolso_check;
alter table public.devoluciones add constraint devoluciones_metodo_reembolso_check
  check (metodo_reembolso = any (array['efectivo','nequi','bre_b','otro']));

alter table public.devoluciones drop constraint devoluciones_metodo_cobro_check;
alter table public.devoluciones add constraint devoluciones_metodo_cobro_check
  check (metodo_cobro = any (array['efectivo','nequi','bre_b','otro']));

-- 2) Columna almacenada del cierre de caja
alter table public.cierres_caja rename column total_daviplata to total_bre_b;
alter table public.cierres_caja add column total_otro numeric not null default 0;

-- 3) obtener_resumen_dia
create or replace function public.obtener_resumen_dia(p_fecha date)
returns json language plpgsql security definer set search_path to ''
as $function$
declare
  v_total_ventas int := 0;
  v_total_general numeric := 0;
  v_total_efectivo numeric := 0;
  v_total_nequi numeric := 0;
  v_total_bre_b numeric := 0;
  v_total_otro numeric := 0;
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
begin
  select count(id), coalesce(sum(total),0) into v_total_ventas, v_total_general
  from public.ventas
  where estado = any(v_estados) and (created_at at time zone 'America/Bogota')::date = p_fecha;

  select
    coalesce(sum(case when m.metodo='efectivo' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='nequi' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='bre_b' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='otro' then m.monto else 0 end),0)
  into v_total_efectivo, v_total_nequi, v_total_bre_b, v_total_otro
  from public.metodos_pago_venta m join public.ventas v on v.id = m.venta_id
  where v.estado = any(v_estados) and (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  select
    v_total_general - coalesce(sum(d.monto_devuelto),0) + coalesce(sum(d.monto_cobrado),0),
    v_total_efectivo
      - coalesce(sum(case when d.metodo_reembolso='efectivo' then d.monto_devuelto else 0 end),0)
      + coalesce(sum(case when d.metodo_cobro='efectivo' then d.monto_cobrado else 0 end),0),
    v_total_nequi
      - coalesce(sum(case when d.metodo_reembolso='nequi' then d.monto_devuelto else 0 end),0)
      + coalesce(sum(case when d.metodo_cobro='nequi' then d.monto_cobrado else 0 end),0),
    v_total_bre_b
      - coalesce(sum(case when d.metodo_reembolso='bre_b' then d.monto_devuelto else 0 end),0)
      + coalesce(sum(case when d.metodo_cobro='bre_b' then d.monto_cobrado else 0 end),0),
    v_total_otro
      - coalesce(sum(case when d.metodo_reembolso='otro' then d.monto_devuelto else 0 end),0)
      + coalesce(sum(case when d.metodo_cobro='otro' then d.monto_cobrado else 0 end),0)
  into v_total_general, v_total_efectivo, v_total_nequi, v_total_bre_b, v_total_otro
  from public.devoluciones d
  join public.ventas v on v.id = d.venta_id
  where (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  return json_build_object(
    'total_ventas', v_total_ventas,
    'total_general', v_total_general,
    'total_efectivo', v_total_efectivo,
    'total_nequi', v_total_nequi,
    'total_bre_b', v_total_bre_b,
    'total_otro', v_total_otro
  );
end;
$function$;

-- 4) obtener_balance
create or replace function public.obtener_balance(p_desde date, p_hasta date)
returns json language plpgsql security definer set search_path to ''
as $function$
declare
  v_ef numeric := 0; v_ne numeric := 0; v_br numeric := 0; v_ot numeric := 0;
  v_reemb numeric := 0; v_cobros numeric := 0;
  v_gf numeric := 0; v_gv numeric := 0; v_prov numeric := 0; v_sueldos numeric := 0;
  v_ing_neto numeric; v_egr numeric;
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
begin
  if not private.is_owner() then
    raise exception 'Solo el dueño puede ver el balance';
  end if;

  select
    coalesce(sum(case when m.metodo='efectivo' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='nequi' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='bre_b' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='otro' then m.monto else 0 end),0)
  into v_ef, v_ne, v_br, v_ot
  from public.metodos_pago_venta m
  join public.ventas v on v.id = m.venta_id
  where v.estado = any(v_estados)
    and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  select coalesce(sum(d.monto_devuelto),0), coalesce(sum(d.monto_cobrado),0)
  into v_reemb, v_cobros
  from public.devoluciones d
  join public.ventas v on v.id = d.venta_id
  where (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  select coalesce(sum(monto_pagado),0) into v_gf
  from public.gastos_fijos_pagos where fecha_pago between p_desde and p_hasta;

  select coalesce(sum(monto),0) into v_gv
  from public.gastos_variables where fecha between p_desde and p_hasta;

  select coalesce(sum(monto),0) into v_prov
  from public.compra_pagos where fecha between p_desde and p_hasta;

  select coalesce(sum(monto),0) into v_sueldos
  from public.empleado_pagos where fecha_pago between p_desde and p_hasta;

  v_ing_neto := v_ef + v_ne + v_br + v_ot - v_reemb + v_cobros;
  v_egr := v_gf + v_gv + v_prov + v_sueldos;

  return json_build_object(
    'ingresos', json_build_object(
      'efectivo', v_ef, 'nequi', v_ne, 'bre_b', v_br, 'otro', v_ot,
      'reembolsos', v_reemb, 'cobros_cambios', v_cobros, 'total_neto', v_ing_neto),
    'egresos', json_build_object(
      'gastos_fijos', v_gf, 'gastos_variables', v_gv,
      'pagos_proveedores', v_prov, 'sueldos', v_sueldos, 'total', v_egr),
    'balance', v_ing_neto - v_egr
  );
end;
$function$;

-- 5) obtener_reporte_diario
create or replace function public.obtener_reporte_diario(p_fecha date)
returns json language plpgsql security definer set search_path to ''
as $function$
declare
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
  v_ef numeric := 0; v_ne numeric := 0; v_br numeric := 0; v_ot numeric := 0; v_num int := 0; v_total numeric;
  v_mas_vendido text; v_stock text[]; v_stock_txt text;
  v_dif numeric; v_cuadro boolean; v_caja_existe boolean;
  v_caja_linea text; v_mensaje text;
begin
  select coalesce(sum(case when m.metodo='efectivo' then m.monto else 0 end),0),
         coalesce(sum(case when m.metodo='nequi' then m.monto else 0 end),0),
         coalesce(sum(case when m.metodo='bre_b' then m.monto else 0 end),0),
         coalesce(sum(case when m.metodo='otro' then m.monto else 0 end),0)
  into v_ef, v_ne, v_br, v_ot
  from public.metodos_pago_venta m join public.ventas v on v.id=m.venta_id
  where v.estado=any(v_estados) and (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  select v_ef - coalesce(sum(case when metodo_reembolso='efectivo' then monto_devuelto else 0 end),0) + coalesce(sum(case when metodo_cobro='efectivo' then monto_cobrado else 0 end),0),
         v_ne - coalesce(sum(case when metodo_reembolso='nequi' then monto_devuelto else 0 end),0) + coalesce(sum(case when metodo_cobro='nequi' then monto_cobrado else 0 end),0),
         v_br - coalesce(sum(case when metodo_reembolso='bre_b' then monto_devuelto else 0 end),0) + coalesce(sum(case when metodo_cobro='bre_b' then monto_cobrado else 0 end),0),
         v_ot - coalesce(sum(case when metodo_reembolso='otro' then monto_devuelto else 0 end),0) + coalesce(sum(case when metodo_cobro='otro' then monto_cobrado else 0 end),0)
  into v_ef, v_ne, v_br, v_ot
  from public.devoluciones d join public.ventas v on v.id=d.venta_id
  where (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  v_total := v_ef + v_ne + v_br + v_ot;

  select count(*) into v_num from public.ventas v
  where v.estado=any(v_estados) and (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  select vi.descripcion_snapshot into v_mas_vendido
  from public.venta_items vi join public.ventas v on v.id=vi.venta_id
  where v.estado=any(v_estados) and (v.created_at at time zone 'America/Bogota')::date = p_fecha
  group by vi.descripcion_snapshot order by sum(vi.cantidad) desc limit 1;

  select array_agg(t.txt) into v_stock from (
    select pc.descripcion || coalesce(' · talla ' || pc.talla, '') as txt
    from public.productos_calzado pc
    where pc.activo = true and pc.stock_actual <= pc.stock_minimo
    order by pc.descripcion limit 5
  ) t;
  v_stock := coalesce(v_stock, array[]::text[]);
  v_stock_txt := case when array_length(v_stock,1) is null then 'ninguno' else array_to_string(v_stock, ', ') end;

  select (c.diferencia = 0), c.diferencia, true into v_cuadro, v_dif, v_caja_existe
  from public.cierres_caja c where c.fecha = p_fecha order by c.cierre_at desc nulls last limit 1;
  if v_caja_existe is null then
    v_caja_existe := false; v_caja_linea := '🔓 Caja sin cerrar';
  elsif v_cuadro then
    v_caja_linea := '✅ Caja cuadró';
  else
    v_caja_linea := '⚠️ Diferencia de ' || private.fmt_cop(v_dif);
  end if;

  v_mensaje :=
    '📊 Venus — Resumen del día' || E'\n' ||
    '📅 ' || to_char(p_fecha, 'YYYY-MM-DD') || E'\n\n' ||
    '💰 Total vendido: ' || private.fmt_cop(v_total) || E'\n' ||
    '🛍️ Ventas: ' || v_num || E'\n' ||
    '💵 Efectivo: ' || private.fmt_cop(v_ef) || E'\n' ||
    '📱 Nequi: ' || private.fmt_cop(v_ne) || E'\n' ||
    '🏦 Bre-B: ' || private.fmt_cop(v_br) || E'\n' ||
    '🔁 Otro: ' || private.fmt_cop(v_ot) || E'\n\n' ||
    '👟 Más vendido: ' || coalesce(v_mas_vendido, 'ninguno') || E'\n' ||
    '⚠️ Stock bajo: ' || v_stock_txt || E'\n\n' ||
    v_caja_linea;

  return json_build_object(
    'fecha', to_char(p_fecha,'YYYY-MM-DD'),
    'total_vendido', v_total, 'num_ventas', v_num,
    'efectivo', v_ef, 'nequi', v_ne, 'bre_b', v_br, 'otro', v_ot,
    'mas_vendido', v_mas_vendido,
    'stock_bajo', to_json(v_stock),
    'caja_cuadro', case when v_caja_existe then v_cuadro else null end,
    'diferencia', case when v_caja_existe then v_dif else null end,
    'mensaje', v_mensaje
  );
end;
$function$;

-- 6) obtener_reporte_periodo
create or replace function public.obtener_reporte_periodo(p_desde date, p_hasta date)
returns json language plpgsql security definer set search_path to ''
as $function$
declare
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
  v_largo int := (p_hasta - p_desde) + 1;
  v_prev_desde date := p_desde - v_largo;
  v_prev_hasta date := p_desde - 1;
  v_ef numeric := 0; v_ne numeric := 0; v_br numeric := 0; v_ot numeric := 0;
  v_num int := 0;
  v_total numeric; v_total_ant numeric;
  v_dia_top json; v_top json; v_sinmov json;
begin
  if not private.is_staff_admin() then
    raise exception 'No autorizado para ver reportes';
  end if;

  select
    coalesce(sum(case when m.metodo='efectivo' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='nequi' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='bre_b' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='otro' then m.monto else 0 end),0)
  into v_ef, v_ne, v_br, v_ot
  from public.metodos_pago_venta m
  join public.ventas v on v.id = m.venta_id
  where v.estado = any(v_estados)
    and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  select
    v_ef - coalesce(sum(case when metodo_reembolso='efectivo'  then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='efectivo'      then monto_cobrado  else 0 end),0),
    v_ne - coalesce(sum(case when metodo_reembolso='nequi'     then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='nequi'         then monto_cobrado  else 0 end),0),
    v_br - coalesce(sum(case when metodo_reembolso='bre_b'     then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='bre_b'         then monto_cobrado  else 0 end),0),
    v_ot - coalesce(sum(case when metodo_reembolso='otro'      then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='otro'          then monto_cobrado  else 0 end),0)
  into v_ef, v_ne, v_br, v_ot
  from public.devoluciones d
  join public.ventas v on v.id = d.venta_id
  where (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  v_total := v_ef + v_ne + v_br + v_ot;

  select count(*) into v_num
  from public.ventas v
  where v.estado = any(v_estados)
    and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  with pagos as (
    select coalesce(sum(m.monto),0) as g
    from public.metodos_pago_venta m
    join public.ventas v on v.id = m.venta_id
    where v.estado = any(v_estados)
      and (v.created_at at time zone 'America/Bogota')::date between v_prev_desde and v_prev_hasta
  ), devs as (
    select coalesce(sum(d.monto_devuelto),0) as r, coalesce(sum(d.monto_cobrado),0) as c
    from public.devoluciones d
    join public.ventas v on v.id = d.venta_id
    where (v.created_at at time zone 'America/Bogota')::date between v_prev_desde and v_prev_hasta
  )
  select (pagos.g - devs.r + devs.c) into v_total_ant from pagos, devs;

  with dia_pagos as (
    select (v.created_at at time zone 'America/Bogota')::date as d, sum(m.monto) as g
    from public.metodos_pago_venta m
    join public.ventas v on v.id = m.venta_id
    where v.estado = any(v_estados)
      and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by 1
  ), dia_devs as (
    select (v.created_at at time zone 'America/Bogota')::date as d,
           sum(d2.monto_devuelto) as r, sum(d2.monto_cobrado) as c
    from public.devoluciones d2
    join public.ventas v on v.id = d2.venta_id
    where (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by 1
  )
  select json_build_object('fecha', x.d, 'monto', x.neto) into v_dia_top
  from (
    select p.d, (p.g - coalesce(dd.r,0) + coalesce(dd.c,0)) as neto
    from dia_pagos p
    left join dia_devs dd on dd.d = p.d
    order by neto desc, p.d desc
    limit 1
  ) x;

  select coalesce(json_agg(t order by t.unidades desc), '[]'::json) into v_top
  from (
    select vi.descripcion_snapshot as producto,
           sum(vi.cantidad) as unidades,
           sum(vi.subtotal) as monto
    from public.venta_items vi
    join public.ventas v on v.id = vi.venta_id
    where v.estado = any(v_estados)
      and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by vi.descripcion_snapshot
    order by unidades desc
    limit 10
  ) t;

  select coalesce(
           json_agg(json_build_object(
             'id', pc.id,
             'producto', pc.descripcion || coalesce(' · talla ' || pc.talla, ''))
             order by pc.descripcion),
           '[]'::json) into v_sinmov
  from public.productos_calzado pc
  where pc.activo = true
    and not exists (
      select 1 from public.venta_items vi
      join public.ventas v on v.id = vi.venta_id
      where vi.producto_calzado_id = pc.id
        and v.estado = any(v_estados)
        and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    );

  return json_build_object(
    'total_vendido', v_total,
    'total_anterior', v_total_ant,
    'num_ventas', v_num,
    'efectivo', v_ef, 'nequi', v_ne, 'bre_b', v_br, 'otro', v_ot,
    'dia_top', v_dia_top,
    'top_productos', v_top,
    'sin_movimiento', v_sinmov
  );
end;
$function$;

-- 7) registrar_venta — solo cambia la lista de métodos válidos
create or replace function public.registrar_venta(p_items jsonb, p_pagos jsonb, p_efectivo_recibido numeric DEFAULT NULL::numeric, p_cliente_nombre text DEFAULT NULL::text, p_cliente_apellido text DEFAULT NULL::text, p_cliente_telefono text DEFAULT NULL::text)
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

  return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero);
end;
$function$;

-- 8) registrar_devolucion — solo cambian las dos listas de métodos válidos
create or replace function public.registrar_devolucion(p_venta_id uuid, p_motivo text, p_tipo_devolucion text, p_metodo_reembolso text, p_metodo_cobro text, p_monto_devuelto numeric, p_monto_cobrado numeric, p_items jsonb)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_devolucion_id uuid;
  v_estado text;
  v_item jsonb;
  v_vi_id uuid;
  v_cant numeric(12,3);
  v_reempl_id uuid;
  v_precio_reempl numeric(12,2);
  v_tipo_prod text;
  v_calzado_id uuid;
  v_varios_id uuid;
  v_cant_vendida numeric(12,3);
  v_precio_unit numeric(12,2);
  v_ya_devuelto numeric(12,3);
  v_subtotal numeric(12,2);
  v_orig_ref text; v_orig_desc text;
  v_r_ref text; v_r_desc text; v_r_pmin numeric(12,2); v_r_pmax numeric(12,2);
  v_r_stock numeric; v_r_activo boolean;
  v_refund_total numeric(12,2) := 0.00;
  v_diff_total numeric(12,2) := 0.00;
  v_exp_devuelto numeric(12,2);
  v_exp_cobrado numeric(12,2);
  v_vendido numeric(12,3);
  v_movido numeric(12,3);
  v_todas_cambio boolean;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_motivo is null or trim(p_motivo) = '' then raise exception 'El motivo es requerido'; end if;
  if p_tipo_devolucion not in ('total','parcial','cambio') then
    raise exception 'Tipo de devolución inválido: %', p_tipo_devolucion; end if;
  if coalesce(p_monto_devuelto,0) < 0 or coalesce(p_monto_cobrado,0) < 0 then
    raise exception 'Montos inválidos'; end if;
  if coalesce(p_monto_devuelto,0) > 0 and coalesce(p_monto_cobrado,0) > 0 then
    raise exception 'Una devolución no puede cobrar y reembolsar a la vez'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La devolución debe contener al menos un producto'; end if;

  select estado into v_estado from public.ventas where id = p_venta_id for update;
  if v_estado is null then raise exception 'Venta no encontrada'; end if;
  if v_estado not in ('completada','devuelta_parcial','cambiada_parcial') then
    raise exception 'La venta no admite devoluciones en su estado actual (%).', v_estado; end if;

  insert into public.devoluciones (
    venta_id, motivo, tipo_devolucion, monto_devuelto, metodo_reembolso, monto_cobrado, metodo_cobro
  ) values (
    p_venta_id, p_motivo, p_tipo_devolucion,
    coalesce(p_monto_devuelto,0.00), p_metodo_reembolso,
    coalesce(p_monto_cobrado,0.00), p_metodo_cobro
  ) returning id into v_devolucion_id;

  for v_item in select jsonb_array_elements(p_items) loop
    v_vi_id := (v_item->>'venta_item_id')::uuid;
    v_cant := (v_item->>'cantidad')::numeric;
    v_reempl_id := nullif(v_item->>'cambio_talla_color_id','')::uuid;
    v_precio_reempl := nullif(v_item->>'precio_reemplazo','')::numeric;

    if v_vi_id is null then raise exception 'venta_item_id es requerido'; end if;
    if v_cant is null or v_cant <= 0 then raise exception 'La cantidad debe ser mayor a 0'; end if;

    select tipo_producto, producto_calzado_id, producto_varios_id, cantidad, precio_unitario
      into v_tipo_prod, v_calzado_id, v_varios_id, v_cant_vendida, v_precio_unit
      from public.venta_items where id = v_vi_id and venta_id = p_venta_id for update;
    if v_cant_vendida is null then raise exception 'Item no pertenece a esta venta'; end if;

    select coalesce(sum(di.cantidad),0.000) into v_ya_devuelto
      from public.devolucion_items di
      where di.venta_item_id = v_vi_id and di.devolucion_id <> v_devolucion_id;
    if v_cant + v_ya_devuelto > v_cant_vendida then
      raise exception 'La cantidad devuelta supera la cantidad vendida'; end if;

    if p_tipo_devolucion = 'cambio' then
      if v_tipo_prod <> 'calzado' then raise exception 'Granja no admite cambios'; end if;
      if v_cant <> trunc(v_cant) then raise exception 'La cantidad de calzado debe ser entera'; end if;
      if v_reempl_id is null then raise exception 'Falta el zapato de reemplazo'; end if;
      if v_precio_reempl is null then raise exception 'Falta el precio del reemplazo'; end if;

      select referencia, descripcion, precio_minimo, precio_maximo, stock_actual, activo
        into v_r_ref, v_r_desc, v_r_pmin, v_r_pmax, v_r_stock, v_r_activo
        from public.productos_calzado where id = v_reempl_id for update;
      if v_r_desc is null then raise exception 'El reemplazo no existe'; end if;
      if not v_r_activo then raise exception 'El reemplazo no está activo'; end if;

      select referencia, descripcion into v_orig_ref, v_orig_desc
        from public.productos_calzado where id = v_calzado_id;
      if coalesce(v_orig_ref,'') <> coalesce(v_r_ref,'') or v_orig_desc <> v_r_desc then
        raise exception 'El reemplazo debe ser del mismo modelo (referencia y descripción)'; end if;

      if v_reempl_id <> v_calzado_id then
        if v_r_stock < v_cant then raise exception 'Stock insuficiente del reemplazo'; end if;
        update public.productos_calzado set stock_actual = stock_actual + v_cant where id = v_calzado_id;
        update public.productos_calzado set stock_actual = stock_actual - v_cant where id = v_reempl_id;
      end if;

      v_diff_total := v_diff_total + round((v_precio_reempl - v_precio_unit) * v_cant, 2);
      v_subtotal := 0.00;

      insert into public.devolucion_items (
        devolucion_id, venta_item_id, producto_calzado_id, producto_varios_id,
        cantidad, precio_unitario, subtotal, cambio_talla_color_id,
        precio_reemplazo, precio_minimo_snapshot, precio_maximo_snapshot
      ) values (
        v_devolucion_id, v_vi_id, v_calzado_id, null,
        v_cant, v_precio_unit, v_subtotal, v_reempl_id,
        v_precio_reempl, v_r_pmin, v_r_pmax
      );
    else
      if v_reempl_id is not null or v_precio_reempl is not null then
        raise exception 'No se permite reemplazo en una devolución que no es cambio'; end if;
      if v_tipo_prod = 'calzado' then
        if v_cant <> trunc(v_cant) then raise exception 'La cantidad de calzado debe ser entera'; end if;
        update public.productos_calzado set stock_actual = stock_actual + v_cant where id = v_calzado_id;
      elsif v_tipo_prod <> 'varios' then
        raise exception 'Tipo de producto inválido';
      end if;
      v_subtotal := round(v_precio_unit * v_cant, 2);
      v_refund_total := v_refund_total + v_subtotal;

      insert into public.devolucion_items (
        devolucion_id, venta_item_id, producto_calzado_id, producto_varios_id,
        cantidad, precio_unitario, subtotal, cambio_talla_color_id,
        precio_reemplazo, precio_minimo_snapshot, precio_maximo_snapshot
      ) values (
        v_devolucion_id, v_vi_id, v_calzado_id, v_varios_id,
        v_cant, v_precio_unit, v_subtotal, null, null, null, null
      );
    end if;
  end loop;

  if p_tipo_devolucion = 'cambio' then
    if v_diff_total > 0 then v_exp_cobrado := v_diff_total; v_exp_devuelto := 0.00;
    elsif v_diff_total < 0 then v_exp_devuelto := -v_diff_total; v_exp_cobrado := 0.00;
    else v_exp_devuelto := 0.00; v_exp_cobrado := 0.00; end if;
  else
    v_exp_devuelto := v_refund_total; v_exp_cobrado := 0.00;
  end if;

  if coalesce(p_monto_devuelto,0.00) <> v_exp_devuelto then
    raise exception 'Monto a reembolsar (%) no coincide con lo esperado (%)', p_monto_devuelto, v_exp_devuelto; end if;
  if coalesce(p_monto_cobrado,0.00) <> v_exp_cobrado then
    raise exception 'Monto a cobrar (%) no coincide con lo esperado (%)', p_monto_cobrado, v_exp_cobrado; end if;
  if v_exp_devuelto > 0 and (p_metodo_reembolso is null or p_metodo_reembolso not in ('efectivo','nequi','bre_b','otro')) then
    raise exception 'Falta método de reembolso'; end if;
  if v_exp_cobrado > 0 and (p_metodo_cobro is null or p_metodo_cobro not in ('efectivo','nequi','bre_b','otro')) then
    raise exception 'Falta método de cobro'; end if;

  select coalesce(sum(cantidad),0.000) into v_vendido
    from public.venta_items where venta_id = p_venta_id;
  select coalesce(sum(di.cantidad),0.000) into v_movido
    from public.devolucion_items di join public.devoluciones d on d.id = di.devolucion_id
    where d.venta_id = p_venta_id;
  select count(*) = 0 into v_todas_cambio
    from public.devoluciones where venta_id = p_venta_id and tipo_devolucion <> 'cambio';

  if v_movido >= v_vendido then
    update public.ventas set estado = case when v_todas_cambio then 'cambiada_total' else 'devuelta_total' end
      where id = p_venta_id;
  else
    update public.ventas set estado = case when v_todas_cambio then 'cambiada_parcial' else 'devuelta_parcial' end
      where id = p_venta_id;
  end if;

  return jsonb_build_object('devolucion_id', v_devolucion_id);
end;
$function$;
