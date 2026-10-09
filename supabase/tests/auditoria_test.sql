-- Test del historial de acciones (public.auditoria):
--   - crear/editar/borrar quedan registrados con quién, qué tabla/registro y qué cambió;
--   - editar guarda solo lo que cambió; un UPDATE sin cambios reales no deja rastro;
--   - una venta por RPC queda a nombre de quien vende; sin sesión = sistema (NULL);
--   - solo el dueño lee el historial y nadie lo escribe ni lo corrige a mano;
--   - toda tabla de public tiene el trigger, salvo las excluidas a propósito.
--
-- Corre en una transacción. Éxito = termina con el error AUDITORIA_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/auditoria_test.sql

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
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claims',
    case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  if p_uid is not null then
    execute 'set local role authenticated';
  end if;
end $$;

grant execute on function pg_temp.error_de(text), pg_temp.como(uuid) to authenticated, anon;

do $$
declare
  v_dueno uuid := gen_random_uuid();
  v_ana uuid;
  v_zapato uuid; v_gasto uuid; v_venta uuid;
  v_hoy date;
  v_n bigint; v_err text;
  v_antes jsonb; v_despues jsonb; v_usuario uuid;
  v_excluidas text[] := array['auditoria', 'historial_precios_calzado', 'historial_precios_varios',
                              'cierres_caja_reaperturas', 'reporte_envios', 'clima_registro'];
begin
  insert into auth.users (id, email, aud, role) values (v_dueno, 'jefe@venus.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, usuario) values (v_dueno, 'Jefe Test', 'dueno', 'jefetest');
  v_hoy := private.hoy_bogota();
  delete from public.cierres_caja_reaperturas where fecha = v_hoy;
  delete from public.cierres_caja where fecha = v_hoy;

  -- ===== Crear un empleado queda a nombre del dueño =====
  perform pg_temp.como(v_dueno);
  v_ana := public.crear_empleado('Ana Test', 'anatest', '482915',
    array['ventas', 'caja', 'inventario', 'gastos', 'gastos_fijos']);
  perform pg_temp.como(null);
  select count(*) into v_n from public.auditoria
    where tabla = 'users' and registro_id = v_ana::text and accion = 'crear' and usuario_id = v_dueno
      and despues ->> 'usuario' = 'anatest';
  if v_n <> 1 then
    raise exception 'FALLO: crear_empleado no quedó en el historial a nombre del dueño';
  end if;

  -- ===== Crear y editar: editar guarda solo lo que cambió =====
  perform pg_temp.como(v_ana);
  insert into public.productos_calzado
    (descripcion, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Zapato Auditado', 'Deportivo', '40', 'Negro', 80000, 100000, 5, 1)
    returning id into v_zapato;
  update public.productos_calzado set precio_maximo = 110000 where id = v_zapato;
  -- Mismo valor: no es un cambio y no deja rastro (aunque toque updated_at/updated_by).
  update public.productos_calzado set precio_maximo = 110000 where id = v_zapato;

  perform pg_temp.como(null);
  select count(*) into v_n from public.auditoria where tabla = 'productos_calzado' and registro_id = v_zapato::text;
  if v_n <> 2 then
    raise exception 'FALLO: se esperaban 2 registros del zapato (crear y editar), hay %', v_n;
  end if;
  select count(*) into v_n from public.auditoria
    where tabla = 'productos_calzado' and registro_id = v_zapato::text and accion = 'crear'
      and usuario_id = v_ana and antes is null and despues ->> 'descripcion' = 'Zapato Auditado';
  if v_n <> 1 then
    raise exception 'FALLO: crear no guardó la fila completa a nombre de quien la creó';
  end if;
  select antes, despues, usuario_id into v_antes, v_despues, v_usuario from public.auditoria
    where tabla = 'productos_calzado' and registro_id = v_zapato::text and accion = 'editar';
  if v_usuario is distinct from v_ana
     or (select count(*) from jsonb_object_keys(v_despues)) <> 1
     or (v_antes ->> 'precio_maximo')::numeric <> 100000
     or (v_despues ->> 'precio_maximo')::numeric <> 110000 then
    raise exception 'FALLO: editar debe guardar solo precio_maximo (antes %, después %)', v_antes, v_despues;
  end if;

  -- ===== El sistema (sin sesión) queda como NULL; borrar guarda la fila completa =====
  perform pg_temp.como(v_ana);
  insert into public.gastos_variables (descripcion, monto, categoria, fecha, pagado_de_caja)
    values ('Bolsas', 15000, 'insumos', v_hoy, false) returning id into v_gasto;
  perform pg_temp.como(null);
  update public.gastos_variables set descripcion = 'Bolsas grandes' where id = v_gasto;
  perform pg_temp.como(v_ana);
  delete from public.gastos_variables where id = v_gasto;

  perform pg_temp.como(null);
  select count(*) into v_n from public.auditoria
    where tabla = 'gastos_variables' and registro_id = v_gasto::text and accion = 'editar' and usuario_id is null;
  if v_n <> 1 then
    raise exception 'FALLO: un cambio sin sesión debe quedar a nombre del sistema (NULL)';
  end if;
  select count(*) into v_n from public.auditoria
    where tabla = 'gastos_variables' and registro_id = v_gasto::text and accion = 'borrar'
      and usuario_id = v_ana and despues is null
      and antes ->> 'descripcion' = 'Bolsas grandes' and (antes ->> 'monto')::numeric = 15000;
  if v_n <> 1 then
    raise exception 'FALLO: borrar debe guardar la fila completa a nombre de quien borró';
  end if;

  -- ===== Una venta por RPC queda a nombre de quien vende =====
  perform pg_temp.como(v_ana);
  perform public.abrir_caja();
  v_venta := (public.registrar_venta(
    p_items => jsonb_build_array(jsonb_build_object(
      'tipo', 'calzado', 'producto_id', v_zapato, 'cantidad', 1, 'precio', 90000)),
    p_pagos => jsonb_build_array(jsonb_build_object('metodo', 'efectivo', 'monto', 90000)),
    p_efectivo_recibido => 90000) ->> 'venta_id')::uuid;
  perform pg_temp.como(null);
  select count(*) into v_n from public.auditoria
    where tabla = 'ventas' and registro_id = v_venta::text and accion = 'crear' and usuario_id = v_ana;
  if v_n <> 1 then
    raise exception 'FALLO: la venta no quedó en el historial a nombre de quien vendió';
  end if;
  select count(*) into v_n from public.auditoria
    where tabla = 'productos_calzado' and registro_id = v_zapato::text and accion = 'editar'
      and usuario_id = v_ana and (antes ->> 'stock_actual')::int = 5 and (despues ->> 'stock_actual')::int = 4;
  if v_n <> 1 then
    raise exception 'FALLO: la baja de stock por la venta no quedó en el historial';
  end if;

  -- ===== Solo el dueño lee el historial =====
  perform pg_temp.como(v_ana);
  select count(*) into v_n from public.auditoria;
  if v_n <> 0 then
    raise exception 'FALLO: un empleado ve % registros del historial', v_n;
  end if;
  perform pg_temp.como(v_dueno);
  select count(*) into v_n from public.auditoria where usuario_id = v_ana;
  if v_n < 5 then
    raise exception 'FALLO: el dueño debe ver el historial de cada empleado (ve %)', v_n;
  end if;

  -- ===== Nadie escribe ni corrige el historial, ni siquiera el dueño =====
  v_err := pg_temp.error_de($q$insert into public.auditoria (tabla, accion) values ('x', 'crear')$q$);
  if v_err not like '%permission denied%' then
    raise exception 'FALLO: el dueño pudo insertar en el historial (%)', v_err;
  end if;
  v_err := pg_temp.error_de('update public.auditoria set usuario_id = null');
  if v_err not like '%permission denied%' then
    raise exception 'FALLO: el dueño pudo corregir el historial (%)', v_err;
  end if;
  v_err := pg_temp.error_de('delete from public.auditoria');
  if v_err not like '%permission denied%' then
    raise exception 'FALLO: el dueño pudo borrar el historial (%)', v_err;
  end if;
  execute 'reset role';
  execute 'set local role anon';
  v_err := pg_temp.error_de('select count(*) from public.auditoria');
  if v_err not like '%permission denied%' then
    raise exception 'FALLO: sin sesión se puede leer el historial (%)', v_err;
  end if;
  execute 'reset role';

  -- ===== Toda tabla de public lleva el trigger, salvo las excluidas a propósito =====
  select string_agg(c.relname, ', ' order by c.relname) into v_err
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and c.relname <> all (v_excluidas)
    and not exists (select 1 from pg_trigger t
                    where t.tgrelid = c.oid and t.tgname = 'trg_' || c.relname || '_auditoria');
  if v_err is not null then
    raise exception 'FALLO: tablas sin historial de acciones: % (agregar el trigger o excluirlas a propósito)', v_err;
  end if;

  raise exception 'AUDITORIA_OK_ROLLBACK';
end $$;
