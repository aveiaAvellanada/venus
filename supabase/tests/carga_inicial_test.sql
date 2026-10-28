-- Test de la Carga inicial del panel web (20261026001601_carga_inicial_fotos):
--   - cargar_inventario guarda la foto en las tallas nuevas y la cambia en las
--     existentes (sin tocar su stock); sin foto conserva la que tenga;
--   - el precio máximo es opcional (si viene, no puede ser menor que el mínimo);
--   - una foto que no es una dirección web es un error;
--   - en el bucket `productos`, reemplazar y borrar fotos pide `inventario`,
--     `carga_inicial` o `recibir_mercancia`.
--
-- Corre en una transacción. Éxito = termina con el error CARGA_INICIAL_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/carga_inicial_test.sql

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
  v_carga uuid; v_ventas uuid; v_t38 uuid; v_obj uuid;
  r jsonb; v_err text; v_n bigint; v_stock int; v_foto text; v_max numeric; v_clave uuid; v_lote jsonb;
  v_foto1 text := 'https://x.supabase.co/storage/v1/object/public/productos/catalogo/dg-1-rojo.webp?v=1';
  v_foto2 text := 'https://x.supabase.co/storage/v1/object/public/productos/catalogo/dg-1-rojo.webp?v=2';
begin
  insert into auth.users (id, email, aud, role) values (v_dueno, 'jefe@venus.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, usuario) values (v_dueno, 'Jefe Test', 'dueno', 'jefetest');
  insert into storage.buckets (id, name, public) values ('productos', 'productos', true) on conflict do nothing;

  perform pg_temp.como(v_dueno);
  v_carga := public.crear_empleado('Carla Test', 'carlatest', '482915', array['carga_inicial']);
  v_ventas := public.crear_empleado('Vero Test', 'verotest', '730264', array['ventas']);

  -- ===== Tallas nuevas con foto y sin máximo =====
  r := public.cargar_inventario(jsonb_build_array(
    jsonb_build_object('fila', 1, 'categoria', 'Chanclas', 'descripcion', 'Diana Gold', 'marca', 'Manisol', 'referencia', 'DG-1',
                       'color', 'Rojo', 'talla', '37', 'precio_minimo', 30000, 'stock', 10, 'foto_url', v_foto1),
    jsonb_build_object('fila', 2, 'categoria', 'Chanclas', 'descripcion', 'Diana Gold', 'marca', 'Manisol', 'referencia', 'DG-1',
                       'color', 'Rojo', 'talla', '38', 'precio_minimo', 30000, 'precio_maximo', 35000, 'stock', 4, 'foto_url', v_foto1)
  ));
  if r <> '{"creados": 2, "actualizados": 0, "sin_cambios": 0}'::jsonb then
    raise exception 'FALLO: resumen inesperado al crear: %', r;
  end if;
  execute 'reset role';
  select id, stock_actual, foto_url, precio_maximo into v_t38, v_stock, v_foto, v_max
    from public.productos_calzado where referencia = 'DG-1' and talla = '38';
  if v_stock <> 4 or v_foto <> v_foto1 or v_max <> 35000 then
    raise exception 'FALLO: la talla nueva no quedó con su stock, foto y máximo (%, %, %)', v_stock, v_foto, v_max;
  end if;
  if not exists (select 1 from public.productos_calzado where referencia = 'DG-1' and talla = '37'
                   and precio_maximo is null and foto_url = v_foto1 and stock_actual = 10) then
    raise exception 'FALLO: una talla sin máximo debía crearse con el máximo vacío';
  end if;

  -- ===== Foto nueva en una existente: cambia la foto, no el stock =====
  perform pg_temp.como(v_dueno);
  r := public.cargar_inventario(jsonb_build_array(
    jsonb_build_object('fila', 1, 'categoria', 'Chanclas', 'descripcion', 'Diana Gold', 'marca', 'Manisol', 'referencia', 'dg-1',
                       'color', 'ROJO', 'talla', '38', 'precio_minimo', 30000, 'precio_maximo', 35000, 'stock', 0, 'foto_url', v_foto2)
  ));
  if r <> '{"creados": 0, "actualizados": 1, "sin_cambios": 0}'::jsonb then
    raise exception 'FALLO: cambiar la foto debía contar como actualizada: %', r;
  end if;
  execute 'reset role';
  select stock_actual, foto_url into v_stock, v_foto from public.productos_calzado where id = v_t38;
  if v_stock <> 4 or v_foto <> v_foto2 then
    raise exception 'FALLO: la foto debía cambiar sin tocar el stock (%, %)', v_stock, v_foto;
  end if;

  -- ===== Sin foto se conserva la que tiene =====
  perform pg_temp.como(v_dueno);
  r := public.cargar_inventario(jsonb_build_array(
    jsonb_build_object('fila', 1, 'categoria', 'Chanclas', 'descripcion', 'Diana Gold', 'marca', 'Manisol', 'referencia', 'DG-1',
                       'color', 'Rojo', 'talla', '38', 'precio_minimo', 30000, 'precio_maximo', 35000, 'stock', 0)
  ));
  if r <> '{"creados": 0, "actualizados": 0, "sin_cambios": 1}'::jsonb then
    raise exception 'FALLO: sin foto y sin cambios no debía actualizar: %', r;
  end if;
  execute 'reset role';
  if (select foto_url from public.productos_calzado where id = v_t38) <> v_foto2 then
    raise exception 'FALLO: sin foto debía conservar la que tenía';
  end if;

  -- ===== Otra caja del mismo zapato: los pares se suman (20261028120000) =====
  perform pg_temp.como(v_carga);
  v_clave := gen_random_uuid();
  v_lote := jsonb_build_array(
    -- la 38 ya tiene 4 pares: se suman 3; el precio provisional cambia
    jsonb_build_object('fila', 1, 'categoria', 'Chanclas', 'descripcion', 'Diana Gold', 'marca', 'Manisol', 'referencia', 'DG-1',
                       'color', 'Rojo', 'talla', '38', 'precio_minimo', 30000, 'precio_maximo', 35000, 'stock', 0, 'sumar', 3),
    -- una talla nueva en la misma carga
    jsonb_build_object('fila', 2, 'categoria', 'Chanclas', 'descripcion', 'Diana Gold', 'marca', 'Manisol', 'referencia', 'DG-1',
                       'color', 'Rojo', 'talla', '39', 'precio_minimo', 30000, 'stock', 2)
  );
  r := public.cargar_inventario(v_lote, null, v_clave);
  if r <> '{"creados": 1, "actualizados": 1, "sin_cambios": 0}'::jsonb then
    raise exception 'FALLO: sumar pares debía contar como actualizada: %', r;
  end if;
  -- Se cayó la señal y se reintenta con la misma clave: no suma otra vez.
  r := public.cargar_inventario(v_lote, null, v_clave);
  if not coalesce((r ->> 'repetida')::boolean, false) or (r ->> 'creados')::int <> 1 then
    raise exception 'FALLO: el reintento debía devolver la misma respuesta marcada como repetida: %', r;
  end if;
  execute 'reset role';
  if (select stock_actual from public.productos_calzado where id = v_t38) <> 7 then
    raise exception 'FALLO: la 38 debía quedar con 4 + 3 = 7 pares (quedó %)', (select stock_actual from public.productos_calzado where id = v_t38);
  end if;
  if (select count(*) from public.productos_calzado where referencia = 'DG-1' and talla = '39') <> 1 then
    raise exception 'FALLO: el reintento no debía crear la 39 otra vez';
  end if;
  -- Sin clave, la carga masiva por Excel sigue como antes: el stock de lo existente no cambia.
  perform pg_temp.como(v_carga);
  r := public.cargar_inventario(jsonb_build_array(
    jsonb_build_object('fila', 1, 'categoria', 'Chanclas', 'descripcion', 'Diana Gold', 'marca', 'Manisol', 'referencia', 'DG-1',
                       'color', 'Rojo', 'talla', '38', 'precio_minimo', 30000, 'precio_maximo', 35000, 'stock', 99)));
  execute 'reset role';
  if (select stock_actual from public.productos_calzado where id = v_t38) <> 7 then
    raise exception 'FALLO: sin `sumar` el stock de lo existente no debía cambiar';
  end if;

  -- ===== Precios provisionales: se cambian desde la carga (con permiso de inventario) =====
  perform pg_temp.como(v_dueno);
  r := public.cargar_inventario(jsonb_build_array(
    jsonb_build_object('fila', 1, 'categoria', 'Chanclas', 'descripcion', 'Diana Gold', 'marca', 'Manisol', 'referencia', 'DG-1',
                       'color', 'Rojo', 'talla', '38', 'precio_minimo', 42000, 'stock', 0)));
  execute 'reset role';
  if not exists (select 1 from public.productos_calzado where id = v_t38 and precio_minimo = 42000 and precio_maximo is null and stock_actual = 7) then
    raise exception 'FALLO: el precio debía cambiar sin tocar el stock';
  end if;
  perform pg_temp.como(v_carga);
  v_err := pg_temp.error_de(format('select public.cargar_inventario(%L)', jsonb_build_array(
    jsonb_build_object('fila', 9, 'categoria', 'Chanclas', 'descripcion', 'Diana Gold', 'marca', 'Manisol', 'referencia', 'DG-1',
                       'color', 'Rojo', 'talla', '38', 'precio_minimo', 1, 'stock', 0))));
  if v_err not like '%no tienes permiso para cambiar precios%' then raise exception 'FALLO: sin inventario cambió un precio (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.cargar_inventario(%L)', jsonb_build_array(
    jsonb_build_object('fila', 8, 'categoria', 'Chanclas', 'descripcion', 'Diana Gold', 'marca', 'Manisol', 'referencia', 'DG-1',
                       'color', 'Rojo', 'talla', '38', 'precio_minimo', 42000, 'stock', 0, 'sumar', -2))));
  if v_err not like 'Fila 8: los pares que se suman%' then raise exception 'FALLO: sumar negativo (%)', v_err; end if;
  execute 'reset role';

  -- ===== Errores =====
  perform pg_temp.como(v_dueno);
  v_err := pg_temp.error_de(format('select public.cargar_inventario(%L)', jsonb_build_array(
    jsonb_build_object('fila', 4, 'categoria', 'Otros', 'descripcion', 'X', 'talla', '40', 'precio_minimo', 5, 'precio_maximo', 2, 'stock', 1))));
  if v_err not like 'Fila 4: revisa los precios%' then raise exception 'FALLO: máximo menor que el mínimo (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.cargar_inventario(%L)', jsonb_build_array(
    jsonb_build_object('fila', 5, 'categoria', 'Otros', 'descripcion', 'X', 'talla', '40', 'precio_minimo', 5, 'stock', 1, 'foto_url', 'C:\fotos\x.jpg'))));
  if v_err not like 'Fila 5: la foto no es una dirección válida%' then raise exception 'FALLO: foto inválida (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.cargar_inventario(%L)', jsonb_build_array(
    jsonb_build_object('fila', 6, 'categoria', 'Otros', 'descripcion', 'X', 'talla', '40', 'stock', 1))));
  if v_err not like 'Fila 6: revisa los precios%' then raise exception 'FALLO: sin precio mínimo (%)', v_err; end if;

  -- ===== Storage: reemplazar y borrar fotos =====
  execute 'reset role';
  insert into storage.objects (bucket_id, name) values ('productos', 'catalogo/dg-1-rojo.webp') returning id into v_obj;

  perform pg_temp.como(v_ventas);
  update storage.objects set name = name where id = v_obj;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FALLO: sin permiso no debe reemplazar fotos'; end if;
  delete from storage.objects where id = v_obj;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FALLO: sin permiso no debe borrar fotos'; end if;

  perform pg_temp.como(v_carga);
  update storage.objects set name = name where id = v_obj;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO: con carga_inicial debe poder reemplazar la foto'; end if;
  delete from storage.objects where id = v_obj;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO: con carga_inicial debe poder borrar la foto'; end if;
  execute 'reset role';

  raise exception 'CARGA_INICIAL_OK_ROLLBACK';
end $$;
