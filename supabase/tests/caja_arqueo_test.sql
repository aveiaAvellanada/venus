-- Test del arqueo de caja (revisión 2026-10-09, punto 11):
--   - La caja abre con una base (la predeterminada de caja_config, o la que
--     se indique al abrir; la apertura automática toma la predeterminada).
--   - Los gastos variables marcados "pagado_de_caja" se restan del efectivo
--     esperado; solo se pueden registrar/mover con la caja del día abierta.
--   - Efectivo esperado = base + efectivo de ventas − gastos del cajón, y el
--     cierre guarda ese desglose (también en las reaperturas).
--
-- Corre en una transacción. Éxito = termina con el error ARQUEO_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/caja_arqueo_test.sql

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

grant execute on function pg_temp.error_de(text), pg_temp.como(uuid) to authenticated;

do $$
declare
  v_dueno uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_emp   uuid := gen_random_uuid();
  v_hoy date;
  v_prov uuid; v_zapato uuid; v_gasto uuid;
  v_caja public.cierres_caja;
  v_arq json;
  v_ef_ventas numeric; v_esperado numeric;
  v_n bigint; v_err text;
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

  v_hoy := private.hoy_bogota();
  delete from public.cierres_caja_reaperturas where fecha = v_hoy;
  delete from public.cierres_caja where fecha = v_hoy;
  delete from public.gastos_variables where fecha = v_hoy and pagado_de_caja;
  update public.caja_config set modo_cierre = 'con_diferencia', base_predeterminada = 50000;

  -- ===== Base de caja =====
  perform pg_temp.como(v_emp);
  if public.obtener_base_predeterminada() <> 50000 then
    raise exception 'FALLO base: el empleado no ve la base predeterminada para abrir';
  end if;
  v_caja := public.abrir_caja();
  if v_caja.base_inicial <> 50000 then
    raise exception 'FALLO base: abrir sin base no tomó la predeterminada (%)', v_caja.base_inicial;
  end if;

  execute 'reset role';
  delete from public.cierres_caja where fecha = v_hoy;
  perform pg_temp.como(v_emp);
  if pg_temp.error_de('select public.abrir_caja(p_base_inicial => -1)') not like '%base%' then
    raise exception 'FALLO base: se aceptó una base negativa';
  end if;
  v_caja := public.abrir_caja(p_base_inicial => 80000);
  if v_caja.base_inicial <> 80000 then
    raise exception 'FALLO base: no se guardó la base indicada al abrir (%)', v_caja.base_inicial;
  end if;

  -- Apertura automática (caja-scheduler, escribe directo sin base)
  execute 'reset role';
  delete from public.cierres_caja where fecha = v_hoy;
  insert into public.cierres_caja (fecha, estado, modo, apertura_at)
    values (v_hoy, 'abierta', 'automatico', now()) returning * into v_caja;
  if v_caja.base_inicial <> 50000 then
    raise exception 'FALLO base: la apertura automática no tomó la base predeterminada';
  end if;

  -- ===== Gastos pagados con plata del cajón =====
  perform pg_temp.como(v_emp);
  perform public.registrar_venta(
    jsonb_build_array(jsonb_build_object('tipo', 'calzado', 'producto_id', v_zapato, 'cantidad', 1, 'precio', 90000)),
    jsonb_build_array(jsonb_build_object('metodo', 'efectivo', 'monto', 90000)), 100000);
  insert into public.gastos_variables (descripcion, monto, categoria, fecha, pagado_de_caja)
    values ('Flete', 20000, 'transporte', v_hoy, true) returning id into v_gasto;
  insert into public.gastos_variables (descripcion, monto, categoria, fecha, pagado_de_caja)
    values ('Repuesto pagado por Nequi', 5000, 'reparaciones', v_hoy, false);
  v_err := pg_temp.error_de(format(
    $f$insert into public.gastos_variables (descripcion, monto, categoria, fecha, pagado_de_caja)
       values ('Ayer', 1000, 'otros', %L, true)$f$, v_hoy - 1));
  if v_err not like '%fecha de hoy%' then
    raise exception 'FALLO gastos: se registró un gasto del cajón con otra fecha (%)', v_err;
  end if;

  v_ef_ventas := (public.obtener_resumen_dia(v_hoy)->>'total_efectivo')::numeric;
  v_esperado := 50000 + v_ef_ventas - 20000;
  v_arq := public.obtener_arqueo_caja();
  if (v_arq->>'base_inicial')::numeric <> 50000 or (v_arq->>'efectivo_ventas')::numeric <> v_ef_ventas
     or (v_arq->>'gastos_caja')::numeric <> 20000 or (v_arq->>'efectivo_esperado')::numeric <> v_esperado then
    raise exception 'FALLO arqueo: desglose incorrecto %', v_arq;
  end if;

  -- Contar exactamente lo esperado cuadra (sin justificación)
  v_caja := public.cerrar_caja(v_esperado, null);
  if v_caja.diferencia <> 0 or v_caja.base_inicial <> 50000 or v_caja.gastos_caja <> 20000
     or v_caja.total_efectivo <> v_ef_ventas then
    raise exception 'FALLO arqueo: el cierre no usó base y gastos: %', row_to_json(v_caja);
  end if;

  -- ===== Con la caja cerrada no se mueve plata del cajón =====
  v_err := pg_temp.error_de(format(
    $f$insert into public.gastos_variables (descripcion, monto, categoria, fecha, pagado_de_caja)
       values ('Tarde', 3000, 'otros', %L, true)$f$, v_hoy));
  if v_err not like '%caja%' then
    raise exception 'FALLO gastos: se registró un gasto del cajón con la caja cerrada (%)', v_err;
  end if;
  if pg_temp.error_de(format(
      $f$insert into public.gastos_variables (descripcion, monto, categoria, fecha, pagado_de_caja)
         values ('Transferencia', 3000, 'otros', %L, false)$f$, v_hoy)) <> '' then
    raise exception 'FALLO gastos: un gasto que no sale del cajón no depende de la caja';
  end if;
  perform pg_temp.como(v_admin);
  if pg_temp.error_de(format('delete from public.gastos_variables where id = %L', v_gasto)) not like '%caja%' then
    raise exception 'FALLO gastos: se borró un gasto del cajón con la caja ya cerrada';
  end if;

  -- ===== Reabrir conserva el arqueo deshecho =====
  v_caja := public.reabrir_caja();
  select count(*) into v_n from public.cierres_caja_reaperturas
    where cierre_id = v_caja.id and base_inicial = 50000 and gastos_caja = 20000 and diferencia = 0;
  if v_n <> 1 then
    raise exception 'FALLO arqueo: la reapertura no guardó base y gastos del cierre deshecho';
  end if;
  if v_caja.base_inicial <> 50000 then
    raise exception 'FALLO base: reabrir cambió la base del día';
  end if;
  update public.gastos_variables set monto = 25000 where id = v_gasto;
  if (public.obtener_arqueo_caja()->>'gastos_caja')::numeric <> 25000 then
    raise exception 'FALLO arqueo: corregir un gasto del cajón con la caja abierta no se reflejó';
  end if;

  raise exception 'ARQUEO_OK_ROLLBACK';
end $$;

rollback;
