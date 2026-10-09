-- Test de actualizar_precios_lote y obtener_costos_productos (panel web, fase 1):
--   - la vista previa calcula sin tocar nada; aplicar cambia, deja historial y auditoría;
--   - porcentaje, suma y fijo; solo mínimo o solo máximo; redondeo;
--   - no se aplica si algún mínimo quedaría mayor que el máximo;
--   - sin permiso `inventario` no cambia precios; sin `costos` no ve costos;
--   - costos: último y promedio de compras no canceladas, con respaldo en el historial.
--
-- Corre en una transacción. Éxito = termina con el error PRECIOS_LOTE_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/precios_lote_test.sql

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
  v_prov uuid; v_a uuid; v_b uuid; v_c uuid; v_compra uuid; v_cancelada uuid;
  r jsonb; v_err text; v_n bigint;
  v_min numeric; v_max numeric;
  v_ult numeric; v_prom numeric; v_uni bigint;
begin
  insert into auth.users (id, email, aud, role) values (v_dueno, 'jefe@venus.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, usuario) values (v_dueno, 'Jefe Test', 'dueno', 'jefetest');
  insert into public.proveedores (nombre) values ('Proveedor Test') returning id into v_prov;
  insert into public.productos_calzado (descripcion, referencia, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Tennis A', 'TA-1', 'Tennis', '38', 'Negro', 80000, 100000, 5, 1) returning id into v_a;
  insert into public.productos_calzado (descripcion, referencia, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Bota B', 'BB-2', 'Botas caucho', '40', 'Verde', 50000, 60000, 5, 1) returning id into v_b;
  insert into public.productos_calzado (descripcion, referencia, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Chancla C', 'CC-3', 'Chanclas', '39', 'Azul', 10000, 12000, 5, 1) returning id into v_c;

  perform pg_temp.como(v_dueno);
  v_ana := public.crear_empleado('Ana Test', 'anatest', '482915', array['inventario']);
  v_beto := public.crear_empleado('Beto Test', 'betotest', '730264', array['ventas']);

  -- ===== Vista previa: calcula sin tocar nada =====
  perform pg_temp.como(v_ana);
  r := public.actualizar_precios_lote(array[v_a, v_b],
    '{"tipo": "porcentaje", "valor": 10, "redondeo": 1000}'::jsonb);
  if (r ->> 'aplicado')::boolean or (r ->> 'invalidos')::int <> 0 or jsonb_array_length(r -> 'filas') <> 2 then
    raise exception 'FALLO: vista previa inesperada: %', r;
  end if;
  if not exists (select 1 from jsonb_array_elements(r -> 'filas') f
                 where (f ->> 'id')::uuid = v_a and (f ->> 'min_nuevo')::numeric = 88000
                   and (f ->> 'max_nuevo')::numeric = 110000) then
    raise exception 'FALLO: +10%% con redondeo a 1000 sobre 80.000/100.000 debe dar 88.000/110.000: %', r;
  end if;
  select precio_minimo, precio_maximo into v_min, v_max from public.productos_calzado where id = v_a;
  if v_min <> 80000 or v_max <> 100000 then
    raise exception 'FALLO: la vista previa cambió precios';
  end if;

  -- ===== Aplicar: cambia, deja historial y auditoría a nombre de quien cambió =====
  r := public.actualizar_precios_lote(array[v_a, v_b],
    '{"tipo": "porcentaje", "valor": 10, "redondeo": 1000, "motivo": "Temporada escolar"}'::jsonb, true);
  if not (r ->> 'aplicado')::boolean or (r ->> 'cambiados')::int <> 2 then
    raise exception 'FALLO: aplicar debía cambiar 2 productos: %', r;
  end if;
  execute 'reset role';
  select precio_minimo, precio_maximo into v_min, v_max from public.productos_calzado where id = v_b;
  if v_min <> 55000 or v_max <> 66000 then
    raise exception 'FALLO: Bota B debía quedar en 55.000/66.000 y quedó en %/%', v_min, v_max;
  end if;
  select count(*) into v_n from public.historial_precios_calzado
    where producto_id in (v_a, v_b) and motivo = 'Temporada escolar' and registrado_por = v_ana;
  if v_n <> 2 then
    raise exception 'FALLO: el cambio debe quedar en el historial de precios (hay %)', v_n;
  end if;
  select count(*) into v_n from public.auditoria
    where tabla = 'productos_calzado' and registro_id = v_a::text and accion = 'editar' and usuario_id = v_ana
      and (despues ->> 'precio_maximo')::numeric = 110000;
  if v_n <> 1 then
    raise exception 'FALLO: el cambio de precio no quedó en el historial de acciones';
  end if;

  -- ===== Solo el máximo, con suma =====
  perform pg_temp.como(v_ana);
  perform public.actualizar_precios_lote(array[v_c], '{"tipo": "suma", "valor": 3000, "campos": "maximo"}'::jsonb, true);
  execute 'reset role';
  select precio_minimo, precio_maximo into v_min, v_max from public.productos_calzado where id = v_c;
  if v_min <> 10000 or v_max <> 15000 then
    raise exception 'FALLO: solo debía subir el máximo (quedó %/%)', v_min, v_max;
  end if;

  -- ===== Precio fijo igual al actual: no cuenta como cambio ni deja historial =====
  perform pg_temp.como(v_ana);
  r := public.actualizar_precios_lote(array[v_c], '{"tipo": "fijo", "minimo": 10000, "maximo": 15000}'::jsonb, true);
  if (r ->> 'cambiados')::int <> 0 then
    raise exception 'FALLO: un precio igual al actual no es un cambio: %', r;
  end if;

  -- ===== Mínimo mayor que máximo: la vista previa lo marca y no se aplica =====
  r := public.actualizar_precios_lote(array[v_a, v_c], '{"tipo": "fijo", "minimo": 90000, "campos": "minimo"}'::jsonb);
  if (r ->> 'invalidos')::int <> 1 then
    raise exception 'FALLO: Chancla C (máx 15.000) con mínimo 90.000 debe salir inválida: %', r;
  end if;
  v_err := pg_temp.error_de(format(
    $q$select public.actualizar_precios_lote(array[%L, %L]::uuid[], '{"tipo": "fijo", "minimo": 90000, "campos": "minimo"}'::jsonb, true)$q$,
    v_a, v_c));
  if v_err not like '%mínimo quedaría mayor%' then
    raise exception 'FALLO: no debía aplicarse con un producto inválido (%)', v_err;
  end if;

  -- ===== Validaciones de la regla =====
  v_err := pg_temp.error_de(format($q$select public.actualizar_precios_lote(array[%L]::uuid[], '{"tipo": "porcentaje", "valor": -100}'::jsonb)$q$, v_a));
  if v_err not like '%cero o negativos%' then
    raise exception 'FALLO: -100%% debe rechazarse (%)', v_err;
  end if;
  v_err := pg_temp.error_de(format($q$select public.actualizar_precios_lote(array[%L]::uuid[], '{"tipo": "otro"}'::jsonb)$q$, v_a));
  if v_err not like '%no válida%' then
    raise exception 'FALLO: regla desconocida debe rechazarse (%)', v_err;
  end if;
  v_err := pg_temp.error_de(format($q$select public.actualizar_precios_lote(array[%L]::uuid[], '{"tipo": "suma", "valor": 1}'::jsonb)$q$, gen_random_uuid()));
  if v_err not like '%ya no existen%' then
    raise exception 'FALLO: un producto inexistente debe avisarse (%)', v_err;
  end if;

  -- ===== Permisos =====
  perform pg_temp.como(v_beto);
  v_err := pg_temp.error_de(format($q$select public.actualizar_precios_lote(array[%L]::uuid[], '{"tipo": "suma", "valor": 1000}'::jsonb, true)$q$, v_a));
  if v_err not like '%permiso para cambiar precios%' then
    raise exception 'FALLO: sin permiso de inventario no se cambian precios (%)', v_err;
  end if;
  perform pg_temp.como(v_ana);
  v_err := pg_temp.error_de('select * from public.obtener_costos_productos()');
  if v_err not like '%permiso para ver costos%' then
    raise exception 'FALLO: sin permiso de costos no se ven costos (%)', v_err;
  end if;
  execute 'reset role';
  execute 'set local role anon';
  v_err := pg_temp.error_de('select * from public.obtener_costos_productos()');
  if v_err not like '%permission denied%' then
    raise exception 'FALLO: sin sesión no se ven costos (%)', v_err;
  end if;

  -- ===== Costos: último y promedio de compras no canceladas; respaldo en el historial =====
  execute 'reset role';
  insert into public.compras (proveedor_id, estado, total, condicion_pago) values (v_prov, 'completada', 1100000, 'contado')
    returning id into v_compra;
  insert into public.compra_items (compra_id, producto_calzado_id, referencia, descripcion, talla, cantidad, costo_unitario, subtotal, created_at)
    values (v_compra, v_a, 'TA-1', 'Tennis A', '38', 10, 50000, 500000, now() - interval '2 days'),
           (v_compra, v_a, 'TA-1', 'Tennis A', '38', 10, 60000, 600000, now() - interval '1 day');
  insert into public.compras (proveedor_id, estado, total, condicion_pago) values (v_prov, 'cancelada', 900000, 'contado')
    returning id into v_cancelada;
  insert into public.compra_items (compra_id, producto_calzado_id, referencia, descripcion, talla, cantidad, costo_unitario, subtotal)
    values (v_cancelada, v_a, 'TA-1', 'Tennis A', '38', 10, 90000, 900000);
  insert into public.historial_precios_calzado (producto_id, costo_compra, motivo) values (v_c, 7000, 'Creación inicial');

  perform pg_temp.como(v_dueno);
  select ultimo_costo, costo_promedio, unidades_compradas into v_ult, v_prom, v_uni
    from public.obtener_costos_productos() where producto_id = v_a;
  if v_ult <> 60000 or v_prom <> 55000 or v_uni <> 20 then
    raise exception 'FALLO: Tennis A debía tener último 60.000, promedio 55.000 y 20 unidades (hay %, %, %)', v_ult, v_prom, v_uni;
  end if;
  select ultimo_costo, costo_promedio, unidades_compradas into v_ult, v_prom, v_uni
    from public.obtener_costos_productos() where producto_id = v_c;
  if v_ult <> 7000 or v_prom <> 7000 or v_uni <> 0 then
    raise exception 'FALLO: Chancla C debía tomar el costo del historial (hay %, %, %)', v_ult, v_prom, v_uni;
  end if;
  if exists (select 1 from public.obtener_costos_productos() where producto_id = v_b) then
    raise exception 'FALLO: Bota B no tiene costos registrados';
  end if;

  raise exception 'PRECIOS_LOTE_OK_ROLLBACK';
end $$;
