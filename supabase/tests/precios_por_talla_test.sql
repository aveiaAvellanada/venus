-- Test de precios por talla y garantía (ajustes 2026-10-16, Ola 2):
--   - el máximo es opcional (null); el mínimo, obligatorio en cada tramo;
--   - guardar_tramos_precio aplica el precio del tramo a todos los colores de
--     las tallas del tramo y deja historial; las tallas sin tramo no cambian;
--   - tramos que se cruzan, con talla invertida o con máximo < mínimo se rechazan;
--   - una variante nueva hereda el precio del tramo y la garantía de su referencia;
--   - fijar_garantia_referencia cambia toda la referencia;
--   - sin el permiso `inventario` no se puede.
--
-- Corre en una transacción. Éxito = termina con el error PRECIOS_TALLA_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/precios_por_talla_test.sql

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
  r jsonb; v_err text; v_n bigint;
  v_min numeric; v_max numeric; v_gar int;
  v_nuevo uuid;
begin
  insert into auth.users (id, email, aud, role) values (v_dueno, 'jefe@venus.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, usuario) values (v_dueno, 'Jefe Test', 'dueno', 'jefetest');
  -- Tennis Venus: dos colores x tallas 36, 38, 40, 44 y una "Única"; el máximo es opcional.
  insert into public.productos_calzado (descripcion, referencia, categoria, talla, color, precio_minimo, stock_actual, stock_minimo)
    select 'Tennis Venus', ' TV-1 ', 'Tennis', t, c, 50000, 5, 1
    from unnest(array['36','38','40','44','Única']) t, unnest(array['Negro','Blanco']) c;
  select count(*) into v_n from public.productos_calzado where referencia = ' TV-1 ' and precio_maximo is null;
  if v_n <> 10 then raise exception 'FALLO: el máximo debía poder quedar vacío (%)', v_n; end if;

  perform pg_temp.como(v_dueno);
  v_ana := public.crear_empleado('Ana Test', 'anatest', '482915', array['inventario']);
  v_beto := public.crear_empleado('Beto Test', 'betotest', '730264', array['ventas']);

  -- ===== Sin permiso no se puede =====
  perform pg_temp.como(v_beto);
  v_err := pg_temp.error_de($e$select public.guardar_tramos_precio('TV-1', '[]'::jsonb)$e$);
  if v_err not like '%permiso%' then raise exception 'FALLO: sin inventario debía rechazar: %', v_err; end if;
  v_err := pg_temp.error_de($e$select public.fijar_garantia_referencia('TV-1', 90)$e$);
  if v_err not like '%permiso%' then raise exception 'FALLO: sin inventario no fija garantía: %', v_err; end if;

  -- ===== Validaciones =====
  perform pg_temp.como(v_ana);
  v_err := pg_temp.error_de($e$select public.guardar_tramos_precio('TV-1', '[{"talla_desde":30,"talla_hasta":38,"precio_minimo":55000},{"talla_desde":38,"talla_hasta":44,"precio_minimo":60000}]')$e$);
  if v_err not like '%cruzan%' then raise exception 'FALLO: tramos que se cruzan: %', v_err; end if;
  v_err := pg_temp.error_de($e$select public.guardar_tramos_precio('TV-1', '[{"talla_desde":38,"talla_hasta":30,"precio_minimo":55000}]')$e$);
  if v_err not like '%mayor que la final%' then raise exception 'FALLO: talla invertida: %', v_err; end if;
  v_err := pg_temp.error_de($e$select public.guardar_tramos_precio('TV-1', '[{"talla_desde":30,"talla_hasta":38,"precio_minimo":55000,"precio_maximo":50000}]')$e$);
  if v_err not like '%máximo es menor%' then raise exception 'FALLO: máximo < mínimo: %', v_err; end if;
  v_err := pg_temp.error_de($e$select public.guardar_tramos_precio('TV-1', '[{"talla_desde":30,"talla_hasta":38}]')$e$);
  if v_err not like '%precio mínimo%' then raise exception 'FALLO: el mínimo es obligatorio: %', v_err; end if;

  -- ===== Aplicar tramos: 30-38 -> 55.000, 39-44 -> 60.000/70.000 =====
  r := public.guardar_tramos_precio('TV-1',
    '[{"talla_desde":30,"talla_hasta":38,"precio_minimo":55000},{"talla_desde":39,"talla_hasta":44,"precio_minimo":60000,"precio_maximo":70000}]');
  if (r ->> 'tramos')::int <> 2 or (r ->> 'actualizados')::int <> 8 or (r ->> 'sin_tramo')::int <> 2 then
    raise exception 'FALLO: resumen inesperado: %', r;
  end if;
  execute 'reset role';
  select count(*) into v_n from public.productos_calzado
    where referencia = ' TV-1 ' and talla in ('36','38') and precio_minimo = 55000 and precio_maximo is null;
  if v_n <> 4 then raise exception 'FALLO: 30-38 debía quedar en 55.000 en ambos colores (%)', v_n; end if;
  select count(*) into v_n from public.productos_calzado
    where referencia = ' TV-1 ' and talla in ('40','44') and precio_minimo = 60000 and precio_maximo = 70000;
  if v_n <> 4 then raise exception 'FALLO: 39-44 debía quedar en 60.000/70.000 en ambos colores (%)', v_n; end if;
  select count(*) into v_n from public.productos_calzado where referencia = ' TV-1 ' and talla = 'Única' and precio_minimo = 50000;
  if v_n <> 2 then raise exception 'FALLO: la talla sin tramo no debía cambiar'; end if;
  select count(*) into v_n from public.historial_precios_calzado where motivo = 'Precios por talla';
  if v_n <> 8 then raise exception 'FALLO: el historial debía registrar 8 cambios (%)', v_n; end if;
  select count(*) into v_n from public.auditoria where tabla = 'calzado_tramos_precio' and accion = 'crear';
  if v_n <> 2 then raise exception 'FALLO: la auditoría debía registrar los 2 tramos (%)', v_n; end if;

  -- ===== Garantía por referencia + variante nueva =====
  perform pg_temp.como(v_ana);
  v_n := public.fijar_garantia_referencia('tv-1', 90);
  if v_n <> 10 then raise exception 'FALLO: la garantía debía cambiar las 10 variantes (%)', v_n; end if;
  execute 'reset role';
  insert into public.productos_calzado (descripcion, referencia, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Tennis Venus', 'TV-1', 'Tennis', '42', 'Rojo', 1, 2, 3, 1) returning id into v_nuevo;
  select precio_minimo, precio_maximo, garantia_dias into v_min, v_max, v_gar from public.productos_calzado where id = v_nuevo;
  if v_min <> 60000 or v_max <> 70000 or v_gar <> 90 then
    raise exception 'FALLO: la variante nueva debía heredar tramo y garantía (%/%/%)', v_min, v_max, v_gar;
  end if;

  -- ===== [] quita los tramos sin tocar precios =====
  perform pg_temp.como(v_ana);
  r := public.guardar_tramos_precio('TV-1', '[]');
  if (r ->> 'tramos')::int <> 0 or (r ->> 'actualizados')::int <> 0 then raise exception 'FALLO: quitar tramos: %', r; end if;
  execute 'reset role';
  select count(*) into v_n from public.calzado_tramos_precio;
  if v_n <> 0 then raise exception 'FALLO: debían borrarse los tramos'; end if;

  raise exception 'PRECIOS_TALLA_OK_ROLLBACK';
end $$;

rollback;
