-- M12 Dashboard: RPC de widgets solo-dueño (proveedores por vencer + empleados sin actividad hoy).
-- Solo dueño, solo lectura. No crea tablas.

create or replace function public.obtener_dashboard_dueno(p_dias_alerta int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_prov json;
  v_emp json;
begin
  if not private.is_owner() then
    raise exception 'Solo el dueño puede ver el dashboard financiero';
  end if;

  -- Proveedores con pago por vencer (compras a crédito con saldo, dentro de ventana o vencidas)
  select coalesce(json_agg(t order by t.fecha_vencimiento), '[]'::json) into v_prov
  from (
    select p.nombre as proveedor,
           c.fecha_vencimiento,
           c.saldo_pendiente as saldo,
           (c.fecha_vencimiento < v_hoy) as vencida
    from public.compras c
    join public.proveedores p on p.id = c.proveedor_id
    where c.condicion_pago = 'credito'
      and c.estado = 'completada'
      and c.saldo_pendiente > 0
      and c.fecha_vencimiento is not null
      and c.fecha_vencimiento <= (v_hoy + p_dias_alerta)
  ) t;

  -- Empleados activos sin ninguna actividad hoy (venta, cierre, o día trabajado manual)
  select coalesce(
           json_agg(json_build_object('id', u.id, 'nombre', u.nombre) order by u.nombre),
           '[]'::json) into v_emp
  from public.empleado_config ec
  join public.users u on u.id = ec.empleado_id
  where ec.activo = true
    and not exists (
      select 1 from public.ventas v
      where v.created_by = ec.empleado_id
        and (v.created_at at time zone 'America/Bogota')::date = v_hoy)
    and not exists (
      select 1 from public.cierres_caja cc
      where (cc.created_by = ec.empleado_id or cc.cerrado_por = ec.empleado_id)
        and cc.fecha = v_hoy)
    and not exists (
      select 1 from public.empleado_dias_trabajados d
      where d.empleado_id = ec.empleado_id
        and d.fecha = v_hoy
        and d.tipo in ('trabajado','adicional'));

  return json_build_object(
    'proveedores_por_vencer', v_prov,
    'empleados_sin_actividad', v_emp
  );
end;
$$;

revoke all on function public.obtener_dashboard_dueno(int) from public;
grant execute on function public.obtener_dashboard_dueno(int) to authenticated;
