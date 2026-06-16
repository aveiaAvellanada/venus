-- Smoke Test: Providers Payments, Stock, Debt and RLS
-- Path: smoke_test_proveedores.sql
-- Runs inside a transaction and rolls back.

BEGIN;

-- Create helper function to check results and raise error if false
CREATE OR REPLACE FUNCTION public.assert_equals(expected numeric, actual numeric, msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF expected IS DISTINCT FROM actual THEN
    RAISE EXCEPTION 'Assertion failed: % (Expected %, got %)', msg, expected, actual;
  END IF;
END;
$$;

DO $$
DECLARE
  v_proveedor_id uuid;
  v_producto_id uuid;
  v_compra_id uuid;
  v_admin_id uuid;
  v_employee_id uuid;
  v_stock_actual integer;
  v_deuda numeric;
  v_pago_id uuid;
  v_count integer;
BEGIN
  RAISE NOTICE 'Starting smoke test for proveedores payments and triggers...';

  -- 1. Create mock users in auth.users and public.users
  v_admin_id := gen_random_uuid();
  v_employee_id := gen_random_uuid();

  -- Insert admin user (Owner)
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_admin_id, 'admin@test.com', '{"provider":"email"}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated');
  
  INSERT INTO public.users (id, nombre, rol, email, activo)
  VALUES (v_admin_id, 'Andres Owner', 'dueno', 'admin@test.com', true);

  -- Insert employee user
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
  VALUES (v_employee_id, 'employee@test.com', '{"provider":"email"}'::jsonb, '{}'::jsonb, 'authenticated', 'authenticated');
  
  INSERT INTO public.users (id, nombre, rol, email, activo)
  VALUES (v_employee_id, 'Camilo Employee', 'empleado', 'employee@test.com', true);

  -- 2. Create provider
  INSERT INTO public.proveedores (nombre, nit_cedula, activo)
  VALUES ('Proveedor Test', '123456', true)
  RETURNING id INTO v_proveedor_id;

  -- 3. Create product (calzado) with stock_actual = 10
  INSERT INTO public.productos_calzado (descripcion, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo, proveedor_id, activo)
  VALUES ('Zapato Running', 'Deportivo', '40', 'Negro', 80000, 100000, 10, 2, v_proveedor_id, true)
  RETURNING id INTO v_producto_id;

  -- Verify initial stock is 10
  SELECT stock_actual INTO v_stock_actual FROM public.productos_calzado WHERE id = v_producto_id;
  PERFORM public.assert_equals(10, v_stock_actual, 'Initial product stock');

  -- Set context to Admin user to create purchase
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);

  -- 4. Create credit purchase with total = 200000.00, state = 'completada'
  INSERT INTO public.compras (proveedor_id, estado, total, condicion_pago, monto_pagado, registrada_por, revisada_por)
  VALUES (v_proveedor_id, 'completada', 200000.00, 'credito', 0.00, v_admin_id, v_admin_id)
  RETURNING id INTO v_compra_id;

  -- Verify that compras_recalculate_saldo trigger sets saldo_pendiente = 200000.00
  SELECT saldo_pendiente INTO v_deuda FROM public.compras WHERE id = v_compra_id;
  PERFORM public.assert_equals(200000.00, v_deuda, 'Initial purchase balance');

  -- 5. Insert purchase item with cantidad = 5
  INSERT INTO public.compra_items (compra_id, producto_calzado_id, descripcion, cantidad, costo_unitario, subtotal)
  VALUES (v_compra_id, v_producto_id, 'Item running', 5, 40000.00, 200000.00);

  -- Verify that product stock increased to 15 (compra_items_stock_increment trigger)
  SELECT stock_actual INTO v_stock_actual FROM public.productos_calzado WHERE id = v_producto_id;
  PERFORM public.assert_equals(15, v_stock_actual, 'Stock after purchase item insert');

  -- Verify that obtaining debt for the provider returns 200000.00
  v_deuda := public.obtener_deuda_proveedor(v_proveedor_id);
  PERFORM public.assert_equals(200000.00, v_deuda, 'Provider debt before payment');

  -- 6. Insert first payment of 50000.00
  INSERT INTO public.compra_pagos (compra_id, monto, registrado_por, notas)
  VALUES (v_compra_id, 50000.00, v_admin_id, 'Abono 1')
  RETURNING id INTO v_pago_id;

  -- Verify that compras.monto_pagado updated to 50000.00
  -- and compras.saldo_pendiente updated to 150000.00
  SELECT saldo_pendiente INTO v_deuda FROM public.compras WHERE id = v_compra_id;
  PERFORM public.assert_equals(150000.00, v_deuda, 'Purchase balance after first payment');

  -- Check provider debt
  v_deuda := public.obtener_deuda_proveedor(v_proveedor_id);
  PERFORM public.assert_equals(150000.00, v_deuda, 'Provider debt after first payment');

  -- 7. Insert second payment of 150000.00 without specifying registrado_por (to test the trigger default to auth.uid())
  INSERT INTO public.compra_pagos (compra_id, monto, registrado_por, notas)
  VALUES (v_compra_id, 150000.00, NULL, 'Abono final')
  RETURNING id INTO v_pago_id;

  -- Verify registrado_por is set to auth.uid() (v_admin_id)
  SELECT registrado_por INTO v_admin_id FROM public.compra_pagos WHERE id = v_pago_id;
  IF v_admin_id IS DISTINCT FROM (select auth.uid()) THEN
    RAISE EXCEPTION 'Trigger compra_pagos_set_registrado_por failed to set registrado_por to auth.uid()';
  END IF;

  -- Verify that purchase is fully paid (saldo_pendiente = 0.00)
  SELECT saldo_pendiente INTO v_deuda FROM public.compras WHERE id = v_compra_id;
  PERFORM public.assert_equals(0.00, v_deuda, 'Purchase balance after final payment');

  -- Check provider debt is now 0.00
  v_deuda := public.obtener_deuda_proveedor(v_proveedor_id);
  PERFORM public.assert_equals(0.00, v_deuda, 'Provider debt after final payment');

  -- 8. Verify Row Level Security (RLS) policies for STAFF_ADMIN
  -- Set context to Employee user
  PERFORM set_config('request.jwt.claim.sub', v_employee_id::text, true);

  -- A. Calling obtener_deuda_proveedor as employee must throw Access Denied
  BEGIN
    v_deuda := public.obtener_deuda_proveedor(v_proveedor_id);
    RAISE EXCEPTION 'RLS FAIL: Employee was allowed to invoke obtener_deuda_proveedor';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Acceso denegado%' THEN
        RAISE NOTICE 'RLS SUCCESS: Employee call to obtener_deuda_proveedor was blocked with expected error.';
      ELSE
        RAISE EXCEPTION 'RLS FAIL: Employee call to obtener_deuda_proveedor failed with unexpected error: %', SQLERRM;
      END IF;
  END;

  -- B. Querying purchase payments (compra_pagos) as employee must return 0 rows
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO v_count FROM public.compra_pagos;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'RLS FAIL: Employee was able to read % payment records due to RLS bypass', v_count;
  END IF;
  RAISE NOTICE 'RLS SUCCESS: Employee read from compra_pagos returned 0 records.';

  -- C. Trying to insert a payment as employee must fail
  BEGIN
    INSERT INTO public.compra_pagos (compra_id, monto, registrado_por, notas)
    VALUES (v_compra_id, 1000.00, v_employee_id, 'Intento de abono de empleado');
    RAISE EXCEPTION 'RLS FAIL: Employee was allowed to insert into compra_pagos';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'RLS SUCCESS: Employee insert was blocked by RLS/Trigger constraint: %', SQLERRM;
  END;

  -- Reset role to superuser
  EXECUTE 'RESET ROLE';

  RAISE NOTICE 'SMOKE TEST COMPLETED SUCCESSFULLY. ALL ASSERTEES PASSED!';
END $$;

ROLLBACK;
