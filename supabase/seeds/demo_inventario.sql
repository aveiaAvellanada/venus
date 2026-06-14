-- Seed de demostración para probar Nueva Venta. Idempotente: borra por marca y reinserta.
-- NO es una migración de esquema; se aplica manualmente a la DB remota.

delete from public.productos_calzado where referencia like 'DEMO-%';
delete from public.productos_varios where nombre like 'DEMO %';

insert into public.productos_calzado (referencia, categoria, descripcion, talla, color, precio_venta, stock_actual, stock_minimo) values
  ('DEMO-NK-AF1', 'Tennis',  'Tenis Nike Air Force', '38', 'Negro',  120000, 2, 1),
  ('DEMO-NK-AF1', 'Tennis',  'Tenis Nike Air Force', '39', 'Negro',  120000, 3, 1),
  ('DEMO-NK-AF1', 'Tennis',  'Tenis Nike Air Force', '40', 'Negro',  120000, 1, 1),
  ('DEMO-NK-AF1', 'Tennis',  'Tenis Nike Air Force', '38', 'Blanco', 120000, 0, 1),
  ('DEMO-CH-RIO', 'Chanclas','Chancla Rio',           '36', 'Azul',    25000, 6, 2),
  ('DEMO-CH-RIO', 'Chanclas','Chancla Rio',           '38', 'Rosado',  25000, 4, 2),
  ('DEMO-ESC-01', 'Escolar', 'Zapato escolar negro',  '34', 'Negro',   80000, 5, 1),
  ('DEMO-BC-01',  'Botas caucho','Bota caucho',       '40', 'Negro',   60000, 3, 1);

insert into public.productos_varios (nombre, unidad_medida, precio_venta, stock_actual, stock_minimo) values
  ('DEMO Huevos', 'panel', 16000,  8,   2),
  ('DEMO Café',   'libra', 12000, 10, 1.5),
  ('DEMO Limón',  'libra',  3000, 20,   3);
