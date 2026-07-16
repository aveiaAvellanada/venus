# Rediseño Venus — Paso 6: Movimientos con historiales + detalles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el tab Movimientos en el hub real de la spec §7.3: historiales en línea de Ventas/Devoluciones/Gastos con filtros de período compartidos, detalle de venta (con "Hacer devolución") y detalle de devolución. Cierra el gap `listarDevoluciones(período)`.

**Architecture:** Capa de datos nueva `lib/movimientos.ts` con selects directos de PostgREST (la RLS ya limita al empleado a lo de hoy; no hacen falta RPCs): `listarVentasPeriodo`, `obtenerVentaDetalle`, `listarDevoluciones`, `obtenerDevolucionDetalle` + helpers puros de badges. UI: rebuild de `(tabs)/movimientos.tsx` (toggle 3 + chips de período staff / solo-hoy empleado + resumen contextual) y 2 pantallas push nuevas: `app/(app)/ventas/[id].tsx` y `app/(app)/devoluciones/[id].tsx`. "Hacer devolución" → flujo existente `/devoluciones/nueva?numero=N` (ya lee ese param). Vista Gastos reusa `obtenerGastosPeriodo` (staff) + accesos a los módulos de gastos.

**Tech Stack:** PostgREST joins anidados, componentes ui existentes, patrón de tests del repo.

## Global Constraints

- Las de fases anteriores. Bogota = UTC-5 fijo: rango de un período = `gte(created_at, desde+'T00:00:00-05:00')` y `lte(created_at, hasta+'T23:59:59.999-05:00')`.
- Badges de estado de venta: completada→ÉXITO "COMPLETADA"; devuelta_parcial→ADVERTENCIA "DEV. PARCIAL"; devuelta_total→PELIGRO "DEVUELTA"; cambiada_parcial/total→NEUTRO "CAMBIO"; cancelada→PELIGRO "CANCELADA"; separada→ADVERTENCIA "SEPARADA". Tipos de devolución: total→PELIGRO, parcial→ADVERTENCIA, cambio→NEUTRO.
- Empleado: sin chips de período (solo hoy). Vista Gastos: total+lista solo staff (obtener_gastos_periodo es staff_admin); empleado ve accesos a registrar gasto variable.
- Una venta confirmada nunca se elimina: el detalle no ofrece borrar; "Hacer devolución" solo si estado ∈ completada/devuelta_parcial/cambiada_parcial.
- Commits con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Rama
- [ ] `git checkout main && git pull && git checkout -b feat/redesign-movimientos` + commit del plan.

### Task 2: `lib/movimientos.ts` (TDD)

**Interfaces (produce):**
- `VentaListado { id; numero; total; estado; hora; metodos: string[] }` · `listarVentasPeriodo(desde, hasta): Promise<VentaListado[]>` — select `id, numero, total, estado, created_at, metodos_pago_venta(metodo)`, rango Bogota, orden desc.
- `VentaDetalle { id; numero; total; estado; fecha; hora; vendedor: string | null; cliente: {nombre; apellido; telefono} | null; nota; efectivo_recibido; cambio; saldo_pendiente; corregida; correccion_motivo; items: {descripcion; talla; color; cantidad; precio_unitario; subtotal}[]; pagos: {metodo; monto}[] }` · `obtenerVentaDetalle(id)` — select `*` + `venta_items(...)` + `metodos_pago_venta(metodo, monto)` + `vendedor:users!ventas_vendedor_id_fkey(nombre)` (null si RLS lo bloquea), maybeSingle.
- `DevolucionListado { id; numero_venta; tipo; monto_devuelto; monto_cobrado; hora; fecha }` · `listarDevoluciones(desde, hasta)` — select con `venta:ventas(numero)`, rango sobre `devoluciones.created_at`, orden desc. **(cierra el gap del redisign)**
- `DevolucionDetalle { ...listado; motivo; metodo_reembolso; metodo_cobro; items: {descripcion; talla; color; cantidad}[] }` · `obtenerDevolucionDetalle(id)` — + `devolucion_items(cantidad, venta_item:venta_items(descripcion_snapshot, talla, color))`.
- Puros: `badgeEstadoVenta(estado): {texto; tipo: TipoBadge}` y `badgeTipoDevolucion(tipo)` según Global Constraints; `horaCorta(iso)` (es-CO h:mm).

**Steps:**
- [ ] Test que falla (`lib/movimientos.test.ts`, mock chainable de supabase.from como los tests lib existentes): mapeos de filas (metodos join → array), rangos con offset -05:00 en los filtros, badges puros, detalle null si no existe.
- [ ] FAIL → implementar → PASS + tsc → commit `feat(movimientos): capa de datos de historiales y detalles`.

### Task 3: Rebuild `(tabs)/movimientos.tsx` (TDD)

- Toggle `[Ventas][Devoluciones][Gastos]` + chips `[Hoy][Semana][Mes]` (staff; empleado sin chips, rango de hoy).
- Resumen contextual bajo el toggle (micro + montos tabulares): Ventas → `$total · N ventas` (suma del listado); Devoluciones → `$devuelto · N`; Gastos → `$total gastos`.
- Vista Ventas: `FilaLista` por venta (CirculoIcono según primer método: efectivo→Banknote/exito, nequi→Smartphone/primario, bre_b→Zap/primario, otro→CreditCard/neutro→primario; título `Venta #N`; sub `hora · métodos`; derecha monto tabular o Badge si estado ≠ completada) → push `/ventas/{id}`. Vacío → EstadoVacio "Aún no hay ventas en este período".
- Vista Devoluciones: fila = `Venta #N` + Badge tipo + derecha monto (devuelto, o cobrado si cambio) + sub hora → push `/devoluciones/{id}`. Vacío → EstadoVacio.
- Vista Gastos: staff → filas de `obtenerGastosPeriodo` (nombre + badge FIJO/VARIABLE + monto) + fila total; todos → accesos `Registrar gasto variable` (→`/gastos`) y `Gastos fijos` (→`/gastos/fijos`, staff).
- Esqueletos, pull-to-refresh, recarga en focus y al cambiar toggle/chip.
- [ ] Reescribir `lib/tabs_secciones_ui.test.tsx` (Movimientos): (a) staff ve resumen y filas de ventas del mock y navega a `/ventas/{id}`; (b) toggle a Devoluciones lista y navega al detalle; (c) toggle a Gastos muestra total y filas; (d) empleado: sin chips, `listarVentasPeriodo` llamado con hoy-hoy. Mantener los tests de Productos intactos.
- [ ] FAIL → implementar → PASS → commit `feat(ui): Movimientos con historiales en línea y filtros compartidos`.

### Task 4: Detalle de venta `app/(app)/ventas/[id].tsx` (TDD)

- Secciones §7.3 en tarjetas: encabezado (`Venta #N` h1 + Badge estado + `fecha · hora · vendedor` caption), cliente (si hay: nombre completo + teléfono), items (`desc`, `talla · color` caption, `cant × $precio` → subtotal tabular), pago (Total display + desglose por método + efectivo recibido y cambio si efectivo>0 + saldo pendiente si >0), nota (itálica) si hay, corrección (motivo) si `corregida`.
- CTA `Boton` secundario-peligro "↩ Hacer devolución" → `router.push('/devoluciones/nueva?numero=N')`; visible solo si estado ∈ {completada, devuelta_parcial, cambiada_parcial}.
- Carga con `obtenerVentaDetalle` en focus; no encontrado → EstadoVacio + volver.
- [ ] Test `lib/venta_detalle_ui.test.tsx`: render completo con mock (cliente, items con talla/color, cambio, nota), badge CANCELADA sin CTA devolución, CTA navega con el numero.
- [ ] FAIL → implementar → PASS → commit `feat(ui): detalle de venta con secciones y acceso a devolución`.

### Task 5: Detalle de devolución `app/(app)/devoluciones/[id].tsx` (TDD)

- Encabezado (`Devolución` h1 + Badge tipo + fecha/hora), venta original (`FilaLista "Venta #N"` chevron → `/ventas/{venta_id}`... el listado ya trae numero; detalle trae venta_id), motivo (itálica), montos (devuelto con método / cobrado con método), items devueltos (desc + talla·color + cantidad).
- [ ] Test `lib/devolucion_detalle_ui.test.tsx`: render con mock de tipo cambio (cobrado>0) y navegación a la venta original.
- [ ] FAIL → implementar → PASS → commit `feat(ui): detalle de devolución`.

### Task 6: Verificación + cierre
- [ ] tsc + suite completa → finishing-a-development-branch.

## Self-Review
1. **Cobertura §7.3:** hub toggle 3 ✓, filtros compartidos ✓ (Rango ▾ sigue ⏳ global), resumen contextual ✓, detalle venta completo ✓ (7 secciones), crear devolución desde detalle ✓ (flujo existente), historial devoluciones ✓ (gap cerrado sin RPC: select directo), detalle devolución ✓, gastos ✓. Mini-gráfico de la semana en vista Ventas: omitido (el dashboard ya lo tiene; anotado como polish).
2. **Placeholders:** shapes de columnas verificadas contra database.types.ts (ventas/devoluciones/venta_items/devolucion_items).
3. **Tipos:** los de Task 2 se consumen tal cual en Tasks 3-5.
