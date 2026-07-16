# Rediseño Venus — Paso 5b: UI del dashboard (Menú) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el tab Menú en el dashboard de la spec §7.2: chips de período, tarjeta hero con count-up y delta, desglose por método, gráfico de barras y gastos del período — con vista reducida "solo hoy" para el empleado operativo.

**Architecture:** Dos componentes ui nuevos (`GraficoBarras` §6.14 y `ContadorDinero` receta 2) + reconstrucción de `app/(app)/(tabs)/index.tsx`. Datos: staff-admin usa `obtenerReportePeriodo` (totales + métodos + anterior), `obtenerVentasPorSubperiodo` (gráfico) y `obtenerGastosPeriodo` (gastos); empleado usa `obtenerResumenDia` (hoy). Delta con `compararConAyer` existente. El chip "Rango ▾" (fechas custom) queda ⏳ para una iteración posterior (necesita sheet con date-range picker).

**Tech Stack:** Reanimated 4 (count-up con AnimatedTextInput+useAnimatedProps, barras con scaleY), expo-linear-gradient, componentes ui existentes.

## Global Constraints

- Los de fases anteriores (tokens, TDD, fake timers con Reanimated, español, mocks por archivo).
- Dinero SIEMPRE `'$' + n.toLocaleString('es-CO')` y tabular.
- Delta nunca solo color: flecha ▲/▼ + %. División por cero → `compararConAyer` (sinBase oculta el %... muestra chip "nuevo" o nada).
- Gráfico: barras solo `transform` (scaleY, origin bottom), stagger 30ms, tap → tooltip con valor exacto, área táctil ≥44dp, todo-cero → mensaje vacío.
- Empleado operativo: sin chips/gráfico/gastos/comparación histórica (PRD §2); hero de HOY con `obtenerResumenDia`.
- Commits con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Rama
- [ ] `git checkout main && git pull && git checkout -b feat/redesign-dashboard` + commit del plan.

### Task 2: `etiquetaBucket` + `GraficoBarras` (TDD)

**Files:** Modify `lib/dashboard.ts` (+`lib/dashboard.test.ts`); Create `components/ui/GraficoBarras.tsx`, `components/ui/GraficoBarras.test.tsx`; export en barrel.

**Interfaces:**
- `etiquetaBucket(inicio: string, granularidad: Granularidad): string` — dia→`'lun'|'mar'…` (es-CO, minúscula), semana→`'13 jul'`, mes→`'jul'`. Pura, zona-segura (mediodía UTC).
- `GraficoBarras({ datos: VentasBucket[]; granularidad: Granularidad })` — alto 120; barra máx = 100%; barra con mayor total en `primario` pleno, resto `primarioSoft`+borde; labels `micro texto3`; tap en barra → pill tooltip con `$monto`; todos en cero → texto "Sin ventas en este período".

**Steps:**
- [ ] Tests que fallan: etiquetas ('2026-07-13'→'lun', mes→'jul'); render: un label por bucket; tap muestra `$965.000`; todo-cero muestra vacío.
- [ ] FAIL → implementar → PASS → commit `feat(ui): GraficoBarras con tooltip y etiquetaBucket`.

### Task 3: `ContadorDinero` (TDD)

**Files:** Create `components/ui/ContadorDinero.tsx`, test dentro de `GraficoBarras.test.tsx` o propio; export en barrel.

**Interfaces:** `ContadorDinero({ valor: number; estilo?: StyleProp<TextStyle>; color?: string })` — TextInput no-editable animado (patrón ReText): al cambiar `valor` anima 0/anterior→valor con `withTiming(500, easeMove)`; reduced motion → salto directo. Formato es-CO.

**Steps:**
- [ ] Test que falla: renderiza `$1.250.000` como valor (con mock de reanimated los timings son inmediatos).
- [ ] FAIL → implementar → PASS → commit `feat(ui): ContadorDinero (count-up de dinero)`.

### Task 4: Dashboard en `(tabs)/index.tsx` (TDD)

**Files:** Modify `app/(app)/(tabs)/index.tsx`, `lib/tabs_menu_ui.test.tsx`.

**Comportamiento:**
- Header saludo + badge caja: SIN CAMBIOS.
- **Staff (dueno/admin):** chips `[Hoy][Semana][Mes][Año]` (estado `Periodo`, default hoy) → `rangoParaPeriodo` → `Promise.all(obtenerReportePeriodo, obtenerVentasPorSubperiodo, obtenerGastosPeriodo)` en `useFocusEffect` + al cambiar chip. Hero: gradiente, micro "TOTAL VENDIDO", `ContadorDinero` 40/blanco, chip delta (`compararConAyer(total_vendido, total_anterior)`: ▲ verde / ▼ rojo sobre blanco translúcido; `sinBase` → sin chip), caption "N ventas". Grid métodos: Efectivo/Nequi/Bre-B (+Otro si >0) con `TarjetaMetrica mini` + iconos (Banknote/Smartphone/Zap/CreditCard). Tarjeta gráfico: `GraficoBarras`. Tarjeta gastos: hasta 5 filas (nombre + `Badge neutro` FIJO/VARIABLE + monto) + fila total (`peligroTexto`); vacío → caption "Sin gastos en este período". Accesos del menú: SIN CAMBIOS, al final.
- **Empleado:** sin chips/gráfico/gastos/delta; hero de HOY con `obtenerResumenDia(hoyBogota)` + grid de métodos del día. Accesos ya filtrados (quedan vacíos → no se muestran).
- Cargando: `Esqueleto` de hero + grid + gráfico. Error de carga: caption discreta "No se pudo cargar el resumen" + pull-to-refresh (tinte primario) siempre disponible.

**Steps:**
- [ ] Actualizar `lib/tabs_menu_ui.test.tsx` (mocks nuevos: `../lib/reportes` con `obtenerResumenDia`+`obtenerReportePeriodo` mock y `compararConAyer` real vía requireActual; `../lib/dashboard` con wrappers mock y `rangoParaPeriodo`/`etiquetaBucket` reales). Casos: (a) dueño ve "TOTAL VENDIDO", el total formateado, métodos y gastos con total; (b) cambiar chip a "Semana" re-llama los wrappers con el rango de 7 días; (c) empleado no ve chips ni "GASTOS" y sí el total de hoy de `obtenerResumenDia`; (d) badge caja sigue funcionando (regresión).
- [ ] FAIL → implementar → PASS + tsc → commit `feat(ui): dashboard del Menú con hero, gráfico y gastos por rol`.

### Task 5: Verificación + cierre
- [ ] `npx tsc --noEmit` + `npx jest` completos → finishing-a-development-branch.

## Self-Review
1. **Cobertura §7.2:** chips ✓ (Rango ⏳ anotado), hero+delta+count-up ✓, métodos con bre_b/otro ✓, gráfico ✓, gastos ✓, accesos ✓, rol empleado ✓, skeletons ✓. Sticky header con e1 al scroll: omitido en esta iteración (polish menor, anotado).
2. **Placeholders:** formas de datos citadas de lib/reportes.ts y lib/dashboard.ts reales.
3. **Tipos:** `ReportePeriodo` (bre_b/otro), `VentasBucket`, `GastosPeriodo`, `ResumenDia` — existentes.
