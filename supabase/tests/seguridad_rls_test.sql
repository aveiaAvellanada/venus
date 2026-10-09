-- Test de seguridad de la Data API (revisión 2026-10-09, puntos 1–4):
--   1. Ventas: nadie escribe ventas/ítems/pagos directo; solo las RPC.
--   2. Caja: abrir/cerrar/reabrir solo por RPC; totales y diferencia los
--      calcula el servidor; reabrir conserva el cierre anterior.
--   3. Costos, deudas y pagos a proveedores: solo el dueño (Sandra no).
--   4. Ninguna función de public es ejecutable por anon.
--
-- Corre en una transacción. Éxito = termina con el error SEGURIDAD_OK_ROLLBACK
-- (fuerza el rollback: no persiste nada). Cualquier "FALLO n: ..." es un hueco.
-- Local:  supabase/tests/local/run.sh supabase/tests/seguridad_rls_test.sql

begin;

-- Ejecuta p_sql con el rol vigente; true si no tuvo efecto (permiso/RLS
-- denegado o 0 filas). Otros errores se propagan: son errores del test.
create function pg_temp.sin_efecto(p_sql text) returns boolean language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n = 0;
exception when insufficient_privilege then
  return true;
end $$;

-- Ejecuta p_sql y devuelve el mensaje de error, o '' si no falló.
create function pg_temp.error_de(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return '';
exception when others then
  return sqlerrm;
end $$;

-- Impersona a un usuario de la app (rol authenticated + JWT con su id).
create function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- Las funciones nuevas ya no nacen ejecutables por PUBLIC (ver
-- 20261009120300_seguridad_rpc_sin_anon.sql): concesión explícita.
grant execute on function pg_temp.sin_efecto(text), pg_temp.error_de(text), pg_temp.como(uuid)
  to authenticated;

do $$
declare
  v_dueno uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_emp   uuid := gen_random_uuid();
  v_hoy   date;
  v_prov uuid; v_zapato uuid; v_venta uuid; v_item uuid;
  v_compra uuid; v_pendiente uuid; v_vacia uuid;
  v_caja public.cierres_caja;
  v_esperado numeric;
  v_n bigint; v_txt text;
begin
  -- Fixtures (como postgres)
  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role) values
    (v_dueno, 'dueno@test.venus', '{"provider":"email"}', '{}', 'authenticated', 'authenticated'),
    (v_admin, 'admin@test.venus', '{"provider":"email"}', '{}', 'authenticated', 'authenticated'),
    (v_emp,   'emp@test.venus',   '{"provider":"email"}', '{}', 'authenticated', 'authenticated');
  -- "admin" = empleado con la plantilla administrativa; "emp" = plantilla operativa.
  insert into public.users (id, nombre, rol, email, permisos) values
    (v_dueno, 'Dueño Test', 'dueno', 'dueno@test.venus', '{}'),
    (v_admin, 'Admin Test', 'empleado', 'admin@test.venus',
     array['ventas','devoluciones','inventario','recibir_mercancia','caja','gastos',
           'proveedores','gastos_fijos','reportes','carga_inicial']),
    (v_emp,   'Empleado Test', 'empleado', 'emp@test.venus',
     array['ventas','devoluciones','inventario','recibir_mercancia','caja','gastos']);
  insert into public.proveedores (nombre) values ('Proveedor Test') returning id into v_prov;
  insert into public.productos_calzado
    (descripcion, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo, proveedor_id)
    values ('Zapato Test', 'Deportivo', '40', 'Negro', 80000, 100000, 10, 1, v_prov)
    returning id into v_zapato;
  v_hoy := private.hoy_bogota();

  -- Vender exige la caja del día abierta (20261009130200).
  delete from public.cierres_caja_reaperturas where fecha = v_hoy;
  delete from public.cierres_caja where fecha = v_hoy;
  update public.caja_config set modo_cierre = 'con_diferencia';

  -- ===== 1. Ventas: solo vía RPC =====
  perform pg_temp.como(v_emp);
  perform public.abrir_caja();
  select (r->>'venta_id')::uuid into v_venta from (
    select public.registrar_venta(
      jsonb_build_array(jsonb_build_object('tipo', 'calzado', 'producto_id', v_zapato, 'cantidad', 2, 'precio', 90000)),
      jsonb_build_array(jsonb_build_object('metodo', 'efectivo', 'monto', 180000)),
      200000) as r) s;
  if v_venta is null then
    raise exception 'FALLO 1: el empleado no pudo registrar una venta por RPC';
  end if;

  if not pg_temp.sin_efecto(format('update public.ventas set estado = %L where id = %L', 'cancelada', v_venta)) then
    raise exception 'FALLO 1: un empleado puede cancelar una venta por la API';
  end if;
  if not pg_temp.sin_efecto(format('update public.ventas set total = 0 where id = %L', v_venta)) then
    raise exception 'FALLO 1: un empleado puede cambiar el total de una venta';
  end if;
  if not pg_temp.sin_efecto(format('insert into public.metodos_pago_venta (venta_id, metodo, monto) values (%L, %L, 1)', v_venta, 'nequi')) then
    raise exception 'FALLO 1: un empleado puede agregar pagos a una venta';
  end if;
  if not pg_temp.sin_efecto(format(
      $f$insert into public.venta_items (venta_id, tipo_producto, producto_calzado_id, descripcion_snapshot, cantidad, precio_unitario, subtotal)
         values (%L, 'calzado', %L, 'x', 1, 1, 1)$f$, v_venta, v_zapato)) then
    raise exception 'FALLO 1: un empleado puede agregar ítems a una venta';
  end if;
  if not pg_temp.sin_efecto(format(
      $f$insert into public.ventas (vendedor_id, total, monto_pagado, saldo_pendiente, estado)
         values (%L, 0, 0, 0, 'completada')$f$, v_emp)) then
    raise exception 'FALLO 1: un empleado puede crear ventas sin registrar_venta';
  end if;

  perform pg_temp.como(v_admin);
  if not pg_temp.sin_efecto(format('update public.ventas set estado = %L where id = %L', 'cancelada', v_venta)) then
    raise exception 'FALLO 1: la administrativa puede cancelar una venta por la API';
  end if;
  perform pg_temp.como(v_dueno);
  if not pg_temp.sin_efecto(format('update public.ventas set total = 0 where id = %L', v_venta)) then
    raise exception 'FALLO 1: el dueño puede editar una venta por fuera de las RPC';
  end if;

  -- Las RPC siguen funcionando: devolución parcial del empleado
  perform pg_temp.como(v_emp);
  select id into v_item from public.venta_items where venta_id = v_venta;
  perform public.registrar_devolucion(v_venta, 'Test', 'parcial', 'efectivo', null, 90000, 0,
    jsonb_build_array(jsonb_build_object('venta_item_id', v_item, 'cantidad', 1)));
  select count(*) into v_n from public.ventas where id = v_venta and estado = 'devuelta_parcial';
  if v_n <> 1 then
    raise exception 'FALLO 1: registrar_devolucion dejó de actualizar la venta';
  end if;

  -- ===== 2. Caja: solo vía RPC =====
  perform pg_temp.como(v_emp);
  v_caja := public.abrir_caja();
  if v_caja.estado <> 'abierta' or v_caja.fecha <> v_hoy then
    raise exception 'FALLO 2: abrir_caja no devolvió la caja abierta de hoy';
  end if;
  if (public.abrir_caja()).id <> v_caja.id then
    raise exception 'FALLO 2: abrir_caja dos veces creó otra caja';
  end if;

  if not pg_temp.sin_efecto(format('update public.cierres_caja set total_efectivo = 0 where id = %L', v_caja.id)) then
    raise exception 'FALLO 2: un empleado puede alterar los totales de la caja';
  end if;
  if not pg_temp.sin_efecto(format('update public.cierres_caja set estado = %L where id = %L', 'cerrada', v_caja.id)) then
    raise exception 'FALLO 2: un empleado puede cerrar la caja sin la RPC';
  end if;
  if not pg_temp.sin_efecto(format('insert into public.cierres_caja (fecha) values (%L)', v_hoy + 1)) then
    raise exception 'FALLO 2: un empleado puede insertar cierres de caja';
  end if;
  perform pg_temp.como(v_admin);
  if not pg_temp.sin_efecto(format('delete from public.cierres_caja where id = %L', v_caja.id)) then
    raise exception 'FALLO 2: la administrativa puede borrar cierres de caja';
  end if;

  perform pg_temp.como(v_emp);
  v_esperado := (public.obtener_resumen_dia(v_hoy)->>'total_efectivo')::numeric;
  if pg_temp.error_de('select public.cerrar_caja(null, null)') not like '%contar el efectivo%' then
    raise exception 'FALLO 2: se pudo cerrar sin contar el efectivo en modo con_diferencia';
  end if;
  if pg_temp.error_de(format('select public.cerrar_caja(%s, null)', v_esperado - 5000)) not like '%justificación%' then
    raise exception 'FALLO 2: se pudo cerrar con faltante sin justificación';
  end if;
  v_caja := public.cerrar_caja(v_esperado - 5000, '  Faltó sencillo ');
  if v_caja.estado <> 'cerrada' or v_caja.total_efectivo <> v_esperado or v_caja.diferencia <> -5000
     or v_caja.efectivo_contado <> v_esperado - 5000 or v_caja.cerrado_por is distinct from v_emp
     or v_caja.diferencia_nota is distinct from 'Faltó sencillo' then
    raise exception 'FALLO 2: cerrar_caja guardó un cierre incorrecto: %', row_to_json(v_caja);
  end if;
  if pg_temp.error_de('select public.cerrar_caja(0, null)') not like '%ya se cerró%' then
    raise exception 'FALLO 2: se pudo cerrar dos veces';
  end if;
  if pg_temp.error_de('select public.abrir_caja()') not like '%ya se cerró%' then
    raise exception 'FALLO 2: abrir_caja sobre una caja cerrada no avisó';
  end if;

  perform pg_temp.como(v_admin);
  v_caja := public.reabrir_caja();
  if v_caja.estado <> 'abierta' or v_caja.efectivo_contado is not null or v_caja.cerrado_por is not null then
    raise exception 'FALLO 2: reabrir_caja no dejó la caja abierta y limpia: %', row_to_json(v_caja);
  end if;
  select count(*) into v_n from public.cierres_caja_reaperturas r
    where r.cierre_id = v_caja.id and r.diferencia = -5000 and r.efectivo_contado = v_esperado - 5000
      and r.cerrado_por = v_emp and r.reabierta_por = v_admin;
  if v_n <> 1 then
    raise exception 'FALLO 2: reabrir la caja borró el cierre anterior sin dejar rastro';
  end if;

  execute 'reset role';
  update public.caja_config set modo_cierre = 'sin_diferencia';
  perform pg_temp.como(v_admin);
  v_caja := public.cerrar_caja(null, null);
  if v_caja.estado <> 'cerrada' or v_caja.diferencia is not null or v_caja.cerrado_por is distinct from v_admin then
    raise exception 'FALLO 2: el cierre sin diferencia quedó mal: %', row_to_json(v_caja);
  end if;

  -- ===== 3. Costos, deudas y pagos a proveedores: solo el dueño =====
  perform pg_temp.como(v_dueno);
  insert into public.compras (proveedor_id, estado, registrada_por, revisada_por, condicion_pago, total, monto_pagado, saldo_pendiente)
    values (v_prov, 'completada', v_dueno, v_dueno, 'credito', 500000, 0, 500000)
    returning id into v_compra;
  insert into public.compra_items (compra_id, producto_calzado_id, descripcion, cantidad, costo_unitario, subtotal)
    values (v_compra, v_zapato, 'Zapato Test', 10, 50000, 500000);
  insert into public.compra_pagos (compra_id, monto) values (v_compra, 100000);
  if public.obtener_deuda_proveedor(v_prov) <> 400000 then
    raise exception 'FALLO 3: el dueño no ve la deuda correcta del proveedor';
  end if;

  perform pg_temp.como(v_emp);
  insert into public.compras (proveedor_id, estado, registrada_por)
    values (v_prov, 'pendiente_revision', v_emp) returning id into v_pendiente;
  insert into public.compra_items (compra_id, producto_calzado_id, descripcion, cantidad)
    values (v_pendiente, v_zapato, 'Zapato Test', 3);

  perform pg_temp.como(v_admin);
  select count(*) into v_n from public.compras where id = v_compra;
  if v_n <> 0 then
    raise exception 'FALLO 3: la administrativa ve compras completadas (total, saldo)';
  end if;
  select count(*) into v_n from public.compra_items where costo_unitario is not null or subtotal is not null;
  if v_n <> 0 then
    raise exception 'FALLO 3: la administrativa ve costos de compra';
  end if;
  select count(*) into v_n from public.compra_pagos;
  if v_n <> 0 then
    raise exception 'FALLO 3: la administrativa ve pagos a proveedores';
  end if;
  if pg_temp.error_de(format('select public.obtener_deuda_proveedor(%L)', v_prov)) = '' then
    raise exception 'FALLO 3: la administrativa puede consultar la deuda con proveedores';
  end if;
  if not pg_temp.sin_efecto(format(
      $f$insert into public.compras (proveedor_id, estado, registrada_por, condicion_pago, total, monto_pagado, saldo_pendiente)
         values (%L, 'completada', %L, 'contado', 1000, 1000, 0)$f$, v_prov, v_admin)) then
    raise exception 'FALLO 3: la administrativa puede registrar compras con costos';
  end if;
  if not pg_temp.sin_efecto(format('update public.compras set total = 1 where id = %L', v_pendiente)) then
    raise exception 'FALLO 3: la administrativa puede poner costos a una llegada';
  end if;
  if not pg_temp.sin_efecto(format('update public.compra_items set costo_unitario = 1 where compra_id = %L', v_pendiente)) then
    raise exception 'FALLO 3: la administrativa puede poner costos a los ítems';
  end if;
  if not pg_temp.sin_efecto(format('insert into public.compra_pagos (compra_id, monto) values (%L, 1)', v_compra)) then
    raise exception 'FALLO 3: la administrativa puede registrar pagos a proveedores';
  end if;

  -- Lo operativo de Sandra sigue funcionando: ve llegadas pendientes y registra una
  select count(*) into v_n from public.compras where id = v_pendiente;
  if v_n <> 1 then
    raise exception 'FALLO 3: la administrativa dejó de ver las llegadas pendientes';
  end if;
  select count(*) into v_n from public.compra_items where compra_id = v_pendiente;
  if v_n <> 1 then
    raise exception 'FALLO 3: la administrativa dejó de ver los ítems de una llegada';
  end if;
  insert into public.compras (proveedor_id, estado, registrada_por)
    values (v_prov, 'pendiente_revision', v_admin) returning id into v_vacia;
  insert into public.compra_items (compra_id, producto_calzado_id, descripcion, cantidad)
    values (v_vacia, v_zapato, 'Zapato Test', 1);

  -- Empleado: deshace su llegada vacía (rollback de la app), no borra mercancía recibida
  perform pg_temp.como(v_emp);
  insert into public.compras (proveedor_id, estado, registrada_por)
    values (v_prov, 'pendiente_revision', v_emp) returning id into v_vacia;
  delete from public.compras where id = v_vacia;
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'FALLO 3: el empleado no puede deshacer su llegada vacía';
  end if;
  if not pg_temp.sin_efecto(format('delete from public.compras where id = %L', v_pendiente)) then
    raise exception 'FALLO 3: el empleado puede borrar mercancía ya recibida';
  end if;

  -- ===== 4. Ninguna función de public ejecutable por anon =====
  execute 'reset role';
  select count(*), string_agg(p.oid::regprocedure::text, ', ') into v_n, v_txt
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');
  if v_n > 0 then
    raise exception 'FALLO 4: anon (sin iniciar sesión) puede ejecutar: %', v_txt;
  end if;
  select count(*), string_agg(p.oid::regprocedure::text, ', ') into v_n, v_txt
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and not has_function_privilege('authenticated', p.oid, 'execute');
  if v_n > 0 then
    raise exception 'FALLO 4: la app (authenticated) perdió acceso a: %', v_txt;
  end if;
  if not has_function_privilege('service_role', 'public.obtener_resumen_dia(date)', 'execute')
     or not has_function_privilege('service_role', 'public.obtener_reporte_diario(date)', 'execute') then
    raise exception 'FALLO 4: las Edge Functions (service_role) perdieron acceso a los reportes';
  end if;
  create function public.zz_test_seguridad() returns int language sql as 'select 1';
  if has_function_privilege('anon', 'public.zz_test_seguridad()', 'execute') then
    raise exception 'FALLO 4: las funciones nuevas nacen ejecutables por anon';
  end if;

  raise exception 'SEGURIDAD_OK_ROLLBACK';
end $$;

rollback;
