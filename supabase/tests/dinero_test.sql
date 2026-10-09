-- Test de los bugs de dinero (revisión 2026-10-09, puntos 7–9):
--   7. Una devolución cuenta en el día en que se hace (caja, balance y
--      reportes), no en el día de la venta original.
--   8. Reintentar registrar_venta con la misma clave no duplica la venta ni
--      descuenta stock dos veces.
--   9. Vender o devolver exige la caja del día abierta, y el precio del
--      calzado debe estar dentro de su rango mínimo–máximo (PRD §3.1.1).
--
-- Corre en una transacción. Éxito = termina con el error DINERO_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/dinero_test.sql

begin;

create function pg_temp.error_de(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return '';
exception when others then
  return sqlerrm;
end $$;

create function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- Venta de un ítem pagada toda en efectivo (sql listo para error_de / execute).
create function pg_temp.sql_venta(p_tipo text, p_id uuid, p_cant numeric, p_precio numeric, p_clave uuid default null)
returns text language sql as $$
  select format(
    'select public.registrar_venta(p_items => %L, p_pagos => %L, p_efectivo_recibido => %s%s)',
    jsonb_build_array(jsonb_build_object('tipo', p_tipo, 'producto_id', p_id, 'cantidad', p_cant, 'precio', p_precio)),
    jsonb_build_array(jsonb_build_object('metodo', 'efectivo', 'monto', round(p_cant * p_precio, 2))),
    round(p_cant * p_precio, 2),
    case when p_clave is null then '' else format(', p_clave_idempotencia => %L', p_clave) end)
$$;

grant execute on function pg_temp.error_de(text), pg_temp.como(uuid),
  pg_temp.sql_venta(text, uuid, numeric, numeric, uuid) to authenticated;

do $$
declare
  v_dueno uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_emp   uuid := gen_random_uuid();
  v_clave uuid := gen_random_uuid();
  v_hoy date; v_ayer date;
  v_prov uuid; v_zapato uuid; v_huevos uuid;
  v_r1 jsonb; v_r2 jsonb; v_r3 jsonb;
  v_venta_ayer uuid; v_item uuid; v_item_hoy uuid;
  v_stock int; v_n bigint; v_err text;
  -- antes (a_) y después (d_) de la devolución, para hoy y ayer
  a_res_hoy json; a_res_ayer json; d_res_hoy json; d_res_ayer json;
  a_bal_hoy json; a_bal_ayer json; d_bal_hoy json; d_bal_ayer json;
  a_dia_hoy json; a_dia_ayer json; d_dia_hoy json; d_dia_ayer json;
  a_per_hoy json; a_per_ayer json; d_per_hoy json; d_per_ayer json;
  a_sub_hoy json; a_sub_ayer json; d_sub_hoy json; d_sub_ayer json;
begin
  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) values
    (v_dueno, 'dueno@test.venus', '{"provider":"email"}', '{}', 'authenticated', 'authenticated'),
    (v_admin, 'admin@test.venus', '{"provider":"email"}', '{}', 'authenticated', 'authenticated'),
    (v_emp,   'emp@test.venus',   '{"provider":"email"}', '{}', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, email) values
    (v_dueno, 'Dueño Test', 'dueno', 'dueno@test.venus'),
    (v_admin, 'Admin Test', 'admin', 'admin@test.venus'),
    (v_emp,   'Empleado Test', 'empleado', 'emp@test.venus');
  insert into public.proveedores (nombre) values ('Proveedor Test') returning id into v_prov;
  insert into public.productos_calzado
    (descripcion, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo, proveedor_id)
    values ('Zapato Test', 'Deportivo', '40', 'Negro', 80000, 100000, 10, 1, v_prov)
    returning id into v_zapato;
  insert into public.productos_varios (nombre, unidad_medida) values ('Huevos Test', 'Panel')
    returning id into v_huevos;

  v_hoy := private.hoy_bogota();
  v_ayer := v_hoy - 1;
  delete from public.cierres_caja_reaperturas where fecha = v_hoy;
  delete from public.cierres_caja where fecha = v_hoy;

  -- ===== 9. Sin caja abierta no se vende =====
  perform pg_temp.como(v_emp);
  v_err := pg_temp.error_de(pg_temp.sql_venta('calzado', v_zapato, 1, 90000));
  if v_err not like '%caja%' then
    raise exception 'FALLO 9: se registró una venta sin caja abierta (%)', v_err;
  end if;
  perform public.abrir_caja();

  -- ===== 9. Precio del calzado dentro del rango =====
  v_err := pg_temp.error_de(pg_temp.sql_venta('calzado', v_zapato, 1, 79999));
  if v_err not like '%entre%' then
    raise exception 'FALLO 9: se vendió calzado por debajo del mínimo (%)', v_err;
  end if;
  v_err := pg_temp.error_de(pg_temp.sql_venta('calzado', v_zapato, 1, 100001));
  if v_err not like '%entre%' then
    raise exception 'FALLO 9: se vendió calzado por encima del máximo (%)', v_err;
  end if;
  if pg_temp.error_de(pg_temp.sql_venta('calzado', v_zapato, 1, 80000)) <> ''
     or pg_temp.error_de(pg_temp.sql_venta('calzado', v_zapato, 1, 100000)) <> '' then
    raise exception 'FALLO 9: los extremos del rango deben ser vendibles';
  end if;
  if pg_temp.error_de(pg_temp.sql_venta('varios', v_huevos, 0.5, 1234)) <> '' then
    raise exception 'FALLO 9: Granja no tiene rango; cualquier precio positivo vale';
  end if;

  -- ===== 8. Reintento con la misma clave =====
  execute 'reset role';
  select stock_actual into v_stock from public.productos_calzado where id = v_zapato;
  perform pg_temp.como(v_emp);
  execute pg_temp.sql_venta('calzado', v_zapato, 1, 90000, v_clave) into v_r1;
  execute pg_temp.sql_venta('calzado', v_zapato, 1, 90000, v_clave) into v_r2;
  if v_r1->>'venta_id' is distinct from v_r2->>'venta_id' or v_r1->>'numero' is distinct from v_r2->>'numero' then
    raise exception 'FALLO 8: el reintento creó otra venta (% / %)', v_r1, v_r2;
  end if;
  if coalesce((v_r1->>'repetida')::boolean, false) or not coalesce((v_r2->>'repetida')::boolean, false) then
    raise exception 'FALLO 8: la respuesta no distingue la venta nueva de la repetida (% / %)', v_r1, v_r2;
  end if;
  execute 'reset role';
  if (select stock_actual from public.productos_calzado where id = v_zapato) <> v_stock - 1 then
    raise exception 'FALLO 8: el reintento descontó stock dos veces';
  end if;
  select count(*) into v_n from public.ventas where clave_idempotencia = v_clave;
  if v_n <> 1 then
    raise exception 'FALLO 8: hay % ventas con la misma clave', v_n;
  end if;
  select count(*) into v_n from public.metodos_pago_venta where venta_id = (v_r1->>'venta_id')::uuid;
  if v_n <> 1 then
    raise exception 'FALLO 8: el reintento duplicó los pagos';
  end if;
  perform pg_temp.como(v_emp);
  execute pg_temp.sql_venta('calzado', v_zapato, 1, 90000, gen_random_uuid()) into v_r3;
  if v_r3->>'venta_id' = v_r1->>'venta_id' then
    raise exception 'FALLO 8: otra clave debe crear otra venta';
  end if;
  -- La app anterior (sin clave) sigue funcionando
  execute pg_temp.sql_venta('calzado', v_zapato, 1, 90000) into v_r3;
  if v_r3->>'venta_id' is null then
    raise exception 'FALLO 8: registrar_venta sin clave dejó de funcionar';
  end if;

  -- ===== 7. Devolución hoy de una venta de ayer =====
  execute 'reset role';
  insert into public.ventas (vendedor_id, total, monto_pagado, saldo_pendiente, estado, created_at)
    values (v_emp, 100000, 100000, 0, 'completada', now() - interval '1 day')
    returning id into v_venta_ayer;
  insert into public.venta_items (venta_id, tipo_producto, producto_calzado_id, descripcion_snapshot,
      cantidad, precio_unitario, subtotal)
    values (v_venta_ayer, 'calzado', v_zapato, 'Zapato Test', 1, 100000, 100000)
    returning id into v_item;
  insert into public.metodos_pago_venta (venta_id, metodo, monto) values (v_venta_ayer, 'efectivo', 100000);

  perform pg_temp.como(v_dueno);
  a_res_hoy := public.obtener_resumen_dia(v_hoy);       a_res_ayer := public.obtener_resumen_dia(v_ayer);
  a_bal_hoy := public.obtener_balance(v_hoy, v_hoy);    a_bal_ayer := public.obtener_balance(v_ayer, v_ayer);
  a_dia_hoy := public.obtener_reporte_diario(v_hoy);    a_dia_ayer := public.obtener_reporte_diario(v_ayer);
  a_per_hoy := public.obtener_reporte_periodo(v_hoy, v_hoy);
  a_per_ayer := public.obtener_reporte_periodo(v_ayer, v_ayer);
  a_sub_hoy := public.obtener_ventas_por_subperiodo(v_hoy, v_hoy, 'dia');
  a_sub_ayer := public.obtener_ventas_por_subperiodo(v_ayer, v_ayer, 'dia');

  perform pg_temp.como(v_admin);
  perform public.registrar_devolucion(v_venta_ayer, 'No le quedó', 'total', 'efectivo', null, 100000, 0,
    jsonb_build_array(jsonb_build_object('venta_item_id', v_item, 'cantidad', 1)));

  perform pg_temp.como(v_dueno);
  d_res_hoy := public.obtener_resumen_dia(v_hoy);       d_res_ayer := public.obtener_resumen_dia(v_ayer);
  d_bal_hoy := public.obtener_balance(v_hoy, v_hoy);    d_bal_ayer := public.obtener_balance(v_ayer, v_ayer);
  d_dia_hoy := public.obtener_reporte_diario(v_hoy);    d_dia_ayer := public.obtener_reporte_diario(v_ayer);
  d_per_hoy := public.obtener_reporte_periodo(v_hoy, v_hoy);
  d_per_ayer := public.obtener_reporte_periodo(v_ayer, v_ayer);
  d_sub_hoy := public.obtener_ventas_por_subperiodo(v_hoy, v_hoy, 'dia');
  d_sub_ayer := public.obtener_ventas_por_subperiodo(v_ayer, v_ayer, 'dia');

  if (d_res_hoy->>'total_efectivo')::numeric <> (a_res_hoy->>'total_efectivo')::numeric - 100000
     or (d_res_hoy->>'total_general')::numeric <> (a_res_hoy->>'total_general')::numeric - 100000 then
    raise exception 'FALLO 7: el reembolso de hoy no se resta de la caja de hoy (% → %)', a_res_hoy, d_res_hoy;
  end if;
  if (d_res_ayer->>'total_efectivo')::numeric <> (a_res_ayer->>'total_efectivo')::numeric
     or (d_res_ayer->>'total_general')::numeric <> (a_res_ayer->>'total_general')::numeric then
    raise exception 'FALLO 7: el reembolso de hoy cambió la caja de ayer (% → %)', a_res_ayer, d_res_ayer;
  end if;
  if (d_bal_hoy->'ingresos'->>'reembolsos')::numeric <> (a_bal_hoy->'ingresos'->>'reembolsos')::numeric + 100000
     or (d_bal_ayer->>'balance')::numeric <> (a_bal_ayer->>'balance')::numeric then
    raise exception 'FALLO 7: el balance no ubica el reembolso en su fecha (ayer % → %)', a_bal_ayer, d_bal_ayer;
  end if;
  if (d_dia_hoy->>'efectivo')::numeric <> (a_dia_hoy->>'efectivo')::numeric - 100000
     or (d_dia_ayer->>'total_vendido')::numeric <> (a_dia_ayer->>'total_vendido')::numeric then
    raise exception 'FALLO 7: el reporte diario no ubica el reembolso en su fecha';
  end if;
  if (d_per_hoy->>'total_vendido')::numeric <> (a_per_hoy->>'total_vendido')::numeric - 100000
     or (d_per_ayer->>'total_vendido')::numeric <> (a_per_ayer->>'total_vendido')::numeric then
    raise exception 'FALLO 7: el reporte por período no ubica el reembolso en su fecha';
  end if;
  if (d_sub_hoy->0->>'total')::numeric <> (a_sub_hoy->0->>'total')::numeric - 100000
     or (d_sub_ayer->0->>'total')::numeric <> (a_sub_ayer->0->>'total')::numeric then
    raise exception 'FALLO 7: el gráfico por día no ubica el reembolso en su fecha';
  end if;

  -- ===== 9. Con la caja cerrada no se vende ni se devuelve =====
  execute 'reset role';
  update public.cierres_caja set estado = 'cerrada', cierre_at = now() where fecha = v_hoy;
  select id into v_item_hoy from public.venta_items where venta_id = (v_r1->>'venta_id')::uuid;

  perform pg_temp.como(v_emp);
  v_err := pg_temp.error_de(pg_temp.sql_venta('calzado', v_zapato, 1, 90000));
  if v_err not like '%caja%' then
    raise exception 'FALLO 9: se vendió con la caja cerrada (%)', v_err;
  end if;
  v_err := pg_temp.error_de(format(
    'select public.registrar_devolucion(%L, %L, %L, %L, null, 90000, 0, %L)',
    v_r1->>'venta_id', 'Talla', 'total', 'efectivo',
    jsonb_build_array(jsonb_build_object('venta_item_id', v_item_hoy, 'cantidad', 1))));
  if v_err not like '%caja%' then
    raise exception 'FALLO 9: se devolvió dinero con la caja cerrada (%)', v_err;
  end if;
  -- Un reintento de una venta que sí se guardó responde bien aunque ya se cerró
  execute pg_temp.sql_venta('calzado', v_zapato, 1, 90000, v_clave) into v_r2;
  if v_r2->>'venta_id' is distinct from v_r1->>'venta_id' then
    raise exception 'FALLO 8: el reintento tras el cierre no devolvió la venta guardada';
  end if;

  raise exception 'DINERO_OK_ROLLBACK';
end $$;

rollback;
