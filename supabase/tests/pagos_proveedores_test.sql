-- Test de registrar_pago_proveedor y de los documentos de proveedores en Storage
-- (panel web, fase 1, entrega 2):
--   - abonar baja el saldo; pagar el resto lo deja en cero; queda en compra_pagos
--     a nombre de quien pagó y en la auditoría;
--   - no deja pagar más que el saldo, ni en cero, ni con fecha futura, ni a
--     compras de contado o pendientes;
--   - sin permiso `deudas` no registra pagos;
--   - los documentos del bucket `proveedores` piden el permiso `proveedores`.
--
-- Corre en una transacción. Éxito = termina con el error PAGOS_PROVEEDORES_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/pagos_proveedores_test.sql

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
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

grant execute on function pg_temp.error_de(text), pg_temp.como(uuid) to authenticated, anon;

do $$
declare
  v_dueno uuid := gen_random_uuid();
  v_ana uuid; v_beto uuid;
  v_prov uuid; v_credito uuid; v_contado uuid; v_pendiente uuid;
  r jsonb; v_err text; v_n bigint; v_saldo numeric;
begin
  insert into auth.users (id, email, aud, role) values (v_dueno, 'jefe@venus.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, usuario) values (v_dueno, 'Jefe Test', 'dueno', 'jefetest');
  insert into public.proveedores (nombre) values ('Proveedor Test') returning id into v_prov;
  insert into public.compras (proveedor_id, estado, condicion_pago, total, monto_pagado, fecha_vencimiento)
    values (v_prov, 'completada', 'credito', 100000, 0, private.hoy_bogota() + 30) returning id into v_credito;
  insert into public.compras (proveedor_id, estado, condicion_pago, total, monto_pagado)
    values (v_prov, 'completada', 'contado', 50000, 50000) returning id into v_contado;
  insert into public.compras (proveedor_id, estado) values (v_prov, 'pendiente_revision') returning id into v_pendiente;

  perform pg_temp.como(v_dueno);
  -- Ana gestiona proveedores pero no deudas; Beto solo vende.
  v_ana := public.crear_empleado('Ana Test', 'anatest', '482915', array['proveedores']);
  v_beto := public.crear_empleado('Beto Test', 'betotest', '730264', array['ventas']);

  -- ===== Abono: baja el saldo y queda a nombre de quien pagó =====
  r := public.registrar_pago_proveedor(v_credito, 40000, null, '  Abono en efectivo ');
  if (r ->> 'saldo_pendiente')::numeric <> 60000 then
    raise exception 'FALLO: tras abonar 40.000 el saldo debía ser 60.000: %', r;
  end if;
  execute 'reset role';
  select count(*) into v_n from public.compra_pagos
    where compra_id = v_credito and monto = 40000 and registrado_por = v_dueno
      and notas = 'Abono en efectivo' and fecha = private.hoy_bogota();
  if v_n <> 1 then
    raise exception 'FALLO: el abono no quedó en compra_pagos como se esperaba';
  end if;
  select count(*) into v_n from public.auditoria
    where tabla = 'compra_pagos' and accion = 'crear' and usuario_id = v_dueno;
  if v_n <> 1 then
    raise exception 'FALLO: el pago debe quedar en el historial de acciones';
  end if;

  -- ===== Validaciones =====
  perform pg_temp.como(v_dueno);
  v_err := pg_temp.error_de(format('select public.registrar_pago_proveedor(%L, 60001)', v_credito));
  if v_err not like '%supera el saldo pendiente%' then
    raise exception 'FALLO: no debe dejar pagar más que el saldo (%)', v_err;
  end if;
  v_err := pg_temp.error_de(format('select public.registrar_pago_proveedor(%L, 0)', v_credito));
  if v_err not like '%mayor a cero%' then
    raise exception 'FALLO: un pago en cero debe rechazarse (%)', v_err;
  end if;
  v_err := pg_temp.error_de(format('select public.registrar_pago_proveedor(%L, 1000, %L)', v_credito, private.hoy_bogota() + 1));
  if v_err not like '%no puede ser futura%' then
    raise exception 'FALLO: un pago con fecha futura debe rechazarse (%)', v_err;
  end if;
  v_err := pg_temp.error_de(format('select public.registrar_pago_proveedor(%L, 1000)', v_contado));
  if v_err not like '%a crédito%' then
    raise exception 'FALLO: no se paga una compra de contado (%)', v_err;
  end if;
  v_err := pg_temp.error_de(format('select public.registrar_pago_proveedor(%L, 1000)', v_pendiente));
  if v_err not like '%a crédito%' then
    raise exception 'FALLO: no se paga una compra pendiente de revisión (%)', v_err;
  end if;
  v_err := pg_temp.error_de(format('select public.registrar_pago_proveedor(%L, 1000)', gen_random_uuid()));
  if v_err not like '%no existe%' then
    raise exception 'FALLO: una compra inexistente debe avisarse (%)', v_err;
  end if;

  -- ===== Sin permiso `deudas` no registra pagos =====
  perform pg_temp.como(v_ana);
  v_err := pg_temp.error_de(format('select public.registrar_pago_proveedor(%L, 1000)', v_credito));
  if v_err not like '%No tienes permiso%' then
    raise exception 'FALLO: sin `deudas` no debe registrar pagos (%)', v_err;
  end if;

  -- ===== Pagar el resto deja el saldo en cero =====
  perform pg_temp.como(v_dueno);
  r := public.registrar_pago_proveedor(v_credito, 60000, private.hoy_bogota() - 1);
  execute 'reset role';
  select saldo_pendiente into v_saldo from public.compras where id = v_credito;
  if v_saldo <> 0 or (r ->> 'saldo_pendiente')::numeric <> 0 then
    raise exception 'FALLO: pagar el resto debía dejar el saldo en 0 (quedó %)', v_saldo;
  end if;

  -- ===== Documentos: el bucket pide el permiso `proveedores` =====
  if not exists (select 1 from storage.buckets where id = 'proveedores' and not public) then
    raise exception 'FALLO: falta el bucket privado proveedores';
  end if;
  perform pg_temp.como(v_ana);
  insert into storage.objects (bucket_id, name) values ('proveedores', v_prov || '/rut.pdf');
  select count(*) into v_n from storage.objects where bucket_id = 'proveedores';
  if v_n <> 1 then
    raise exception 'FALLO: con `proveedores` debe ver el documento que subió';
  end if;
  perform pg_temp.como(v_beto);
  select count(*) into v_n from storage.objects where bucket_id = 'proveedores';
  if v_n <> 0 then
    raise exception 'FALLO: sin `proveedores` no debe ver documentos de proveedores';
  end if;
  v_err := pg_temp.error_de(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'proveedores', v_prov || '/otro.pdf'));
  if v_err = '' then
    raise exception 'FALLO: sin `proveedores` no debe subir documentos';
  end if;
  execute 'reset role';

  raise exception 'PAGOS_PROVEEDORES_OK_ROLLBACK';
end $$;
