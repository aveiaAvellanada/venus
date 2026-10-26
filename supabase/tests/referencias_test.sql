-- Test de la referencia automática y las categorías (20261026120000):
--   - un zapato nuevo sin referencia recibe CAT-MARC-NNN; otra talla u otro
--     color con la misma descripción y marca recibe el mismo código;
--   - el consecutivo salta un código que ya esté usado;
--   - una referencia escrita se respeta, no se borra y cambiarla es del dueño;
--   - la talla nueva hereda la garantía de su modelo;
--   - referencia_para_modelo: el código antes de guardar (con permiso);
--   - registrar_compra y cargar_inventario reconocen por descripción + marca
--     cuando no llega la referencia, y Deportivo ya no es una categoría.
--
-- Corre en una transacción. Éxito = termina con el error REFERENCIAS_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/referencias_test.sql

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

create function pg_temp.nuevo(p_desc text, p_marca text, p_cat text, p_talla text, p_color text, p_ref text default null)
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.productos_calzado (descripcion, marca, referencia, categoria, talla, color, precio_minimo, stock_actual, stock_minimo)
    values (p_desc, p_marca, p_ref, p_cat, p_talla, p_color, 50000, 1, 1) returning id into v;
  return v;
end $$;

create function pg_temp.ref(p_id uuid) returns text language sql as $$
  select referencia from public.productos_calzado where id = p_id
$$;

grant execute on function pg_temp.error_de(text), pg_temp.como(uuid), pg_temp.ref(uuid) to authenticated, anon;

do $$
declare
  v_dueno uuid := gen_random_uuid();
  v_ana uuid; v_beto uuid; v_prov uuid;
  v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_e uuid; v_f uuid; v_g uuid;
  r jsonb; v_err text; v_n bigint; v_txt text; v_gar int;
begin
  insert into auth.users (id, email, aud, role) values (v_dueno, 'jefe@venus.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, usuario) values (v_dueno, 'Jefe Test', 'dueno', 'jefetest');
  insert into public.proveedores (nombre) values ('Proveedor Test') returning id into v_prov;

  -- ===== Código automático =====
  v_a := pg_temp.nuevo('Tennis Zeus', 'Nike', 'Tennis', '38', 'Negro');
  if pg_temp.ref(v_a) <> 'TEN-NIKE-001' then raise exception 'FALLO: primer Tennis Nike quedó con %', pg_temp.ref(v_a); end if;
  -- Otra talla y otro color, escrito distinto: el mismo modelo.
  v_b := pg_temp.nuevo(' tennis ZEUS', 'nike ', 'Tennis', '39', 'Blanco');
  if pg_temp.ref(v_b) <> 'TEN-NIKE-001' then raise exception 'FALLO: otra talla del modelo quedó con %', pg_temp.ref(v_b); end if;
  -- Misma descripción, otra marca: otro modelo.
  v_c := pg_temp.nuevo('Tennis Zeus', 'Adidas', 'Tennis', '40', 'Negro');
  if pg_temp.ref(v_c) <> 'TEN-ADID-001' then raise exception 'FALLO: Tennis Adidas quedó con %', pg_temp.ref(v_c); end if;
  -- Sin marca, con tildes y ñ en la marca, y las categorías nuevas.
  v_d := pg_temp.nuevo('Bota trabajo', null, 'Botas material', '40', 'Café');
  if pg_temp.ref(v_d) <> 'BMA-SM-001' then raise exception 'FALLO: bota sin marca quedó con %', pg_temp.ref(v_d); end if;
  v_e := pg_temp.nuevo('Guayo', 'Ñandú Sport', 'Futbol', '40', 'Negro');
  if pg_temp.ref(v_e) <> 'FUT-NAND-001' then raise exception 'FALLO: guayo Ñandú quedó con %', pg_temp.ref(v_e); end if;
  if pg_temp.ref(pg_temp.nuevo('Sandalia niña', 'Bubble', 'Infantil', '28', 'Rosado')) <> 'INF-BUBB-001' then
    raise exception 'FALLO: la categoría Infantil no da INF';
  end if;
  -- El consecutivo salta un código que ya alguien escribió a mano.
  perform pg_temp.nuevo('Otro tennis', 'Nike', 'Tennis', '40', 'Rojo', 'TEN-NIKE-002');
  v_f := pg_temp.nuevo('Air Force', 'Nike', 'Tennis', '40', 'Blanco');
  if pg_temp.ref(v_f) <> 'TEN-NIKE-003' then raise exception 'FALLO: no saltó el código usado (%)', pg_temp.ref(v_f); end if;
  -- Una referencia escrita se respeta.
  v_g := pg_temp.nuevo('Clásico', 'Verlon', 'Clasico', '40', 'Café', 'VR-77');
  if pg_temp.ref(v_g) <> 'VR-77' then raise exception 'FALLO: la referencia escrita quedó %', pg_temp.ref(v_g); end if;

  -- Deportivo ya no es una categoría.
  v_err := pg_temp.error_de($q$insert into public.productos_calzado (descripcion, categoria, precio_minimo) values ('x', 'Deportivo', 1)$q$);
  if v_err not like '%categoria_check%' then raise exception 'FALLO: aceptó Deportivo (%)', v_err; end if;

  -- ===== La talla nueva hereda la garantía del modelo =====
  update public.productos_calzado set garantia_dias = 30 where referencia = 'TEN-NIKE-001';
  v_d := pg_temp.nuevo('Tennis Zeus', 'Nike', 'Tennis', '41', 'Negro');
  select garantia_dias into v_gar from public.productos_calzado where id = v_d;
  if v_gar is distinct from 30 then raise exception 'FALLO: la talla nueva no heredó la garantía (%)', v_gar; end if;

  -- ===== No se borra y cambiarla es del dueño =====
  perform pg_temp.como(v_dueno);
  v_ana := public.crear_empleado('Ana Test', 'anatest', '482915', array['inventario', 'recibir_mercancia', 'costos', 'carga_inicial']);
  v_beto := public.crear_empleado('Beto Test', 'betotest', '730264', array['ventas']);

  perform pg_temp.como(v_ana);
  update public.productos_calzado set referencia = '' where id = v_a;
  if pg_temp.ref(v_a) <> 'TEN-NIKE-001' then raise exception 'FALLO: se pudo borrar la referencia (%)', pg_temp.ref(v_a); end if;
  -- guardar_producto_calzado sin referencia (la app no la manda) tampoco la borra.
  perform public.guardar_producto_calzado(v_a, 'Tennis', 'Tennis Zeus', null, '38', 'Negro', 80000, null, null, 2, 1, null, null, true, 'Nike');
  if pg_temp.ref(v_a) <> 'TEN-NIKE-001' then raise exception 'FALLO: guardar sin referencia la borró (%)', pg_temp.ref(v_a); end if;
  v_err := pg_temp.error_de(format('update public.productos_calzado set referencia = %L where id = %L', 'OTRA-1', v_a));
  if v_err not like '%Solo el dueño%' then raise exception 'FALLO: un empleado cambió la referencia (%)', v_err; end if;
  perform pg_temp.como(v_dueno);
  update public.productos_calzado set referencia = 'TEN-NIKE-100' where id = v_f;
  if pg_temp.ref(v_f) <> 'TEN-NIKE-100' then raise exception 'FALLO: el dueño no pudo cambiar la referencia'; end if;

  -- ===== referencia_para_modelo =====
  perform pg_temp.como(v_ana);
  if public.referencia_para_modelo('TENNIS ZEUS ', 'Nike', 'Tennis') <> 'TEN-NIKE-001' then
    raise exception 'FALLO: referencia_para_modelo no dio el código del modelo';
  end if;
  v_txt := public.referencia_para_modelo('Mocasín', 'Verlon', 'Clasico');
  if v_txt <> 'CLA-VERL-001' then raise exception 'FALLO: código nuevo para el mocasín: %', v_txt; end if;
  -- El número queda apartado: el siguiente es otro.
  if public.referencia_para_modelo('Mocasín 2', 'Verlon', 'Clasico') <> 'CLA-VERL-002' then
    raise exception 'FALLO: el código apartado se repitió';
  end if;
  v_err := pg_temp.error_de($q$select public.referencia_para_modelo('  ', 'Nike', 'Tennis')$q$);
  if v_err not like '%descripción%' then raise exception 'FALLO: sin descripción (%)', v_err; end if;
  perform pg_temp.como(v_beto);
  v_err := pg_temp.error_de($q$select public.referencia_para_modelo('Tennis', 'Nike', 'Tennis')$q$);
  if v_err not like '%permiso%' then raise exception 'FALLO: sin permiso pidió un código (%)', v_err; end if;

  -- ===== registrar_compra sin referencia =====
  perform pg_temp.como(v_ana);
  r := public.registrar_compra(jsonb_build_object(
    'proveedor_id', v_prov, 'condicion_pago', 'contado',
    'items', jsonb_build_array(
      -- talla que ya existe, por descripción + marca + color + talla
      jsonb_build_object('descripcion', 'tennis zeus', 'marca', 'NIKE', 'categoria', 'Tennis', 'color', 'negro', 'talla', '38',
                         'cantidad', 2, 'costo_unitario', 50000, 'precio_minimo', 80000),
      -- talla nueva de ese modelo: su mismo código
      jsonb_build_object('descripcion', 'Tennis Zeus', 'marca', 'Nike', 'categoria', 'Tennis', 'color', 'Negro', 'talla', '42',
                         'cantidad', 1, 'costo_unitario', 50000, 'precio_minimo', 80000),
      -- zapato nuevo: código nuevo (dos tallas, un solo código)
      jsonb_build_object('descripcion', 'Chancla playa', 'marca', 'Rider', 'categoria', 'Chanclas', 'color', 'Azul', 'talla', '40',
                         'cantidad', 3, 'costo_unitario', 10000, 'precio_minimo', 20000),
      jsonb_build_object('descripcion', 'Chancla playa', 'marca', 'Rider', 'categoria', 'Chanclas', 'color', 'Azul', 'talla', '41',
                         'cantidad', 3, 'costo_unitario', 10000, 'precio_minimo', 20000)
    )));
  if (r ->> 'productos_nuevos')::int <> 3 then raise exception 'FALLO: debía crear 3 tallas nuevas: %', r; end if;
  execute 'reset role';
  select count(*) into v_n from public.productos_calzado where referencia = 'TEN-NIKE-001' and color = 'Negro' and talla = '38';
  if v_n <> 1 or (select stock_actual from public.productos_calzado where id = v_a) <> 4 then
    raise exception 'FALLO: la talla existente se duplicó o no subió el stock';
  end if;
  if not exists (select 1 from public.productos_calzado where referencia = 'TEN-NIKE-001' and talla = '42') then
    raise exception 'FALLO: la talla nueva no quedó en el modelo';
  end if;
  select string_agg(distinct referencia, ',') into v_txt from public.productos_calzado where descripcion = 'Chancla playa';
  if v_txt is distinct from 'CHA-RIDE-001' then raise exception 'FALLO: la chancla nueva quedó con %', v_txt; end if;
  select string_agg(distinct referencia, ',' order by referencia) into v_txt
    from public.compra_items where compra_id = (r ->> 'compra_id')::uuid;
  if v_txt is distinct from 'CHA-RIDE-001,TEN-NIKE-001' then raise exception 'FALLO: compra_items quedó con referencias %', v_txt; end if;

  -- ===== cargar_inventario sin referencia =====
  perform pg_temp.como(v_ana);
  r := public.cargar_inventario(jsonb_build_array(
    jsonb_build_object('fila', 2, 'categoria', 'Tennis', 'descripcion', 'Tennis Zeus', 'marca', 'Adidas', 'color', 'Negro', 'talla', '40',
                       'precio_minimo', 50000, 'stock', 9),
    jsonb_build_object('fila', 3, 'categoria', 'Tennis', 'descripcion', 'Tennis Zeus', 'marca', 'Adidas', 'color', 'Negro', 'talla', '41',
                       'precio_minimo', 50000, 'stock', 2),
    jsonb_build_object('fila', 4, 'categoria', 'Botas material', 'descripcion', 'Botín', 'color', 'Negro', 'talla', '38',
                       'precio_minimo', 70000, 'stock', 1)
  ));
  if (r ->> 'creados')::int <> 2 or (r ->> 'sin_cambios')::int <> 1 then raise exception 'FALLO: carga sin referencia: %', r; end if;
  execute 'reset role';
  select string_agg(distinct referencia, ',') into v_txt from public.productos_calzado where descripcion = 'Tennis Zeus' and marca = 'Adidas';
  if v_txt is distinct from 'TEN-ADID-001' then raise exception 'FALLO: la carga no reconoció el modelo (%)', v_txt; end if;
  if (select referencia from public.productos_calzado where descripcion = 'Botín') <> 'BMA-SM-002' then
    raise exception 'FALLO: el botín quedó con %', (select referencia from public.productos_calzado where descripcion = 'Botín');
  end if;
  perform pg_temp.como(v_ana);
  v_err := pg_temp.error_de(format('select public.cargar_inventario(%L)', jsonb_build_array(
    jsonb_build_object('categoria', 'Deportivo', 'descripcion', 'x', 'precio_minimo', 1, 'stock', 0))));
  if v_err not like '%categoría inválida%' then raise exception 'FALLO: la carga aceptó Deportivo (%)', v_err; end if;
  execute 'reset role';

  raise exception 'REFERENCIAS_OK_ROLLBACK';
end $$;
