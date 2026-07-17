# Paso 8 del rediseño — Nueva Venta restilizada + Perfil + barrido de pantallas

**Fecha:** 2026-07-16
**Rama:** `feat/redesign-nueva-venta`
**Referencias:** `redisign-visual.md` (§5.2 recetas 5/8/10, §6, §7.5, §7.6, §8, §9.3 paso 8), `redisign.md`

## Objetivo

Cerrar el paso 8 del plan de migración §9.3: restilizar el flujo de Nueva Venta,
pulir Perfil y llevar todas las pantallas restantes al nuevo lenguaje visual,
eliminando las que el nuevo diseño ya reemplaza. Sin cambios de lógica de
negocio ni de backend.

## Decisiones cerradas (usuario, 2026-07-16)

1. **Alcance:** todo el paso 8 en esta rama, en 4 fases secuenciales con
   commit propio y tests en verde por fase (Opción A). No se fusiona a main
   por fase salvo que el usuario lo pida.
2. **Búsqueda en Nueva Venta:** directo al carrito (flujo actual restilizado).
   Tocar un resultado agrega al instante; el detalle unificado (§7.4) queda
   como camino alterno desde el tab Productos.
3. **Pantallas redundantes:** se eliminan y sus rutas se redirigen a las
   nuevas. Editores y fichas sin reemplazo se restilizan.
4. **Perfil–Caja:** FilaLista "Automatización de caja" → `/caja/config`
   restilizada (ya existe así; se conserva).
5. **`Sheet` (§6) queda diferido** (YAGNI): ninguna pantalla de este paso lo
   necesita. El input de precio de Granja en sheet (§7.4) es trabajo del tab
   Productos, fuera de este paso.

## Fase 1 — Componentes nuevos (`components/ui/`)

Ambos consumen `useTema()` y respetan `useReducedMotion` (§5.3).

### `Toast`

- `ToastProvider` montado junto a los providers existentes (nivel del auth
  guard, junto a `CarritoProvider`) + hook `useToast()` →
  `mostrar(mensaje: string, tipo?: 'exito' | 'error' | 'info')` (default
  `exito`).
- Visual: pill/tarjeta flotante abajo (sobre el tab bar, respetando insets),
  fondo `surface` elevado, icono Lucide por tipo (`CircleCheck` éxito /
  `CircleAlert` error / `Info` info), texto `body`.
- Motion: entra slide-up + fade 200ms, se autodescarta a los 2.5s con fade.
  Reduced motion: solo fade ≤150ms. Un toast a la vez (el nuevo reemplaza al
  anterior).
- Primer consumidor: `app/(app)/productos/[ref].tsx` — al agregar al carrito
  muestra "Agregado: talla N · Color" (§7.4; en paso 7 quedó solo haptic).

### `OverlayExito` (receta 10)

- Overlay a pantalla completa: `CircleCheck` entra `scale 0.6 → 1` con spring,
  flash de fondo `successSoft` 400ms, haptic `notificationSuccess`.
- Se autodescarta a los 1.2s y llama `onFin`. Props: `visible`,
  `mensaje?`, `onFin`.
- Consumidores: confirmación de venta (Fase 2) y cierre de caja (Fase 4b).

**Tests:** lógica renderizable de ambos (render por tipo, autodescarte con
fake timers, un-toast-a-la-vez).

## Fase 2 — Nueva Venta restilizada (`app/(app)/ventas/nueva.tsx`)

**Invariantes:** `lib/carrito.ts`, `useCarrito()`, `buscarProductos`,
`registrarVenta`, guard de caja abierta y el wizard de 3 etapas
(`carrito → cobrar → confirmacion`) no cambian de lógica. Solo presentación.

### Etapa carrito

- Header: icono `X` (Lucide) para salir con la confirmación de descarte
  actual; título `h2` "Nueva venta".
- Búsqueda: `CampoTexto` con icono `Search`, autofocus, debounce actual.
- Resultados: filas (título `body` seminegrita, detalle + stock `caption
  text3`, precio a la derecha); tap = agregar al carrito + haptic light.
  Stagger receta 5 solo en primera carga (nunca al re-filtrar).
- Carrito (tarjeta inferior): líneas restilizadas —
  - Calzado: stepper circular `primarySoft` (− / cantidad / +), precio c/u
    editable inline; bajo el mínimo → borde y rango en `danger` con leyenda
    "bajo el mínimo" (validación inline §7.5).
  - Granja: cantidad decimal × precio, botón quitar (×).
  - Subtotal por línea.
- CTA: `Boton` primario lg "Cobrar $X", deshabilitado con carrito vacío.
- Estado "Caja cerrada": `EstadoVacio` con icono `Lock` + Boton "Ir a Caja" +
  fantasma "Volver".

### Etapa cobrar

- Total en tipografía display centrado.
- Métodos con componente `Chip` (efectivo / nequi / bre_b / otro), multi-select
  como hoy; un solo método autollenado con el total (comportamiento actual).
- Montos con `CampoTexto` number-pad.
- **Nuevo: línea de diferencia en vivo** — "Faltan $X" / "Sobran $X" en
  `danger`; "✓ Cuadra" en `success`. Regla de cálculo: `total − suma(pagos)`.
  Nunca solo color: siempre lleva texto (checklist §8).
- Efectivo recibido + "Cambio: $X" (success) cuando hay efectivo.
- Cliente opcional: 3 `CampoTexto` (nombre, apellido, teléfono `phone-pad`).
- Confirmar: `Boton` primario lg con estado `cargando`; deshabilitado si no
  cuadra o falta efectivo recibido (regla actual `puedeConfirmar`).

### Etapa confirmación

- `OverlayExito` (receta 10); al descartarse queda la pantalla
  "Venta #N registrada" con `Boton` "Nueva venta" (limpia todo, vuelve a
  carrito) y fantasma "Listo".

### Navegación (consecuencia de eliminar `/ventas`)

- "Salir" y "Listo": `router.back()` con fallback
  `router.replace('/movimientos')` si no hay historial.

### Tests

- Actualizar suites de UI existentes de nueva venta (labels/estructura).
- Nuevos: línea de diferencia en vivo (faltan/sobran/cuadra) y render de
  confirmación con OverlayExito.

## Fase 3 — Perfil (pulido menor)

`app/(app)/(tabs)/perfil.tsx` ya cumple §7.6 casi por completo. Cambios:

- "Cerrar sesión": título de la fila en `danger` (icono ya lo está).
- Badge de rol capitalizado: "Dueño" / "Administrativa" / "Operativo"
  (hoy en MAYÚSCULAS).
- Sección Caja/Equipo se conserva solo-dueño con enlaces existentes.

## Fase 4 — Barrido

### 4a. Eliminaciones y redirecciones (un commit)

Borrar:

- `app/(app)/ventas/index.tsx` (lo cubre Movimientos)
- `app/(app)/devoluciones/index.tsx` (Movimientos con toggle)
- `app/(app)/inventario/calzado/index.tsx` (tab Productos; muere con él el
  bug de categorías desalineadas Tenis/Botas/Sandalias)
- `app/(app)/inventario/granja/index.tsx` (tab Productos)
- `app/(app)/modulo/[id].tsx` (placeholder obsoleto)

Actualizar referencias a rutas muertas en: `devoluciones/nueva.tsx`,
editores de inventario, `inventario/carga.tsx`, `(tabs)/index.tsx`,
`(tabs)/productos.tsx`, `lib/permisos.ts` (+ tests `permisos.test.ts`,
`devoluciones*.test*`). Verificación: `grep` de las 5 rutas borradas sin
resultados en `app/`, `components/`, `lib/`.

### 4b. Restilizado mecánico (~25 pantallas, un commit por grupo)

| Grupo | Pantallas |
|---|---|
| Devoluciones | `nueva` |
| Inventario | ficha `calzado/[id]`, `calzado/editor`, `granja/editor`, `carga` |
| Recibir mercancía | `index`, `nueva`, `[id]` |
| Proveedores | `index`, `[id]`, `editor` |
| Gastos | `index`, `fijos`, `fijos-editor`, `pagar` |
| Caja | `index`, `cierre`, `config`, `historial` |
| Empleados | `index`, `[id]` |
| Balance + Reportes | `balance`, `reportes/index`, `reportes/config`, `reportes/periodos` |

(`ventas/[id].tsx` y `devoluciones/[id].tsx` ya se restilizaron en paso 6.)

Reglas por pantalla (idénticas para todos los grupos):

1. Tokens vía `useTema()` — cero colores/tamaños hardcoded.
2. Componentes de `components/ui/` (Boton, Tarjeta, CampoTexto, FilaLista,
   Chip, ControlSegmentado, Badge, EstadoVacio, Esqueleto).
3. Header consistente: volver + título `h2`.
4. Teclados semánticos (§8) y `accessibilityLabel` en español.
5. Ambos temas verificados (no inferir el oscuro).
6. Lógica y llamadas a datos intactas.
7. Extra puntual: `caja/cierre.tsx` adopta `OverlayExito`.
8. Alerts puramente informativos (no bloqueantes) migran a `Toast` de error;
   confirmaciones destructivas siguen en `Alert`.

### Tests

- Suites de pantallas borradas se eliminan; las demás se actualizan.
- Cierre por fase y final: `npx tsc --noEmit` + `npx jest` completos en verde.

## Fuera de alcance

- Componente `Sheet` (diferido, sin consumidor en este paso).
- Cambios de backend/RPCs/RLS.
- Paso 9 (§9.3): QA de ambos temas + accesibilidad en dispositivo real —
  sigue pendiente y CRÍTICO tras 8 fases sin smoke en Android.
- Input de precio de Granja en sheet desde el tab Productos (§7.4).
