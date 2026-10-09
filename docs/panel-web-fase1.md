# Panel web — Fase 1: Mercancía (plan)

Estado: plan, sin construir (2026-10-09). Marco general: `docs/panel-web.md`.
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
  - **matriz de tallas**: una celda por talla (rango según categoría, p. ej.
    Escolar 27–38, adultos 34–44) con la cantidad; Tab/Enter navegan como en
    Excel;
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
  duplicados) antes de guardar; guardar por lotes reutilizando `registrar_compra`
  (como "compra inicial") o `guardar_producto_calzado`.
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

1. Inventario y precios (+ `actualizar_precios_lote`, vista de costos).
2. Proveedores.
3. Compras y recepción (+ `registrar_compra`).
4. Carga masiva.

Cada PR: migración aplicada con un script de un solo paso para el SQL Editor
(como en la fase 0), `verificar_despliegue.sql` contra producción y tipos
regenerados en `shared/database.types.ts`.

## Decisiones pendientes (para Andrés)

1. Rangos de tallas por categoría (¿cuáles maneja la tienda?).
2. ¿El número de factura del proveedor es obligatorio?
3. Redondeo de precios: ¿a $500, $1.000 o $5.000?
