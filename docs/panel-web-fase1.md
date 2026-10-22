# Panel web — Fase 1: Mercancía (plan)

Estado: entrega 1 (Inventario y precios) construida el 2026-10-09; entregas 2 (Proveedores), 3 (Compras) y 4 (Carga masiva) el 2026-10-12. La migración de la entrega 4 falta aplicarla al remoto. Marco general: `docs/panel-web.md`.
Fase 0 publicada en Cloudflare Pages (login del dueño, navegación, búsqueda, Inicio,
historial de acciones).

Objetivo: que todo lo que entra a la tienda (facturas, productos nuevos, precios,
stock mínimo, proveedores) se maneje desde el computador en minutos, sin pasar
por la app del celular. La venta y la caja siguen en el celular.

## Alcance

| # | Pantalla | Ruta |
|---|---|---|
| A2 | Inventario y precios | `/inventario` |
| A1 | Compras y recepción (con matriz de tallas) | `/compras`, `/compras/nueva`, `/compras/:id` |
| A8 | Proveedores | `/proveedores`, `/proveedores/:id` |
| A9 | Carga masiva (Excel) | `/carga` |

Orden de construcción: A2 → A8 → A1 → A9. Inventario primero porque Compras y
Carga reutilizan su tabla, sus filtros y su validación de producto; Proveedores
antes de Compras porque la factura elige proveedor.

## Base de datos (lo que hay y lo que falta)

Ya existe: `productos_calzado` (referencia, descripción, categoría, marca, color,
talla, precio mín/máx, stock actual/mínimo, proveedor, activo; una fila por talla),
`productos_varios`, `proveedores`, `proveedor_cuentas_bancarias`, `compras`
(proveedor, total, contado/crédito, vencimiento, saldo, estado), `compra_items`
(producto, referencia, talla, color, cantidad, costo unitario, subtotal),
`compra_pagos`, `compra_documentos`; triggers que suben stock y recalculan saldos;
RPC `guardar_producto_calzado`; historial de precios; auditoría en todas.

Migraciones nuevas (cada una con su test SQL, grant explícito y auditoría):

1. **`registrar_compra(p_compra jsonb)`** — una factura completa en una sola
   transacción: cabecera + ítems; crea en el mismo paso los productos que no
   existen (referencia + talla + color) y opcionalmente actualiza precio mín/máx.
   Valida: cantidades > 0, costo ≥ 0, total = suma de ítems, crédito exige
   vencimiento. Permiso `recibir_mercancia`; los costos solo se guardan si quien
   registra tiene `costos` (para el dueño siempre). Idempotente con
   `p_clave_idempotencia`, como `registrar_venta`.
2. **`actualizar_precios_lote(p_ids uuid[], p_regla jsonb)`** — cambia precio
   mín/máx de varios productos a la vez: `{tipo: 'porcentaje'|'fijo'|'redondeo',
   valor}`. Devuelve antes/después para mostrar la vista previa; el historial de
   precios y la auditoría registran cada cambio. Permiso `inventario`.
3. **Vista `v_costo_producto`** (solo con permiso `costos`): último costo y costo
   promedio por producto desde `compra_items`, para mostrar margen en el
   inventario sin exponer costos a quien no debe.
4. **Índices** para la tabla grande: `productos_calzado(referencia)`,
   `(categoria, activo)`, búsqueda por texto sin tildes (`unaccent` +
   `pg_trgm`) si la búsqueda se siente lenta.

Agregar las RPC nuevas a `verificar_despliegue.sql` solo si las llama la app del
celular (la lista es de la app); las del panel van a una lista propia en
`web/src/lib/rpc.test.ts` con el mismo control.

## Pantallas

### A2 Inventario y precios
- Tabla (TanStack Table) agrupada por referencia con las tallas como columnas
  o filas desplegables; columnas: referencia, descripción, marca, color,
  categoría, tallas con stock, precio mín/máx, stock mínimo, costo y margen
  (si `costos`), proveedor, activo.
- Filtros en una fila: categoría, marca, proveedor, agotados, bajo mínimo,
  inactivos; búsqueda; orden por cualquier columna; filtro en la URL
  (`?buscar=` ya lo usa la búsqueda global).
- Edición en celda (precio, stock mínimo, activo) con guardado optimista y
  deshacer; el stock NO se edita aquí (solo entra por compras, sale por ventas;
  ajustes llegan en la fase 2 con motivo).
- Selección múltiple → "Cambiar precios" (vista previa antes/después →
  `actualizar_precios_lote`).
- Totales al pie: unidades, valor a precio y a costo (si `costos`).
- Exportar a Excel lo filtrado.

### A8 Proveedores
- Lista con deuda total y próximo vencimiento; ficha con datos, cuentas
  bancarias, documentos, historial de compras y de costos por referencia,
  pagos (registrar pago parcial/total) y botón WhatsApp.
- Deudas y pagos visibles solo con `deudas` (dueño).

### A1 Compras y recepción
- Lista de compras con filtros (proveedor, fecha, contado/crédito, con saldo).
- Nueva compra = factura en grilla editable:
  - cabecera: proveedor, fecha, número de factura, contado/crédito, vencimiento,
    foto/PDF de la factura (Storage, comprimida a 500 KB como en la app);
  - fila = referencia; al escribirla se autocompleta lo existente (descripción,
    marca, color, categoría, último costo, precios);
  - **matriz de tallas**: una celda por talla, de la 20 a la 45 (decisión del
    dueño), con la cantidad; flechas y Enter navegan como en Excel;
  - costo unitario, subtotal y precio mín/máx sugerido (por ahora: último
    precio; las reglas de margen llegan en la fase 2);
  - referencia nueva → se marca "Nuevo" y se crea al guardar.
- Al guardar: resumen (unidades, total, productos nuevos, cambios de precio) →
  `registrar_compra` → stock actualizado y la compra queda en el historial.
- Borrador local (localStorage) para no perder una factura a medias.

### A9 Carga masiva
- Subir la plantilla Excel actual (`plantilla_carga_inventario.xlsx`); reutilizar
  la lectura de `lib/excel.ts` moviendo la parte pura a `shared/`.
- Vista previa con errores por fila (categoría inválida, precio mín > máx,
  duplicados) antes de guardar; guardar todo junto con `cargar_inventario`
  (una transacción; ver la entrega 4).
- Exportar el inventario con el mismo formato (ida y vuelta).

## Código compartido

Mover a `shared/` lo que ambas apps necesiten: categorías y rangos de tallas,
validación de producto (mín ≤ máx, campos obligatorios), cálculo de subtotales
y totales de compra, lectura/validación de la plantilla Excel. Con tests en
`shared/*.test.ts`.

## Pruebas

- SQL: `compras_test.sql` (factura con productos nuevos y existentes, stock,
  saldo, idempotencia, permisos: sin `costos` no guarda costos, sin
  `recibir_mercancia` no registra), `precios_lote_test.sql`.
- Web: tests de la grilla (navegación con teclado, matriz de tallas, totales),
  de la vista previa de precios y de la validación del Excel; capturas en
  escritorio, oscuro y celular.
- CI ya cubre `web/`, la app y la base.

## Entregas (un PR cada una)

1. ✅ Inventario y precios (+ `actualizar_precios_lote`, `obtener_costos_productos`). Tabla propia en vez de TanStack Table (no hizo falta); exporta CSV para Excel; el precio se cambia solo por la regla en lote (también para una sola referencia), así todo cambio queda en el historial de precios.
2. ✅ Proveedores (+ `registrar_pago_proveedor` y bucket privado `proveedores`; migración `20261012120000_panel_proveedores.sql`, test `pagos_proveedores_test.sql`). Migración aplicada al remoto el 2026-10-12 por SQL Editor, en una transacción y registrada en el historial. Comprobado: migración registrada, bucket privado, 3 políticas de Storage y la función de pagos.
   - **Lista** (`/proveedores`): deuda total, lo vencido, búsqueda sin tildes y filtros Activos / Con deuda / Vencidos / Inactivos, ordenada por deuda.
   - **Ficha** (`/proveedores/:id`): datos editables, WhatsApp, deuda y próximo pago, y pestañas:
     - Compras y pagos, con "Registrar pago". La base valida contra el saldo; antes solo lo hacía la app.
     - Costos por referencia: último costo, el anterior y el cambio.
     - Cuentas bancarias: agregar, editar, copiar y borrar.
     - Documentos: PDF de hasta 5 MB o fotos comprimidas a 500 KB, guardados en un bucket privado y abiertos con enlace temporal.
   - **Búsqueda global:** también encuentra proveedores.
   - **Permisos:** sin `deudas` o `costos` (otra cuenta), esas partes se ocultan en vez de fallar.
3. ✅ Compras y recepción (+ `registrar_compra`; migración `20261012130000_panel_compras.sql`, test `compras_test.sql`). Migración aplicada al remoto el 2026-10-12 por SQL Editor, en una transacción y registrada en el historial. Comprobado: migración registrada, 3 columnas nuevas en `compras` y la función `registrar_compra`.
   - **Lista** (`/compras`): filtros por proveedor, contado, crédito y con saldo, con total y saldo.
   - **Detalle** (`/compras/:id`): ítems agrupados por referencia con sus tallas, registrar pago y la foto o PDF de la factura.
   - **Factura nueva** (`/compras/nueva`), con el proveedor, el número (opcional, con aviso), la fecha, contado o crédito con vencimiento y el adjunto. Cada fila es una referencia y su color:
     - al escribir referencia y color de algo que ya existe, trae la descripción, la marca, la categoría, las tallas y los precios (en rangos) y el último costo;
     - cantidades por talla de la 20 a la 45; las flechas se mueven entre tallas y Enter baja a la misma talla de la fila siguiente;
     - costo y precios por rango de tallas, con "Precio distinto desde la talla…".
   - **Al guardar:** resumen (tallas nuevas, precios que cambian, total). Si falta algo, la lista de lo que falta.
   - **Borrador:** queda guardado en el navegador.
   - **Ajustes del 2026-10-22:**
     - **Otro color** copia la fila debajo, con todo igual menos el color, las cantidades y la foto.
     - **Foto** por referencia y color: se comprime a 500 KB y se sube al bucket `productos`, el mismo de la app. Al guardar queda en todas las tallas de ese color.
     - **Marca** con lista de las ya usadas, y se puede escribir una nueva.
     - **Color** en dos campos (color y segundo color, opcional): la lista trae los ya usados, también los de dos colores, más los básicos, y acepta uno nuevo.
   - **Reintento:** con una clave por factura; si se corta la red, reintentar no duplica la compra ni el stock.
   - **Base:** `registrar_compra` pide `recibir_mercancia` y `costos` (más `inventario` para cambiar un precio existente). Sin `costos` se sigue usando la llegada física de la app.
   - **Pendiente:** el precio sugerido de una referencia nueva sale vacío; las reglas de margen llegan en la fase 2.
4. ✅ Carga masiva (+ `cargar_inventario`; migración `20261016185059_panel_carga_masiva.sql`, test `carga_masiva_test.sql`). Migración aplicada al remoto el 2026-10-16.
   - **Importar** (`/carga`): la plantilla de Excel de la app (`plantilla_carga_inventario.md`), arrastrando o eligiendo el archivo. Antes de guardar muestra:
     - cuántas tallas son nuevas (y cuántos pares entran), cuáles cambian (con el cambio: precio, descripción, marca o categoría) y cuáles quedan igual;
     - los errores con su número de fila del Excel, incluida una talla repetida en el archivo. Con un solo error no se puede guardar.
   - **Stock:** una talla que ya existe (misma referencia —o descripción si no tiene—, color y talla) **no cambia su stock** con la carga; el panel avisa si el archivo trae otro. El stock de lo existente se mueve con compras, ventas y devoluciones (y el conteo físico de la fase 2). Las tallas nuevas sí entran con el stock del archivo.
   - **Guardar:** todo o nada en la base, con el proveedor opcional para las tallas nuevas. El costo es opcional en el panel; el de las nuevas queda en el historial de precios (con permiso `costos`), el de las existentes se ignora (su costo sale de las compras).
   - **Exportar:** el inventario activo con el formato de la plantilla y el último costo, más una hoja de instrucciones; también la plantilla vacía. Exportar, corregir precios en Excel y volver a subir no toca el stock.
   - **Base:** `cargar_inventario` pide `carga_inicial` (más `inventario` para cambiar precios de lo existente). Las tallas nuevas quedan con stock mínimo 0, como en la carga de la app.
   - **Librería:** `xlsx` 0.18.5 de npm (la misma de la app), cargada solo al usar la página. Esa versión tiene avisos de seguridad al leer archivos manipulados; aquí solo la usa el dueño con sus propios archivos. Las versiones corregidas solo se publican en el CDN de SheetJS.
   - **Compartido:** la validación de la plantilla pasó de `lib/excel.ts` a `shared/excel.ts` (la app la sigue usando igual); ahora guarda el número real de fila del Excel y deja el costo opcional para el panel.

Cada PR: migración aplicada con un script de un solo paso para el SQL Editor
(como en la fase 0), `verificar_despliegue.sql` contra producción y tipos
regenerados en `shared/database.types.ts`.

## Decisiones del dueño (2026-10-12)

1. **Tallas:** no hay rangos por categoría; la tienda maneja de la 20 a la 45 en todos los zapatos.
2. **Número de factura:** opcional, pero el panel avisa si falta (sirve para la facturación futura).
3. **Redondeo de precios:** a $1.000.
4. **Precios por rango de tallas:** una misma referencia puede tener precio mínimo y máximo (y costo)
   distintos según el rango de tallas; la factura lo maneja con rangos (p. ej. 20–33 y 34–45).
