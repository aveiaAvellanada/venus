-- M12 it.2: RPC de reporte de período (semana/mes), staff_admin, solo lectura. No crea tablas.

create or replace function public.obtener_reporte_periodo(p_desde date, p_hasta date)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
  v_largo int := (p_hasta - p_desde) + 1;
  v_prev_desde date := p_desde - v_largo;
  v_prev_hasta date := p_desde - 1;
  v_ef numeric := 0; v_ne numeric := 0; v_da numeric := 0;
  v_num int := 0;
  v_total numeric; v_total_ant numeric;
  v_dia_top json; v_top json; v_sinmov json;
begin
  if not private.is_staff_admin() then
    raise exception 'No autorizado para ver reportes';
  end if;

  -- Pagos brutos del período, por método
  select
    coalesce(sum(case when m.metodo='efectivo' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='nequi' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='daviplata' then m.monto else 0 end),0)
  into v_ef, v_ne, v_da
  from public.metodos_pago_venta m
  join public.ventas v on v.id = m.venta_id
  where v.estado = any(v_estados)
    and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  -- Netear devoluciones por método (por fecha de la venta)
  select
    v_ef - coalesce(sum(case when metodo_reembolso='efectivo'  then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='efectivo'      then monto_cobrado  else 0 end),0),
    v_ne - coalesce(sum(case when metodo_reembolso='nequi'     then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='nequi'         then monto_cobrado  else 0 end),0),
    v_da - coalesce(sum(case when metodo_reembolso='daviplata' then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='daviplata'     then monto_cobrado  else 0 end),0)
  into v_ef, v_ne, v_da
  from public.devoluciones d
  join public.ventas v on v.id = d.venta_id
  where (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  v_total := v_ef + v_ne + v_da;

  -- Nº de ventas del período
  select count(*) into v_num
  from public.ventas v
  where v.estado = any(v_estados)
    and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  -- Total neto del período anterior (mismo largo) para comparación
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

  -- Día con más ventas (neto) del período
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

  -- Top 10 productos por unidades brutas
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

  -- Calzado activo sin movimiento en el período
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
    'efectivo', v_ef, 'nequi', v_ne, 'daviplata', v_da,
    'dia_top', v_dia_top,
    'top_productos', v_top,
    'sin_movimiento', v_sinmov
  );
end;
$$;

revoke all on function public.obtener_reporte_periodo(date, date) from public;
grant execute on function public.obtener_reporte_periodo(date, date) to authenticated;
