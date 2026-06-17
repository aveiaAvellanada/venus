# Gestión de Empleados (M8) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir M8 (Gestión de Empleados, solo dueño): gestionar empleados existentes — sueldo, activar/desactivar (bloquea login), días trabajados del mes y pagos proporcionales con historial. Todo auditado.

**Architecture:** Las tablas `empleado_*` y su RLS owner-only YA existen. La migración solo añade triggers de auditoría (`registrado_por`) y el RPC `obtener_dias_trabajados`. Encima, `lib/empleados.ts` (lógica pura + acceso a datos por RLS directa) y UI `app/(app)/empleados/`. Crear cuenta Auth desde la app se difiere (no entra en v1).

**Tech Stack:** Supabase (PostgreSQL 17, RLS, RPC plpgsql), React Native + Expo SDK 54 (expo-router), TypeScript estricto, jest.

**Spec:** `docs/superpowers/specs/2026-06-17-empleados-design.md`
**Rama:** `feat/m8-empleados` (creada; spec ya commiteado). **No mergear a `main` sin aprobación humana.**

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/<ts>_m8_empleados.sql` (nuevo) | Triggers `registrado_por` + RPC `obtener_dias_trabajados` (NO recrea tablas) |
| `supabase/tests/smoke_test_empleados.sql` (gitignored) | Smoke en transacción con `rollback` |
| `lib/database.types.ts` (regenerar vía MCP) | Tipos generados |
| `lib/permisos.ts` (modificar) | Añadir `ruta: '/empleados'` al módulo `gestion-empleado` |
| `lib/empleados.ts` (nuevo) | Lógica pura (proración/días esperados) + acceso a datos |
| `lib/empleados.test.ts` (nuevo) | Tests jest de la lógica pura |
| `app/(app)/empleados/_layout.tsx` (nuevo) | Stack + gating dueño-only |
| `app/(app)/empleados/index.tsx` (nuevo) | Lista de empleados |
| `app/(app)/empleados/[id].tsx` (nuevo) | Detalle: editar, activar/desactivar, días, pagos |
| `lib/empleados_ui.test.tsx` (nuevo) | Tests jest de la UI |

---

## Task 1: Escribir la migración (triggers + RPC)

**Files:**
- Create: `supabase/migrations/<ts>_m8_empleados.sql` (generar `<ts>` con `date +%Y%m%d%H%M%S`)

- [ ] **Step 1: Confirmar columnas (vía MCP execute_sql)**

```sql
select table_name, column_name from information_schema.columns
where table_schema='public' and table_name in ('ventas','cierres_caja','empleado_dias_trabajados','empleado_pagos')
order by table_name, ordinal_position;
```
Esperado: `ventas(created_by, created_at)`, `cierres_caja(created_by, cerrado_por, fecha)`, `empleado_dias_trabajados(empleado_id, fecha, tipo, registrado_por)`, `empleado_pagos(registrado_por)`. Ajustar el SQL si algún nombre difiere.

- [ ] **Step 2: Escribir la migración completa**

Crear `supabase/migrations/<ts>_m8_empleados.sql` con exactamente:

```sql
-- M8 Gestión de Empleados: auditoría de registrado_por + RPC de días trabajados.
-- NO recrea empleado_config/empleado_dias_trabajados/empleado_pagos (ya existen con RLS owner-only).

-- 1. Auditoría inviolable de registrado_por (las tablas hoy solo tienen trigger updated_at)
create or replace function private.set_registrado_por()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.registrado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_empleado_pagos_registrado_por on public.empleado_pagos;
create trigger trg_empleado_pagos_registrado_por
  before insert on public.empleado_pagos
  for each row execute function private.set_registrado_por();

drop trigger if exists trg_empleado_dias_registrado_por on public.empleado_dias_trabajados;
create trigger trg_empleado_dias_registrado_por
  before insert on public.empleado_dias_trabajados
  for each row execute function private.set_registrado_por();

-- 2. RPC: días trabajados del mes (ventas ∪ cierres ∪ manuales 'trabajado') − 'ausente'
create or replace function public.obtener_dias_trabajados(
  p_empleado_id uuid, p_anio int, p_mes int
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not private.is_owner() then
    raise exception 'Solo el dueño puede consultar días trabajados';
  end if;

  with dias as (
    select distinct (v.created_at at time zone 'America/Bogota')::date as d
    from public.ventas v
    where v.created_by = p_empleado_id
      and extract(year  from (v.created_at at time zone 'America/Bogota'))::int = p_anio
      and extract(month from (v.created_at at time zone 'America/Bogota'))::int = p_mes
    union
    select distinct c.fecha
    from public.cierres_caja c
    where (c.created_by = p_empleado_id or c.cerrado_por = p_empleado_id)
      and extract(year from c.fecha)::int = p_anio
      and extract(month from c.fecha)::int = p_mes
    union
    select distinct m.fecha
    from public.empleado_dias_trabajados m
    where m.empleado_id = p_empleado_id and m.tipo = 'trabajado'
      and extract(year from m.fecha)::int = p_anio
      and extract(month from m.fecha)::int = p_mes
  ),
  ausentes as (
    select distinct m.fecha as d
    from public.empleado_dias_trabajados m
    where m.empleado_id = p_empleado_id and m.tipo = 'ausente'
      and extract(year from m.fecha)::int = p_anio
      and extract(month from m.fecha)::int = p_mes
  )
  select count(*) into v_count from dias where d not in (select d from ausentes);

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.obtener_dias_trabajados(uuid, int, int) from public;
grant execute on function public.obtener_dias_trabajados(uuid, int, int) to authenticated;
```

- [ ] **Step 3: Commit (solo el archivo de migración)**

```bash
git add supabase/migrations/*_m8_empleados.sql
git commit -m "feat(m8): migración — auditoría de registrado_por + RPC obtener_dias_trabajados

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Smoke test SQL y correrlo vía MCP

**Files:**
- Create: `supabase/tests/smoke_test_empleados.sql` (gitignored — no se commitea)

- [ ] **Step 1: Escribir el smoke**

Envuelto en `begin; ... rollback;`. Replica del smoke de proveedores/devoluciones: simulación de `auth.uid()` (set role + `request.jwt.claims` con el `sub`), sembrar `auth.users` ANTES de `public.users`, helpers de assert, centinela final `raise notice 'EMPLEADOS_OK_ROLLBACK'`. **El usuario sembrado debe tener `rol='dueno'`** para pasar el gate `private.is_owner()` del RPC. Escenarios:
1. Setup: usuario dueño (auth+public, rol='dueno'), un empleado (rol='empleado'), una venta del empleado el 2026-06-10, un cierre de caja del empleado el 2026-06-11, y un registro manual `empleado_dias_trabajados(empleado, '2026-06-12', 'trabajado')`.
2. `obtener_dias_trabajados(empleado, 2026, 6)` ⇒ **3** (tres fechas distintas).
3. Añadir manual `('2026-06-10','ausente')` ⇒ recomputar ⇒ **2** (la ausencia quita el día de la venta).
4. **Auditoría:** insertar en `empleado_pagos` con `registrado_por` falso (otro uuid) ⇒ tras el insert, `registrado_por` debe ser el `auth.uid()` del dueño (el trigger lo sobrescribe).
5. **Gate:** cambiar el claim a un usuario `rol='empleado'` y llamar `obtener_dias_trabajados` ⇒ debe lanzar excepción ('Solo el dueño...').

- [ ] **Step 2: Correr vía MCP**

`mcp__plugin_supabase_supabase__execute_sql` con el contenido completo (incluye `begin; ... rollback;`). Esperado: termina con `EMPLEADOS_OK_ROLLBACK` sin error. Si falla un assert, corregir la **migración** (Task 1) o el smoke y repetir. Si hay un bug real en la migración, corregirlo en Task 1. **No avanzar a Task 3 hasta verde.**

---

## Task 3: Aplicar al remoto, regenerar tipos, añadir ruta, commit

**Files:**
- Modify: `lib/database.types.ts` (regenerar), `lib/permisos.ts`

- [ ] **Step 1: Aplicar la migración al remoto vía MCP** (`apply_migration`, name `m8_empleados`, cuerpo = la migración sin `begin/rollback`). Verificar:
```sql
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname='obtener_dias_trabajados';
```
Esperado: 1 fila. Y que `apply_migration` registre la versión (anotar el timestamp asignado; si difiere del nombre local, renombrar el archivo local a la versión registrada — lección de M2).

- [ ] **Step 2: Regenerar tipos** con `generate_typescript_types` y sobrescribir `lib/database.types.ts` (no editar a mano).

- [ ] **Step 3: Añadir la ruta del módulo** en `lib/permisos.ts`:

```ts
  { id: 'gestion-empleado',   titulo: 'Empleados',          icono: '👤', roles: SOLO_DUENO, ruta: '/empleados' },
```

- [ ] **Step 4: Verificar** `npx tsc --noEmit` → 0 errores.

- [ ] **Step 5: Commit**

```bash
git add lib/database.types.ts lib/permisos.ts
git commit -m "feat(m8): aplicar migración al remoto + regenerar tipos; ruta /empleados

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `lib/empleados.ts` — lógica pura (TDD)

**Files:**
- Create: `lib/empleados.ts`, `lib/empleados.test.ts`

- [ ] **Step 1: Escribir los tests que fallan** — crear `lib/empleados.test.ts`:

```ts
// La capa de datos importa supabase; mockear para los tests puros (AsyncStorage en jest).
jest.mock('./supabase', () => ({ supabase: {} }))

import { diasEsperadosMes, montoSugeridoPago } from './empleados'

describe('diasEsperadosMes', () => {
  it('6 días/semana en un mes de 30 días ≈ 26', () => {
    expect(diasEsperadosMes(6, 2026, 6)).toBe(26) // round(6*30/7)=round(25.7)
  })
  it('asume 6 si dias_trabajo_semana es null', () => {
    expect(diasEsperadosMes(null, 2026, 6)).toBe(26)
  })
  it('5 días/semana en julio (31 días) ≈ 22', () => {
    expect(diasEsperadosMes(5, 2026, 7)).toBe(22) // round(5*31/7)=round(22.14)
  })
})

describe('montoSugeridoPago', () => {
  it('proporcional por días', () => {
    expect(montoSugeridoPago(1300000, 13, 26)).toBe(650000)
  })
  it('topa en el sueldo mensual si trabajó de más', () => {
    expect(montoSugeridoPago(1300000, 30, 26)).toBe(1300000)
  })
  it('paga el sueldo completo si diasEsperados es 0', () => {
    expect(montoSugeridoPago(1300000, 0, 0)).toBe(1300000)
  })
})
```

- [ ] **Step 2: Run para ver fallar** — `npx jest lib/empleados.test.ts` → FAIL.

- [ ] **Step 3: Implementar la lógica pura** — crear `lib/empleados.ts` (solo la parte pura por ahora):

```ts
export function diasEsperadosMes(diasTrabajoSemana: number | null, anio: number, mes: number): number {
  const dts = diasTrabajoSemana ?? 6
  const diasDelMes = new Date(anio, mes, 0).getDate() // mes 1-12 → último día de ese mes
  return Math.round((dts * diasDelMes) / 7)
}

export function montoSugeridoPago(sueldoMensual: number, diasTrabajados: number, diasEsperados: number): number {
  if (diasEsperados <= 0) return Math.round(sueldoMensual)
  return Math.round((sueldoMensual * Math.min(diasTrabajados, diasEsperados)) / diasEsperados)
}
```

- [ ] **Step 4: Run para ver pasar** — `npx jest lib/empleados.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/empleados.ts lib/empleados.test.ts
git commit -m "feat(m8): lógica pura de empleados (días esperados, pago proporcional) + tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `lib/empleados.ts` — acceso a datos

**Files:**
- Modify: `lib/empleados.ts`

- [ ] **Step 1: Leer patrones** — `lib/caja.ts` (cómo llama `supabase.rpc` y mapea) y `lib/supabase.ts` (cliente). Confirmar en `lib/database.types.ts` los nombres de columnas de `users` (`id,nombre,email,rol,activo`), `empleado_config` y `empleado_pagos`, y la firma del RPC `obtener_dias_trabajados`.

- [ ] **Step 2: Añadir tipos y funciones de datos** a `lib/empleados.ts`:

```ts
import { supabase } from './supabase'

export type EmpleadoConfig = {
  sueldo_mensual: number | null
  fecha_inicio: string | null
  dias_trabajo_semana: number | null
  activo: boolean
}

export type Empleado = {
  id: string
  nombre: string
  email: string
  rol: 'admin' | 'empleado'
  activo: boolean
  config: EmpleadoConfig | null
}

export type PagoEmpleado = {
  id: string
  monto: number
  fecha_pago: string
  periodo_inicio: string | null
  periodo_fin: string | null
  dias_trabajados: number | null
  nota: string | null
}

export type RegistrarPagoInput = {
  empleado_id: string
  monto: number
  fecha_pago: string
  periodo_inicio?: string | null
  periodo_fin?: string | null
  dias_trabajados?: number | null
  nota?: string | null
}

// Empleados del negocio = todos menos el dueño (rol admin o empleado) + su config.
export async function listarEmpleados(): Promise<Empleado[]> {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, nombre, email, rol, activo')
    .in('rol', ['admin', 'empleado'])
    .order('nombre')
  if (error) throw error

  const ids = (users ?? []).map((u) => u.id)
  const { data: configs, error: e2 } = await supabase
    .from('empleado_config')
    .select('empleado_id, sueldo_mensual, fecha_inicio, dias_trabajo_semana, activo')
    .in('empleado_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  if (e2) throw e2

  const byId = new Map((configs ?? []).map((c) => [c.empleado_id, c]))
  return (users ?? []).map((u) => {
    const c = byId.get(u.id)
    return {
      id: u.id, nombre: u.nombre, email: u.email,
      rol: u.rol as 'admin' | 'empleado', activo: u.activo,
      config: c ? {
        sueldo_mensual: c.sueldo_mensual, fecha_inicio: c.fecha_inicio,
        dias_trabajo_semana: c.dias_trabajo_semana, activo: c.activo,
      } : null,
    }
  })
}

export async function guardarConfigEmpleado(
  empleadoId: string,
  cfg: { sueldo_mensual: number; fecha_inicio?: string | null; dias_trabajo_semana?: number | null }
): Promise<void> {
  const { error } = await supabase
    .from('empleado_config')
    .upsert(
      {
        empleado_id: empleadoId,
        sueldo_mensual: cfg.sueldo_mensual,
        fecha_inicio: cfg.fecha_inicio ?? null,
        dias_trabajo_semana: cfg.dias_trabajo_semana ?? null,
      },
      { onConflict: 'empleado_id' }
    )
  if (error) throw error
}

export async function setActivoEmpleado(empleadoId: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from('users').update({ activo }).eq('id', empleadoId)
  if (error) throw error
  // Espejar en config (ignora error si aún no hay config)
  await supabase.from('empleado_config').update({ activo }).eq('empleado_id', empleadoId)
}

export async function actualizarNombreEmpleado(empleadoId: string, nombre: string): Promise<void> {
  const { error } = await supabase.from('users').update({ nombre }).eq('id', empleadoId)
  if (error) throw error
}

export async function diasTrabajadosMes(empleadoId: string, anio: number, mes: number): Promise<number> {
  const { data, error } = await supabase.rpc('obtener_dias_trabajados', {
    p_empleado_id: empleadoId, p_anio: anio, p_mes: mes,
  })
  if (error) throw error
  return (data as number) ?? 0
}

export async function registrarPagoEmpleado(input: RegistrarPagoInput): Promise<void> {
  const { error } = await supabase.from('empleado_pagos').insert({
    empleado_id: input.empleado_id,
    monto: input.monto,
    fecha_pago: input.fecha_pago,
    periodo_inicio: input.periodo_inicio ?? null,
    periodo_fin: input.periodo_fin ?? null,
    dias_trabajados: input.dias_trabajados ?? null,
    nota: input.nota ?? null,
  })
  if (error) throw error
}

export async function historialPagos(empleadoId: string): Promise<PagoEmpleado[]> {
  const { data, error } = await supabase
    .from('empleado_pagos')
    .select('id, monto, fecha_pago, periodo_inicio, periodo_fin, dias_trabajados, nota')
    .eq('empleado_id', empleadoId)
    .order('fecha_pago', { ascending: false })
  if (error) throw error
  return (data ?? []) as PagoEmpleado[]
}
```

> Nota: `registrado_por` lo fija el trigger de BD; no se envía desde el cliente. Si los
> tipos generados se quejan del `upsert`/`insert`, resolver con tipos correctos (no `as any`).

- [ ] **Step 3: Verificar** `npx tsc --noEmit` → 0 errores.

- [ ] **Step 4: Commit**

```bash
git add lib/empleados.ts
git commit -m "feat(m8): acceso a datos de empleados (listar, config, activo, días, pagos)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: UI — layout e índice

**Files:**
- Create: `app/(app)/empleados/_layout.tsx`, `app/(app)/empleados/index.tsx`

- [ ] **Step 1: `_layout.tsx`** (patrón de `app/(app)/recibir-mercancia/_layout.tsx`, gate dueño-only):

```tsx
import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function EmpleadosLayout() {
  const requireModulo = useRequireModulo('gestion-empleado')
  if (requireModulo) return requireModulo
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: '#ffffff' }, headerShadowVisible: false,
      headerTintColor: '#111827', headerTitleStyle: { fontWeight: '600' },
      contentStyle: { backgroundColor: '#f9fafb' }, headerTitleAlign: 'center',
    }}>
      <Stack.Screen name="index" options={{ title: 'Empleados' }} />
      <Stack.Screen name="[id]" options={{ title: 'Empleado' }} />
    </Stack>
  )
}
```

- [ ] **Step 2: `index.tsx`** — lista de empleados.

Carga `listarEmpleados()` y, por empleado, `diasTrabajadosMes(id, añoActual, mesActual)`. Muestra: nombre, rol, badge Activo/Inactivo, sueldo mensual (formateado en COP) y "Días este mes: N". Cada fila navega a `router.push('/empleados/' + id)`. Estilo de `app/(app)/recibir-mercancia/index.tsx` (SafeAreaView/ScrollView/cards). Maneja carga/erro­r en español.

- [ ] **Step 3: Verificar** `npx tsc --noEmit` → 0 · `npm test` → todas las suites verdes.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/empleados/_layout.tsx" "app/(app)/empleados/index.tsx"
git commit -m "feat(m8): UI empleados — layout dueño-only + lista

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: UI — detalle del empleado (`[id].tsx`)

**Files:**
- Create: `app/(app)/empleados/[id].tsx`

- [ ] **Step 1: Implementar la pantalla**

Lee `id` con `useLocalSearchParams`. Carga el empleado (de `listarEmpleados` filtrado por id, o reusar datos) + `diasTrabajadosMes` + `historialPagos`. Secciones:
1. **Datos:** inputs para nombre y sueldo mensual (y opcional `dias_trabajo_semana`, `fecha_inicio`); botón "Guardar" → `actualizarNombreEmpleado` + `guardarConfigEmpleado`.
2. **Estado:** botón Activar/Desactivar → `setActivoEmpleado`; al desactivar, mostrar aviso "El empleado no podrá iniciar sesión".
3. **Días este mes:** mostrar el número (del RPC).
4. **Registrar pago:** calcular `diasEsperados = diasEsperadosMes(dias_trabajo_semana, año, mes)` y `monto = montoSugeridoPago(sueldo, diasTrabajados, diasEsperados)`; mostrar el monto sugerido en un input editable; "Registrar pago" → `registrarPagoEmpleado({empleado_id, monto, fecha_pago: hoy, dias_trabajados, periodo_inicio, periodo_fin})`. Refrescar el historial al confirmar.
5. **Historial de pagos:** lista (fecha, monto, días, período).

Todo en español; estilo consistente. Manejo de errores con `error.message`.

- [ ] **Step 2: Verificar** `npx tsc --noEmit` → 0 · `npm test` → verde.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/empleados/[id].tsx"
git commit -m "feat(m8): UI detalle de empleado — editar, activar/desactivar, días, pagos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Tests de UI

**Files:**
- Create: `lib/empleados_ui.test.tsx` (patrón de `lib/recibir_mercancia_ui.test.tsx` / `lib/devoluciones_ui.test.tsx`)

- [ ] **Step 1: Escribir los tests** — mockear `lib/empleados`, `lib/auth`, `expo-router`. Cubrir:
1. **Gating dueño-only:** el layout invoca `useRequireModulo('gestion-empleado')`; cuando el guard devuelve un elemento (rol no dueño), no se renderiza el contenido.
2. **Registrar pago:** en `[id]`, confirmar invoca `registrarPagoEmpleado` con el payload correcto (empleado_id, monto, dias_trabajados).
3. **Desactivar:** el botón invoca `setActivoEmpleado(id, false)`.
4. **Monto sugerido:** dado sueldo y días mockeados, el input de pago muestra el monto proporcional esperado.

- [ ] **Step 2: Run** — `npx jest lib/empleados_ui.test.tsx` → verde; `npm test` → todas verdes; `npx tsc --noEmit` → 0.

- [ ] **Step 3: Commit**

```bash
git add lib/empleados_ui.test.tsx
git commit -m "test(m8): tests de UI de empleados (gating, registrar pago, desactivar, monto)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Verificación de regresión

- [ ] **Step 1:** `npx tsc --noEmit && npm test` → tsc 0, todas las suites verdes.
- [ ] **Step 2:** Re-correr el smoke `smoke_test_empleados.sql` vía MCP (rollback) → `EMPLEADOS_OK_ROLLBACK`.
- [ ] **Step 3:** Verificación read-only vía MCP: `select public.obtener_dias_trabajados('<un-empleado-real>', 2026, 6);` ejecuta sin error (como dueño).

---

## Task 10: Code review y cierre

- [ ] **Step 1: Code review** (REQUIRED SUB-SKILL: superpowers:requesting-code-review) sobre `main..feat/m8-empleados`. Foco: que el RPC y las tablas no filtren datos a no-dueños (gate `is_owner` + RLS), que `registrado_por` sea inviolable, que desactivar bloquee login, y la proración.
- [ ] **Step 2:** Actualizar `openspec/changes/tasks.json` (SP-8 Empleados construido) y la memoria.
- [ ] **Step 3: Presentar al humano para decisión de merge** (REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch). **No auto-mergear.**

---

## Self-Review (writing-plans)

- **Cobertura del spec:** §2.1 días → RPC (Task 1) + RPC consumo (Task 5/7); §2.2 proración → lógica pura (Task 4); §2.3 auditoría → triggers (Task 1); §3 BD → Tasks 1-3; §4 lib → Tasks 4-5; §5 UI → Tasks 6-7 (+ ruta en Task 3); §6 pruebas → Tasks 2,4,8,9. Sin huecos.
- **Sin placeholders** en BD ni lógica pura (código completo). UI con estructura + patrón concreto + referencia a pantallas existentes.
- **Consistencia de tipos:** firma del RPC `obtener_dias_trabajados(uuid,int,int)` idéntica en migración, grant y `diasTrabajadosMes`; `RegistrarPagoInput`/`registrarPagoEmpleado` consistentes con columnas de `empleado_pagos`; `gestion-empleado` es el id real del módulo.
- **Orden serial:** BD (1-3) → lib (4-5) → UI (6-8) → verificación (9) → review/cierre (10). Coincide con AGENTS.md §5.1.
