# Panel web — Fase 2: Control de inventario (plan)

Estado: entrega 1 (Conteo físico) construida el 2026-10-22; falta aplicar su migración al remoto.
Marco general: `docs/panel-web.md`. Fase 1: `docs/panel-web-fase1.md`.

Objetivo: saber por qué cada producto tiene el stock que tiene y corregirlo con
motivo cuando lo que hay en la tienda no coincide con el sistema.

## Alcance

| # | Pantalla | Ruta | Estado |
|---|---|---|---|
| A4 | Conteo físico | `/conteo`, `/conteo/nuevo`, `/conteo/:id` | ✅ construida |
| A5 | Kardex por producto | `/kardex` | pendiente (leerá los ajustes de `conteo_items`) |
| A6 | Etiquetas | `/etiquetas` | pendiente |
| A3 | Reglas de precio | `/reglas-precio` | pendiente |
| A7 | Reposición y órdenes de compra | `/pedidos` | pendiente |

## Entregas

1. ✅ Conteo físico (+ `registrar_conteo`; migración `20261022180000_panel_conteo_fisico.sql`, test `conteo_fisico_test.sql`).
   - **Base:**
     - `conteos_inventario` guarda cada conteo confirmado: qué se contó, nota, quién, cuándo y los totales.
     - `conteo_items` guarda cada talla contada: lo que decía el sistema, lo contado, la diferencia y el motivo. También quedan las que coincidieron, para saber qué se contó. Las filas con diferencia son los ajustes de inventario.
     - Las dos tablas se leen con `inventario` y nadie las escribe directo. Llevan historial de acciones, igual que el cambio de stock de cada talla.
   - **`registrar_conteo`:** todo o nada, con permiso `inventario`.
     - Deja el stock igual a lo contado; nunca negativo.
     - Si el stock de una talla cambió desde que se contó (una venta o devolución en medio), no guarda nada y devuelve esas tallas con su stock de ahora. Así un ajuste nunca pisa una venta.
     - Idempotente: reintentar con la misma clave no ajusta dos veces.
   - **Motivos:** error de registro, pérdida o robo, daño o defecto, y otro con nota obligatoria. Pérdida y daño solo explican faltantes. Sin diferencia no hay motivo.
   - **Lista** (`/conteo`): cada conteo con fecha, qué se contó, quién, tallas contadas, con diferencia, sobrantes y faltantes.
   - **Nuevo conteo** (`/conteo/nuevo`):
     - Alcance por categoría y marca (o todo); queda fijo al empezar a contar.
     - Una fila por referencia y color con sus tallas activas; cada talla muestra el stock del sistema y la diferencia (✓, +n, −n).
     - Enter y las flechas pasan a la siguiente talla. "Todo coincide con el sistema" llena una referencia de una vez. "Lo que falta, en 0" cuenta como cero lo que no se encontró.
     - Búsqueda y vistas Todas / Sin contar / Con diferencia.
     - Lo que no se cuenta no se toca. El borrador queda guardado en el navegador.
     - **Revisar y confirmar:** resumen, valor a costo de lo que falta y sobra (con permiso `costos`), motivo para todas o por talla, y nota del conteo.
     - Si el stock cambió mientras se contaba, marca esas tallas para recontar, o "Mantener lo contado".
   - **Detalle** (`/conteo/:id`): totales y las tallas ajustadas con motivo y nota; opcional, también las que coincidieron.

## Decisiones (2026-10-22)

1. **Lo contado manda:** al confirmar, el stock queda igual a lo contado (no se suma una diferencia), y solo si el stock no se movió desde que se contó cada talla.
2. **Sin conteos abiertos en la base:** el conteo a medias vive en el navegador, como el borrador de una compra; la base solo guarda conteos confirmados.
3. **Solo calzado:** Granja no maneja stock.
4. **Permiso `inventario`**, el mismo con que la app edita productos.
