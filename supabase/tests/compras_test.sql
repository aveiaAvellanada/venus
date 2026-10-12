-- Test de registrar_compra (panel web, fase 1, entrega 3: Compras y recepción):
--   - factura de contado con una talla existente, un cambio de precio y una
--     referencia nueva con precios distintos según el rango de tallas;
--   - sube el stock, deja costo y precios en el historial, total y pagado;
--   - reconoce una talla existente por referencia + color + talla (no duplica);
--   - crédito: exige vencimiento, deja saldo y admite pagos;
--   - reintentar con la misma clave no duplica la compra ni el stock;
--   - valida cantidades, costos y precios, y un error no deja nada a medias;
--   - sin `costos` (o sin `recibir_mercancia`) no registra facturas.
--
-- Corre en una transacción. Éxito = termina con el error COMPRAS_OK_ROLLBACK.
-- Local:  supabase/tests/local/run.sh supabase/tests/compras_test.sql

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
  v_ana uuid;
  v_prov uuid; v_t38 uuid; v_t39 uuid;
  v_clave uuid := gen_random_uuid();
  r jsonb; r2 jsonb; v_err text; v_n bigint;
  v_compra uuid; v_stock int; v_min numeric; v_max numeric; v_saldo numeric;
  v_factura jsonb;
begin
  insert into auth.users (id, email, aud, role) values (v_dueno, 'jefe@venus.invalid', 'authenticated', 'authenticated');
  insert into public.users (id, nombre, rol, usuario) values (v_dueno, 'Jefe Test', 'dueno', 'jefetest');
  insert into public.proveedores (nombre) values ('Proveedor Test') returning id into v_prov;
  insert into public.productos_calzado (descripcion, referencia, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Tennis A', 'TA-1', 'Tennis', '38', 'Negro', 80000, 100000, 2, 1) returning id into v_t38;
  insert into public.productos_calzado (descripcion, referencia, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo)
    values ('Tennis A', 'TA-1', 'Tennis', '39', 'Negro', 80000, 100000, 0, 1) returning id into v_t39;

  perform pg_temp.como(v_dueno);
  v_ana := public.crear_empleado('Ana Test', 'anatest', '482915', array['recibir_mercancia', 'inventario']);

  -- ===== Factura de contado =====
  v_factura := jsonb_build_object(
    'proveedor_id', v_prov, 'condicion_pago', 'contado', 'numero_factura', ' FV-1001 ',
    'fecha_factura', private.hoy_bogota() - 1,
    'items', jsonb_build_array(
      -- talla existente por id, mismo precio
      jsonb_build_object('producto_id', v_t38, 'cantidad', 3, 'costo_unitario', 55000, 'precio_minimo', 80000, 'precio_maximo', 100000),
      -- talla existente sin id (por referencia + color + talla) y con precio nuevo
      jsonb_build_object('referencia', 'ta-1', 'color', 'negro', 'talla', '39', 'descripcion', 'Tennis A', 'categoria', 'Tennis',
                         'cantidad', 2, 'costo_unitario', 55000, 'precio_minimo', 85000, 'precio_maximo', 105000),
      -- referencia nueva: tallas pequeñas más baratas que las grandes
      jsonb_build_object('referencia', 'ES-9', 'descripcion', 'Escolar', 'marca', 'Bosi', 'categoria', 'Escolar', 'color', 'Negro',
                         'talla', '24', 'cantidad', 4, 'costo_unitario', 30000, 'precio_minimo', 45000, 'precio_maximo', 55000),
      jsonb_build_object('referencia', 'ES-9', 'descripcion', 'Escolar', 'marca', 'Bosi', 'categoria', 'Escolar', 'color', 'Negro',
                         'talla', '36', 'cantidad', 2, 'costo_unitario', 38000, 'precio_minimo', 60000, 'precio_maximo', 70000)
    ));
  r := public.registrar_compra(v_factura, v_clave);
  v_compra := (r ->> 'compra_id')::uuid;
  if (r ->> 'repetida')::boolean or (r ->> 'total')::numeric <> 3*55000 + 2*55000 + 4*30000 + 2*38000
     or (r ->> 'unidades')::int <> 11 or (r ->> 'productos_nuevos')::int <> 2 or (r ->> 'precios_cambiados')::int <> 1 then
    raise exception 'FALLO: resumen inesperado: %', r;
  end if;

  execute 'reset role';
  if not exists (select 1 from public.compras where id = v_compra and estado = 'completada' and condicion_pago = 'contado'
                   and total = 471000 and monto_pagado = 471000 and saldo_pendiente = 0 and numero_factura = 'FV-1001'
                   and fecha_factura = private.hoy_bogota() - 1 and registrada_por = v_dueno) then
    raise exception 'FALLO: la cabecera de la compra no quedó como se esperaba';
  end if;
  select stock_actual into v_stock from public.productos_calzado where id = v_t38;
  if v_stock <> 5 then raise exception 'FALLO: la talla 38 debía quedar con 5 (quedó %)', v_stock; end if;
  select stock_actual, precio_minimo, precio_maximo into v_stock, v_min, v_max from public.productos_calzado where id = v_t39;
  if v_stock <> 2 or v_min <> 85000 or v_max <> 105000 then
    raise exception 'FALLO: la talla 39 debía quedar con 2 y 85.000/105.000 (quedó %, %/%)', v_stock, v_min, v_max;
  end if;
  select count(*) into v_n from public.productos_calzado where lower(referencia) = 'ta-1';
  if v_n <> 2 then raise exception 'FALLO: reconocer la talla por referencia no debía crear otra (hay %)', v_n; end if;
  if not exists (select 1 from public.productos_calzado where referencia = 'ES-9' and talla = '24' and stock_actual = 4
                   and precio_minimo = 45000 and marca = 'Bosi' and proveedor_id = v_prov)
     or not exists (select 1 from public.productos_calzado where referencia = 'ES-9' and talla = '36' and stock_actual = 2
                   and precio_minimo = 60000 and precio_maximo = 70000) then
    raise exception 'FALLO: la referencia nueva no quedó con su stock y su precio por rango de tallas';
  end if;
  select count(*) into v_n from public.historial_precios_calzado h
    join public.compra_items ci on ci.producto_calzado_id = h.producto_id and ci.compra_id = v_compra
    where h.costo_compra = ci.costo_unitario and h.motivo = 'Compra factura FV-1001' and h.registrado_por = v_dueno;
  if v_n <> 4 then raise exception 'FALLO: cada talla debe dejar su costo en el historial (hay %)', v_n; end if;
  select count(*) into v_n from public.auditoria where tabla = 'compras' and registro_id = v_compra::text and usuario_id = v_dueno;
  if v_n < 1 then raise exception 'FALLO: la compra debe quedar en el historial de acciones'; end if;

  -- ===== Reintentar con la misma clave no duplica =====
  perform pg_temp.como(v_dueno);
  r2 := public.registrar_compra(v_factura, v_clave);
  if not (r2 ->> 'repetida')::boolean or (r2 ->> 'compra_id')::uuid <> v_compra then
    raise exception 'FALLO: el reintento debía devolver la misma compra: %', r2;
  end if;
  execute 'reset role';
  select stock_actual into v_stock from public.productos_calzado where id = v_t38;
  if v_stock <> 5 then raise exception 'FALLO: el reintento duplicó el stock (%)', v_stock; end if;
  select count(*) into v_n from public.compras where clave_idempotencia = v_clave;
  if v_n <> 1 then raise exception 'FALLO: el reintento duplicó la compra'; end if;

  -- ===== Crédito: exige vencimiento, deja saldo y admite pagos =====
  perform pg_temp.como(v_dueno);
  v_err := pg_temp.error_de(format('select public.registrar_compra(%L)', jsonb_build_object(
    'proveedor_id', v_prov, 'condicion_pago', 'credito',
    'items', jsonb_build_array(jsonb_build_object('producto_id', v_t38, 'cantidad', 1, 'costo_unitario', 55000, 'precio_minimo', 80000, 'precio_maximo', 100000)))));
  if v_err not like '%fecha de vencimiento%' then raise exception 'FALLO: crédito sin vencimiento (%)', v_err; end if;
  r := public.registrar_compra(jsonb_build_object(
    'proveedor_id', v_prov, 'condicion_pago', 'credito', 'fecha_vencimiento', private.hoy_bogota() + 30,
    'items', jsonb_build_array(jsonb_build_object('producto_id', v_t38, 'cantidad', 2, 'costo_unitario', 55000, 'precio_minimo', 80000, 'precio_maximo', 100000))));
  perform public.registrar_pago_proveedor((r ->> 'compra_id')::uuid, 50000);
  execute 'reset role';
  select saldo_pendiente into v_saldo from public.compras where id = (r ->> 'compra_id')::uuid;
  if v_saldo <> 60000 then raise exception 'FALLO: crédito de 110.000 con abono de 50.000 debía quedar en 60.000 (%)', v_saldo; end if;

  -- ===== Validaciones; un error no deja nada a medias =====
  perform pg_temp.como(v_dueno);
  v_err := pg_temp.error_de(format('select public.registrar_compra(%L)', jsonb_build_object(
    'proveedor_id', v_prov, 'condicion_pago', 'contado',
    'items', jsonb_build_array(
      jsonb_build_object('producto_id', v_t38, 'cantidad', 1, 'costo_unitario', 55000, 'precio_minimo', 80000, 'precio_maximo', 100000),
      jsonb_build_object('producto_id', v_t39, 'cantidad', 1, 'costo_unitario', 55000, 'precio_minimo', 120000, 'precio_maximo', 100000)))));
  if v_err not like '%Revisa los precios%' then raise exception 'FALLO: mínimo mayor que el máximo (%)', v_err; end if;
  execute 'reset role';
  select stock_actual into v_stock from public.productos_calzado where id = v_t38;
  if v_stock <> 7 then raise exception 'FALLO: una factura con error no debe subir stock (quedó %)', v_stock; end if;

  perform pg_temp.como(v_dueno);
  v_err := pg_temp.error_de(format('select public.registrar_compra(%L)', jsonb_build_object(
    'proveedor_id', v_prov, 'condicion_pago', 'contado',
    'items', jsonb_build_array(jsonb_build_object('producto_id', v_t38, 'cantidad', 1.5, 'costo_unitario', 55000, 'precio_minimo', 80000, 'precio_maximo', 100000)))));
  if v_err not like '%cantidad entera%' then raise exception 'FALLO: cantidad decimal (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.registrar_compra(%L)', jsonb_build_object(
    'proveedor_id', v_prov, 'condicion_pago', 'contado', 'items', '[]'::jsonb)));
  if v_err not like '%no tiene productos%' then raise exception 'FALLO: factura vacía (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.registrar_compra(%L)', jsonb_build_object(
    'proveedor_id', v_prov, 'condicion_pago', 'contado', 'fecha_factura', private.hoy_bogota() + 1,
    'items', jsonb_build_array(jsonb_build_object('producto_id', v_t38, 'cantidad', 1, 'costo_unitario', 1, 'precio_minimo', 80000, 'precio_maximo', 100000)))));
  if v_err not like '%no puede ser futura%' then raise exception 'FALLO: fecha futura (%)', v_err; end if;
  v_err := pg_temp.error_de(format('select public.registrar_compra(%L)', jsonb_build_object(
    'proveedor_id', v_prov, 'condicion_pago', 'contado',
    'items', jsonb_build_array(jsonb_build_object('referencia', 'NV-1', 'categoria', 'Otros', 'cantidad', 1, 'costo_unitario', 1,
                                                  'precio_minimo', 1000, 'precio_maximo', 2000, 'talla', '40')))));
  if v_err not like '%Falta la descripción%' then raise exception 'FALLO: producto nuevo sin descripción (%)', v_err; end if;

  -- ===== Sin `costos` no registra facturas =====
  perform pg_temp.como(v_ana);
  v_err := pg_temp.error_de(format('select public.registrar_compra(%L)', v_factura));
  if v_err not like '%No tienes permiso%' then raise exception 'FALLO: sin `costos` no debe registrar (%)', v_err; end if;
  execute 'reset role';

  raise exception 'COMPRAS_OK_ROLLBACK';
end $$;
