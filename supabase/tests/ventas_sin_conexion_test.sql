-- Test de ventas hechas sin conexión (20261029120000):
--   - con p_vendida_en la venta queda con esa hora (cuenta en su día), marcada
--     hecha_sin_conexion y con recibida_at;
--   - no exige la caja de hoy abierta; si la caja de ese día ya se cerró (o no
--     se abrió) entra igual y lo avisa;
--   - si falta stock la guarda, deja el stock en 0 (nunca negativo) y avisa;
--   - el reintento con la misma clave no la duplica y devuelve los avisos;
--   - una hora en el futuro o de hace más de 30 días se rechaza;
--   - sin p_vendida_en todo sigue igual (caja abierta y stock suficiente).
--
-- Corre en una transacción. Éxito = termina con el error VENTAS_SIN_CONEXION_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/ventas_sin_conexion_test.sql

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

-- Venta de un zapato pagada en efectivo, hecha sin conexión a la hora p_en.
create function pg_temp.venta(p_id uuid, p_cant int, p_en timestamptz, p_clave uuid default gen_random_uuid())
returns jsonb language sql as $$
  select public.registrar_venta(
    p_items => jsonb_build_array(jsonb_build_object('tipo', 'calzado', 'producto_id', p_id, 'cantidad', p_cant, 'precio', 50000)),
    p_pagos => jsonb_build_array(jsonb_build_object('metodo', 'efectivo', 'monto', 50000 * p_cant)),
    p_efectivo_recibido => 50000 * p_cant,
    p_clave_idempotencia => p_clave,
    p_vendida_en => p_en)
$$;

grant execute on function pg_temp.error_de(text), pg_temp.como(uuid),
  pg_temp.venta(uuid, int, timestamptz, uuid) to authenticated;

do $$
declare
  v_dueno uuid := gen_random_uuid();
  v_emp uuid;
  v_zapato uuid; v_bota uuid;
  v_hoy date := private.hoy_bogota();
  v_ayer_en timestamptz;
  v_clave uuid := gen_random_uuid();
  r jsonb; r2 jsonb; v_err text; v_n bigint; v_stock int;
  v_venta record;
begin
  insert into auth.users (id, email, aud, role) values (v_dueno, 'jefe@venus.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, usuario) values (v_dueno, 'Jefe Test', 'dueno', 'jefetest');
  insert into public.productos_calzado (descripcion, categoria, talla, color, precio_minimo, stock_actual, stock_minimo)
    values ('Tennis Luz', 'Tennis', '40', 'Negro', 50000, 3, 1) returning id into v_zapato;
  insert into public.productos_calzado (descripcion, categoria, talla, color, precio_minimo, stock_actual, stock_minimo)
    values ('Bota Luz', 'Botas caucho', '38', 'Verde', 50000, 1, 1) returning id into v_bota;
  delete from public.cierres_caja_reaperturas where fecha >= v_hoy - 2;
  delete from public.cierres_caja where fecha >= v_hoy - 2;
  -- Ayer a las 3 p. m. (hora de Bogotá), con la caja de ayer ya cerrada.
  v_ayer_en := ((v_hoy - 1)::timestamp + time '15:00') at time zone 'America/Bogota';
  insert into public.cierres_caja (fecha, estado, apertura_at, cierre_at)
    values (v_hoy - 1, 'cerrada', v_ayer_en - interval '6 hours', v_ayer_en + interval '4 hours');

  perform pg_temp.como(v_dueno);
  v_emp := public.crear_empleado('Vera Test', 'veratest', '482915', array['ventas']);

  -- ===== Sin p_vendida_en: sin caja de hoy abierta no se vende =====
  perform pg_temp.como(v_emp);
  v_err := pg_temp.error_de(format($e$select public.registrar_venta(
    p_items => '[{"tipo":"calzado","producto_id":"%s","cantidad":1,"precio":50000}]',
    p_pagos => '[{"metodo":"efectivo","monto":50000}]', p_efectivo_recibido => 50000)$e$, v_zapato));
  if v_err not like '%caja de hoy%' then raise exception 'FALLO: sin conexión no debía cambiar la venta normal: %', v_err; end if;

  -- ===== Hora inválida =====
  v_err := pg_temp.error_de(format('select pg_temp.venta(%L, 1, now() + interval ''1 hour'')', v_zapato));
  if v_err not like '%hora de la venta%' then raise exception 'FALLO: una hora en el futuro debía rechazarse: %', v_err; end if;
  v_err := pg_temp.error_de(format('select pg_temp.venta(%L, 1, now() - interval ''31 days'')', v_zapato));
  if v_err not like '%hora de la venta%' then raise exception 'FALLO: una venta de hace 31 días debía rechazarse: %', v_err; end if;

  -- ===== Venta de ayer (caja cerrada) sin la caja de hoy abierta =====
  r := pg_temp.venta(v_zapato, 1, v_ayer_en, v_clave);
  if (r ->> 'repetida')::boolean or jsonb_array_length(r -> 'avisos') <> 1
     or r -> 'avisos' ->> 0 not like '%ya estaba cerrada%' then
    raise exception 'FALLO: la venta de ayer debía entrar con el aviso de la caja cerrada: %', r;
  end if;
  execute 'reset role';
  select * into v_venta from public.ventas where id = (r ->> 'venta_id')::uuid;
  if v_venta.created_at <> v_ayer_en or not v_venta.hecha_sin_conexion or v_venta.recibida_at is null
     or (v_venta.created_at at time zone 'America/Bogota')::date <> v_hoy - 1 then
    raise exception 'FALLO: la venta debía quedar con la hora en que se hizo (% / %)', v_venta.created_at, v_venta.recibida_at;
  end if;
  if v_venta.aviso_sincronizacion not like '%ya estaba cerrada%' then
    raise exception 'FALLO: el aviso debía quedar en la venta: %', v_venta.aviso_sincronizacion;
  end if;
  select stock_actual into v_stock from public.productos_calzado where id = v_zapato;
  if v_stock <> 2 then raise exception 'FALLO: debía descontar el stock (%)', v_stock; end if;

  -- ===== Reintento con la misma clave: no se duplica y trae los avisos =====
  perform pg_temp.como(v_emp);
  r2 := pg_temp.venta(v_zapato, 1, v_ayer_en, v_clave);
  if not (r2 ->> 'repetida')::boolean or r2 ->> 'venta_id' <> r ->> 'venta_id'
     or r2 -> 'avisos' ->> 0 not like '%ya estaba cerrada%' then
    raise exception 'FALLO: el reintento debía devolver la misma venta con sus avisos: %', r2;
  end if;
  execute 'reset role';
  select stock_actual into v_stock from public.productos_calzado where id = v_zapato;
  if v_stock <> 2 then raise exception 'FALLO: el reintento no debía descontar otra vez (%)', v_stock; end if;

  -- ===== Hoy, caja sin abrir y falta stock: entra, stock en 0 y dos avisos =====
  perform pg_temp.como(v_emp);
  r := pg_temp.venta(v_bota, 3, now() - interval '5 minutes');
  if jsonb_array_length(r -> 'avisos') <> 2
     or not (r -> 'avisos') @> to_jsonb(array[
       'Faltaba stock de Bota Luz talla 38 Verde: se vendieron 3 y había 1. Revísalo en el conteo físico.',
       format('La caja del %s no se había abierto: esta venta cuenta en ese día.', to_char(v_hoy, 'DD/MM/YYYY'))]) then
    raise exception 'FALLO: avisos inesperados: %', r;
  end if;
  execute 'reset role';
  select stock_actual into v_stock from public.productos_calzado where id = v_bota;
  if v_stock <> 0 then raise exception 'FALLO: el stock debía quedar en 0, nunca negativo (%)', v_stock; end if;
  select count(*) into v_n from public.venta_items where venta_id = (r ->> 'venta_id')::uuid and cantidad = 3;
  if v_n <> 1 then raise exception 'FALLO: la venta debía guardar los 3 pares vendidos'; end if;

  -- ===== Con la caja de hoy abierta y stock: sin avisos =====
  perform pg_temp.como(v_dueno);
  perform public.abrir_caja();
  perform pg_temp.como(v_emp);
  r := pg_temp.venta(v_zapato, 1, now());
  if jsonb_array_length(r -> 'avisos') <> 0 then raise exception 'FALLO: no debía haber avisos: %', r; end if;
  -- Y sin p_vendida_en con stock corto sigue rechazándose.
  v_err := pg_temp.error_de(format($e$select public.registrar_venta(
    p_items => '[{"tipo":"calzado","producto_id":"%s","cantidad":5,"precio":50000}]',
    p_pagos => '[{"metodo":"efectivo","monto":250000}]', p_efectivo_recibido => 250000)$e$, v_zapato));
  if v_err not like '%Stock insuficiente%' then raise exception 'FALLO: la venta normal debía exigir stock: %', v_err; end if;

  -- ===== Devoluciones siguen exigiendo la caja abierta (trigger aparte) =====
  execute 'reset role';
  update public.cierres_caja set estado = 'cerrada', cierre_at = now() where fecha = v_hoy;
  v_err := pg_temp.error_de(format('insert into public.devoluciones (venta_id, tipo_devolucion, motivo, monto_devuelto) values (%L, ''total'', ''x'', 0)', r ->> 'venta_id'));
  if v_err not like '%caja de hoy%' then raise exception 'FALLO: la devolución debía exigir la caja abierta: %', v_err; end if;

  raise exception 'VENTAS_SIN_CONEXION_OK_ROLLBACK';
end $$;

rollback;
