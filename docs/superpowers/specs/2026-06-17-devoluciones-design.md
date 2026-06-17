# Especificación de Diseño: Devoluciones (M2)

> Diseño aprobado el 2026-06-17. Parte de una capa de BD previa (sesión Antigravity
> cortada) que se **reescribe** según las decisiones de producto de esta sesión:
> los cambios de producto admiten **diferencia de precio** y la venta distingue el
> estado **cambiada** del estado **devuelta**.

## 1. Introducción y Objetivos

El módulo **Devoluciones (M2)** permite procesar tres operaciones sobre una venta ya
confirmada: **devolución total**, **devolución parcial** y **cambio de producto**.
Toda operación es **atómica**, **auditada** y respeta las reglas de negocio del PRD v4.0:

- Una venta confirmada **nunca** se elimina; la devolución es el mecanismo de corrección.
- El stock de **calzado** se restituye; **Granja (varios) no** restituye stock.
- **No se puede devolver más de lo vendido** (acumulado entre devoluciones).
- El inventario de calzado **nunca** queda en negativo.

### Roles y Permisos
- **Todos los roles operativos** (dueño, admin, empleados) pueden registrar
  devoluciones — el módulo `devoluciones` ya tiene `roles: TODOS` en `lib/permisos.ts`.
  No requiere gate de dueño.
- La seguridad real es **RLS + RPC `SECURITY DEFINER`**: las tablas son de solo
  lectura para `authenticated`; la escritura ocurre exclusivamente vía el RPC
  `registrar_devolucion`.

---

## 2. Reglas de negocio de la operación

### 2.1 Tipos de devolución
| Tipo | Descripción | Stock calzado | Dinero |
|---|---|---|---|
| `total` | Se devuelven todos los ítems aún no devueltos de la venta | +cantidad | reembolso del total devuelto |
| `parcial` | Se devuelve parte de los ítems | +cantidad | reembolso del subtotal devuelto |
| `cambio` | Se reemplaza un calzado por otro del **mismo modelo** (referencia+descripción), distinta talla/color, o el mismo (defecto) | original +cantidad, reemplazo −cantidad | **diferencia de precio** (ver 2.2) |

- **Granja (varios)** admite `total`/`parcial` (reembolso) pero **no** `cambio`.
- El cambio de calzado exige que el reemplazo tenga la **misma `referencia` y
  `descripcion`** que el ítem devuelto (es el mismo modelo, otra talla/color).

### 2.2 Cambios con diferencia de precio (decisión de producto)

El calzado usa **regateo** (precio mínimo/máximo, precio negociado en el momento),
así que el precio del reemplazo **se ingresa al momento del cambio**, igual que en una
venta. Por cada ítem de cambio se captura `precio_reemplazo` y se guarda un snapshot
del rango (`precio_minimo_snapshot`/`precio_maximo_snapshot`) del reemplazo, para que
Andrés audite cambios por debajo del mínimo.

Cálculo por ítem de cambio:

```
diferencia = (precio_reemplazo − precio_pagado_original) × cantidad
```

A nivel de la devolución se acumula:
- `diferencia > 0` ⇒ el cliente **paga** la diferencia → suma a `monto_cobrado`.
- `diferencia < 0` ⇒ la tienda **reembolsa** → suma a `monto_devuelto`.
- `diferencia = 0` ⇒ cambio par (sin dinero).

**Una misma devolución usa una sola dirección de dinero:** o cobra, o reembolsa, o
ninguna. Si el RPC calcula un neto que requiere cobrar (`monto_cobrado > 0`) entonces
`monto_devuelto` debe ser 0, y viceversa. El cliente declara cómo paga/recibe
(`metodo_cobro` / `metodo_reembolso`).

### 2.3 Estado de la venta (decisión de producto)

`ventas.estado` se amplía con `cambiada_parcial` y `cambiada_total`. Tras registrar una
devolución, el RPC recalcula el estado de la venta con esta regla derivada:

- Sea `vendido` la cantidad total de ítems de la venta y `movido` el acumulado
  devuelto/cambiado entre **todas** las devoluciones de la venta.
- Si `movido == vendido` (terminal): `cambiada_total` si **todas** las devoluciones de
  esa venta son de tipo `cambio`; si no, `devuelta_total`.
- Si `0 < movido < vendido`: `cambiada_parcial` si **todas** son `cambio`; si no,
  `devuelta_parcial`.

> **Convención de caso mixto:** si una venta acumula cambios *y* devoluciones reales,
> gana el estado `devuelta_*`. El detalle fino siempre queda en las filas de
> `devoluciones`/`devolucion_items`; el `estado` es solo un resumen para reportes.

### 2.4 Validaciones del RPC
- Autenticación obligatoria (`auth.uid()` no nulo).
- `motivo` no vacío; `tipo_devolucion` y `metodo_*` dentro de su dominio.
- La venta debe existir y estar en `completada`, `devuelta_parcial` o `cambiada_parcial`
  (se bloquean `separada`/`cancelada`/estados terminales).
- Al menos un ítem; cada ítem pertenece a la venta; `cantidad > 0`.
- Calzado: la cantidad debe ser **entera**.
- `cantidad_solicitada + ya_devuelto ≤ cantidad_vendida` por ítem.
- En cambio: `cambio_talla_color_id` requerido, reemplazo **activo**, mismo
  modelo (referencia+descripción), y stock suficiente si es distinta talla/color.
- Locks `FOR UPDATE` sobre la venta y los `venta_items` involucrados (evita carreras
  entre devoluciones simultáneas).
- El monto declarado por el cliente debe **coincidir exactamente** con el neto
  calculado por el RPC (`monto_devuelto`/`monto_cobrado`).

---

## 3. Capa de Base de Datos (reescribe la migración de Antigravity)

Migración nueva (timestamp creciente) que reemplaza
`20260617163622_m2_devoluciones_db.sql`. Sigue el patrón del repo: `drop ... if exists`
idempotente, RLS solo-SELECT a `authenticated`, escrituras revocadas, RPC
`SECURITY DEFINER` con `search_path = ''` y referencias `public.`/`auth.` calificadas;
triggers `private.set_audit_fields` + `private.set_updated_at`.

### 3.1 `public.ventas.estado` — check ampliado
```
('completada','separada','cancelada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total')
```

### 3.2 `public.devoluciones`
Columnas clave (además de `id`, `created_at`, `updated_at`, `created_by`, `updated_by`):
- `venta_id uuid not null` → `ventas(id)` `on delete restrict`
- `motivo text not null`
- `tipo_devolucion text not null` ∈ (`total`,`parcial`,`cambio`)
- `monto_devuelto numeric(12,2) not null default 0` (≥ 0) — reembolso al cliente
- `metodo_reembolso text` ∈ (`efectivo`,`nequi`,`daviplata`,`cambio`) — requerido si `monto_devuelto>0`
- `monto_cobrado numeric(12,2) not null default 0` (≥ 0) — **nuevo**: diferencia cobrada al cliente
- `metodo_cobro text` ∈ (`efectivo`,`nequi`,`daviplata`) — **nuevo**: requerido si `monto_cobrado>0`
- **Check:** no pueden ser ambos > 0 (`monto_devuelto = 0 OR monto_cobrado = 0`).

### 3.3 `public.devolucion_items`
- `devolucion_id uuid not null` → `devoluciones(id)` `on delete cascade`
- `venta_item_id uuid not null` → `venta_items(id)` `on delete restrict`
- `producto_calzado_id` / `producto_varios_id` (exactamente uno; check XOR)
- `cantidad numeric(12,3) not null` (> 0)
- `precio_unitario numeric(12,2) not null` (precio pagado original, ≥ 0)
- `subtotal numeric(12,2) not null` (valor reembolsable del ítem en devolución pura; 0 en cambio par)
- `cambio_talla_color_id uuid` → `productos_calzado(id)` (reemplazo en cambios)
- `precio_reemplazo numeric(12,2)` — **nuevo**: precio negociado del reemplazo (solo cambios)
- `precio_minimo_snapshot` / `precio_maximo_snapshot numeric(12,2)` — **nuevo**: rango del reemplazo para auditoría
- Índices: `venta_id` (en devoluciones), `devolucion_id`, `venta_item_id`.

### 3.4 RPC `public.registrar_devolucion`
Firma:
```
registrar_devolucion(
  p_venta_id uuid, p_motivo text, p_tipo_devolucion text,
  p_metodo_reembolso text, p_metodo_cobro text,
  p_monto_devuelto numeric, p_monto_cobrado numeric, p_items jsonb
) returns jsonb   -- { devolucion_id }
```
Cada elemento de `p_items`: `{ venta_item_id, cantidad, cambio_talla_color_id?, precio_reemplazo? }`.
Lógica: validar → insertar `devoluciones` → recorrer ítems (validar cantidades,
restituir/mover stock, calcular `subtotal` y acumular `diferencia`) → derivar
`monto_devuelto`/`monto_cobrado` netos y validar contra lo declarado → insertar
`devolucion_items` → recalcular `ventas.estado` (regla 2.3). `grant execute` a
`authenticated`; `revoke` a `public`.

### 3.5 RPC `public.obtener_resumen_dia` (modifica función ya en producción)
Mantiene la **misma forma JSON** (`total_ventas`, `total_general`, `total_efectivo`,
`total_nequi`, `total_daviplata`). Cambia la semántica del día:
- Cuenta ventas en `('completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total')`.
- **Resta** `monto_devuelto` por método de reembolso.
- **Suma** `monto_cobrado` por método de cobro (ingresos por diferencias de cambio).

> ⚠️ Es una función que ya consume **Caja (M7)**. La verificación debe confirmar que
> el cierre de caja sigue correcto tras este cambio.

### 3.6 Smoke test (local, vía MCP — `smoke_test*.sql` está gitignored)
`supabase/tests/smoke_test_devoluciones.sql`, en transacción con `rollback`, con asserts
que cubran: bloqueo de exceso de cantidad; Granja sin restitución de stock; restitución
de stock en devolución de calzado; cambio par (sin dinero); **cambio con diferencia a
favor del cliente (reembolso) y en contra (cobro)**; transiciones `devuelta_parcial`/
`_total` y `cambiada_parcial`/`_total`; neteo de `obtener_resumen_dia` (resta reembolsos,
suma cobros); y RLS (INSERT directo bloqueado, SELECT permitido).

---

## 4. Capa de acceso a datos (`lib/devoluciones.ts`)

- **Lógica pura y testeable** (en `lib/devoluciones.ts`, sin acceso a red), con
  `lib/devoluciones.test.ts` (jest, TDD):
  - `calcularDiferenciaCambio(precioOriginal, precioReemplazo, cantidad)` → diferencia firmada.
  - `netearDevolucion(items)` → `{ monto_devuelto, monto_cobrado }` (una sola dirección).
  - `validarCantidades(items, vendidoPorItem, yaDevueltoPorItem)` → errores legibles en español.
- **Acceso a datos:**
  - `buscarVentaParaDevolucion(query)` → busca la venta (por número/cliente) y trae sus
    `venta_items` con cantidades ya devueltas, para armar la pantalla. (Reutiliza/extiende
    el patrón de `listarVentasHoy` de `lib/ventas.ts`.)
  - `registrarDevolucion(input)` → invoca el RPC `registrar_devolucion` y normaliza el
    resultado/errores.
- Tras aplicar la migración, **regenerar `lib/database.types.ts`** vía MCP (no editar a mano).

---

## 5. Interfaz de Usuario (`app/(app)/devoluciones/`)

```
/app/(app)/devoluciones/
  ├── _layout.tsx   <-- Stack + useRequireModulo('devoluciones')
  ├── index.tsx     <-- Buscar venta a devolver + lista de devoluciones recientes
  └── nueva.tsx     <-- Flujo de devolución/cambio para la venta seleccionada
```

### 5.1 `index.tsx`
- Buscador de venta (por número o cliente) usando `buscarVentaParaDevolucion`.
- Al seleccionar una venta navega a `nueva` con su `venta_id`.
- Lista de devoluciones recientes (fecha, venta, tipo, monto) — informativa.

### 5.2 `nueva.tsx`
1. Muestra los ítems de la venta con cantidad vendida y cantidad ya devuelta (disponible).
2. El usuario elige **tipo**: total / parcial / cambio.
   - **total/parcial:** selecciona ítems y cantidades a devolver; elige `metodo_reembolso`.
   - **cambio (solo calzado):** selecciona el ítem, elige el reemplazo (mismo modelo,
     buscador de talla/color del catálogo) e ingresa `precio_reemplazo`. La UI muestra la
     **diferencia** y, según el signo, pide `metodo_cobro` (cobro) o `metodo_reembolso`.
3. La UI calcula el neto con la lógica pura de `lib/devoluciones.ts` y exige que el
   monto mostrado coincida con lo que confirma el usuario.
4. Confirmar → `registrarDevolucion`. Éxito → vuelve a `index` con feedback.
- Todo en **español**. Granja no ofrece la opción "cambio".

---

## 6. Estrategia de Pruebas

1. **Smoke SQL** (sección 3.6) vía MCP, verde, antes de aplicar al remoto.
2. **Jest lógica pura** `lib/devoluciones.test.ts`: diferencia de cambio (a favor/en
   contra/par), neteo en una sola dirección, validación de exceso de cantidad, calzado
   entero, Granja sin cambio.
3. **Jest UI** `lib/devoluciones_ui.test.tsx`: gating del layout; que Granja no muestre
   "cambio"; que un cambio con reemplazo más caro pida `metodo_cobro`; que confirmar
   invoque `registrarDevolucion` con el payload correcto.
4. **Verificación de regresión:** `npx tsc --noEmit` 0, `npm test` verde, y confirmar
   que **Caja (M7)** sigue correcta tras el cambio de `obtener_resumen_dia`.

---

## 7. Fuera de alcance (M2 v1)
- Reportes/balance de devoluciones (vive en M11/M12).
- Devoluciones de ventas separadas (M1 v2, no existe aún).
- Reembolso a método distinto del pago original sin validación adicional (se confía en
  el operador; la auditoría lo registra).
