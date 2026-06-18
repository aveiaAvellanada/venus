# Reportes y Dashboard (M12 v1 — Dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir M12 v1 (Dashboard del día, módulo `reportes`, Andrés + Sandra): ventas de hoy + comparación con ayer + stock bajo (ambos roles), y proveedores por vencer + empleados sin actividad hoy (solo dueño).

**Architecture:** Reutiliza el RPC existente `obtener_resumen_dia` para ventas; consulta directa a `productos_calzado` para stock bajo; un RPC nuevo `SECURITY DEFINER` dueño-only `obtener_dashboard_dueno` para los widgets financieros/gestión. Encima, `lib/reportes.ts` (lógica pura de comparación + acceso a datos) y UI `app/(app)/reportes/` de una pantalla. Solo lectura.

**Tech Stack:** Supabase (PostgreSQL 17, RPC plpgsql), React Native + Expo SDK 54, TypeScript estricto, jest.

**Spec:** `docs/superpowers/specs/2026-06-17-reportes-dashboard-design.md`
**Rama:** `feat/m12-reportes` (creada; spec commiteado). **No mergear a `main` sin aprobación humana.**

## Global Constraints

- TypeScript estricto: `npx tsc --noEmit` debe quedar en **0 errores**.
- Todo en español en la UI; COP formateado (`'$' + n.toLocaleString('es-CO')`).
- RLS/RPC es la frontera de seguridad real: los datos solo-dueño (proveedores por vencer, empleados sin actividad) se gatean con `private.is_owner()` en el RPC, no solo en la UI.
- "Hoy"/"ayer" en zona `America/Bogota`: `(now() at time zone 'America/Bogota')::date`.
- Migraciones: archivo `supabase/migrations/<YYYYMMDDHHMMSS>_<nombre>.sql`; aplicar con MCP `apply_migration`; tras aplicar, **renombrar el archivo local a la versión asignada** (lección M2/M8/M11) y regenerar `lib/database.types.ts`.
- El smoke SQL corre contra la **BD real** dentro de la TX → usar datos/nombres únicos y aserciones por **pertenencia** (no por conteo exacto), porque puede haber datos reales que coincidan con los filtros (lección M11).
- Un commit por tarea; mensajes terminan con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/<ts>_m12_dashboard.sql` (nuevo) | RPC `obtener_dashboard_dueno` (no crea tablas) |
| `supabase/tests/smoke_test_dashboard.sql` (gitignored) | Smoke en transacción con rollback |
| `lib/database.types.ts` (regenerar vía MCP) | Tipos generados |
| `lib/permisos.ts` (modificar) | `ruta: '/reportes'` en módulo `reportes` |
| `lib/reportes.ts` (nuevo) | Lógica pura (`compararConAyer`) + acceso a datos |
| `lib/reportes.test.ts` (nuevo) | Tests jest de la lógica pura |
| `app/(app)/reportes/_layout.tsx` (nuevo) | Stack + gate `useRequireModulo('reportes')` |
| `app/(app)/reportes/index.tsx` (nuevo) | Pantalla del dashboard |
| `lib/reportes_ui.test.tsx` (nuevo) | Tests jest de la UI |

---

## Task 1: Escribir la migración (RPC obtener_dashboard_dueno)

**Files:**
- Create: `supabase/migrations/<ts>_m12_dashboard.sql` (`<ts>` con `date +%Y%m%d%H%M%S`)

**Interfaces:**
- Produces: `public.obtener_dashboard_dueno(p_dias_alerta int) returns json` (dueño-only).

- [ ] **Step 1: Confirmar columnas (MCP execute_sql)** — verificar que existen, ajustar si difiere:
```sql
select table_name, column_name from information_schema.columns
where table_schema='public' and table_name in ('compras','proveedores','empleado_config','users','ventas','cierres_caja','empleado_dias_trabajados')
  and column_name in ('proveedor_id','condicion_pago','estado','saldo_pendiente','fecha_vencimiento','nombre','empleado_id','activo','created_by','cerrado_por','fecha','tipo','id','created_at')
order by table_name, column_name;
```
Esperado: compras(proveedor_id,condicion_pago,estado,saldo_pendiente,fecha_vencimiento); proveedores(nombre); empleado_config(empleado_id,activo); users(id,nombre); ventas(created_by,created_at); cierres_caja(created_by,cerrado_por,fecha); empleado_dias_trabajados(empleado_id,fecha,tipo).

- [ ] **Step 2: Escribir la migración**, contenido exacto:

```sql
-- M12 Dashboard: RPC de widgets solo-dueño (proveedores por vencer + empleados sin actividad hoy).
-- Solo dueño, solo lectura. No crea tablas.

create or replace function public.obtener_dashboard_dueno(p_dias_alerta int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_prov json;
  v_emp json;
begin
  if not private.is_owner() then
    raise exception 'Solo el dueño puede ver el dashboard financiero';
  end if;

  -- Proveedores con pago por vencer (compras a crédito con saldo, dentro de ventana o vencidas)
  select coalesce(json_agg(t order by t.fecha_vencimiento), '[]'::json) into v_prov
  from (
    select p.nombre as proveedor,
           c.fecha_vencimiento,
           c.saldo_pendiente as saldo,
           (c.fecha_vencimiento < v_hoy) as vencida
    from public.compras c
    join public.proveedores p on p.id = c.proveedor_id
    where c.condicion_pago = 'credito'
      and c.estado = 'completada'
      and c.saldo_pendiente > 0
      and c.fecha_vencimiento is not null
      and c.fecha_vencimiento <= (v_hoy + p_dias_alerta)
  ) t;

  -- Empleados activos sin ninguna actividad hoy (venta, cierre, o día trabajado manual)
  select coalesce(
           json_agg(json_build_object('id', u.id, 'nombre', u.nombre) order by u.nombre),
           '[]'::json) into v_emp
  from public.empleado_config ec
  join public.users u on u.id = ec.empleado_id
  where ec.activo = true
    and not exists (
      select 1 from public.ventas v
      where v.created_by = ec.empleado_id
        and (v.created_at at time zone 'America/Bogota')::date = v_hoy)
    and not exists (
      select 1 from public.cierres_caja cc
      where (cc.created_by = ec.empleado_id or cc.cerrado_por = ec.empleado_id)
        and cc.fecha = v_hoy)
    and not exists (
      select 1 from public.empleado_dias_trabajados d
      where d.empleado_id = ec.empleado_id
        and d.fecha = v_hoy
        and d.tipo = 'trabajado');

  return json_build_object(
    'proveedores_por_vencer', v_prov,
    'empleados_sin_actividad', v_emp
  );
end;
$$;

revoke all on function public.obtener_dashboard_dueno(int) from public;
grant execute on function public.obtener_dashboard_dueno(int) to authenticated;
```

- [ ] **Step 3: Commit** (solo la migración)
```bash
git add supabase/migrations/*_m12_dashboard.sql
git commit -m "feat(m12): migración — RPC obtener_dashboard_dueno (proveedores por vencer + empleados sin actividad, dueño-only)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Smoke test SQL y correrlo vía MCP

**Files:** Create `supabase/tests/smoke_test_dashboard.sql` (gitignored)

**Interfaces:**
- Consumes: `public.obtener_dashboard_dueno(int)` (embebido al inicio de la TX, aún no aplicado).

- [ ] **Step 1: Escribir el smoke** — `begin; ... rollback;`. Embeber el RPC `obtener_dashboard_dueno` al inicio (igual patrón que `smoke_test_balance.sql`). Helper `_smoke_assert`, tabla `public._smoke_log`, centinela `DASHBOARD_OK_ROLLBACK`. **Aserciones por pertenencia** (no por conteo), porque la BD real puede tener datos que coincidan. Escenarios:
  1. **Setup:** dueño + 2 empleados (auth.users antes de public.users). `empleado_config(activo=true)` para ambos. Proveedor único `'Smoke Prov M12'`.
  2. **Empleado activo:** bajo claim del empleado A, una venta HOY (`created_at = now()`). El empleado B no registra nada.
  3. **Proveedores:** 2 compras a crédito del proveedor smoke con `estado='completada'`, `saldo_pendiente>0`: una **vencida** (`fecha_vencimiento = hoy - 5`) y una **fuera de ventana** (`fecha_vencimiento = hoy + 30`).
  4. Bajo claim del **dueño**, `obtener_dashboard_dueno(7)`:
     - `proveedores_por_vencer` **contiene** una fila con `proveedor='Smoke Prov M12'`, `vencida=true`; y **NO contiene** la de `hoy+30` (verificar que ninguna fila del proveedor smoke tenga `vencida=false` con esa fecha — la +30 queda fuera de la ventana de 7).
     - `empleados_sin_actividad` **contiene** al empleado B (sin actividad) y **NO contiene** al empleado A (con venta hoy). Verificar por `id`.
  5. **Gate:** bajo claim del empleado A, `obtener_dashboard_dueno(7)` ⇒ excepción `'Solo el dueño...'`.
  Termina con `INSERT INTO public._smoke_log VALUES ('SENTINEL','DASHBOARD_OK_ROLLBACK')`.

  > AVISO: `empleado_config.empleado_id` y `empleado_pagos`/`users` ya existen (M8). Inserta `compras` con `condicion_pago='credito'`, `estado='completada'`, `saldo_pendiente>0` (el trigger `private.compra_pagos_validate` NO aplica a `compras`, solo a `compra_pagos`; aquí no insertamos pagos). La venta se siembra bajo el claim del empleado A para que el trigger fije `created_by` (inviolable).

- [ ] **Step 2: Correr vía MCP** `execute_sql` con el contenido completo. Esperado: fila `SENTINEL = DASHBOARD_OK_ROLLBACK` y todos los pasos `OK`. Si un assert falla, corregir migración (Task 1) o smoke. No avanzar a Task 3 hasta verde.

---

## Task 3: Aplicar al remoto, regenerar tipos, añadir ruta, commit

- [ ] **Step 1:** `apply_migration` (name `m12_dashboard`, cuerpo de la migración). Verificar:
```sql
select count(*) as fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='obtener_dashboard_dueno';
```
Esperado `fn = 1`. Anotar la versión asignada; **renombrar el archivo local a esa versión**.
- [ ] **Step 2:** `generate_typescript_types` → sobrescribir `lib/database.types.ts` (no editar a mano). Confirmar que aparece `obtener_dashboard_dueno`.
- [ ] **Step 3:** En `lib/permisos.ts`, añadir `ruta: '/reportes'` al módulo `reportes`:
```ts
  { id: 'reportes',           titulo: 'Reportes',           icono: '📊', roles: STAFF_ADMIN, ruta: '/reportes' },
```
- [ ] **Step 4:** `npx tsc --noEmit` → 0 errores.
- [ ] **Step 5: Commit**
```bash
git add lib/database.types.ts lib/permisos.ts supabase/migrations/
git commit -m "feat(m12): aplicar RPC obtener_dashboard_dueno al remoto + regenerar tipos; ruta /reportes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `lib/reportes.ts` — lógica pura (TDD)

**Files:** Create `lib/reportes.ts`, `lib/reportes.test.ts`

**Interfaces:**
- Produces: `compararConAyer(hoy: number, ayer: number): { pct: number; direccion: 'sube' | 'baja' | 'igual'; sinBase: boolean }`.

- [ ] **Step 1: Tests que fallan** — `lib/reportes.test.ts`:
```ts
jest.mock('./supabase', () => ({ supabase: {} }))

import { compararConAyer } from './reportes'

describe('compararConAyer', () => {
  it('sube: +50% cuando hoy=150k vs ayer=100k', () => {
    expect(compararConAyer(150000, 100000)).toEqual({ pct: 50, direccion: 'sube', sinBase: false })
  })
  it('baja: -20% cuando hoy=80k vs ayer=100k', () => {
    expect(compararConAyer(80000, 100000)).toEqual({ pct: 20, direccion: 'baja', sinBase: false })
  })
  it('igual cuando hoy=ayer', () => {
    expect(compararConAyer(100000, 100000)).toEqual({ pct: 0, direccion: 'igual', sinBase: false })
  })
  it('ayer=0 con ventas hoy → sube 100% sin base', () => {
    expect(compararConAyer(50000, 0)).toEqual({ pct: 100, direccion: 'sube', sinBase: true })
  })
  it('ambos 0 → igual sin base', () => {
    expect(compararConAyer(0, 0)).toEqual({ pct: 0, direccion: 'igual', sinBase: true })
  })
  it('redondea el porcentaje a entero', () => {
    expect(compararConAyer(133000, 100000)).toEqual({ pct: 33, direccion: 'sube', sinBase: false })
  })
})
```

- [ ] **Step 2: Run** `npx jest lib/reportes.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar** `lib/reportes.ts` (solo la pura por ahora):
```ts
export function compararConAyer(
  hoy: number,
  ayer: number
): { pct: number; direccion: 'sube' | 'baja' | 'igual'; sinBase: boolean } {
  if (ayer === 0) {
    if (hoy > 0) return { pct: 100, direccion: 'sube', sinBase: true }
    return { pct: 0, direccion: 'igual', sinBase: true }
  }
  const cambio = ((hoy - ayer) / ayer) * 100
  const pct = Math.round(Math.abs(cambio))
  if (cambio > 0) return { pct, direccion: 'sube', sinBase: false }
  if (cambio < 0) return { pct, direccion: 'baja', sinBase: false }
  return { pct: 0, direccion: 'igual', sinBase: false }
}
```

- [ ] **Step 4: Run** `npx jest lib/reportes.test.ts` → PASS (6 verdes). **Step 5: Commit**
```bash
git add lib/reportes.ts lib/reportes.test.ts
git commit -m "feat(m12): lógica pura de reportes (compararConAyer) + tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `lib/reportes.ts` — acceso a datos

**Files:** Modify `lib/reportes.ts`

**Interfaces:**
- Consumes: RPC `obtener_resumen_dia(p_fecha)`, RPC `obtener_dashboard_dueno(p_dias_alerta)`, tabla `productos_calzado`.
- Produces: `obtenerResumenDia(fecha)`, `listarStockBajo()`, `obtenerDashboardDueno(diasAlerta?)` y los tipos `ResumenDia`, `ProductoStockBajo`, `DashboardDueno`.

- [ ] **Step 1:** Leer `lib/caja.ts` (patrón `supabase.rpc`) y la firma generada de los RPC. Añadir al inicio de `lib/reportes.ts`:
```ts
import { supabase } from './supabase'

export type ResumenDia = {
  total_ventas: number
  total_general: number
  total_efectivo: number
  total_nequi: number
  total_daviplata: number
}

export type ProductoStockBajo = {
  id: string
  descripcion: string
  talla: string | null
  stock_actual: number
  stock_minimo: number
}

export type ProveedorPorVencer = {
  proveedor: string
  fecha_vencimiento: string
  saldo: number
  vencida: boolean
}
export type EmpleadoSinActividad = { id: string; nombre: string }
export type DashboardDueno = {
  proveedores_por_vencer: ProveedorPorVencer[]
  empleados_sin_actividad: EmpleadoSinActividad[]
}

export async function obtenerResumenDia(fecha: string): Promise<ResumenDia> {
  const { data, error } = await supabase.rpc('obtener_resumen_dia', { p_fecha: fecha })
  if (error) throw error
  return data as unknown as ResumenDia
}

// Inventario pequeño: traemos los activos y filtramos stock_actual <= stock_minimo en cliente
// (PostgREST no compara dos columnas entre sí).
export async function listarStockBajo(): Promise<ProductoStockBajo[]> {
  const { data, error } = await supabase
    .from('productos_calzado')
    .select('id, descripcion, talla, stock_actual, stock_minimo')
    .eq('activo', true)
  if (error) throw error
  return (data ?? []).filter((p) => p.stock_actual <= p.stock_minimo)
}

export async function obtenerDashboardDueno(diasAlerta = 7): Promise<DashboardDueno> {
  const { data, error } = await supabase.rpc('obtener_dashboard_dueno', { p_dias_alerta: diasAlerta })
  if (error) throw error
  return data as unknown as DashboardDueno
}
```
> Si el RPC retorna `Json`, castear con `as unknown as <Tipo>` (es el contrato del RPC) — no `as any`.

- [ ] **Step 2:** `npx tsc --noEmit` → 0; `npx jest lib/reportes.test.ts` → 6 verdes (el mock de supabase ya está). **Step 3: Commit**
```bash
git add lib/reportes.ts
git commit -m "feat(m12): acceso a datos de reportes (resumen día, stock bajo, dashboard dueño)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: UI — layout e índice del dashboard

**Files:** Create `app/(app)/reportes/_layout.tsx`, `app/(app)/reportes/index.tsx`

**Interfaces:**
- Consumes: `obtenerResumenDia`, `listarStockBajo`, `obtenerDashboardDueno`, `compararConAyer` de `lib/reportes`; `useRequireModulo` y `useAuth` de `lib/auth`.

- [ ] **Step 1: `_layout.tsx`** (patrón exacto de `app/(app)/balance/_layout.tsx`, cambiando módulo y título):
```tsx
import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function ReportesLayout() {
  const requireModulo = useRequireModulo('reportes')
  if (requireModulo) return requireModulo
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerShadowVisible: false,
        headerTintColor: '#111827',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#f9fafb' },
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Reportes' }} />
    </Stack>
  )
}
```

- [ ] **Step 2: `index.tsx`** (patrón de `app/(app)/balance/index.tsx`):
  - Imports: `useState/useCallback`, RN (`View,Text,ScrollView,TouchableOpacity,ActivityIndicator,StyleSheet,RefreshControl,SafeAreaView`), `useFocusEffect` de `expo-router`, `Ionicons`, `useRequireModulo` y `useAuth` de `../../../lib/auth`, y de `../../../lib/reportes`: `obtenerResumenDia, listarStockBajo, obtenerDashboardDueno, compararConAyer` + tipos.
  - Helper `pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')`.
  - Estado: `resumenHoy`, `resumenAyer`, `stockBajo`, `dashDueno` (o null), `loading`, `refreshing`, `error`.
  - `const requireModulo = useRequireModulo('reportes')`; `const { perfil } = useAuth()`; `const esDueno = perfil?.rol === 'dueno'`.
  - `cargarDatos`: calcula `hoy` y `ayer` ISO (`YYYY-MM-DD`, `America/Bogota` vía `new Date()` local — el dispositivo está en Colombia; usar `toISOString().slice(0,10)` sobre fechas locales construidas con `getFullYear/getMonth/getDate`, igual que `lib/balance.ts toISO`). Llama `obtenerResumenDia(hoy)`, `obtenerResumenDia(ayer)`, `listarStockBajo()` en paralelo (`Promise.all`); **solo si `esDueno`** además `obtenerDashboardDueno(7)` (si no, `dashDueno=null`).
  - `useFocusEffect(useCallback(() => { if (!requireModulo) cargarDatos() }, [cargarDatos, requireModulo]))` (lección M8).
  - `if (requireModulo) return requireModulo`.
  - Render (ScrollView con RefreshControl):
    - **Ventas de hoy** (tarjeta): `pesos(resumenHoy.total_general)`, `resumenHoy.total_ventas` ventas, desglose efectivo/Nequi/Daviplata. Comparación: `const cmp = compararConAyer(resumenHoy.total_general, resumenAyer.total_general)`; si `cmp.sinBase` mostrar "—" (sin comparación); si no, flecha ↑ (verde, `cmp.direccion==='sube'`) / ↓ (rojo, `'baja'`) / "=" y `cmp.pct + '%'`.
    - **Stock bajo** (sección, ambos): lista `stockBajo` (`descripcion` + `talla` + "quedan X"); si vacía, "Todo en orden con el stock.".
    - **Solo si `esDueno && dashDueno`:**
      - **Proveedores por vencer:** lista `dashDueno.proveedores_por_vencer` (proveedor, `fecha_vencimiento`, `pesos(saldo)`); las `vencida` en rojo con etiqueta "Vencida". Si vacía, "Sin pagos próximos a vencer.".
      - **Empleados sin actividad hoy:** lista de `nombre`. Si vacía, "Todos registraron actividad hoy.".
    - Carga: `ActivityIndicator`; error: mensaje + botón "Reintentar"; todo en español. Estilos consistentes con `balance/index.tsx`.

- [ ] **Step 3:** `npx tsc --noEmit` → 0; `npm test` → todas verdes. **Step 4: Commit**
```bash
git add "app/(app)/reportes/_layout.tsx" "app/(app)/reportes/index.tsx"
git commit -m "feat(m12): UI dashboard — ventas del día + comparación, stock bajo, widgets de dueño

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Tests de UI

**Files:** Create `lib/reportes_ui.test.tsx` (patrón de `lib/balance_ui.test.tsx`)

**Interfaces:**
- Consumes: `ReportesLayout`, `ReportesIndex`; mocks de `lib/auth`, `lib/reportes`, `expo-router`.

- [ ] **Step 1:** Copiar el andamiaje de mocks de `lib/balance_ui.test.tsx` (AsyncStorage, supabase relativo+absoluto, `@expo/vector-icons`, `expo-router` con `useFocusEffect`). Mockear `lib/auth`: `useRequireModulo` → null por defecto, y `useAuth` → `{ perfil: { rol: 'dueno', nombre: 'Andrés' } }` (configurable por test). Mockear `lib/reportes` conservando la pura (`compararConAyer` real) y mockeando `obtenerResumenDia`, `listarStockBajo`, `obtenerDashboardDueno`. Importar pantallas DESPUÉS de los mocks. Cubrir:
  1. **Gating del módulo:** `ReportesLayout` invoca `useRequireModulo('reportes')`; cuando devuelve elemento, `ReportesIndex` no renderiza el contenido ni llama a las funciones de datos.
  2. **Sandra (admin) NO ve widgets de dueño:** con `useAuth` → `{ perfil: { rol: 'admin', nombre: 'Sandra' } }`, `obtenerDashboardDueno` **no se invoca** y no aparecen las secciones "Proveedores por vencer" / "Empleados sin actividad hoy"; sí aparecen ventas y stock bajo.
  3. **Dueño SÍ ve widgets de dueño:** con rol `'dueno'`, `obtenerDashboardDueno` se invoca y se renderizan las secciones con los datos mockeados.
  4. **Comparación con ayer:** con `obtenerResumenDia` mockeado a `total_general` hoy>ayer, se muestra la flecha de "sube" y el porcentaje (verifica el texto/porcentaje real vía `compararConAyer`).
  5. **Totales:** se renderizan total vendido, nº de ventas y el desglose por método del mock.

- [ ] **Step 2:** `npx jest lib/reportes_ui.test.tsx` → verde; `npm test` → todas verdes; `npx tsc --noEmit` → 0. **Step 3: Commit**
```bash
git add lib/reportes_ui.test.tsx
git commit -m "test(m12): tests de UI del dashboard (gating, Sandra sin widgets de dueño, comparación, totales)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Verificación de regresión
- [ ] `npx tsc --noEmit && npm test` → tsc 0, todas verdes.
- [ ] Re-correr `smoke_test_dashboard.sql` vía MCP → `DASHBOARD_OK_ROLLBACK`.
- [ ] Read-only vía MCP (bajo claim del dueño real): `select public.obtener_dashboard_dueno(7);` ejecuta sin error y devuelve el JSON con las dos listas.

## Task 9: Code review y cierre
- [ ] **Code review** (superpowers:requesting-code-review) sobre `main..feat/m12-reportes`. Foco: gate `is_owner` en el RPC (Sandra/operativos no ven proveedores/empleados ni por RPC ni por UI), corrección de la ventana de vencimiento y de la bandera `vencida`, definición de "actividad de empleado" (venta/cierre/día), y `compararConAyer` (ayer=0).
- [ ] Actualizar `openspec/changes/tasks.json` (M12 v1 construido) y la memoria `sp9-balance-reportes-state.md`.
- [ ] **Presentar al humano para decisión de merge** (superpowers:finishing-a-development-branch). **No auto-mergear.**

---

## Self-Review (writing-plans)
- **Cobertura del spec:** §2.1 contenido por rol → RPC dueño (Task 1) + UI por rol (Task 6); §2.2 atribución `America/Bogota` → RPC + UI fechas; §2.3 permisos → gate `is_owner` (Task 1) + `useRequireModulo`/`esDueno` (Task 6); §3 RPC → Tasks 1-3; §4 lib (compararConAyer + acceso) → Tasks 4-5; §5 UI → Task 6 (+ ruta Task 3); §6 pruebas → Tasks 2,4,7,8. Sin huecos.
- **Sin placeholders:** RPC, lógica pura y acceso a datos con código completo; UI con estructura concreta + patrón de pantallas existentes (`balance/`).
- **Consistencia de tipos:** firma `obtener_dashboard_dueno(int)` idéntica en migración, grant, smoke y `obtenerDashboardDueno`; tipos `ResumenDia`/`ProductoStockBajo`/`DashboardDueno` espejan los contratos; `compararConAyer` con la misma firma en Task 4 (def) y Task 6 (uso); `reportes` es el id real del módulo.
- **Orden serial:** RPC (1-3) → lib (4-5) → UI (6-7) → verificación (8) → review/cierre (9). DB serial y primero (AGENTS.md §5.1).
