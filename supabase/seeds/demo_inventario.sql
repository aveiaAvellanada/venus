-- Seed de PRUEBA para inventario (calzado + Granja).
-- NO es una migración de esquema; se aplica manualmente a la DB.
--
-- Convención: todo lo de prueba lleva el prefijo DEMO (referencia 'DEMO-%' en calzado,
-- nombre 'DEMO %' en Granja) para poder limpiarlo sin tocar datos reales.
--
-- Idempotente y seguro de re-ejecutar:
--   - Borra solo filas DEMO que NO estén referenciadas por una venta
--     (venta_items tiene FK on delete restrict: una venta confirmada nunca se destruye).
--   - Inserta solo lo que falta, así que los productos DEMO ya vendidos sobreviven
--     y no se duplican.
--
-- created_by queda en null: el trigger de auditoría lo toma de auth.uid(), que es null
-- cuando esto corre como postgres/service_role fuera de la app. Es dato de prueba.
--
-- Precios en COP. Cada calzado tiene rango mín/máx para poder probar el regateo.

begin;

-- ---------------------------------------------------------------------
-- 1. Limpieza de datos DEMO previos (respetando ventas existentes)
-- ---------------------------------------------------------------------
delete from public.productos_calzado pc
where pc.referencia like 'DEMO-%'
  and not exists (select 1 from public.venta_items vi where vi.producto_calzado_id = pc.id);

delete from public.productos_varios pv
where pv.nombre like 'DEMO %'
  and not exists (select 1 from public.venta_items vi where vi.producto_varios_id = pv.id);

-- ---------------------------------------------------------------------
-- 2. Calzado — 7 categorías, stock variado (incluye AGOTADO y bajo mínimo)
-- ---------------------------------------------------------------------
with nuevos (referencia, categoria, descripcion, marca, talla, color,
             precio_minimo, precio_maximo, stock_actual, stock_minimo) as (
  values
    -- Chanclas
    ('DEMO-CHA-RIO', 'Chanclas', 'Chancla playera Rio',        'Croydon',   '35', 'Azul',     18000, 25000,  8, 3),
    ('DEMO-CHA-RIO', 'Chanclas', 'Chancla playera Rio',        'Croydon',   '36', 'Azul',     18000, 25000,  6, 3),
    ('DEMO-CHA-RIO', 'Chanclas', 'Chancla playera Rio',        'Croydon',   '37', 'Rosado',   18000, 25000,  4, 3),
    ('DEMO-CHA-RIO', 'Chanclas', 'Chancla playera Rio',        'Croydon',   '38', 'Rosado',   18000, 25000,  1, 3),
    ('DEMO-CHA-RIO', 'Chanclas', 'Chancla playera Rio',        'Croydon',   '39', 'Negro',    18000, 25000,  0, 3),
    ('DEMO-CHA-HAV', 'Chanclas', 'Sandalia Havaianas Brasil',  'Havaianas', '38', 'Verde',    32000, 45000,  5, 2),
    ('DEMO-CHA-HAV', 'Chanclas', 'Sandalia Havaianas Brasil',  'Havaianas', '40', 'Negro',    32000, 45000,  3, 2),
    ('DEMO-CHA-HAV', 'Chanclas', 'Sandalia Havaianas Brasil',  'Havaianas', '42', 'Azul',     32000, 45000,  2, 2),
    ('DEMO-CHA-BRA', 'Chanclas', 'Chancla Brahma hombre',      'Brahma',    '40', 'Café',     22000, 30000,  7, 2),
    ('DEMO-CHA-BRA', 'Chanclas', 'Chancla Brahma hombre',      'Brahma',    '42', 'Negro',    22000, 30000,  5, 2),
    ('DEMO-CHA-INF', 'Chanclas', 'Chancla infantil estampada', 'Bata',      '28', 'Rosado',   15000, 20000, 10, 4),
    ('DEMO-CHA-INF', 'Chanclas', 'Chancla infantil estampada', 'Bata',      '30', 'Celeste',  15000, 20000,  9, 4),

    -- Escolar
    ('DEMO-ESC-JAG', 'Escolar', 'Zapato colegial amarrado',  'Jaguar',  '32', 'Negro', 62000,  85000,  6, 2),
    ('DEMO-ESC-JAG', 'Escolar', 'Zapato colegial amarrado',  'Jaguar',  '34', 'Negro', 62000,  85000,  5, 2),
    ('DEMO-ESC-JAG', 'Escolar', 'Zapato colegial amarrado',  'Jaguar',  '36', 'Negro', 65000,  90000,  4, 2),
    ('DEMO-ESC-JAG', 'Escolar', 'Zapato colegial amarrado',  'Jaguar',  '38', 'Negro', 68000,  95000,  1, 2),
    ('DEMO-ESC-BAT', 'Escolar', 'Zapato charol niña',        'Bata',    '30', 'Negro', 55000,  75000,  7, 2),
    ('DEMO-ESC-BAT', 'Escolar', 'Zapato charol niña',        'Bata',    '32', 'Negro', 55000,  75000,  3, 2),
    ('DEMO-ESC-BAT', 'Escolar', 'Zapato charol niña',        'Bata',    '34', 'Negro', 58000,  78000,  0, 2),
    ('DEMO-ESC-CRO', 'Escolar', 'Zapato escolar sintético',  'Croydon', '35', 'Negro', 70000, 100000,  4, 2),
    ('DEMO-ESC-CRO', 'Escolar', 'Zapato escolar sintético',  'Croydon', '37', 'Negro', 72000, 105000,  2, 2),

    -- Botas caucho
    ('DEMO-BOT-VEN', 'Botas caucho', 'Bota de caucho campo',       'Venus',   '38', 'Negro',  38000, 55000,  6, 2),
    ('DEMO-BOT-VEN', 'Botas caucho', 'Bota de caucho campo',       'Venus',   '40', 'Negro',  38000, 55000,  8, 2),
    ('DEMO-BOT-VEN', 'Botas caucho', 'Bota de caucho campo',       'Venus',   '42', 'Negro',  40000, 58000,  3, 2),
    ('DEMO-BOT-VEN', 'Botas caucho', 'Bota de caucho campo',       'Venus',   '43', 'Verde',  40000, 58000,  0, 2),
    ('DEMO-BOT-CRO', 'Botas caucho', 'Bota pantanera reforzada',   'Croydon', '40', 'Negro',  52000, 75000,  5, 2),
    ('DEMO-BOT-CRO', 'Botas caucho', 'Bota pantanera reforzada',   'Croydon', '42', 'Negro',  52000, 75000,  4, 2),
    ('DEMO-BOT-INF', 'Botas caucho', 'Bota caucho infantil',       'Macha',   '28', 'Amarillo', 30000, 42000,  6, 3),
    ('DEMO-BOT-INF', 'Botas caucho', 'Bota caucho infantil',       'Macha',   '30', 'Rojo',     30000, 42000,  1, 3),

    -- Deportivo
    ('DEMO-DEP-ADI', 'Deportivo', 'Guayos fútbol Adidas',      'Adidas', '39', 'Negro',   95000, 140000,  3, 1),
    ('DEMO-DEP-ADI', 'Deportivo', 'Guayos fútbol Adidas',      'Adidas', '41', 'Blanco',  95000, 140000,  2, 1),
    ('DEMO-DEP-ADI', 'Deportivo', 'Guayos fútbol Adidas',      'Adidas', '43', 'Rojo',   100000, 150000,  0, 1),
    ('DEMO-DEP-NIK', 'Deportivo', 'Tenis running Revolution',  'Nike',   '40', 'Gris',   120000, 175000,  4, 1),
    ('DEMO-DEP-NIK', 'Deportivo', 'Tenis running Revolution',  'Nike',   '42', 'Negro',  120000, 175000,  2, 1),
    ('DEMO-DEP-PUM', 'Deportivo', 'Tenis Puma Softride',       'Puma',   '39', 'Azul',   110000, 160000,  3, 1),
    ('DEMO-DEP-PUM', 'Deportivo', 'Tenis Puma Softride',       'Puma',   '41', 'Negro',  110000, 160000,  1, 1),

    -- Tennis
    ('DEMO-TEN-AF1', 'Tennis', 'Tenis Nike Air Force 1',      'Nike',     '38', 'Blanco', 150000, 210000,  3, 1),
    ('DEMO-TEN-AF1', 'Tennis', 'Tenis Nike Air Force 1',      'Nike',     '39', 'Blanco', 150000, 210000,  4, 1),
    ('DEMO-TEN-AF1', 'Tennis', 'Tenis Nike Air Force 1',      'Nike',     '40', 'Negro',  150000, 210000,  2, 1),
    ('DEMO-TEN-AF1', 'Tennis', 'Tenis Nike Air Force 1',      'Nike',     '42', 'Negro',  155000, 220000,  0, 1),
    ('DEMO-TEN-CON', 'Tennis', 'Tenis Converse Chuck Taylor', 'Converse', '37', 'Negro',  130000, 185000,  5, 1),
    ('DEMO-TEN-CON', 'Tennis', 'Tenis Converse Chuck Taylor', 'Converse', '39', 'Rojo',   130000, 185000,  2, 1),
    ('DEMO-TEN-VAN', 'Tennis', 'Tenis Vans Old Skool',        'Vans',     '38', 'Negro',  140000, 195000,  3, 1),
    ('DEMO-TEN-VAN', 'Tennis', 'Tenis Vans Old Skool',        'Vans',     '41', 'Blanco', 140000, 195000,  1, 1),
    ('DEMO-TEN-ADS', 'Tennis', 'Tenis Adidas Superstar',      'Adidas',   '40', 'Blanco', 145000, 200000,  4, 1),
    ('DEMO-TEN-ADS', 'Tennis', 'Tenis Adidas Superstar',      'Adidas',   '42', 'Blanco', 145000, 200000,  2, 1),

    -- Clasico (sin tilde: así lo exige el CHECK de la tabla)
    ('DEMO-CLA-VEL', 'Clasico', 'Zapato clásico cuero hombre', 'Vélez', '39', 'Café',  135000, 190000,  3, 1),
    ('DEMO-CLA-VEL', 'Clasico', 'Zapato clásico cuero hombre', 'Vélez', '41', 'Negro', 135000, 190000,  2, 1),
    ('DEMO-CLA-VEL', 'Clasico', 'Zapato clásico cuero hombre', 'Vélez', '43', 'Negro', 140000, 195000,  0, 1),
    ('DEMO-CLA-BOS', 'Clasico', 'Mocasín cuero',               'Bosi',  '40', 'Café',  120000, 170000,  2, 1),
    ('DEMO-CLA-BOS', 'Clasico', 'Mocasín cuero',               'Bosi',  '42', 'Negro', 120000, 170000,  1, 1),
    ('DEMO-CLA-DAM', 'Clasico', 'Tacón dama cerrado',          'Bosi',  '36', 'Negro',  95000, 140000,  4, 1),
    ('DEMO-CLA-DAM', 'Clasico', 'Tacón dama cerrado',          'Bosi',  '38', 'Beige',  95000, 140000,  2, 1),

    -- Otros
    ('DEMO-OTR-PAN', 'Otros', 'Pantufla de casa',      'Bata',    '36', 'Gris',   25000, 35000,  6, 2),
    ('DEMO-OTR-PAN', 'Otros', 'Pantufla de casa',      'Bata',    '40', 'Azul',   25000, 35000,  4, 2),
    ('DEMO-OTR-BAL', 'Otros', 'Baleta dama',           'Croydon', '36', 'Negro',  45000, 65000,  5, 2),
    ('DEMO-OTR-BAL', 'Otros', 'Baleta dama',           'Croydon', '38', 'Beige',  45000, 65000,  3, 2),
    ('DEMO-OTR-SAN', 'Otros', 'Sandalia romana dama',  'Croydon', '37', 'Café',   55000, 80000,  2, 1),
    ('DEMO-OTR-SAN', 'Otros', 'Sandalia romana dama',  'Croydon', '39', 'Negro',  55000, 80000,  0, 1)
)
insert into public.productos_calzado (
  referencia, categoria, descripcion, marca, talla, color,
  precio_minimo, precio_maximo, stock_actual, stock_minimo, activo
)
select n.referencia, n.categoria, n.descripcion, n.marca, n.talla, n.color,
       n.precio_minimo, n.precio_maximo, n.stock_actual, n.stock_minimo, true
from nuevos n
where not exists (
  select 1 from public.productos_calzado pc
  where pc.referencia = n.referencia
    and pc.talla is not distinct from n.talla
    and pc.color is not distinct from n.color
);

-- ---------------------------------------------------------------------
-- 3. Costos de compra por referencia -> historial_precios_calzado
--    (solo el dueño los ve; sirven para probar márgenes y balance)
-- ---------------------------------------------------------------------
with costos (referencia, costo) as (
  values
    ('DEMO-CHA-RIO',  11000), ('DEMO-CHA-HAV', 20000), ('DEMO-CHA-BRA', 13000),
    ('DEMO-CHA-INF',   9000), ('DEMO-ESC-JAG', 38000), ('DEMO-ESC-BAT', 33000),
    ('DEMO-ESC-CRO',  43000), ('DEMO-BOT-VEN', 23000), ('DEMO-BOT-CRO', 32000),
    ('DEMO-BOT-INF',  18000), ('DEMO-DEP-ADI', 58000), ('DEMO-DEP-NIK', 74000),
    ('DEMO-DEP-PUM',  67000), ('DEMO-TEN-AF1', 92000), ('DEMO-TEN-CON', 80000),
    ('DEMO-TEN-VAN',  86000), ('DEMO-TEN-ADS', 89000), ('DEMO-CLA-VEL', 83000),
    ('DEMO-CLA-BOS',  74000), ('DEMO-CLA-DAM', 58000), ('DEMO-OTR-PAN', 15000),
    ('DEMO-OTR-BAL',  27000), ('DEMO-OTR-SAN', 34000)
)
insert into public.historial_precios_calzado (
  producto_id, precio_minimo, precio_maximo, costo_compra, motivo
)
select pc.id, pc.precio_minimo, pc.precio_maximo, c.costo, 'Carga de prueba'
from public.productos_calzado pc
join costos c on c.referencia = pc.referencia
where not exists (
  select 1 from public.historial_precios_calzado h where h.producto_id = pc.id
);

-- ---------------------------------------------------------------------
-- 4. Granja — sin stock; el precio se define al momento de vender.
--    precio_sugerido es solo una referencia y puede ir en null.
-- ---------------------------------------------------------------------
with nuevos (nombre, unidad_medida, precio_sugerido) as (
  values
    ('DEMO Huevos AA',        'panel',   19000),
    ('DEMO Huevos A',         'panel',   16500),
    ('DEMO Queso campesino',  'libra',   11000),
    ('DEMO Cuajada',          'libra',    9000),
    ('DEMO Café molido',      'libra',   14000),
    ('DEMO Panela',           'kilo',     4500),
    ('DEMO Plátano hartón',   'kilo',     3500),
    ('DEMO Yuca',             'kilo',     2500),
    ('DEMO Arroz',            'libra',    3200),
    ('DEMO Maíz amarillo',    'kilo',     3000),
    ('DEMO Limón',            'libra',    3000),
    ('DEMO Naranja',          'kilo',     2800),
    ('DEMO Aguacate',         'unidad',   4000),
    ('DEMO Miel de abejas',   'litro',   35000),
    ('DEMO Cacao en grano',   'kilo',    18000),
    ('DEMO Leche cruda',      'litro',    2800),
    ('DEMO Pollo criollo',    'unidad',  null),
    ('DEMO Cebolla larga',    'manojo',  null)
)
insert into public.productos_varios (nombre, unidad_medida, precio_sugerido, activo)
select n.nombre, n.unidad_medida, n.precio_sugerido, true
from nuevos n
where not exists (
  select 1 from public.productos_varios pv where pv.nombre = n.nombre
);

commit;
