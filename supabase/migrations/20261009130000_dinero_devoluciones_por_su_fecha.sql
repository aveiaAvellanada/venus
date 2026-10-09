-- Dinero 1/3: una devolución cuenta en el día en que se hace, no en el de la venta.
--
-- Las cinco RPC de caja, balance y reportes filtraban las devoluciones por la
-- fecha de la VENTA original (v.created_at). Si hoy se devolvía en efectivo una
-- venta de la semana pasada, la caja de hoy no restaba ese dinero (el cierre
-- salía con faltante) y el balance/reportes de la semana pasada cambiaban
-- después de cerrados. Ahora se filtran por d.created_at, igual que la lista
-- de Movimientos. Fuera de ese filtro, las funciones quedan idénticas a sus
-- versiones vigentes (20260620002823 y 20260716000000); create or replace
-- conserva sus permisos.

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
  where (d.created_at at time zone 'America/Bogota')::date = p_fecha;

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
  where (d.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

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
  from public.devoluciones d
  where (d.created_at at time zone 'America/Bogota')::date = p_fecha;

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
  where (d.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

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
    where (d.created_at at time zone 'America/Bogota')::date between v_prev_desde and v_prev_hasta
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
    select (d2.created_at at time zone 'America/Bogota')::date as d,
           sum(d2.monto_devuelto) as r, sum(d2.monto_cobrado) as c
    from public.devoluciones d2
    where (d2.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
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


create or replace function public.obtener_ventas_por_subperiodo(
  p_desde date,
  p_hasta date,
  p_granularidad text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
  v_paso interval;
  v_resultado json;
begin
  if not private.is_staff_admin() then
    raise exception 'No autorizado para ver reportes';
  end if;

  if p_granularidad not in ('dia','semana','mes') then
    raise exception 'Granularidad inválida: %. Usa dia, semana o mes.', p_granularidad;
  end if;

  v_paso := case p_granularidad
    when 'dia' then interval '1 day'
    when 'semana' then interval '1 week'
    else interval '1 month'
  end;

  with buckets as (
    select g::date as inicio
    from generate_series(
      case p_granularidad
        when 'dia' then p_desde::timestamp
        when 'semana' then date_trunc('week', p_desde::timestamp)
        else date_trunc('month', p_desde::timestamp)
      end,
      p_hasta::timestamp,
      v_paso
    ) g
  ),
  pagos as (
    select
      case p_granularidad
        when 'dia' then (v.created_at at time zone 'America/Bogota')::date
        when 'semana' then date_trunc('week', (v.created_at at time zone 'America/Bogota'))::date
        else date_trunc('month', (v.created_at at time zone 'America/Bogota'))::date
      end as inicio,
      sum(m.monto) as bruto,
      count(distinct v.id) as num_ventas
    from public.metodos_pago_venta m
    join public.ventas v on v.id = m.venta_id
    where v.estado = any(v_estados)
      and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by 1
  ),
  devs as (
    select
      case p_granularidad
        when 'dia' then (d.created_at at time zone 'America/Bogota')::date
        when 'semana' then date_trunc('week', (d.created_at at time zone 'America/Bogota'))::date
        else date_trunc('month', (d.created_at at time zone 'America/Bogota'))::date
      end as inicio,
      sum(d.monto_devuelto) as devuelto,
      sum(d.monto_cobrado) as cobrado
    from public.devoluciones d
    where (d.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by 1
  )
  select coalesce(json_agg(json_build_object(
           'inicio', b.inicio,
           'total', coalesce(p.bruto, 0) - coalesce(d.devuelto, 0) + coalesce(d.cobrado, 0),
           'num_ventas', coalesce(p.num_ventas, 0)
         ) order by b.inicio), '[]'::json)
  into v_resultado
  from buckets b
  left join pagos p on p.inicio = b.inicio
  left join devs d on d.inicio = b.inicio;

  return v_resultado;
end;
$$;
