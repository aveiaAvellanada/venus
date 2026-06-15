# Diseño — SP-2: Granja sin stock + precio mín/máx (regateo)

Fecha: 2026-06-15
Estado: Aprobado (pendiente revisión del spec escrito)
Parte de: Alineación con `docs/Venus_PRD_v4.0.md` (sub-proyecto 2 de 3). Previo: **SP-1** (roles/permisos/RLS/auditoría, ya mergeado). Siguiente: **SP-3** (detalle de venta + Devoluciones).

## 1. Objetivo y alcance

Llevar el modelo de precios del código al de v4.0:
- **Calzado** con **precio mínimo y máximo** (regateo); el precio final pagado se guarda por item.
- **Granja** (`productos_varios`) **sin stock** y **sin precio guardado**; el precio se ingresa en el momento de la venta, calculado por unidad de medida.

Es la base de datos/lógica para que la venta refleje v4.0. Construido sobre SP-1 (auditoría `created_by`, RLS por rol).

### Dentro del alcance
- Esquema: calzado `precio_minimo`/`precio_maximo`; Granja sin `stock_actual`/`stock_minimo`, con `precio_sugerido` nullable en vez de `precio_venta`.
- `venta_items`: snapshot del rango de calzado vigente al vender (para auditoría precisa).
- RPC `registrar_venta` reescrita para aceptar el precio por item.
- Lógica de carrito (`lib/carrito.ts`) y acceso a datos (`lib/ventas.ts`) actualizados.
- Pantalla **Nueva Venta** (`app/(app)/ventas/nueva.tsx`): regateo de calzado y precio de Granja al vender.
- Regenerar `lib/database.types.ts`.

### Fuera del alcance (módulos posteriores)
- Pantallas de gestión de **Inventario Calzado** y **Granja** (crear/editar productos, mín/máx, fotos). El backfill deja los productos actuales utilizables para probar Nueva Venta.
- **Devoluciones** y detalle de venta (**SP-3**).
- Reportes/alertas de "vendido bajo el mínimo" (el dato queda guardado; el reporte es de Módulo 12).
- Recibir Mercancía / costos de Granja (`historial_precios_varios` se deja intacto, sin uso nuevo).

## 2. Decisiones (aprobadas)

| Tema | Decisión |
|---|---|
| Precio calzado | `precio_minimo` + `precio_maximo` reemplazan `precio_venta`. Backfill `min = max = precio_venta`. |
| Regateo | El rango es **informativo/sugerido, NO restrictivo**. El vendedor puede cobrar cualquier precio (incluso fuera del rango). **Sin rechazo del servidor.** |
| Auditoría de precio | Se guarda el precio final pagado en `venta_items.precio_unitario` **y** un snapshot del `precio_minimo`/`precio_maximo` vigente al vender, para auditar ventas bajo el mínimo de forma precisa en el tiempo. |
| Sugerido al vender | Calzado: el campo arranca en `precio_maximo`. Granja: arranca en `precio_sugerido` (si existe). Ambos editables. |
| Precio Granja | `precio_unitario × cantidad` (cálculo por unidad de medida). Sin precio guardado obligatorio; `precio_sugerido` nullable solo autocompleta. |
| Stock Granja | Eliminado. Granja no maneja stock. |

## 3. Modelo de datos

**`productos_calzado`:**
- Añadir `precio_minimo numeric(12,2) not null default 0 check (precio_minimo >= 0)`.
- Añadir `precio_maximo numeric(12,2) not null default 0 check (precio_maximo >= 0)`.
- Añadir `check (precio_maximo >= precio_minimo)` (constraint a nivel tabla, agregado tras el backfill).
- Backfill: `precio_minimo = precio_maximo = precio_venta` para filas existentes.
- Eliminar `precio_venta`.
- (Quitar los `default 0` tras backfill no es necesario; nuevos productos los pondrá la futura pantalla de inventario. Se dejan con default 0 para no romper inserts mínimos.)

**`productos_varios` (Granja):**
- Eliminar `stock_actual` y `stock_minimo`.
- Añadir `precio_sugerido numeric(12,2) null check (precio_sugerido >= 0)`; backfill desde `precio_venta`.
- Eliminar `precio_venta`.

**`venta_items`** (snapshot para auditoría; solo calzado):
- Añadir `precio_minimo_snapshot numeric(12,2) null` y `precio_maximo_snapshot numeric(12,2) null`.
- En ventas de Granja quedan `null`. En calzado, la RPC los llena con el rango del producto al momento de vender.
- `precio_unitario` (existente) sigue siendo el precio final pagado por unidad. `subtotal = precio_unitario × cantidad` (sin cambio).

Las columnas de auditoría de SP-1 (`created_by`/`updated_by`) y RLS siguen vigentes; estas tablas ya las tienen.

## 4. RPC `registrar_venta`

Hoy la RPC **ignora** el precio del cliente y lo lee del producto. Cambia a aceptar el precio por item (regateo / precio Granja), conservando lo autoritativo en servidor donde aplica:

**Por cada item, el cliente envía** `tipo`, `producto_id`, `cantidad` y `precio` (precio final por unidad).

- **Validación común:** `producto_id` presente; `cantidad > 0`; `precio` numérico y `> 0`. Producto existe y `activo`.
- **Calzado:**
  - `cantidad` entera (sin cambio).
  - Leer `precio_minimo`, `precio_maximo`, `descripcion`, `talla`, `color`, `stock_actual` con `for update`.
  - Validar `stock_actual >= cantidad`; decrementar stock (sin cambio).
  - **Sin validación de rango** (el rango es informativo). Guardar `precio_unitario = precio`.
  - Guardar `precio_minimo_snapshot`/`precio_maximo_snapshot` con el rango leído del producto.
- **Granja:**
  - Leer `nombre` (y validar `activo`). **No** leer ni tocar stock.
  - `precio_unitario = precio`; `subtotal = round(precio × cantidad, 2)`; `descripcion_snapshot = nombre`.
  - `precio_minimo_snapshot`/`precio_maximo_snapshot = null`.
- El resto (pagos suman total, efectivo/cambio, estado `completada`, número de venta) **no cambia**.

Nota de seguridad: el precio ahora lo fija el cliente (regateo en calzado, precio al vender en Granja); esto es intencional por v4.0. El guardrail no es de rechazo sino de **registro + auditoría** (precio final + snapshot del rango). La RPC sigue `SECURITY DEFINER`; `auth.uid()`/trigger de auditoría llenan `created_by`.

## 5. Cliente

**`lib/carrito.ts` (lógica pura, TDD):**
- `ProductoVendible`:
  - Calzado: `precioMin`, `precioMax`; `precio` (elegido) inicia en `precioMax`. Conserva `stock`.
  - Granja: `precio` (por unidad) inicia en `precioSugerido ?? 0`; `stock` deja de aplicar.
- `ItemCarrito`: el `precio` es editable por línea (regateo / precio Granja).
- Nueva acción `cambiarPrecio { id, precio }`: fija `precio` (clamp a `>= 0`); **sin** recorte por rango (el rango es informativo). Recalcula `subtotal = precio × cantidad`.
- `conCantidad`: Granja **no** recorta por stock; calzado mantiene recorte por stock + entero. `subtotal = precio × cantidad`.
- Helper opcional `bajoMinimo(item): boolean` (calzado y `precio < precioMin`) para el aviso suave de la UI.

**`lib/ventas.ts`:**
- `buscarProductos`: mapear calzado a `{ precioMin, precioMax, precio: precioMax, stock }` y Granja a `{ precio: precioSugerido ?? 0, precioSugerido }` sin stock. Ajustar el `select` a las nuevas columnas.
- Envío a la RPC: incluir `precio` por item.

**Pantalla `app/(app)/ventas/nueva.tsx`:**
- Calzado: mostrar rango `mín–máx`; campo de precio inicia en el máximo, editable; **aviso suave** (no bloqueante) si `precio < mín` ("bajo el mínimo"). Confirmar la venta no se bloquea por precio.
- Granja: mostrar la unidad de medida; campos de **cantidad** y **precio por unidad** (autocompletado con `precio_sugerido`); subtotal en vivo. Sin tope de stock.

## 6. Migración y compatibilidad

- Migración de esquema (una): añade columnas calzado + backfill + constraint + drop `precio_venta`; Granja drop stock + `precio_sugerido` (backfill) + drop `precio_venta`; `venta_items` snapshot cols.
- Migración de la RPC (otra): reemplaza `registrar_venta` (misma firma; el body usa el `precio` por item).
- Regenerar `lib/database.types.ts`.
- `venta_items` históricos quedan con snapshot `null` (aceptable).
- Orden de tareas: esquema → RPC → cliente (carrito → ventas.ts → pantalla) → tipos → verificación. Las consultas de `lib/ventas.ts` se actualizan junto al cambio de esquema para no quedar rotas.

## 7. Testing

- `lib/carrito.test.ts`: precio calzado inicia en máximo; `cambiarPrecio` permite bajo el mínimo (sin recorte) y `bajoMinimo` lo detecta; Granja sin recorte por stock; subtotales `precio × cantidad`; calzado conserva recorte por stock + entero.
- Smoke tests SQL de la RPC (centinela `*_OK_ROLLBACK`):
  - Calzado dentro del rango: venta OK, `precio_unitario` y snapshots correctos, stock decrementado.
  - Calzado **bajo el mínimo**: venta **OK** (no se rechaza), `precio_unitario` = el precio bajo, snapshots = rango del producto.
  - Granja: venta OK, stock no existe/no se toca, `precio_unitario × cantidad` correcto, snapshots null.
  - Precio inválido (`<= 0`) o cantidad inválida: rechazado.
- `npx tsc --noEmit` (exit 0, con el shim `env.d.ts`) y `npm test` verdes.

## 8. Archivos
- `supabase/migrations/<ts>_sp2_precio_min_max_granja.sql` (esquema + backfill + snapshot)
- `supabase/migrations/<ts>_sp2_registrar_venta_precio.sql` (RPC)
- `lib/carrito.ts` + `lib/carrito.test.ts`
- `lib/ventas.ts`
- `app/(app)/ventas/nueva.tsx`
- `lib/database.types.ts` (regenerado)
