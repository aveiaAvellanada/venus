-- Zapatos como los de producción antes de 20261026120000 (casi ninguno con
-- referencia, algunos en "Deportivo"). Se carga justo antes de esa migración;
-- verificacion.sql revisa cómo quedaron.
insert into public.productos_calzado (descripcion, marca, referencia, categoria, talla, color, precio_minimo, precio_maximo, stock_actual, stock_minimo, created_at) values
  -- Un modelo en dos colores y tres tallas, con espacios y mayúsculas distintas.
  ('Tennis Zeus',     'Nike',   null,   'Tennis',    '38', 'Negro',  80000, 100000, 2, 1, '2026-07-01'),
  ('tennis zeus ',    'NIKE ',  '',     'Tennis',    '39', 'Negro',  80000, 100000, 1, 1, '2026-07-02'),
  ('Tennis Zeus',     'Nike',   null,   'Tennis',    '38', 'Blanco', 80000, 100000, 3, 1, '2026-07-03'),
  -- Misma descripción, otra marca: otro zapato.
  ('Tennis Zeus',     'Adidas', null,   'Tennis',    '40', 'Negro',  90000, 110000, 1, 1, '2026-07-04'),
  -- Sin marca.
  ('Bota llanera',    null,     null,   'Botas caucho', '40', 'Negro', 40000, null, 5, 1, '2026-07-05'),
  -- Deportivo: guayos → Futbol, de niño → Infantil, el resto → Tennis.
  ('Guayos Predator', 'Adidas', null,   'Deportivo', '41', 'Rojo',  95000, 140000, 2, 1, '2026-07-06'),
  ('Tenis niño luces','Bubble', null,   'Deportivo', '28', 'Azul',  45000, 60000, 4, 1, '2026-07-07'),
  ('Running Revolution','Nike', null,   'Deportivo', '42', 'Gris', 120000, 175000, 1, 1, '2026-07-08'),
  -- Con referencia del proveedor: no se toca.
  ('Clásico cuero',   'Verlon', 'VR-77','Clasico',   '40', 'Café', 110000, 150000, 2, 1, '2026-07-09'),
  -- Otra talla de ese mismo zapato cargada sin referencia: toma la que ya tiene.
  ('Clásico cuero',   'Verlon', null,   'Clasico',   '41', 'Café', 110000, 150000, 1, 1, '2026-07-10');
