-- Dashboard (rediseño paso 5a): agregación de ventas por sub-período (gráfico)
-- y gastos del período (fijos + variables mezclados). Solo lectura, no crea tablas.
-- Gate: private.is_staff_admin() — los empleados operativos no ven históricos (PRD §2);
-- su dashboard usa obtener_resumen_dia.

-- 1) Ventas netas por sub-período (día / semana ISO / mes), buckets en cero incluidos.
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
        when 'dia' then (v.created_at at time zone 'America/Bogota')::date
        when 'semana' then date_trunc('week', (v.created_at at time zone 'America/Bogota'))::date
        else date_trunc('month', (v.created_at at time zone 'America/Bogota'))::date
      end as inicio,
      sum(d.monto_devuelto) as devuelto,
      sum(d.monto_cobrado) as cobrado
    from public.devoluciones d
    join public.ventas v on v.id = d.venta_id
    where (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
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

revoke all on function public.obtener_ventas_por_subperiodo(date, date, text) from public;
grant execute on function public.obtener_ventas_por_subperiodo(date, date, text) to authenticated;

-- 2) Gastos del período: fijos (pagos registrados) + variables, mezclados y con total.
create or replace function public.obtener_gastos_periodo(
  p_desde date,
  p_hasta date
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gastos json;
  v_total numeric;
begin
  if not private.is_staff_admin() then
    raise exception 'No autorizado para ver gastos';
  end if;

  with todos as (
    select
      'fijo'::text as tipo,
      gf.nombre as nombre,
      gfp.periodo as detalle,
      gfp.monto_pagado as monto,
      gfp.fecha_pago as fecha
    from public.gastos_fijos_pagos gfp
    join public.gastos_fijos gf on gf.id = gfp.gasto_fijo_id
    where gfp.fecha_pago between p_desde and p_hasta
    union all
    select
      'variable'::text as tipo,
      gv.descripcion as nombre,
      gv.categoria as detalle,
      gv.monto as monto,
      gv.fecha as fecha
    from public.gastos_variables gv
    where gv.fecha between p_desde and p_hasta
  )
  select
    coalesce(json_agg(json_build_object(
      'tipo', t.tipo,
      'nombre', t.nombre,
      'detalle', t.detalle,
      'monto', t.monto,
      'fecha', t.fecha
    ) order by t.fecha desc, t.nombre), '[]'::json),
    coalesce(sum(t.monto), 0)
  into v_gastos, v_total
  from todos t;

  return json_build_object('total', v_total, 'gastos', v_gastos);
end;
$$;

revoke all on function public.obtener_gastos_periodo(date, date) from public;
grant execute on function public.obtener_gastos_periodo(date, date) to authenticated;
