-- M11 Balance: RPC de agregación de flujo de caja del período (solo dueño, solo lectura).
-- No crea tablas.

create or replace function public.obtener_balance(p_desde date, p_hasta date)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ef numeric := 0; v_ne numeric := 0; v_da numeric := 0;
  v_reemb numeric := 0; v_cobros numeric := 0;
  v_gf numeric := 0; v_gv numeric := 0; v_prov numeric := 0; v_sueldos numeric := 0;
  v_ing_neto numeric; v_egr numeric;
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
begin
  if not private.is_owner() then
    raise exception 'Solo el dueño puede ver el balance';
  end if;

  -- Ingresos: pagos de ventas, atribuidos por la fecha de la VENTA
  select
    coalesce(sum(case when m.metodo='efectivo' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='nequi' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='daviplata' then m.monto else 0 end),0)
  into v_ef, v_ne, v_da
  from public.metodos_pago_venta m
  join public.ventas v on v.id = m.venta_id
  where v.estado = any(v_estados)
    and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  -- Devoluciones: por la fecha de la VENTA original (consistente con obtener_resumen_dia)
  select coalesce(sum(d.monto_devuelto),0), coalesce(sum(d.monto_cobrado),0)
  into v_reemb, v_cobros
  from public.devoluciones d
  join public.ventas v on v.id = d.venta_id
  where (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  -- Egresos: cada uno por su propia fecha de pago (base caja)
  select coalesce(sum(monto_pagado),0) into v_gf
  from public.gastos_fijos_pagos where fecha_pago between p_desde and p_hasta;

  select coalesce(sum(monto),0) into v_gv
  from public.gastos_variables where fecha between p_desde and p_hasta;

  select coalesce(sum(monto),0) into v_prov
  from public.compra_pagos where fecha between p_desde and p_hasta;

  select coalesce(sum(monto),0) into v_sueldos
  from public.empleado_pagos where fecha_pago between p_desde and p_hasta;

  v_ing_neto := v_ef + v_ne + v_da - v_reemb + v_cobros;
  v_egr := v_gf + v_gv + v_prov + v_sueldos;

  return json_build_object(
    'ingresos', json_build_object(
      'efectivo', v_ef, 'nequi', v_ne, 'daviplata', v_da,
      'reembolsos', v_reemb, 'cobros_cambios', v_cobros, 'total_neto', v_ing_neto),
    'egresos', json_build_object(
      'gastos_fijos', v_gf, 'gastos_variables', v_gv,
      'pagos_proveedores', v_prov, 'sueldos', v_sueldos, 'total', v_egr),
    'balance', v_ing_neto - v_egr
  );
end;
$$;

revoke all on function public.obtener_balance(date, date) from public;
grant execute on function public.obtener_balance(date, date) to authenticated;
