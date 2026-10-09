-- Test de usuarios dinámicos y permisos por persona:
--   - Solo el dueño crea empleados (nombre, usuario, PIN de 6) y les da permisos.
--   - Cada RPC/política respeta el permiso correspondiente, no un rol fijo.
--   - Cambiar permisos aplica de inmediato; nadie se da permisos a sí mismo.
--   - PIN: el dueño lo restablece; cada quien cambia el suyo con el actual.
--   - Desactivar bloquea el login, cierra sesiones y corta todo acceso aunque
--     el token siga vigente; reactivar lo devuelve.
--
-- Corre en una transacción. Éxito = termina con el error PERMISOS_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/permisos_test.sql

begin;

create function pg_temp.sin_efecto(p_sql text) returns boolean language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n = 0;
exception when insufficient_privilege then
  return true;
end $$;

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

grant execute on function pg_temp.sin_efecto(text), pg_temp.error_de(text), pg_temp.como(uuid)
  to authenticated;

do $$
declare
  v_dueno uuid := gen_random_uuid();
  v_luisa uuid; v_pedro uuid;
  v_hoy date;
  v_prov uuid; v_zapato uuid; v_venta uuid; v_item uuid; v_vieja uuid;
  v_n bigint; v_err text;
  v_admin text[] := array['ventas','devoluciones','inventario','recibir_mercancia','caja','gastos',
                          'proveedores','gastos_fijos','reportes','carga_inicial'];
begin
  insert into auth.users (id, email, aud, role) values (v_dueno, 'jefe@venus.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, usuario) values (v_dueno, 'Jefe Test', 'dueno', 'jefetest');
  insert into public.proveedores (nombre) values ('Proveedor Test') returning id into v_prov;
  insert into public.productos_calzado
    (descripcion, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo, proveedor_id)
    values ('Zapato Test', 'Deportivo', '40', 'Negro', 80000, 100000, 10, 1, v_prov)
    returning id into v_zapato;
  v_hoy := private.hoy_bogota();
  delete from public.cierres_caja_reaperturas where fecha = v_hoy;
  delete from public.cierres_caja where fecha = v_hoy;

  -- ===== El dueño crea empleados =====
  perform pg_temp.como(v_dueno);
  v_luisa := public.crear_empleado('  Luisa Gómez ', ' Luisa ', '482915', array['ventas','caja']);
  v_pedro := public.crear_empleado('Pedro Test', 'pedro.t', '730264', v_admin);

  execute 'reset role';
  select count(*) into v_n from public.users
    where id = v_luisa and nombre = 'Luisa Gómez' and usuario = 'luisa' and rol = 'empleado' and activo
      and permisos = array['ventas','caja'] and email = 'luisa@venus.invalid' and not debe_cambiar_pin;
  if v_n <> 1 then
    raise exception 'FALLO: crear_empleado no guardó bien el perfil';
  end if;
  select count(*) into v_n from auth.users
    where id = v_luisa and email = 'luisa@venus.invalid' and email_confirmed_at is not null
      and encrypted_password = extensions.crypt('482915', encrypted_password)
      and confirmation_token = '' and recovery_token = '' and email_change_token_new = '' and email_change = '';
  if v_n <> 1 then
    raise exception 'FALLO: la cuenta de Auth no quedó lista para entrar con usuario + PIN';
  end if;
  select count(*) into v_n from auth.identities
    where user_id = v_luisa and provider = 'email' and identity_data->>'email' = 'luisa@venus.invalid';
  if v_n <> 1 then
    raise exception 'FALLO: falta la identidad de correo de la cuenta';
  end if;

  perform pg_temp.como(v_dueno);
  if pg_temp.error_de($q$select public.crear_empleado('X', 'Luisa Gómez', '482915', '{}')$q$) not like '%usuario debe%' then
    raise exception 'FALLO: se aceptó un usuario con espacios/tildes';
  end if;
  if pg_temp.error_de($q$select public.crear_empleado('X', 'luisa', '482915', '{}')$q$) not like '%Ya existe%' then
    raise exception 'FALLO: se aceptó un usuario repetido';
  end if;
  if pg_temp.error_de($q$select public.crear_empleado('X', 'otro', '1234', '{}')$q$) not like '%6 números%' then
    raise exception 'FALLO: se aceptó un PIN de 4 dígitos';
  end if;
  if pg_temp.error_de($q$select public.crear_empleado('X', 'otro', '482915', array['volar'])$q$) not like '%desconocido%' then
    raise exception 'FALLO: se aceptó un permiso que no existe';
  end if;
  if pg_temp.error_de($q$select public.crear_empleado(' ', 'otro', '482915', '{}')$q$) not like '%nombre%' then
    raise exception 'FALLO: se aceptó un empleado sin nombre';
  end if;
  -- PIN triviales: repetidos, en orden o con patrón
  foreach v_err in array array['000000','777777','123456','456789','987654','543210','121212','909090','123123','482482'] loop
    if pg_temp.error_de(format($q$select public.crear_empleado('X', 'otro', %L, '{}')$q$, v_err)) not like '%fácil de adivinar%' then
      raise exception 'FALLO: se aceptó el PIN trivial %', v_err;
    end if;
  end loop;

  -- ===== Luisa solo puede vender y manejar caja =====
  perform pg_temp.como(v_luisa);
  perform public.abrir_caja();
  select (r->>'venta_id')::uuid into v_venta from (select public.registrar_venta(
    jsonb_build_array(jsonb_build_object('tipo', 'calzado', 'producto_id', v_zapato, 'cantidad', 1, 'precio', 90000)),
    jsonb_build_array(jsonb_build_object('metodo', 'efectivo', 'monto', 90000)), 90000) as r) s;
  if v_venta is null then
    raise exception 'FALLO: con permiso de ventas no pudo vender';
  end if;
  select id into v_item from public.venta_items where venta_id = v_venta;

  v_err := pg_temp.error_de(format(
    'select public.registrar_devolucion(%L, %L, %L, %L, null, 90000, 0, %L)', v_venta, 'Talla', 'total', 'efectivo',
    jsonb_build_array(jsonb_build_object('venta_item_id', v_item, 'cantidad', 1))));
  if v_err not like '%permiso%' then
    raise exception 'FALLO: sin permiso de devoluciones pudo devolver (%)', v_err;
  end if;
  if not pg_temp.sin_efecto(format('update public.productos_calzado set precio_maximo = 1 where id = %L', v_zapato)) then
    raise exception 'FALLO: sin permiso de inventario editó un precio';
  end if;
  if pg_temp.error_de(format(
      'select public.guardar_producto_calzado(%L, %L, %L, null, null, null, 1, 2, null, 1, 1, null, null, true)',
      v_zapato, 'Deportivo', 'Zapato Test')) not like '%permiso%' then
    raise exception 'FALLO: sin permiso de inventario guardó un producto por RPC';
  end if;
  if not pg_temp.sin_efecto($q$insert into public.gastos_variables (descripcion, monto, categoria) values ('x', 1, 'otros')$q$) then
    raise exception 'FALLO: sin permiso de gastos registró un gasto';
  end if;
  if not pg_temp.sin_efecto($q$insert into public.proveedores (nombre) values ('Otro')$q$) then
    raise exception 'FALLO: sin permiso de proveedores creó un proveedor';
  end if;
  if pg_temp.error_de(format('select public.obtener_reporte_periodo(%L, %L)', v_hoy, v_hoy)) = '' then
    raise exception 'FALLO: sin permiso de reportes vio el reporte por período';
  end if;
  if not pg_temp.sin_efecto(format('update public.users set permisos = %L where id = %L', v_admin, v_luisa)) then
    raise exception 'FALLO: la empleada se dio permisos a sí misma';
  end if;
  if pg_temp.error_de(format('select public.actualizar_empleado(%L, %L, %L)', v_luisa, 'Luisa', v_admin)) not like '%dueño%' then
    raise exception 'FALLO: una empleada usó actualizar_empleado';
  end if;
  if pg_temp.error_de($q$select public.crear_empleado('X', 'colado', '123456', '{}')$q$) not like '%dueño%' then
    raise exception 'FALLO: una empleada creó cuentas';
  end if;

  -- Historial (reportes): Luisa solo ve las ventas de hoy; Pedro (administrativo) también las viejas
  execute 'reset role';
  insert into public.ventas (vendedor_id, total, monto_pagado, saldo_pendiente, estado, created_at)
    values (v_luisa, 1000, 1000, 0, 'completada', now() - interval '2 days') returning id into v_vieja;
  perform pg_temp.como(v_luisa);
  select count(*) into v_n from public.ventas where id = v_vieja;
  if v_n <> 0 then
    raise exception 'FALLO: sin permiso de reportes vio ventas de otros días';
  end if;
  perform pg_temp.como(v_pedro);
  select count(*) into v_n from public.ventas where id = v_vieja;
  if v_n <> 1 then
    raise exception 'FALLO: con permiso de reportes no ve el historial';
  end if;
  insert into public.proveedores (nombre) values ('Proveedor de Pedro');
  if pg_temp.error_de('select public.obtener_balance(current_date, current_date)') = ''
     or pg_temp.error_de(format('select public.obtener_deuda_proveedor(%L)', v_prov)) = '' then
    raise exception 'FALLO: la plantilla administrativa no incluye balance ni deudas';
  end if;

  -- ===== El dueño cambia permisos: aplica de inmediato =====
  perform pg_temp.como(v_dueno);
  perform public.actualizar_empleado(v_luisa, 'Luisa Gómez', array['ventas','caja','devoluciones','balance']);
  perform pg_temp.como(v_luisa);
  perform public.registrar_devolucion(v_venta, 'Talla', 'total', 'efectivo', null, 90000, 0,
    jsonb_build_array(jsonb_build_object('venta_item_id', v_item, 'cantidad', 1)));
  perform public.obtener_balance(v_hoy, v_hoy);

  -- ===== PIN =====
  perform pg_temp.como(v_pedro);
  if pg_temp.error_de(format('select public.restablecer_pin_empleado(%L, %L)', v_luisa, '000000')) not like '%dueño%' then
    raise exception 'FALLO: un empleado restableció el PIN de otro';
  end if;
  perform pg_temp.como(v_dueno);
  perform public.restablecer_pin_empleado(v_luisa, '111222');
  execute 'reset role';
  if not exists (select 1 from auth.users where id = v_luisa
                   and encrypted_password = extensions.crypt('111222', encrypted_password)) then
    raise exception 'FALLO: restablecer_pin_empleado no cambió el PIN';
  end if;
  update public.users set debe_cambiar_pin = true where id = v_luisa;
  perform pg_temp.como(v_luisa);
  if pg_temp.error_de($q$select public.cambiar_mi_pin('999999', '333444')$q$) not like '%no es correcto%' then
    raise exception 'FALLO: cambió el PIN sin saber el actual';
  end if;
  if pg_temp.error_de($q$select public.cambiar_mi_pin('111222', '12345')$q$) not like '%6 números%' then
    raise exception 'FALLO: aceptó un PIN nuevo de 5 dígitos';
  end if;
  if pg_temp.error_de($q$select public.cambiar_mi_pin('111222', '654321')$q$) not like '%fácil de adivinar%' then
    raise exception 'FALLO: aceptó un PIN propio trivial';
  end if;
  perform public.cambiar_mi_pin('111222', '333444');
  execute 'reset role';
  if not exists (select 1 from auth.users a join public.users u on u.id = a.id where a.id = v_luisa
                   and a.encrypted_password = extensions.crypt('333444', a.encrypted_password)
                   and not u.debe_cambiar_pin) then
    raise exception 'FALLO: cambiar_mi_pin no guardó el PIN nuevo o no limpió debe_cambiar_pin';
  end if;

  -- ===== Desactivar corta todo, aunque el token siga vigente =====
  insert into auth.sessions (id, user_id) values (gen_random_uuid(), v_luisa);
  insert into auth.refresh_tokens (token, user_id) values ('t', v_luisa::text);
  perform pg_temp.como(v_dueno);
  perform public.cambiar_estado_empleado(v_luisa, false);
  execute 'reset role';
  if not exists (select 1 from auth.users where id = v_luisa and banned_until = 'infinity')
     or exists (select 1 from auth.sessions where user_id = v_luisa)
     or exists (select 1 from auth.refresh_tokens where user_id = v_luisa::text)
     or exists (select 1 from public.users where id = v_luisa and activo) then
    raise exception 'FALLO: desactivar no bloqueó el login ni cerró las sesiones';
  end if;
  perform pg_temp.como(v_luisa);
  v_err := pg_temp.error_de(format('select public.registrar_venta(%L, %L)',
    jsonb_build_array(jsonb_build_object('tipo', 'calzado', 'producto_id', v_zapato, 'cantidad', 1, 'precio', 90000)),
    jsonb_build_array(jsonb_build_object('metodo', 'nequi', 'monto', 90000))));
  if v_err not like '%permiso%' then
    raise exception 'FALLO: una cuenta desactivada siguió vendiendo (%)', v_err;
  end if;
  select count(*) into v_n from public.productos_calzado;
  if v_n <> 0 then
    raise exception 'FALLO: una cuenta desactivada sigue leyendo el inventario';
  end if;
  select count(*) into v_n from public.users where id = v_luisa and not activo;
  if v_n <> 1 then
    raise exception 'FALLO: la cuenta desactivada debe poder ver su perfil (la app la saca)';
  end if;

  perform pg_temp.como(v_dueno);
  perform public.cambiar_estado_empleado(v_luisa, true);
  if pg_temp.error_de(format('select public.cambiar_estado_empleado(%L, false)', v_dueno)) not like '%no encontrado%' then
    raise exception 'FALLO: se pudo desactivar al dueño';
  end if;
  execute 'reset role';
  if exists (select 1 from auth.users where id = v_luisa and banned_until is not null) then
    raise exception 'FALLO: reactivar no levantó el bloqueo de login';
  end if;

  raise exception 'PERMISOS_OK_ROLLBACK';
end $$;

rollback;
