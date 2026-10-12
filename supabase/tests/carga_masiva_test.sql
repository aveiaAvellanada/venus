-- Test de cargar_inventario (panel web, fase 1, entrega 4: Carga masiva):
--   - crea tallas nuevas con su stock, precios y costo (en el historial);
--   - reconoce las existentes por referencia (o descripción) + color + talla y
--     actualiza datos y precios SIN tocar el stock;
--   - subir el mismo archivo otra vez no cambia nada (ida y vuelta);
--   - todo o nada: una fila mala no deja nada guardado;
--   - una talla repetida en el archivo es un error;
--   - sin `carga_inicial` no carga; sin `costos` no guarda el costo.
--
-- Corre en una transacción. Éxito = termina con el error CARGA_MASIVA_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/carga_masiva_test.sql

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
  v_ana uuid; v_beto uuid; v_prov uuid; v_t38 uuid; v_sin_ref uuid;
  v_filas jsonb; r jsonb; v_err text; v_n bigint;
  v_stock int; v_min numeric; v_max numeric; v_marca text;
begin
  insert into auth.users (id, email, aud, role) values (v_dueno, 'jefe@venus.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, usuario) values (v_dueno, 'Jefe Test', 'dueno', 'jefetest');
  insert into public.proveedores (nombre) values ('Proveedor Test') returning id into v_prov;
  insert into public.productos_calzado (descripcion, referencia, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Tennis A', 'TA-1', 'Tennis', '38', 'Negro', 80000, 100000, 2, 1) returning id into v_t38;
  insert into public.productos_calzado (descripcion, referencia, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Chancla playa', null, 'Chanclas', '40', 'Azul', 20000, 25000, 9, 1) returning id into v_sin_ref;

  perform pg_temp.como(v_dueno);
  -- Ana carga pero no ve costos; Beto solo vende.
  v_ana := public.crear_empleado('Ana Test', 'anatest', '482915', array['carga_inicial', 'inventario']);
  v_beto := public.crear_empleado('Beto Test', 'betotest', '730264', array['ventas']);

  v_filas := jsonb_build_array(
    -- existente por referencia (otra mayúscula y espacios): cambia marca y precio, el stock del archivo se ignora
    jsonb_build_object('fila', 2, 'categoria', 'Tennis', 'descripcion', 'Tennis A', 'marca', 'Kalzado', 'referencia', ' ta-1 ',
                       'color', 'NEGRO', 'talla', '38', 'precio_minimo', 85000, 'precio_maximo', 105000, 'costo', 50000, 'stock', 99),
    -- existente sin referencia (por descripción): igual que está
    jsonb_build_object('fila', 3, 'categoria', 'Chanclas', 'descripcion', 'Chancla playa', 'color', 'Azul', 'talla', '40',
                       'precio_minimo', 20000, 'precio_maximo', 25000, 'costo', 12000, 'stock', 0),
    -- nuevas
    jsonb_build_object('fila', 4, 'categoria', 'Escolar', 'descripcion', 'Escolar', 'marca', 'Bosi', 'referencia', 'ES-9',
                       'color', 'Negro', 'talla', '24', 'precio_minimo', 45000, 'precio_maximo', 55000, 'costo', 30000, 'stock', 6),
    jsonb_build_object('fila', 5, 'categoria', 'Escolar', 'descripcion', 'Escolar', 'marca', 'Bosi', 'referencia', 'ES-9',
                       'color', 'Negro', 'talla', '36', 'precio_minimo', 60000, 'precio_maximo', 70000, 'costo', 38000, 'stock', 0)
  );
  r := public.cargar_inventario(v_filas, v_prov);
  if r <> '{"creados": 2, "actualizados": 1, "sin_cambios": 1}'::jsonb then
    raise exception 'FALLO: resumen inesperado: %', r;
  end if;

  execute 'reset role';
  select stock_actual, precio_minimo, precio_maximo, marca into v_stock, v_min, v_max, v_marca from public.productos_calzado where id = v_t38;
  if v_stock <> 2 or v_min <> 85000 or v_max <> 105000 or v_marca <> 'Kalzado' then
    raise exception 'FALLO: la existente debía cambiar marca y precio sin tocar el stock (%, %/%, %)', v_stock, v_min, v_max, v_marca;
  end if;
  select count(*) into v_n from public.productos_calzado where lower(referencia) = 'ta-1';
  if v_n <> 1 then raise exception 'FALLO: no debía duplicar la referencia existente'; end if;
  if not exists (select 1 from public.productos_calzado where referencia = 'ES-9' and talla = '24' and stock_actual = 6
                   and precio_minimo = 45000 and marca = 'Bosi' and proveedor_id = v_prov) then
    raise exception 'FALLO: la talla nueva no quedó con su stock, precios y proveedor';
  end if;
  select count(*) into v_n from public.historial_precios_calzado h join public.productos_calzado p on p.id = h.producto_id
    where p.referencia = 'ES-9' and h.motivo = 'Carga inicial' and h.costo_compra in (30000, 38000) and h.registrado_por = v_dueno;
  if v_n <> 2 then raise exception 'FALLO: el costo de las nuevas debía quedar en el historial (hay %)', v_n; end if;
  select count(*) into v_n from public.historial_precios_calzado where producto_id = v_t38 and motivo = 'Carga masiva' and precio_minimo = 85000;
  if v_n <> 1 then raise exception 'FALLO: el cambio de precio debía quedar en el historial'; end if;

  -- ===== Ida y vuelta: el mismo archivo otra vez no cambia nada =====
  perform pg_temp.como(v_dueno);
  r := public.cargar_inventario(v_filas, v_prov);
  if r <> '{"creados": 0, "actualizados": 0, "sin_cambios": 4}'::jsonb then
    raise exception 'FALLO: volver a subir el mismo archivo no debía cambiar nada: %', r;
  end if;

  -- ===== Todo o nada =====
  v_err := pg_temp.error_de(format('select public.cargar_inventario(%L)', jsonb_build_array(
    jsonb_build_object('fila', 2, 'categoria', 'Otros', 'descripcion', 'Nuevo bueno', 'talla', '40',
                       'precio_minimo', 1000, 'precio_maximo', 2000, 'stock', 1),
    jsonb_build_object('fila', 3, 'categoria', 'Sandalias', 'descripcion', 'Malo', 'talla', '40',
                       'precio_minimo', 1000, 'precio_maximo', 2000, 'stock', 1))));
  if v_err not like 'Fila 3: categoría inválida%' then raise exception 'FALLO: categoría inválida (%)', v_err; end if;
  execute 'reset role';
  if exists (select 1 from public.productos_calzado where descripcion = 'Nuevo bueno') then
    raise exception 'FALLO: una fila mala no debe dejar guardadas las buenas';
  end if;

  perform pg_temp.como(v_dueno);
  v_err := pg_temp.error_de(format('select public.cargar_inventario(%L)', jsonb_build_array(
    jsonb_build_object('fila', 2, 'categoria', 'Otros', 'descripcion', 'X', 'referencia', 'R-1', 'color', 'Rojo', 'talla', '40', 'precio_minimo', 1, 'precio_maximo', 2, 'stock', 1),
    jsonb_build_object('fila', 7, 'categoria', 'Otros', 'descripcion', 'X', 'referencia', 'r-1', 'color', 'rojo', 'talla', '40', 'precio_minimo', 1, 'precio_maximo', 2, 'stock', 1))));
  if v_err not like 'Fila 7: esa talla ya viene en otra fila%' then raise exception 'FALLO: talla repetida (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.cargar_inventario(%L)', jsonb_build_array(
    jsonb_build_object('fila', 2, 'categoria', 'Otros', 'descripcion', 'X', 'talla', '40', 'precio_minimo', 3, 'precio_maximo', 2, 'stock', 1))));
  if v_err not like 'Fila 2: revisa los precios%' then raise exception 'FALLO: mínimo mayor que máximo (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.cargar_inventario(%L)', jsonb_build_array(
    jsonb_build_object('fila', 2, 'categoria', 'Otros', 'descripcion', 'X', 'talla', '40', 'precio_minimo', 1, 'precio_maximo', 2, 'stock', 1.5))));
  if v_err not like 'Fila 2: el stock debe ser%' then raise exception 'FALLO: stock decimal (%)', v_err; end if;

  -- ===== Sin `costos` no guarda el costo; sin `carga_inicial` no carga =====
  perform pg_temp.como(v_ana);
  perform public.cargar_inventario(jsonb_build_array(
    jsonb_build_object('fila', 2, 'categoria', 'Otros', 'descripcion', 'De Ana', 'talla', '40', 'precio_minimo', 1000, 'precio_maximo', 2000, 'costo', 500, 'stock', 1)));
  execute 'reset role';
  if exists (select 1 from public.historial_precios_calzado h join public.productos_calzado p on p.id = h.producto_id
             where p.descripcion = 'De Ana' and h.costo_compra is not null) then
    raise exception 'FALLO: sin `costos` no debe guardar el costo';
  end if;
  perform pg_temp.como(v_beto);
  v_err := pg_temp.error_de(format('select public.cargar_inventario(%L)', v_filas));
  if v_err not like '%No tienes permiso%' then raise exception 'FALLO: sin `carga_inicial` no debe cargar (%)', v_err; end if;
  execute 'reset role';

  raise exception 'CARGA_MASIVA_OK_ROLLBACK';
end $$;
