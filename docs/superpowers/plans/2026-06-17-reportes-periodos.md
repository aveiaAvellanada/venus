# Reportes de Período (M12 it.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la segunda pantalla de `/reportes` (módulo `reportes`, Andrés + Sandra): un reporte de período (semana/mes) navegable con total + comparación con el período anterior, desglose por método, día top, top 10 productos por unidades, y calzado sin movimiento.

**Architecture:** Un RPC `SECURITY DEFINER` gateado a staff_admin `obtener_reporte_periodo(p_desde, p_hasta)` que agrega todo (incluido el total del período anterior) en un JSON. Encima, acceso a datos en `lib/reportes.ts` (reutiliza `rangoPeriodo` de `lib/balance.ts` y `compararConAyer` ya existente) y una pantalla nueva `app/(app)/reportes/periodos.tsx`. Solo lectura.

**Tech Stack:** Supabase (PostgreSQL 17, RPC plpgsql), React Native + Expo SDK 54, TypeScript estricto, jest.

**Spec:** `docs/superpowers/specs/2026-06-17-reportes-periodos-design.md`
**Rama:** `feat/m12-reportes-periodos` (creada; spec commiteado). **No mergear a `main` sin aprobación humana.**

## Global Constraints

- TypeScript estricto: `npx tsc --noEmit` → **0 errores**.
- Todo en español en la UI; COP formateado (`'$' + Math.round(n).toLocaleString('es-CO')`).
- Estados de venta contados: `('completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total')`.
- "Hoy"/fechas en `America/Bogota`: `(v.created_at at time zone 'America/Bogota')::date`.
- **Dinero neto** de devoluciones por fecha de venta; **unidades brutas** en top de productos.
- Gate del RPC: `private.is_staff_admin()` (Andrés + Sandra; operativos no).
- Reutilizar `rangoPeriodo` (`lib/balance.ts`) y `compararConAyer` (`lib/reportes.ts`) — NO duplicar.
- Migraciones: aplicar con MCP `apply_migration`; tras aplicar, **renombrar el archivo local a la versión asignada** y regenerar `lib/database.types.ts`.
- El smoke SQL corre contra la **BD real** dentro de la TX → fechas en un año aislado (p. ej. 2051) y/o aserciones por pertenencia (lección M11).
- Un commit por tarea; mensajes terminan con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/<ts>_m12it2_reporte_periodo.sql` (nuevo) | RPC `obtener_reporte_periodo` |
| `supabase/tests/smoke_test_reporte_periodo.sql` (gitignored) | Smoke en transacción con rollback |
| `lib/database.types.ts` (regenerar vía MCP) | Tipos generados |
| `lib/reportes.ts` (modificar) | Acceso a datos `obtenerReportePeriodo` + tipos |
| `app/(app)/reportes/_layout.tsx` (modificar) | Añadir `<Stack.Screen name="periodos">` |
| `app/(app)/reportes/index.tsx` (modificar) | Botón al reporte de período |
| `app/(app)/reportes/periodos.tsx` (nuevo) | Pantalla del reporte de período |
| `lib/reportes_ui.test.tsx` (modificar) | Tests de UI del reporte de período |

---

## Task 1: Escribir la migración (RPC obtener_reporte_periodo)

**Files:** Create `supabase/migrations/<ts>_m12it2_reporte_periodo.sql` (`<ts>` con `date +%Y%m%d%H%M%S`)

**Interfaces:**
- Produces: `public.obtener_reporte_periodo(p_desde date, p_hasta date) returns json` (staff_admin).

- [ ] **Step 1: Confirmar columnas (MCP execute_sql)** — verificar, ajustar si difiere:
```sql
select table_name, column_name from information_schema.columns
where table_schema='public' and table_name in ('venta_items','metodos_pago_venta','ventas','devoluciones','productos_calzado')
  and column_name in ('venta_id','metodo','monto','estado','created_at','monto_devuelto','monto_cobrado','metodo_reembolso','metodo_cobro','producto_calzado_id','descripcion_snapshot','cantidad','subtotal','id','descripcion','talla','activo')
order by table_name, column_name;
```
Esperado: venta_items(venta_id,producto_calzado_id,descripcion_snapshot,cantidad,subtotal); metodos_pago_venta(venta_id,metodo,monto); ventas(estado,created_at); devoluciones(venta_id,monto_devuelto,monto_cobrado,metodo_reembolso,metodo_cobro); productos_calzado(id,descripcion,talla,activo).

- [ ] **Step 2: Escribir la migración**, contenido exacto:

```sql
-- M12 it.2: RPC de reporte de período (semana/mes), staff_admin, solo lectura. No crea tablas.

create or replace function public.obtener_reporte_periodo(p_desde date, p_hasta date)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
  v_largo int := (p_hasta - p_desde) + 1;
  v_prev_desde date := p_desde - v_largo;
  v_prev_hasta date := p_desde - 1;
  v_ef numeric := 0; v_ne numeric := 0; v_da numeric := 0;
  v_num int := 0;
  v_total numeric; v_total_ant numeric;
  v_dia_top json; v_top json; v_sinmov json;
begin
  if not private.is_staff_admin() then
    raise exception 'No autorizado para ver reportes';
  end if;

  -- Pagos brutos del período, por método
  select
    coalesce(sum(case when m.metodo='efectivo' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='nequi' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='daviplata' then m.monto else 0 end),0)
  into v_ef, v_ne, v_da
  from public.metodos_pago_venta m
  join public.ventas v on v.id = m.venta_id
  where v.estado = any(v_estados)
    and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  -- Netear devoluciones por método (por fecha de la venta)
  select
    v_ef - coalesce(sum(case when metodo_reembolso='efectivo'  then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='efectivo'      then monto_cobrado  else 0 end),0),
    v_ne - coalesce(sum(case when metodo_reembolso='nequi'     then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='nequi'         then monto_cobrado  else 0 end),0),
    v_da - coalesce(sum(case when metodo_reembolso='daviplata' then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='daviplata'     then monto_cobrado  else 0 end),0)
  into v_ef, v_ne, v_da
  from public.devoluciones d
  join public.ventas v on v.id = d.venta_id
  where (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  v_total := v_ef + v_ne + v_da;

  -- Nº de ventas del período
  select count(*) into v_num
  from public.ventas v
  where v.estado = any(v_estados)
    and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  -- Total neto del período anterior (mismo largo) para comparación
  with pagos as (
    select coalesce(sum(m.monto),0) as g
    from public.metodos_pago_venta m
    join public.ventas v on v.id = m.venta_id
    where v.estado = any(v_estados)
      and (v.created_at at time zone 'America/Bogota')::date between v_prev_desde and v_prev_hasta
  ), devs as (
    select coalesce(sum(d.monto_devuelto),0) as r, coalesce(sum(d.monto_cobrado),0) as c
    from public.devoluciones d
    join public.ventas v on v.id = d.venta_id
    where (v.created_at at time zone 'America/Bogota')::date between v_prev_desde and v_prev_hasta
  )
  select (pagos.g - devs.r + devs.c) into v_total_ant from pagos, devs;

  -- Día con más ventas (neto) del período
  with dia_pagos as (
    select (v.created_at at time zone 'America/Bogota')::date as d, sum(m.monto) as g
    from public.metodos_pago_venta m
    join public.ventas v on v.id = m.venta_id
    where v.estado = any(v_estados)
      and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by 1
  ), dia_devs as (
    select (v.created_at at time zone 'America/Bogota')::date as d,
           sum(d2.monto_devuelto) as r, sum(d2.monto_cobrado) as c
    from public.devoluciones d2
    join public.ventas v on v.id = d2.venta_id
    where (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by 1
  )
  select json_build_object('fecha', x.d, 'monto', x.neto) into v_dia_top
  from (
    select p.d, (p.g - coalesce(dd.r,0) + coalesce(dd.c,0)) as neto
    from dia_pagos p
    left join dia_devs dd on dd.d = p.d
    order by neto desc, p.d desc
    limit 1
  ) x;

  -- Top 10 productos por unidades brutas
  select coalesce(json_agg(t order by t.unidades desc), '[]'::json) into v_top
  from (
    select vi.descripcion_snapshot as producto,
           sum(vi.cantidad) as unidades,
           sum(vi.subtotal) as monto
    from public.venta_items vi
    join public.ventas v on v.id = vi.venta_id
    where v.estado = any(v_estados)
      and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by vi.descripcion_snapshot
    order by unidades desc
    limit 10
  ) t;

  -- Calzado activo sin movimiento en el período
  select coalesce(
           json_agg(json_build_object(
             'id', pc.id,
             'producto', pc.descripcion || coalesce(' · talla ' || pc.talla, ''))
             order by pc.descripcion),
           '[]'::json) into v_sinmov
  from public.productos_calzado pc
  where pc.activo = true
    and not exists (
      select 1 from public.venta_items vi
      join public.ventas v on v.id = vi.venta_id
      where vi.producto_calzado_id = pc.id
        and v.estado = any(v_estados)
        and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    );

  return json_build_object(
    'total_vendido', v_total,
    'total_anterior', v_total_ant,
    'num_ventas', v_num,
    'efectivo', v_ef, 'nequi', v_ne, 'daviplata', v_da,
    'dia_top', v_dia_top,
    'top_productos', v_top,
    'sin_movimiento', v_sinmov
  );
end;
$$;

revoke all on function public.obtener_reporte_periodo(date, date) from public;
grant execute on function public.obtener_reporte_periodo(date, date) to authenticated;
```

- [ ] **Step 3: Commit** (solo la migración)
```bash
git add supabase/migrations/*_m12it2_reporte_periodo.sql
git commit -m "feat(m12-it2): migración — RPC obtener_reporte_periodo (staff_admin, solo lectura)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Smoke test SQL y correrlo vía MCP

**Files:** Create `supabase/tests/smoke_test_reporte_periodo.sql` (gitignored)

**Interfaces:**
- Consumes: `public.obtener_reporte_periodo(date,date)` (embebido al inicio de la TX).

- [ ] **Step 1: Escribir el smoke** — `begin; ... rollback;`, embeber el RPC, helper `_smoke_assert`, tabla `public._smoke_log`, centinela `REPORTE_OK_ROLLBACK`. **Fechas en año aislado 2051** (la BD es real). Escenarios:
  1. **Setup:** dueño + empleado + admin (auth.users antes de public.users). Producto calzado P1 (`descripcion='Bota Smoke'`, `talla='38'`, activo) y P2 (`descripcion='Tenis Smoke'`, `talla='40'`, activo) y P3 (`descripcion='Sandalia Smoke'`, activo, **sin ventas**). 
  2. **Período (mayo 2051):** bajo claim del empleado, ventas con `created_at` en mayo 2051:
     - Venta el 2051-05-10: 3× P1 @ 50000 (subtotal 150000), pago efectivo 150000.
     - Venta el 2051-05-20: 1× P2 @ 80000, pago nequi 80000.
  3. **Período anterior (abril 2051):** venta el 2051-04-15: 1× P1 @ 50000, efectivo 50000. (Para `total_anterior`.)
  4. Bajo claim del **dueño** (o admin), `obtener_reporte_periodo('2051-05-01','2051-05-31')`:
     - `total_vendido = 230000`; `efectivo = 150000`; `nequi = 80000`; `daviplata = 0`; `num_ventas = 2`.
     - `total_anterior = 50000` (abril).
     - `dia_top.fecha = '2051-05-10'`, `dia_top.monto = 150000`.
     - `top_productos[0].producto = 'Bota Smoke'`, `unidades = 3` (P1 primero por unidades); contiene `'Tenis Smoke'` con `unidades = 1`.
     - `sin_movimiento` **contiene** P3 (`'Sandalia Smoke'`) y **NO** contiene P1 ni P2 (aserción por pertenencia).
  5. **Gate:** bajo claim del **empleado** (operativo), `obtener_reporte_periodo(...)` ⇒ excepción `'No autorizado'`.
  Termina con `INSERT INTO public._smoke_log VALUES ('SENTINEL','REPORTE_OK_ROLLBACK')`.

  > AVISO: sembrar las ventas bajo el claim del empleado (trigger `created_by`). `metodos_pago_venta` requiere `metodo in ('efectivo','nequi','daviplata')` y `monto > 0`. `venta_items` requiere `tipo_producto`, `cantidad > 0`, `precio_unitario`, `subtotal`. Reutiliza el patrón de `smoke_test_dashboard.sql`.

- [ ] **Step 2: Correr vía MCP** `execute_sql` con el contenido completo. Esperado: `SENTINEL = REPORTE_OK_ROLLBACK` y pasos `OK`. Si falla un assert, corregir migración (Task 1) o smoke. No avanzar a Task 3 hasta verde.

---

## Task 3: Aplicar al remoto, regenerar tipos, commit

- [ ] **Step 1:** `apply_migration` (name `m12it2_reporte_periodo`, cuerpo de la migración). Verificar:
```sql
select count(*) as fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='obtener_reporte_periodo';
```
Esperado `fn = 1`. Anotar la versión asignada; **renombrar el archivo local a esa versión**.
- [ ] **Step 2:** `generate_typescript_types` → sobrescribir `lib/database.types.ts`. Confirmar que aparece `obtener_reporte_periodo`. (No hay cambios en `lib/permisos.ts`: `/reportes` ya tiene `ruta`; `periodos` es sub-screen del mismo Stack.)
- [ ] **Step 3:** `npx tsc --noEmit` → 0 errores.
- [ ] **Step 4: Commit**
```bash
git add lib/database.types.ts supabase/migrations/
git commit -m "feat(m12-it2): aplicar RPC obtener_reporte_periodo al remoto + regenerar tipos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `lib/reportes.ts` — acceso a datos

**Files:** Modify `lib/reportes.ts`

**Interfaces:**
- Consumes: RPC `obtener_reporte_periodo(p_desde,p_hasta)`.
- Produces: `obtenerReportePeriodo(desde, hasta)` y tipos `ReportePeriodo`, `TopProducto`, `ProductoSinMovimiento`, `DiaTop`.

- [ ] **Step 1:** Añadir a `lib/reportes.ts` (junto a las funciones existentes):
```ts
export type TopProducto = { producto: string; unidades: number; monto: number }
export type ProductoSinMovimiento = { id: string; producto: string }
export type DiaTop = { fecha: string; monto: number }
export type ReportePeriodo = {
  total_vendido: number
  total_anterior: number
  num_ventas: number
  efectivo: number
  nequi: number
  daviplata: number
  dia_top: DiaTop | null
  top_productos: TopProducto[]
  sin_movimiento: ProductoSinMovimiento[]
}

export async function obtenerReportePeriodo(desde: string, hasta: string): Promise<ReportePeriodo> {
  const { data, error } = await supabase.rpc('obtener_reporte_periodo', { p_desde: desde, p_hasta: hasta })
  if (error) throw error
  return data as unknown as ReportePeriodo
}
```

- [ ] **Step 2:** `npx tsc --noEmit` → 0; `npx jest lib/reportes.test.ts` → 6 verdes (sin cambios en la pura). **Step 3: Commit**
```bash
git add lib/reportes.ts
git commit -m "feat(m12-it2): acceso a datos del reporte de período (obtenerReportePeriodo)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: UI — pantalla del reporte de período

**Files:** Create `app/(app)/reportes/periodos.tsx`; Modify `app/(app)/reportes/_layout.tsx`, `app/(app)/reportes/index.tsx`

**Interfaces:**
- Consumes: `obtenerReportePeriodo`, tipos de `lib/reportes`; `rangoPeriodo` de `lib/balance`; `compararConAyer` de `lib/reportes`; `useRequireModulo` de `lib/auth`; `useRouter`/`useFocusEffect` de `expo-router`.

- [ ] **Step 1: `_layout.tsx`** — añadir la screen al Stack (después de la de `index`):
```tsx
      <Stack.Screen name="index" options={{ title: 'Reportes' }} />
      <Stack.Screen name="periodos" options={{ title: 'Reporte de período' }} />
```

- [ ] **Step 2: `index.tsx`** — añadir un botón que navegue al reporte de período. Importar `useRouter` de `expo-router` (`const router = useRouter()`), y dentro del `ScrollView` (al inicio, antes de la tarjeta "Ventas de hoy") un `TouchableOpacity`:
```tsx
          <TouchableOpacity
            testID="btn-ver-periodos"
            style={styles.linkPeriodos}
            onPress={() => router.push('/reportes/periodos')}
          >
            <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
            <Text style={styles.linkPeriodosText}>Ver reporte por semana / mes</Text>
            <Ionicons name="chevron-forward" size={16} color="#1d4ed8" />
          </TouchableOpacity>
```
Y añadir a `styles`:
```tsx
  linkPeriodos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 12, marginBottom: 12 },
  linkPeriodosText: { fontSize: 14, fontWeight: '600', color: '#1d4ed8' },
```

- [ ] **Step 3: `periodos.tsx`** — pantalla. Patrón base = `app/(app)/balance/index.tsx` (selector Semana/Mes + flechas con `rangoPeriodo`). Estructura concreta:
  - Imports: RN (`View,Text,ScrollView,TouchableOpacity,ActivityIndicator,StyleSheet,RefreshControl,SafeAreaView`), `useFocusEffect` de `expo-router`, `Ionicons`, `useRequireModulo` de `../../../lib/auth`, `rangoPeriodo` de `../../../lib/balance`, y de `../../../lib/reportes`: `obtenerReportePeriodo, compararConAyer, type ReportePeriodo`.
  - `const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')`.
  - Estado: `tipo` ('semana'|'mes', default 'mes'), `refDate` (`new Date()`), `data: ReportePeriodo | null`, `loading`, `refreshing`, `error`.
  - `cargarDatos`: `const { desde, hasta } = rangoPeriodo(tipo, refDate)`; `setData(await obtenerReportePeriodo(desde, hasta))`. Manejo de error en español.
  - `useFocusEffect(useCallback(() => { if (!requireModulo) cargarDatos() }, [cargarDatos, requireModulo]))`; `if (requireModulo) return requireModulo`.
  - Selector Semana/Mes (`testID` `btn-tipo-semana`/`btn-tipo-mes`) + flechas (`btn-nav-prev`/`btn-nav-next`) que mueven `refDate` (mes: `new Date(y, m+dir, 1)`; semana: `new Date(y, m, d + dir*7)`). Al cambiar tipo, resetear `refDate = new Date()`.
  - Render con `data`:
    - **Total:** `pesos(data.total_vendido)`; comparación `const cmp = compararConAyer(data.total_vendido, data.total_anterior)`; si `cmp.sinBase` → "— sin comparación"; si no, flecha ↑ verde (`sube`) / ↓ rojo (`baja`) + `cmp.pct + '%'`. Etiqueta "vs período anterior".
    - **Métricas:** `data.num_ventas` ventas; desglose efectivo/Nequi/Daviplata (`pesos`).
    - **Día con más ventas:** si `data.dia_top` → `data.dia_top.fecha` + `pesos(data.dia_top.monto)`; si null → "Sin ventas en el período".
    - **Top productos:** `data.top_productos.map` → `producto` + `unidades + ' u.'` (y `pesos(monto)` secundario); si vacío → "Sin ventas en el período".
    - **Sin movimiento:** `data.sin_movimiento.map` → `producto`; si vacío → "Todo el catálogo tuvo movimiento.".
    - Carga/error en español; estilos consistentes con `balance/index.tsx`.

- [ ] **Step 4:** `npx tsc --noEmit` → 0; `npm test` → todas verdes. **Step 5: Commit**
```bash
git add "app/(app)/reportes/periodos.tsx" "app/(app)/reportes/_layout.tsx" "app/(app)/reportes/index.tsx"
git commit -m "feat(m12-it2): UI reporte de período — total+comparación, métodos, día top, top productos, sin movimiento

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Tests de UI

**Files:** Modify `lib/reportes_ui.test.tsx`

**Interfaces:**
- Consumes: `ReportesPeriodos` (default export de `app/(app)/reportes/periodos`); mock de `obtenerReportePeriodo`.

- [ ] **Step 1:** En `lib/reportes_ui.test.tsx`, añadir al mock de `./reportes` y `../lib/reportes` la función `obtenerReportePeriodo: jest.fn()` (junto a las ya mockeadas). Importar la pantalla `import ReportesPeriodos from '../app/(app)/reportes/periodos'`. Añadir un `describe` nuevo con un fixture `REPORTE`:
```ts
const REPORTE = {
  total_vendido: 230000, total_anterior: 50000, num_ventas: 2,
  efectivo: 150000, nequi: 80000, daviplata: 0,
  dia_top: { fecha: '2051-05-10', monto: 150000 },
  top_productos: [
    { producto: 'Bota Smoke', unidades: 3, monto: 150000 },
    { producto: 'Tenis Smoke', unidades: 1, monto: 80000 },
  ],
  sin_movimiento: [{ id: 'p3', producto: 'Sandalia Smoke' }],
}
```
  Cubrir (en `beforeEach` del nuevo describe: `(apiReportes.obtenerReportePeriodo as jest.Mock).mockResolvedValue(REPORTE)`, `useRequireModulo`→null):
  1. **Gating:** `ReportesPeriodos` invoca `useRequireModulo('reportes')`; cuando devuelve elemento, no llama `obtenerReportePeriodo`.
  2. **Render:** se muestran total (`230.000`), top productos (`Bota Smoke`, `Tenis Smoke`), día top (`2051-05-10`) y sin movimiento (`Sandalia Smoke`).
  3. **Comparación:** con total 230000 vs 50000, se muestra la flecha "sube" y el porcentaje (`compararConAyer` real: `Math.round((230000-50000)/50000*100)=360`).
  4. **Cambio de período:** tocar `btn-tipo-semana` (o `btn-nav-prev`) vuelve a invocar `obtenerReportePeriodo`.

- [ ] **Step 2:** `npx jest lib/reportes_ui.test.tsx` → verde; `npm test` → todas verdes; `npx tsc --noEmit` → 0. **Step 3: Commit**
```bash
git add lib/reportes_ui.test.tsx
git commit -m "test(m12-it2): tests de UI del reporte de período (gating, render, comparación, cambio de período)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Verificación de regresión
- [ ] `npx tsc --noEmit && npm test` → tsc 0, todas verdes.
- [ ] Re-correr `smoke_test_reporte_periodo.sql` vía MCP → `REPORTE_OK_ROLLBACK`.
- [ ] Read-only vía MCP (bajo claim del dueño real): `select public.obtener_reporte_periodo('2026-06-01','2026-06-30');` ejecuta sin error y devuelve el JSON.

## Task 8: Code review y cierre
- [ ] **Code review** (superpowers:requesting-code-review) sobre `main..feat/m12-reportes-periodos`. Foco: gate `is_staff_admin`, neteo de devoluciones consistente con resumen_dia, cálculo del período anterior (`v_largo`/`v_prev_*`), orden y límite del top, `dia_top` null sin ventas, y reutilización correcta de `rangoPeriodo`/`compararConAyer`.
- [ ] Actualizar `openspec/changes/tasks.json` y la memoria `sp9-balance-reportes-state.md`.
- [ ] **Presentar al humano para decisión de merge** (superpowers:finishing-a-development-branch). **No auto-mergear.**

---

## Self-Review (writing-plans)
- **Cobertura del spec:** §2.1 contenido → RPC (Task 1) + UI (Task 5); §2.2 bases (neto/bruto, período anterior, día top, sin movimiento) → RPC (Task 1); §2.3 permisos → gate `is_staff_admin` (Task 1) + módulo `reportes` ya gateado; §3 RPC → Tasks 1-3; §4 lib (acceso + reutilización) → Task 4; §5 UI → Task 5; §6 pruebas → Tasks 2,6,7. Sin huecos.
- **Sin placeholders:** RPC y acceso a datos con código completo; UI con estructura concreta + patrón (`balance/index.tsx`) y `testID`s nombrados.
- **Consistencia de tipos:** firma `obtener_reporte_periodo(date,date)` idéntica en migración, grant, smoke y `obtenerReportePeriodo`; tipo `ReportePeriodo` espeja el JSON del RPC; `compararConAyer`/`rangoPeriodo` reutilizadas con sus firmas reales; `reportes` es el id real del módulo.
- **Orden serial:** RPC (1-3) → lib (4) → UI (5-6) → verificación (7) → review/cierre (8). DB serial y primero (AGENTS.md §5.1).
- **Reutilización:** ninguna lógica pura nueva (DRY): `rangoPeriodo` (lib/balance) y `compararConAyer` (lib/reportes) ya existen y se importan.
