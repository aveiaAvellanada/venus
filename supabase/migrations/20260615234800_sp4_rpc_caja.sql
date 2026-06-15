create or replace function public.obtener_resumen_dia(p_fecha date)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_ventas int := 0;
  v_total_general numeric := 0;
  v_total_efectivo numeric := 0;
  v_total_nequi numeric := 0;
  v_total_daviplata numeric := 0;
begin
  -- Contar ventas completadas y sumar el total general
  select 
    count(id),
    coalesce(sum(total), 0)
  into 
    v_total_ventas,
    v_total_general
  from public.ventas
  where estado = 'completada'
    and (created_at at time zone 'America/Bogota')::date = p_fecha;

  -- Sumar por método de pago para las ventas completadas de esa fecha
  select 
    coalesce(sum(case when m.metodo = 'efectivo' then m.monto else 0 end), 0),
    coalesce(sum(case when m.metodo = 'nequi' then m.monto else 0 end), 0),
    coalesce(sum(case when m.metodo = 'daviplata' then m.monto else 0 end), 0)
  into 
    v_total_efectivo,
    v_total_nequi,
    v_total_daviplata
  from public.metodos_pago_venta m
  join public.ventas v on v.id = m.venta_id
  where v.estado = 'completada'
    and (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  return json_build_object(
    'total_ventas', v_total_ventas,
    'total_general', v_total_general,
    'total_efectivo', v_total_efectivo,
    'total_nequi', v_total_nequi,
    'total_daviplata', v_total_daviplata
  );
end;
$$;

grant execute on function public.obtener_resumen_dia(date) to authenticated;
