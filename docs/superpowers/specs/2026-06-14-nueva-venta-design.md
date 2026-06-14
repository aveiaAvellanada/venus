# Diseño — Módulo Nueva Venta (v1)

Fecha: 2026-06-14
Estado: Aprobado
Documento maestro de referencia: `docs/Venus_PRD_v3.0.md` (Módulo 1: Registro de Ventas, Flujos 1 y 2, Reglas de negocio 1, 2, 16, 18).

## 1. Objetivo y alcance

Permitir registrar una **venta completa** (pagada en el momento) desde el celular, de forma rápida, actualizando el inventario automáticamente. Lo usa Andrés (empleado) principalmente y Don Carlos (dueño) cuando está en el local.

### Dentro del alcance (v1)
- Carrito con **zapatos** (`productos_calzado`) y **productos varios** (`productos_varios`).
- Buscador de productos (solo disponibles: `activo` y `stock_actual > 0`).
- Cantidad entera para calzado (limitada al stock) y **decimal** para varios (ej. 0.5 libra).
- Métodos de pago: **Efectivo** (con efectivo recibido y cálculo de cambio), **Nequi**, **Daviplata**.
- **Pagos mixtos** (efectivo + Nequi/Daviplata en una misma venta).
- Datos de cliente **opcionales** (nombre, apellido, teléfono).
- Descuento de stock **atómico** y a prueba de stock negativo y de carreras entre dos celulares.
- Hub de Ventas con resumen del día y lista de ventas de hoy.

### Fuera del alcance (v1, iteraciones posteriores)
- **Offline-first** (PowerSync/SQLite + cola de sync). v1 es **online-first**: registrar una venta requiere internet; si no hay red, la venta no se guarda y se avisa claramente.
- **Separado / pago parcial** (anticipo, estado `separada`, saldo, pantalla de cobro de saldo).
- **Corrección de ventas** (solo dueño) — es otro módulo.
- Recepción de mercancía, cierre de caja, inventario (módulos aparte).

## 2. Decisiones de arquitectura

| Tema | Decisión |
|---|---|
| Conectividad v1 | Online-first (escritura directa a Supabase). Offline después. |
| Confirmar venta | RPC Postgres `registrar_venta` `SECURITY DEFINER`, transaccional. |
| Estructura del flujo | Pantalla única con máquina de estados `carrito → cobrar → confirmacion` (Opción A, igual patrón que el login). |
| Estado del carrito | `useReducer` en la pantalla, con un reducer puro en `lib/carrito.ts`. |
| Datos de prueba | Seed versionado e idempotente (`supabase/seeds/demo_inventario.sql`). |
| Cuadre de caja | Se persisten `efectivo_recibido` y `cambio` en `ventas`. |

## 3. Cambios en la base de datos

Una sola migración (`supabase/migrations/<timestamp>_nueva_venta.sql`) con dos partes.

### 3.1 Columnas nuevas en `public.ventas`
```sql
alter table public.ventas
  add column efectivo_recibido numeric(12,2) check (efectivo_recibido >= 0),
  add column cambio            numeric(12,2) not null default 0 check (cambio >= 0);
```
- `efectivo_recibido`: cuánto efectivo entregó el cliente. **Nullable** (null cuando la venta no tiene componente en efectivo). Lo necesita Don Carlos para cuadrar caja.
- `cambio`: vuelto entregado = `efectivo_recibido − (porción pagada en efectivo)`. Default 0 (ventas sin efectivo o pago exacto).

### 3.2 Función `registrar_venta`
```text
public.registrar_venta(
  p_items              jsonb,   -- [{ tipo, producto_id, cantidad }]
  p_pagos              jsonb,   -- [{ metodo, monto }]
  p_efectivo_recibido  numeric default null,
  p_cliente_nombre     text default null,
  p_cliente_apellido   text default null,
  p_cliente_telefono   text default null
) returns jsonb  -- { venta_id, numero }
```
Características:
- `language plpgsql`, `security definer`, `set search_path = public, private, extensions`.
- `revoke all ... from public; grant execute ... to authenticated;`.

Lógica, todo en **una transacción** (cualquier `raise` revierte todo):
1. `v_uid := auth.uid()`; si es null → `raise exception 'No autenticado'`. El vendedor es **siempre** `auth.uid()`; no se confía en ningún parámetro del cliente para identidad.
2. Si `p_items` está vacío → `raise exception 'La venta no tiene productos'`.
3. **Por cada item** (en orden estable por `producto_id` para evitar deadlocks):
   - `select ... for update` del producto según `tipo` (`productos_calzado` o `productos_varios`).
   - Si no existe o `activo = false` → `raise exception 'Producto no disponible'`.
   - Lee `precio_venta` **del servidor** (no del cliente) y arma snapshot (`descripcion`/`nombre`, `talla`, `color`, `unidad_medida`).
   - Valida `cantidad > 0` y `stock_actual >= cantidad`, si no → `raise exception 'Stock insuficiente para %', descripcion`.
   - Acumula `v_total += precio_venta * cantidad`.
4. Valida pagos: cada `metodo ∈ (efectivo,nequi,daviplata)` y `monto > 0`; `suma(montos) = v_total` exacto, si no → `raise exception 'Los pagos no suman el total'`.
5. Calcula efectivo: `v_efectivo_monto := suma de montos con metodo='efectivo'`. Si hay efectivo:
   - `p_efectivo_recibido` debe ser `>= v_efectivo_monto`, si no → `raise exception 'El efectivo recibido es menor al pago en efectivo'`.
   - `v_cambio := p_efectivo_recibido − v_efectivo_monto`.
   - Persistir `efectivo_recibido := p_efectivo_recibido`, `cambio := v_cambio`.
   - Si no hay efectivo: `efectivo_recibido := null`, `cambio := 0`.
6. `insert into ventas (vendedor_id, total, monto_pagado, saldo_pendiente, estado, efectivo_recibido, cambio, cliente_*)` con `estado='completada'`, `monto_pagado=total`, `saldo_pendiente=0`; `returning id, numero`.
7. Inserta filas en `venta_items` (con snapshots) y descuenta `stock_actual` de cada producto.
8. Inserta filas en `metodos_pago_venta` (soporta varias → pago mixto).
9. `return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero)`.

Por qué `SECURITY DEFINER`: por RLS el empleado **no** tiene `UPDATE` sobre `productos_calzado/varios`, así que no podría descontar stock con sus permisos. La función corre como owner y **valida todo internamente** (identidad por `auth.uid()`, precios del servidor, stock, cuadre de pagos).

### 3.3 Regenerar tipos
Tras aplicar la migración, regenerar `lib/database.types.ts` (aparecerán las columnas nuevas y `registrar_venta` en `Functions`).

## 4. Seed de datos (`supabase/seeds/demo_inventario.sql`)

Script **idempotente** (borra por marcador y reinserta; no toca esquema, no es migración). Se aplica a la DB remota durante la implementación para poder probar en dispositivo. Contenido (referencias del PRD):
- **Calzado**: Tenis Nike Air Force (`NK-2024-BLK`) tallas 38/39/40 negro y 38 blanco; una fila en `stock_actual = 0` (para ver "AGOTADO" cuando exista Inventario); Chancla, Escolar, Botas caucho. ~8 filas, categorías válidas del check.
- **Varios**: Huevos (`unidad_medida='panel'`, $16.000), Café (`libra`), Limón (`libra`), con stock.

## 5. Capa de datos (`lib/`)

### `lib/carrito.ts` (puro, testeable)
- Tipos: `TipoProducto`, `MetodoPago`, `ProductoVendible`, `ItemCarrito`, `PagoInput`, `EstadoCarrito`.
- `ProductoVendible`: `{ tipo, id, titulo, detalle, precio, stock, unidad? }`.
- Reducer `carritoReducer(estado, accion)` con acciones: `agregar` (fusiona si ya existe el mismo producto; cantidad inicial 1, tope = stock para calzado), `cambiarCantidad` (valida `0 < cantidad <= stock`; decimal permitido solo para varios), `quitar`, `limpiar`.
- Selectores/helpers puros: `totalCarrito(items)`, `validarPagos(pagos, total)` (suma exacta), `calcularCambio(efectivoRecibido, efectivoMonto)`.

### `lib/ventas.ts` (acceso a datos)
- `buscarProductos(q: string): Promise<ProductoVendible[]>` — consulta `productos_calzado` y `productos_varios` con `activo` y `stock_actual > 0`; `ilike` sobre descripción/referencia/talla/color (calzado) y nombre (varios). Une y limita (~20). `q` vacío → primeros disponibles.
- `registrarVenta(input): Promise<{ numero: number }>` — mapea el carrito + pagos + efectivo recibido + cliente a la forma de la RPC y llama `supabase.rpc('registrar_venta', …)`. Traduce errores de la RPC a mensajes en español (ver §7).
- `resumenHoy(): Promise<{ cantidad: number; total: number }>` y `listarVentasHoy(): Promise<VentaResumen[]>` — para el hub (RLS ya limita al día en curso del empleado).

## 6. Navegación y pantallas

### Rutas
- `app/(app)/ventas/index.tsx` — **Hub**: cabecera "Hoy: N ventas — $total", botón grande "+ Nueva venta", lista de ventas de hoy (hora · total · método, solo lectura). `useRequireModulo('ventas')`.
- `app/(app)/ventas/nueva.tsx` — **Flujo** (máquina de estados). `useRequireModulo('ventas')`.
- `lib/permisos.ts`: agregar campo opcional `ruta?: string` a `Modulo`; `ventas` → `/ventas`. La grilla del home usa `m.ruta ?? '/modulo/${m.id}'` (los módulos no construidos siguen al placeholder).

### `nueva.tsx` — etapas
- **Carrito**: buscador (autofocus, debounce ~300ms) → resultados tappeables (al tocar se agregan); lista del carrito con stepper (− / +; entero ≤ stock para calzado, input decimal para varios), subtotal y quitar; pie con Total + "Cobrar" (deshabilitado si está vacío).
- **Cobrar**: Total grande; chips de método (multiselección para mixto); monto por método (si es uno solo, autocompleta = total); si hay efectivo, campo "Efectivo recibido" → muestra "Cambio: $X" en vivo; sección colapsable "Datos del cliente (opcional)"; botón "Confirmar venta" (deshabilitado hasta que `validarPagos` pase y, si hay efectivo, el recibido ≥ porción en efectivo).
- **Confirmación**: ✓ verde "Venta #N registrada"; botones "Nueva venta" (reset a carrito) y "Listo" (vuelve al hub).

Principios PRD aplicados: botones grandes, texto grande, español colombiano, máx ~3 toques para el camino feliz.

## 7. Manejo de errores (claros, en español)
- Buscar sin red → "No se pudo buscar. Revisa tu conexión." + reintentar.
- `registrarVenta`:
  - Stock insuficiente (raise de la RPC) → "Ya no hay suficiente stock de [producto]. Actualiza el carrito."
  - Pagos no cuadran → se previene en cliente con `validarPagos` antes de llamar; la RPC también lo valida como red de seguridad.
  - Sin red → "Sin conexión. La venta no se guardó. Intenta de nuevo." (online-first: nada quedó a medias).
  - Otro → mensaje claro; **el carrito nunca se pierde** ante un error (se puede reintentar).
- Botón atrás con carrito no vacío → confirmación "¿Descartar la venta?".

## 8. Testing
- `lib/carrito.test.ts` (jest): reducer (fusión de duplicados, cambios de cantidad con tope de stock, decimales solo en varios, total), `validarPagos` (mixto correcto, rechaza sobra/falta), `calcularCambio`.
- RPC `registrar_venta` (smoke test SQL durante implementación, vía MCP): (a) una venta descuenta stock y crea venta+items+pagos; (b) una venta que excede el stock se rechaza y no deja rastro; (c) pagos que no suman el total se rechazan; (d) efectivo recibido < porción efectivo se rechaza; (e) cambio se calcula y persiste.
- E2E manual en Expo Go: checklist (login empleado → nueva venta zapatos con Nequi; venta de varios con efectivo y cambio; pago mixto; verificar stock descontado y la venta en el hub).

## 9. Archivos
- `supabase/migrations/<timestamp>_nueva_venta.sql` (columnas + RPC)
- `supabase/seeds/demo_inventario.sql` (seed idempotente)
- `lib/carrito.ts` + `lib/carrito.test.ts`
- `lib/ventas.ts`
- `app/(app)/ventas/index.tsx`
- `app/(app)/ventas/nueva.tsx`
- `lib/permisos.ts` (campo `ruta` + ruta de `ventas`) — ajustar `lib/permisos.test.ts` si aplica
- `lib/database.types.ts` (regenerado)

## 10. Reglas de negocio cubiertas (PRD §7)
- (1) Venta confirmada no se elimina — no se implementa borrado.
- (2) Inventario nunca negativo — guarda de stock en la RPC; agotados no aparecen en el buscador.
- (16) Andrés no cambia precios — el precio lo fija el servidor en la RPC.
- (18) Pagos mixtos — soportados y validados (suma exacta).
