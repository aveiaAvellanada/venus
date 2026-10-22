-- Test de registrar_conteo (panel web, fase 2, entrega 1: Conteo físico):
--   - un conteo con faltante, sobrante y talla que coincide deja el stock igual
--     a lo contado, guarda el conteo con sus totales y todas sus tallas;
--   - queda en el historial de acciones (conteo, ítems y cambio de stock);
--   - si el stock cambió mientras se contaba no guarda nada y dice qué cambió;
--   - reintentar con la misma clave no ajusta dos veces;
--   - motivos: obligatorio si hay diferencia, prohibido si no; pérdida y daño
--     solo para faltantes; "Otro" con nota; lo contado entero y no negativo;
--   - un error no deja nada a medias; nadie escribe las tablas directo;
--   - sin `inventario` no registra ni lee conteos.
--
-- Corre en una transacción. Éxito = termina con el error CONTEO_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/conteo_fisico_test.sql

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
  v_t38 uuid; v_t39 uuid; v_t40 uuid;
  v_clave uuid := gen_random_uuid();
  r jsonb; r2 jsonb; v_err text; v_n bigint; v_stock int;
  v_conteo uuid;
  v_items jsonb;
begin
  insert into auth.users (id, email, aud, role) values (v_dueno, 'jefe@venus.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, usuario) values (v_dueno, 'Jefe Test', 'dueno', 'jefetest');
  insert into public.productos_calzado (descripcion, referencia, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Tennis A', 'TA-1', 'Tennis', '38', 'Negro', 80000, 100000, 5, 1) returning id into v_t38;
  insert into public.productos_calzado (descripcion, referencia, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Tennis A', 'TA-1', 'Tennis', '39', 'Negro', 80000, 100000, 2, 1) returning id into v_t39;
  insert into public.productos_calzado (descripcion, referencia, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Tennis A', 'TA-1', 'Tennis', '40', 'Negro', 80000, 100000, 4, 1) returning id into v_t40;

  perform pg_temp.como(v_dueno);
  v_ana := public.crear_empleado('Ana Test', 'anatest', '482915', array['inventario']);
  v_beto := public.crear_empleado('Beto Test', 'betotest', '583926', array['ventas']);

  -- ===== Conteo con faltante, sobrante y una talla que coincide =====
  v_items := jsonb_build_array(
    jsonb_build_object('producto_id', v_t38, 'sistema', 5, 'contado', 3, 'motivo', 'perdida'),
    jsonb_build_object('producto_id', v_t39, 'sistema', 2, 'contado', 3, 'motivo', 'error', 'nota', ' llegó sin registrar '),
    jsonb_build_object('producto_id', v_t40, 'sistema', 4, 'contado', 4));
  perform pg_temp.como(v_ana);
  r := public.registrar_conteo(jsonb_build_object('alcance', ' Tennis ', 'nota', 'Conteo de prueba', 'items', v_items), v_clave);
  if not (r ->> 'aplicado')::boolean or (r ->> 'repetido')::boolean then
    raise exception 'FALLO: el conteo debía aplicarse (%)', r;
  end if;
  if (r ->> 'tallas_contadas')::int <> 3 or (r ->> 'tallas_ajustadas')::int <> 2
     or (r ->> 'unidades_faltantes')::int <> 2 or (r ->> 'unidades_sobrantes')::int <> 1 then
    raise exception 'FALLO: totales del conteo (%)', r;
  end if;
  v_conteo := (r ->> 'conteo_id')::uuid;

  -- Quien tiene `inventario` lee el conteo.
  select count(*) into v_n from public.conteo_items where conteo_id = v_conteo;
  if v_n <> 3 then raise exception 'FALLO: Ana debía ver las 3 tallas del conteo (ve %)', v_n; end if;
  execute 'reset role';

  select stock_actual into v_stock from public.productos_calzado where id = v_t38;
  if v_stock <> 3 then raise exception 'FALLO: la talla 38 debía quedar en 3 (quedó %)', v_stock; end if;
  select stock_actual into v_stock from public.productos_calzado where id = v_t39;
  if v_stock <> 3 then raise exception 'FALLO: la talla 39 debía quedar en 3 (quedó %)', v_stock; end if;
  select stock_actual into v_stock from public.productos_calzado where id = v_t40;
  if v_stock <> 4 then raise exception 'FALLO: la talla 40 no debía cambiar (quedó %)', v_stock; end if;

  select count(*) into v_n from public.conteos_inventario
    where id = v_conteo and alcance = 'Tennis' and nota = 'Conteo de prueba' and created_by = v_ana
      and tallas_contadas = 3 and tallas_ajustadas = 2 and unidades_faltantes = 2 and unidades_sobrantes = 1;
  if v_n <> 1 then raise exception 'FALLO: cabecera del conteo'; end if;
  select count(*) into v_n from public.conteo_items
    where conteo_id = v_conteo and producto_id = v_t39 and sistema = 2 and contado = 3 and diferencia = 1
      and motivo = 'error' and nota = 'llegó sin registrar' and created_by = v_ana;
  if v_n <> 1 then raise exception 'FALLO: ítem con sobrante'; end if;
  select count(*) into v_n from public.conteo_items
    where conteo_id = v_conteo and producto_id = v_t40 and diferencia = 0 and motivo is null;
  if v_n <> 1 then raise exception 'FALLO: la talla que coincide también queda en el conteo'; end if;

  -- Historial de acciones: el conteo, sus ítems y el stock de cada talla ajustada, a nombre de Ana.
  select count(*) into v_n from public.auditoria
    where tabla = 'conteos_inventario' and registro_id = v_conteo::text and accion = 'crear' and usuario_id = v_ana;
  if v_n <> 1 then raise exception 'FALLO: el conteo no quedó en el historial'; end if;
  select count(*) into v_n from public.auditoria
    where tabla = 'conteo_items' and accion = 'crear' and usuario_id = v_ana and despues ->> 'conteo_id' = v_conteo::text;
  if v_n <> 3 then raise exception 'FALLO: los ítems del conteo no quedaron en el historial (%)', v_n; end if;
  select count(*) into v_n from public.auditoria
    where tabla = 'productos_calzado' and registro_id = v_t38::text and accion = 'editar' and usuario_id = v_ana
      and antes ->> 'stock_actual' = '5' and despues ->> 'stock_actual' = '3';
  if v_n <> 1 then raise exception 'FALLO: el ajuste de stock no quedó en el historial'; end if;

  -- ===== Reintento con la misma clave: el mismo conteo, sin ajustar otra vez =====
  perform pg_temp.como(v_ana);
  r2 := public.registrar_conteo(jsonb_build_object('alcance', 'Tennis', 'items', v_items), v_clave);
  execute 'reset role';
  if not (r2 ->> 'repetido')::boolean or (r2 ->> 'conteo_id')::uuid <> v_conteo then
    raise exception 'FALLO: el reintento debía devolver el mismo conteo (%)', r2;
  end if;
  select stock_actual into v_stock from public.productos_calzado where id = v_t38;
  if v_stock <> 3 then raise exception 'FALLO: el reintento ajustó otra vez (quedó %)', v_stock; end if;
  select count(*) into v_n from public.conteos_inventario;
  if v_n <> 1 then raise exception 'FALLO: el reintento duplicó el conteo'; end if;

  -- ===== El stock cambió mientras se contaba (p. ej. una venta): no guarda nada =====
  update public.productos_calzado set stock_actual = 2 where id = v_t38; -- se vendió uno
  perform pg_temp.como(v_ana);
  r := public.registrar_conteo(jsonb_build_object('alcance', 'Tennis', 'items', jsonb_build_array(
    jsonb_build_object('producto_id', v_t38, 'sistema', 3, 'contado', 1, 'motivo', 'dano'),
    jsonb_build_object('producto_id', v_t40, 'sistema', 4, 'contado', 2, 'motivo', 'perdida'))), gen_random_uuid());
  execute 'reset role';
  if (r ->> 'aplicado')::boolean or jsonb_array_length(r -> 'cambiados') <> 1
     or r -> 'cambiados' -> 0 ->> 'producto_id' <> v_t38::text
     or (r -> 'cambiados' -> 0 ->> 'sistema_antes')::int <> 3 or (r -> 'cambiados' -> 0 ->> 'sistema_ahora')::int <> 2 then
    raise exception 'FALLO: debía avisar que cambió la talla 38 sin guardar (%)', r;
  end if;
  select stock_actual into v_stock from public.productos_calzado where id = v_t40;
  if v_stock <> 4 then raise exception 'FALLO: con stock cambiado no debía ajustar nada (40 quedó %)', v_stock; end if;
  select count(*) into v_n from public.conteos_inventario;
  if v_n <> 1 then raise exception 'FALLO: con stock cambiado no debía guardar el conteo'; end if;

  -- ===== Validaciones (y un error no deja nada a medias) =====
  perform pg_temp.como(v_ana);
  v_err := pg_temp.error_de(format('select public.registrar_conteo(%L)', jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('producto_id', v_t40, 'sistema', 4, 'contado', 1, 'motivo', 'perdida'),
    jsonb_build_object('producto_id', v_t38, 'sistema', 2, 'contado', 1)))));
  if v_err not like '%elige el motivo%' then raise exception 'FALLO: diferencia sin motivo (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.registrar_conteo(%L)', jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('producto_id', v_t40, 'sistema', 4, 'contado', 4, 'motivo', 'error')))));
  if v_err not like '%no lleva motivo%' then raise exception 'FALLO: motivo sin diferencia (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.registrar_conteo(%L)', jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('producto_id', v_t40, 'sistema', 4, 'contado', 6, 'motivo', 'dano')))));
  if v_err not like '%solo explican faltantes%' then raise exception 'FALLO: daño con sobrante (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.registrar_conteo(%L)', jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('producto_id', v_t40, 'sistema', 4, 'contado', 3, 'motivo', 'otro', 'nota', '  ')))));
  if v_err not like '%escribe una nota%' then raise exception 'FALLO: "Otro" sin nota (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.registrar_conteo(%L)', jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('producto_id', v_t40, 'sistema', 4, 'contado', -1, 'motivo', 'perdida')))));
  if v_err not like '%entero, 0 o más%' then raise exception 'FALLO: contado negativo (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.registrar_conteo(%L)', jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('producto_id', v_t40, 'sistema', 4, 'contado', 2.5, 'motivo', 'perdida')))));
  if v_err not like '%entero, 0 o más%' then raise exception 'FALLO: contado decimal (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.registrar_conteo(%L)', jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('producto_id', v_t40, 'sistema', 4, 'contado', 3, 'motivo', 'perdida'),
    jsonb_build_object('producto_id', v_t40, 'sistema', 4, 'contado', 3, 'motivo', 'perdida')))));
  if v_err not like '%dos veces%' then raise exception 'FALLO: talla repetida (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.registrar_conteo(%L)', jsonb_build_object('items', '[]'::jsonb)));
  if v_err not like '%no tiene tallas%' then raise exception 'FALLO: conteo vacío (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.registrar_conteo(%L)', jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('producto_id', gen_random_uuid(), 'sistema', 1, 'contado', 0, 'motivo', 'perdida')))));
  if v_err not like '%ya no existe%' then raise exception 'FALLO: talla inexistente (%)', v_err; end if;

  -- Nadie escribe las tablas directo, ni con `inventario`.
  v_err := pg_temp.error_de(format(
    'insert into public.conteos_inventario (alcance, tallas_contadas, tallas_ajustadas) values (%L, 1, 0)', 'a mano'));
  if v_err not like '%permission denied%' then raise exception 'FALLO: insertar un conteo a mano (%)', v_err; end if;
  v_err := pg_temp.error_de(format('update public.conteo_items set contado = 9 where conteo_id = %L', v_conteo));
  if v_err not like '%permission denied%' then raise exception 'FALLO: corregir un ítem a mano (%)', v_err; end if;
  v_err := pg_temp.error_de(format('delete from public.conteos_inventario where id = %L', v_conteo));
  if v_err not like '%permission denied%' then raise exception 'FALLO: borrar un conteo a mano (%)', v_err; end if;
  execute 'reset role';

  select stock_actual into v_stock from public.productos_calzado where id = v_t40;
  if v_stock <> 4 then raise exception 'FALLO: un conteo con error no debía ajustar (40 quedó %)', v_stock; end if;

  -- ===== Sin `inventario` no registra ni lee =====
  perform pg_temp.como(v_beto);
  v_err := pg_temp.error_de(format('select public.registrar_conteo(%L)', jsonb_build_object('items', jsonb_build_array(
    jsonb_build_object('producto_id', v_t40, 'sistema', 4, 'contado', 3, 'motivo', 'perdida')))));
  if v_err not like '%No tienes permiso%' then raise exception 'FALLO: sin `inventario` no debe registrar (%)', v_err; end if;
  select count(*) into v_n from public.conteos_inventario;
  if v_n <> 0 then raise exception 'FALLO: sin `inventario` no debe ver conteos'; end if;
  execute 'reset role';

  raise exception 'CONTEO_OK_ROLLBACK';
end $$;
