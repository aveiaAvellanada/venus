-- Test de la cédula o razón social del cliente (rediseño del carrito, B4):
--   - registrar_venta guarda p_cliente_documento en ventas.cliente_documento;
--   - sin documento (o vacío) queda NULL, igual que antes;
--   - queda una sola versión de registrar_venta, ejecutable con sesión;
--   - el historial de acciones no guarda el valor del documento.
--
-- Corre en una transacción. Éxito = termina con el error CLIENTE_DOCUMENTO_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/ventas_cliente_documento_test.sql

begin;

create function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims',
    case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  if p_uid is not null then
    execute 'set local role authenticated';
  end if;
end $$;

grant execute on function pg_temp.como(uuid) to authenticated, anon;

do $$
declare
  v_dueno uuid := gen_random_uuid();
  v_ana uuid;
  v_zapato uuid; v_con uuid; v_sin uuid; v_vacio uuid;
  v_hoy date;
  v_n bigint;
  v_doc text; v_aud jsonb;
  v_items jsonb; v_pagos jsonb;
begin
  insert into auth.users (id, email, aud, role) values (v_dueno, 'jefe@venus.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, usuario) values (v_dueno, 'Jefe Test', 'dueno', 'jefetest');
  v_hoy := private.hoy_bogota();
  delete from public.cierres_caja_reaperturas where fecha = v_hoy;
  delete from public.cierres_caja where fecha = v_hoy;

  perform pg_temp.como(v_dueno);
  v_ana := public.crear_empleado('Ana Test', 'anatest', '482915', array['ventas', 'caja', 'inventario']);
  perform pg_temp.como(v_ana);
  insert into public.productos_calzado
    (descripcion, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Zapato Doc', 'Tennis', '40', 'Negro', 80000, 100000, 5, 1)
    returning id into v_zapato;
  perform public.abrir_caja();

  v_items := jsonb_build_array(jsonb_build_object('tipo', 'calzado', 'producto_id', v_zapato, 'cantidad', 1, 'precio', 90000));
  v_pagos := jsonb_build_array(jsonb_build_object('metodo', 'nequi', 'monto', 90000));

  -- ===== Con documento: se guarda (sin espacios sobrantes) =====
  v_con := (public.registrar_venta(p_items => v_items, p_pagos => v_pagos,
    p_cliente_nombre => 'Luz', p_cliente_documento => '  1.117.123.456  ') ->> 'venta_id')::uuid;
  -- ===== Sin documento y con documento vacío: NULL =====
  v_sin := (public.registrar_venta(p_items => v_items, p_pagos => v_pagos) ->> 'venta_id')::uuid;
  v_vacio := (public.registrar_venta(p_items => v_items, p_pagos => v_pagos, p_cliente_documento => '   ') ->> 'venta_id')::uuid;

  perform pg_temp.como(null);
  select cliente_documento into v_doc from public.ventas where id = v_con;
  if v_doc is distinct from '1.117.123.456' then
    raise exception 'FALLO: no guardó el documento del cliente (quedó %)', v_doc;
  end if;
  select count(*) into v_n from public.ventas where id in (v_sin, v_vacio) and cliente_documento is null;
  if v_n <> 2 then
    raise exception 'FALLO: sin documento (o vacío) debe quedar NULL';
  end if;

  -- ===== Una sola versión, ejecutable con sesión =====
  select count(*) into v_n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname = 'registrar_venta';
  if v_n <> 1 then
    raise exception 'FALLO: hay % versiones de registrar_venta (debe quedar una)', v_n;
  end if;
  if not has_function_privilege('authenticated',
       'public.registrar_venta(jsonb, jsonb, numeric, text, text, text, uuid, text)', 'execute')
     or has_function_privilege('anon',
       'public.registrar_venta(jsonb, jsonb, numeric, text, text, text, uuid, text)', 'execute') then
    raise exception 'FALLO: permisos de registrar_venta (authenticated sí, anon no)';
  end if;

  -- ===== El historial registra la venta pero no el valor del documento =====
  select despues into v_aud from public.auditoria
    where tabla = 'ventas' and registro_id = v_con::text and accion = 'crear';
  if v_aud is null or v_aud ->> 'cliente_documento' <> '(oculto)' or v_aud ->> 'cliente_nombre' <> 'Luz' then
    raise exception 'FALLO: la auditoría debe ocultar el documento y conservar lo demás (%)', v_aud;
  end if;
  select count(*) into v_n from public.auditoria where (antes::text || despues::text) like '%1.117.123.456%';
  if v_n <> 0 then
    raise exception 'FALLO: el documento quedó en claro en el historial';
  end if;
  -- Sin documento no se marca nada como oculto.
  select despues into v_aud from public.auditoria
    where tabla = 'ventas' and registro_id = v_sin::text and accion = 'crear';
  if v_aud ->> 'cliente_documento' is not null then
    raise exception 'FALLO: una venta sin documento no debe mostrar "(oculto)"';
  end if;

  raise exception 'CLIENTE_DOCUMENTO_OK_ROLLBACK';
end $$;
