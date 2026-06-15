# SP-1 — Roles, Permisos, RLS y Auditoría — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar el modelo de roles, permisos, RLS y auditoría base del código al modelo del PRD v4.0 (tres roles `dueno`/`admin`/`empleado`, matriz de permisos, RLS reescrito, columnas `created_by`/`updated_by`, y seed de Sandra como admin).

**Architecture:** Migraciones Postgres incrementales (constraint+helpers → auditoría → RLS por grupos de tablas), más cambios de TypeScript en `lib/permisos.ts`/`lib/usuarios.ts`. Cada tarea es una migración o un archivo, lo bastante pequeña para una sola sesión. Online-first; RLS sigue siendo la frontera de seguridad real.

**Tech Stack:** Supabase (PostgreSQL 17, RLS), Expo SDK 54 / React Native / TypeScript, jest.

**Spec:** `docs/superpowers/specs/2026-06-14-sp1-roles-permisos-rls-design.md`
**Project ref Supabase:** `xqspsaghukeynlizbjvc`

**Notas para quien ejecute:**
- En cada smoke test SQL, un error final `*_OK_ROLLBACK` es la señal de ÉXITO (fuerza el rollback para no persistir). Cualquier mensaje `FALLO ...` es un bug a corregir.
- Cada migración: escribir el archivo en `supabase/migrations/<YYYYMMDDHHMMSS>_<nombre>.sql` Y aplicarla con MCP `supabase.apply_migration` (mismo SQL). Usar timestamps crecientes.
- `drop policy if exists` antes de `create policy` para idempotencia.

---

## Setup (antes de la Tarea 1)

- [x] Crear rama desde `main`:
```bash
cd /home/aveia/Development/work/Venus
git checkout main && git pull --ff-only
git checkout -b feat/sp1-roles-permisos
```

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/<ts>_sp1_roles_helpers.sql` | Constraint de rol + `is_admin()`/`is_staff_admin()` |
| `supabase/migrations/<ts>_sp1_auditoria.sql` | Columnas `created_by`/`updated_by` + trigger |
| `supabase/migrations/<ts>_sp1_rls_inventario_proveedores.sql` | RLS inventario, costos, proveedores |
| `supabase/migrations/<ts>_sp1_rls_compras_gastos.sql` | RLS compras, documentos, gastos |
| `supabase/migrations/<ts>_sp1_rls_ventas_caja_users.sql` | RLS ventas, items, pagos, caja, users |
| `supabase/seeds/sandra_admin.sql` | Seed de Sandra (admin) |
| `lib/permisos.ts` + `lib/permisos.test.ts` | Tipo `Rol`, matriz, renombres, tile Devoluciones |
| `lib/usuarios.ts` | Sandra en el picker |
| `lib/database.types.ts` | Regenerado |

---

## Task 1: Migración — rol `admin` + helpers

**Files:** Create `supabase/migrations/<ts>_sp1_roles_helpers.sql`

- [x] **Step 1: Escribir la migración** con EXACTAMENTE:
```sql
-- SP-1: tercer rol 'admin' + helpers de nivel administrativo.

alter table public.users drop constraint if exists users_rol_check;
alter table public.users add constraint users_rol_check check (rol in ('dueno','admin','empleado'));

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.user_role() = 'admin', false)
$$;

create or replace function private.is_staff_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.user_role() in ('dueno','admin'), false)
$$;

grant execute on function private.is_admin(), private.is_staff_admin() to authenticated, service_role;
```

- [x] **Step 2: Aplicar** vía MCP `supabase.apply_migration` (`project_id: "xqspsaghukeynlizbjvc"`, `name: "sp1_roles_helpers"`, `query` = el SQL). Expected: sin error.

- [ ] **Step 3: Smoke test** vía MCP `supabase.execute_sql`:
```sql
do $$
declare v_admin uuid; v_role text;
begin
  -- 'admin' ahora es válido en el constraint: insertar y borrar un user de prueba
  v_admin := gen_random_uuid();
  insert into public.users (id, nombre, rol) values (v_admin, 'TEST ADMIN', 'admin');
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  if not private.is_admin() then raise exception 'FALLO is_admin'; end if;
  if not private.is_staff_admin() then raise exception 'FALLO is_staff_admin (admin)'; end if;
  if private.is_owner() then raise exception 'FALLO is_owner debería ser false para admin'; end if;
  raise exception 'T1_OK_ROLLBACK';
end $$;
```
Expected: termina con `T1_OK_ROLLBACK`.

> **Nota de ejecución:** el smoke test tal cual falla por FK (`public.users.id → auth.users(id)`): hay que sembrar una fila en `auth.users` antes del insert en `public.users`. Verificado con esa fila añadida → `T1_OK_ROLLBACK`. Aplica a los smoke tests de T2/T4/T5/T6/T9.

- [x] **Step 3: Smoke test** — PASÓ (`T1_OK_ROLLBACK`, con auth.users sembrado).

- [x] **Step 4: Commit** — `1d51a2d`
```bash
git add supabase/migrations/
git commit -m "feat(db): rol admin y helpers is_admin/is_staff_admin"
```

---

## Task 2: Migración — columnas y trigger de auditoría

**Files:** Create `supabase/migrations/<ts>_sp1_auditoria.sql`

- [x] **Step 1: Escribir la migración** con EXACTAMENTE:
```sql
-- SP-1: auditoría base (created_by / updated_by) + trigger.

do $$
declare t text;
begin
  foreach t in array array[
    'productos_calzado','productos_varios','proveedores','proveedor_cuentas_bancarias',
    'compras','compra_items','gastos_fijos','gastos_fijos_pagos','gastos_variables',
    'cierres_caja','ventas','venta_items','metodos_pago_venta'
  ] loop
    execute format('alter table public.%1$s add column if not exists created_by uuid references public.users(id)', t);
    execute format('alter table public.%1$s add column if not exists updated_by uuid references public.users(id)', t);
  end loop;
end $$;

create or replace function private.set_audit_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then new.created_by := auth.uid(); end if;
  elsif tg_op = 'UPDATE' then
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'productos_calzado','productos_varios','proveedores','proveedor_cuentas_bancarias',
    'compras','compra_items','gastos_fijos','gastos_fijos_pagos','gastos_variables',
    'cierres_caja','ventas','venta_items','metodos_pago_venta'
  ] loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$s', t);
    execute format('create trigger trg_%1$s_audit before insert or update on public.%1$s
      for each row execute function private.set_audit_fields()', t);
  end loop;
end $$;
```

- [x] **Step 2: Aplicar** vía MCP `supabase.apply_migration` (`name: "sp1_auditoria"`). Expected: sin error.

- [ ] **Step 3: Smoke test** vía MCP `supabase.execute_sql`:
```sql
do $$
declare v_uid uuid; v_pid uuid; v_cb uuid;
begin
  select id into v_uid from public.users where rol = 'dueno' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role','authenticated')::text, true);
  insert into public.productos_varios (nombre, unidad_medida, precio_venta, stock_actual)
    values ('AUDIT TEST', 'unidad', 1000, 1) returning id, created_by into v_pid, v_cb;
  if v_cb is distinct from v_uid then raise exception 'FALLO created_by: % != %', v_cb, v_uid; end if;
  raise exception 'T2_OK_ROLLBACK';
end $$;
```
Expected: termina con `T2_OK_ROLLBACK`.

- [x] **Step 3: Smoke test** — PASÓ (`T2_OK_ROLLBACK`; usa un `dueno` existente, sin problema de FK).

- [x] **Step 4: Commit** — `c27119b`
```bash
git add supabase/migrations/
git commit -m "feat(db): auditoría base created_by/updated_by con trigger"
```

---

## Task 3: `lib/permisos.ts` — tipo Rol, matriz v4.0, renombres y tile Devoluciones (TDD)

**Files:** Modify `lib/permisos.ts`, `lib/permisos.test.ts`

- [x] **Step 1: Reescribir el test** `lib/permisos.test.ts` con EXACTAMENTE:
```ts
import { MODULOS, modulosPara, puedeAcceder } from './permisos'

describe('permisos', () => {
  test('el dueño ve los 14 módulos', () => {
    expect(modulosPara('dueno')).toHaveLength(14)
  })

  test('el admin ve 11 módulos (todos menos los del dueño)', () => {
    const ids = modulosPara('admin').map(m => m.id)
    expect(ids).toHaveLength(11)
    for (const prohibido of ['gestion-empleado', 'balance', 'analisis-ia']) {
      expect(ids).not.toContain(prohibido)
    }
  })

  test('el empleado ve exactamente los 7 módulos operativos', () => {
    const ids = modulosPara('empleado').map(m => m.id).sort()
    expect(ids).toEqual(
      ['caja', 'devoluciones', 'gastos-variables', 'granja', 'inventario-calzado', 'recibir-mercancia', 'ventas'].sort()
    )
  })

  test('solo el dueño ve finanzas y gestión', () => {
    for (const id of ['balance', 'gestion-empleado', 'analisis-ia']) {
      expect(puedeAcceder('dueno', id)).toBe(true)
      expect(puedeAcceder('admin', id)).toBe(false)
      expect(puedeAcceder('empleado', id)).toBe(false)
    }
  })

  test('admin gestiona proveedores, gastos fijos, reportes y carga inicial; el empleado no', () => {
    for (const id of ['proveedores', 'gastos-fijos', 'reportes', 'carga-inicial']) {
      expect(puedeAcceder('admin', id)).toBe(true)
      expect(puedeAcceder('empleado', id)).toBe(false)
    }
  })

  test('devoluciones es visible para los tres roles', () => {
    expect(puedeAcceder('dueno', 'devoluciones')).toBe(true)
    expect(puedeAcceder('admin', 'devoluciones')).toBe(true)
    expect(puedeAcceder('empleado', 'devoluciones')).toBe(true)
  })

  test('ventas conserva su ruta dedicada', () => {
    expect(MODULOS.find(m => m.id === 'ventas')?.ruta).toBe('/ventas')
  })

  test('no hay ids de módulo duplicados', () => {
    const ids = MODULOS.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [x] **Step 2: Correr el test para verlo fallar** — FALLÓ (5 failed, 3 passed) como se esperaba.
Run: `npm test -- permisos`
Expected: FAIL (la matriz vieja no cumple los conteos/ids nuevos).

- [x] **Step 3: Reescribir** `lib/permisos.ts` con EXACTAMENTE:
```ts
export type Rol = 'dueno' | 'admin' | 'empleado'

export interface Modulo {
  id: string
  titulo: string
  icono: string
  roles: Rol[]
  ruta?: string
}

const TODOS: Rol[] = ['dueno', 'admin', 'empleado']
const STAFF_ADMIN: Rol[] = ['dueno', 'admin']
const SOLO_DUENO: Rol[] = ['dueno']

export const MODULOS: Modulo[] = [
  { id: 'ventas',             titulo: 'Ventas',             icono: '🛒', roles: TODOS, ruta: '/ventas' },
  { id: 'devoluciones',       titulo: 'Devoluciones',       icono: '↩️', roles: TODOS },
  { id: 'inventario-calzado', titulo: 'Inventario calzado', icono: '👟', roles: TODOS },
  { id: 'granja',             titulo: 'Granja',             icono: '🥚', roles: TODOS },
  { id: 'recibir-mercancia',  titulo: 'Recibir mercancía',  icono: '📥', roles: TODOS },
  { id: 'caja',               titulo: 'Caja',               icono: '🧾', roles: TODOS },
  { id: 'gastos-variables',   titulo: 'Gastos variables',   icono: '💸', roles: TODOS },
  { id: 'proveedores',        titulo: 'Proveedores',        icono: '🚚', roles: STAFF_ADMIN },
  { id: 'gastos-fijos',       titulo: 'Gastos fijos',       icono: '📌', roles: STAFF_ADMIN },
  { id: 'reportes',           titulo: 'Reportes',           icono: '📊', roles: STAFF_ADMIN },
  { id: 'carga-inicial',      titulo: 'Carga inicial',      icono: '📷', roles: STAFF_ADMIN },
  { id: 'gestion-empleado',   titulo: 'Empleados',          icono: '👤', roles: SOLO_DUENO },
  { id: 'balance',            titulo: 'Balance',            icono: '⚖️', roles: SOLO_DUENO },
  { id: 'analisis-ia',        titulo: 'Análisis IA',        icono: '🤖', roles: SOLO_DUENO },
]

export const modulosPara = (rol: Rol): Modulo[] =>
  MODULOS.filter(m => m.roles.includes(rol))

export const puedeAcceder = (rol: Rol, id: string): boolean =>
  MODULOS.find(m => m.id === id)?.roles.includes(rol) ?? false
```

- [x] **Step 4: Correr tests y typecheck** — 8 tests PASS. tsc: 0 errores nuevos; 2 errores PREEXISTENTES en `lib/supabase.ts` (`process` no tipado, `tsconfig` usa `"types": ["jest"]` sin `node`) — fuera del alcance de SP-1.
Run: `npm test -- permisos && npx tsc --noEmit`
Expected: PASS (8 tests) y tsc sin errores. (`lib/auth.tsx` ya usa `Rol`; no requiere cambios.)

- [x] **Step 5: Commit** — `a4cad30`
```bash
git add lib/permisos.ts lib/permisos.test.ts
git commit -m "feat: matriz de permisos v4.0 (3 roles, Granja/Caja, tile Devoluciones)"
```

---

## Task 4: Migración — RLS inventario, costos y proveedores

**Files:** Create `supabase/migrations/<ts>_sp1_rls_inventario_proveedores.sql`

- [x] **Step 1: Escribir la migración** con EXACTAMENTE:
```sql
-- SP-1 RLS: inventario editable por todo el staff; proveedores admin+dueño.

-- productos_calzado: SELECT abierto (sin cambio); INSERT/UPDATE todo el staff; DELETE admin/dueño
drop policy if exists calzado_insert on public.productos_calzado;
drop policy if exists calzado_update on public.productos_calzado;
drop policy if exists calzado_delete on public.productos_calzado;
create policy calzado_insert on public.productos_calzado for insert to authenticated with check (true);
create policy calzado_update on public.productos_calzado for update to authenticated using (true) with check (true);
create policy calzado_delete on public.productos_calzado for delete to authenticated using ((select private.is_staff_admin()));

-- productos_varios: igual
drop policy if exists varios_insert on public.productos_varios;
drop policy if exists varios_update on public.productos_varios;
drop policy if exists varios_delete on public.productos_varios;
create policy varios_insert on public.productos_varios for insert to authenticated with check (true);
create policy varios_update on public.productos_varios for update to authenticated using (true) with check (true);
create policy varios_delete on public.productos_varios for delete to authenticated using ((select private.is_staff_admin()));

-- historial_precios (costos): sin cambio (solo dueño). Se dejan tal cual.

-- proveedores: SELECT abierto (para elegir al recibir mercancía); escritura admin+dueño
drop policy if exists proveedores_insert on public.proveedores;
drop policy if exists proveedores_update on public.proveedores;
drop policy if exists proveedores_delete on public.proveedores;
create policy proveedores_insert on public.proveedores for insert to authenticated with check ((select private.is_staff_admin()));
create policy proveedores_update on public.proveedores for update to authenticated using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));
create policy proveedores_delete on public.proveedores for delete to authenticated using ((select private.is_staff_admin()));

-- proveedor_cuentas_bancarias: admin+dueño (antes solo dueño)
drop policy if exists prov_cuentas_owner on public.proveedor_cuentas_bancarias;
create policy prov_cuentas_admin on public.proveedor_cuentas_bancarias for all to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));
```

- [x] **Step 2: Aplicar** vía MCP `supabase.apply_migration` (`name: "sp1_rls_inventario_proveedores"`). Expected: sin error.

- [ ] **Step 3: Smoke test** vía MCP `supabase.execute_sql`:
```sql
do $$
declare v_emp uuid; v_pid uuid;
begin
  select id into v_emp from public.users where rol = 'empleado' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_emp, 'role','authenticated')::text, true);
  set local role authenticated;

  -- empleado SÍ puede crear/editar inventario
  insert into public.productos_calzado (categoria, descripcion, precio_venta, stock_actual)
    values ('Tennis','RLS EMP', 1000, 1) returning id into v_pid;
  update public.productos_calzado set stock_actual = 2 where id = v_pid;

  -- empleado NO puede ver costos (historial_precios_calzado)
  if exists (select 1 from public.historial_precios_calzado) then
    raise exception 'FALLO: empleado vio historial_precios_calzado';
  end if;

  -- empleado NO puede escribir proveedores
  begin
    insert into public.proveedores (nombre) values ('PROV EMP');
    raise exception 'FALLO: empleado insertó proveedor';
  exception when insufficient_privilege then null;
  end;

  reset role;
  raise exception 'T4_OK_ROLLBACK';
end $$;
```
Expected: termina con `T4_OK_ROLLBACK`. (Si el insert de proveedor por empleado NO lanza `insufficient_privilege`/violación de RLS, es un bug.)

- [x] **Step 3: Smoke test** — PASÓ (`T4_OK_ROLLBACK`; empleado edita inventario, no ve costos, no escribe proveedores).

- [x] **Step 4: Commit** — `e944c3e`
```bash
git add supabase/migrations/
git commit -m "feat(db): RLS inventario editable por staff; proveedores admin+dueño"
```

---

## Task 5: Migración — RLS compras, documentos y gastos

**Files:** Create `supabase/migrations/<ts>_sp1_rls_compras_gastos.sql`

- [x] **Step 1: Escribir la migración** con EXACTAMENTE:
```sql
-- SP-1 RLS: compras (recepción staff, finanzas admin+dueño) y gastos.

-- compras
drop policy if exists compras_select on public.compras;
drop policy if exists compras_insert on public.compras;
drop policy if exists compras_update_owner on public.compras;
drop policy if exists compras_delete_owner on public.compras;
create policy compras_select on public.compras for select to authenticated
  using ((select private.is_staff_admin())
    or (registrada_por = (select auth.uid()) and estado = 'pendiente_revision'));
create policy compras_insert on public.compras for insert to authenticated
  with check ((select private.is_staff_admin())
    or ((select private.is_employee()) and estado = 'pendiente_revision'
        and registrada_por = (select auth.uid())
        and total is null and condicion_pago is null
        and monto_pagado = 0 and saldo_pendiente = 0));
create policy compras_update on public.compras for update to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));
create policy compras_delete on public.compras for delete to authenticated
  using ((select private.is_staff_admin()));

-- compra_items
drop policy if exists compra_items_select on public.compra_items;
drop policy if exists compra_items_insert on public.compra_items;
drop policy if exists compra_items_update_owner on public.compra_items;
drop policy if exists compra_items_delete_owner on public.compra_items;
create policy compra_items_select on public.compra_items for select to authenticated
  using ((select private.is_staff_admin())
    or exists (select 1 from public.compras c where c.id = compra_id
      and c.registrada_por = (select auth.uid()) and c.estado = 'pendiente_revision'));
create policy compra_items_insert on public.compra_items for insert to authenticated
  with check ((select private.is_staff_admin())
    or ((select private.is_employee()) and costo_unitario is null and subtotal is null
      and exists (select 1 from public.compras c where c.id = compra_id
        and c.registrada_por = (select auth.uid()) and c.estado = 'pendiente_revision')));
create policy compra_items_update on public.compra_items for update to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));
create policy compra_items_delete on public.compra_items for delete to authenticated
  using ((select private.is_staff_admin()));

-- compra_documentos: admin+dueño
drop policy if exists compra_docs_owner on public.compra_documentos;
create policy compra_docs_admin on public.compra_documentos for all to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));

-- gastos_fijos / pagos: admin+dueño
drop policy if exists gastos_fijos_owner on public.gastos_fijos;
drop policy if exists gastos_fijos_pagos_owner on public.gastos_fijos_pagos;
create policy gastos_fijos_admin on public.gastos_fijos for all to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));
create policy gastos_fijos_pagos_admin on public.gastos_fijos_pagos for all to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));

-- gastos_variables: cualquier staff registra (ve lo suyo); admin+dueño gestionan todo
drop policy if exists gastos_variables_owner on public.gastos_variables;
create policy gastos_var_select on public.gastos_variables for select to authenticated
  using ((select private.is_staff_admin()) or created_by = (select auth.uid()));
create policy gastos_var_insert on public.gastos_variables for insert to authenticated
  with check ((select private.is_staff_admin()) or created_by = (select auth.uid()));
create policy gastos_var_update on public.gastos_variables for update to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));
create policy gastos_var_delete on public.gastos_variables for delete to authenticated
  using ((select private.is_staff_admin()));
```

- [x] **Step 2: Aplicar** vía MCP `supabase.apply_migration` (`name: "sp1_rls_compras_gastos"`). Expected: sin error.

- [ ] **Step 3: Smoke test** vía MCP `supabase.execute_sql`:
```sql
do $$
declare v_emp uuid; v_admin uuid;
begin
  select id into v_emp from public.users where rol = 'empleado' limit 1;
  -- admin de prueba temporal
  v_admin := gen_random_uuid();
  insert into public.users (id, nombre, rol) values (v_admin, 'TEST ADMIN', 'admin');

  -- empleado: registra gasto variable (ve lo suyo) pero NO gastos fijos
  perform set_config('request.jwt.claims', json_build_object('sub', v_emp, 'role','authenticated')::text, true);
  set local role authenticated;
  insert into public.gastos_variables (descripcion, monto, categoria) values ('flete emp', 1000, 'transporte');
  begin
    insert into public.gastos_fijos (nombre, monto_aproximado) values ('arriendo', 1000);
    raise exception 'FALLO: empleado insertó gasto fijo';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- admin: SÍ gestiona gastos fijos
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  set local role authenticated;
  insert into public.gastos_fijos (nombre, monto_aproximado) values ('arriendo admin', 1000);
  reset role;

  raise exception 'T5_OK_ROLLBACK';
end $$;
```
Expected: termina con `T5_OK_ROLLBACK`.

> **Notas de ejecución (correcciones al smoke test, no a la migración):** (1) el bloque crea un admin sintético vía `gen_random_uuid()` → hay que sembrar una fila en `auth.users` antes del insert en `public.users` (FK). (2) `categoria` corregida `'Transporte'` → `'transporte'` (CHECK `gastos_variables_categoria_check` solo acepta minúsculas: transporte/reparaciones/insumos/otros). Con ambos arreglos → `T5_OK_ROLLBACK`.

- [x] **Step 3: Smoke test** — PASÓ (`T5_OK_ROLLBACK`; empleado registra su gasto variable y NO gasto fijo; admin SÍ gestiona gasto fijo).

- [x] **Step 4: Commit** — `0e9d560`
```bash
git add supabase/migrations/
git commit -m "feat(db): RLS compras y gastos por nivel administrativo"
```

---

## Task 6: Migración — RLS ventas, pagos, caja y users

**Files:** Create `supabase/migrations/<ts>_sp1_rls_ventas_caja_users.sql`

- [x] **Step 1: Escribir la migración** con EXACTAMENTE:
```sql
-- SP-1 RLS: ventas/items/pagos y caja suman admin; users ve lista para admin.

-- ventas: admin ve todo; empleado hoy + separadas
drop policy if exists ventas_select on public.ventas;
drop policy if exists ventas_insert on public.ventas;
drop policy if exists ventas_update on public.ventas;
create policy ventas_select on public.ventas for select to authenticated
  using ((select private.is_staff_admin())
    or estado = 'separada'
    or (created_at at time zone 'America/Bogota')::date = private.hoy_bogota());
create policy ventas_insert on public.ventas for insert to authenticated
  with check ((select private.is_staff_admin()) or vendedor_id = (select auth.uid()));
create policy ventas_update on public.ventas for update to authenticated
  using ((select private.is_staff_admin())
    or ((select private.is_employee())
        and (estado = 'separada'
             or (created_at at time zone 'America/Bogota')::date = private.hoy_bogota())))
  with check ((select private.is_staff_admin())
    or ((select private.is_employee()) and corregida = false));

-- venta_items: SELECT suma admin; INSERT igual con is_staff_admin; UPDATE/DELETE quedan solo dueño
drop policy if exists venta_items_select on public.venta_items;
drop policy if exists venta_items_insert on public.venta_items;
create policy venta_items_select on public.venta_items for select to authenticated
  using ((select private.is_staff_admin())
    or exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada'
           or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota())));
create policy venta_items_insert on public.venta_items for insert to authenticated
  with check ((select private.is_staff_admin())
    or exists (select 1 from public.ventas v where v.id = venta_id
      and v.vendedor_id = (select auth.uid())
      and (v.estado = 'separada'
           or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota())));

-- metodos_pago_venta: SELECT/INSERT suman admin; UPDATE/DELETE quedan solo dueño
drop policy if exists metodos_pago_select on public.metodos_pago_venta;
drop policy if exists metodos_pago_insert on public.metodos_pago_venta;
create policy metodos_pago_select on public.metodos_pago_venta for select to authenticated
  using ((select private.is_staff_admin())
    or exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada'
           or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota())));
create policy metodos_pago_insert on public.metodos_pago_venta for insert to authenticated
  with check ((select private.is_staff_admin())
    or exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada'
           or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota())));

-- cierres_caja: admin ve histórico; todos abren/cierran y ven hoy
drop policy if exists cierres_select on public.cierres_caja;
drop policy if exists cierres_insert on public.cierres_caja;
drop policy if exists cierres_update on public.cierres_caja;
drop policy if exists cierres_delete_owner on public.cierres_caja;
create policy cierres_select on public.cierres_caja for select to authenticated
  using ((select private.is_staff_admin()) or fecha = private.hoy_bogota());
create policy cierres_insert on public.cierres_caja for insert to authenticated
  with check ((select private.is_staff_admin()) or fecha = private.hoy_bogota());
create policy cierres_update on public.cierres_caja for update to authenticated
  using ((select private.is_staff_admin()) or fecha = private.hoy_bogota())
  with check ((select private.is_staff_admin()) or fecha = private.hoy_bogota());
create policy cierres_delete on public.cierres_caja for delete to authenticated
  using ((select private.is_staff_admin()));

-- users: cada quien se ve; admin+dueño ven la lista. Escritura sigue solo dueño.
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff_admin()));
```

- [x] **Step 2: Aplicar** vía MCP `supabase.apply_migration` (`name: "sp1_rls_ventas_caja_users"`). Expected: sin error.

- [ ] **Step 3: Smoke test** vía MCP `supabase.execute_sql`:
```sql
do $$
declare v_admin uuid; v_emp uuid; v_old uuid; v_count int;
begin
  select id into v_emp from public.users where rol = 'empleado' limit 1;
  v_admin := gen_random_uuid();
  insert into public.users (id, nombre, rol) values (v_admin, 'TEST ADMIN', 'admin');

  -- venta de AYER por el empleado (para probar visibilidad histórica)
  insert into public.ventas (vendedor_id, total, estado, created_at)
    values (v_emp, 5000, 'completada', now() - interval '2 days') returning id into v_old;

  -- empleado NO ve la venta vieja
  perform set_config('request.jwt.claims', json_build_object('sub', v_emp, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_count from public.ventas where id = v_old;
  if v_count <> 0 then raise exception 'FALLO: empleado vio venta histórica'; end if;
  reset role;

  -- admin SÍ ve la venta vieja
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_count from public.ventas where id = v_old;
  if v_count <> 1 then raise exception 'FALLO: admin no vio venta histórica'; end if;
  reset role;

  raise exception 'T6_OK_ROLLBACK';
end $$;
```
Expected: termina con `T6_OK_ROLLBACK`.

> **Nota de ejecución:** sembrar `auth.users` para el admin sintético (FK), como en T1/T5. La venta usa `numero` (columna identity `GENERATED ALWAYS`, auto), `estado='completada'` válido. Con el seed FK → `T6_OK_ROLLBACK`.

- [x] **Step 3: Smoke test** — PASÓ (`T6_OK_ROLLBACK`; empleado NO ve venta de hace 2 días, admin SÍ).

- [x] **Step 4: Commit** — `fa722c0`
```bash
git add supabase/migrations/
git commit -m "feat(db): RLS ventas/caja/users con nivel admin"
```

---

## Task 7: Seed de Sandra (admin) + picker

**Files:** Create `supabase/seeds/sandra_admin.sql`; Modify `lib/usuarios.ts`

- [ ] **Step 1: Escribir el seed** `supabase/seeds/sandra_admin.sql` con EXACTAMENTE (idempotente; PIN temporal `4321` a cambiar al primer ingreso):
```sql
-- Seed Sandra Cardona como admin. Idempotente. Mismo patrón usado para los otros usuarios.
-- auth.identities.email es columna generada: NO insertarla.
do $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'sandracardona.venus2026@gmail.com';
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) values (
      v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'sandracardona.venus2026@gmail.com', extensions.crypt('4321', extensions.gen_salt('bf')),
      now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
    );
    insert into auth.identities (
      id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at
    ) values (
      gen_random_uuid(), v_uid, 'email', v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', 'sandracardona.venus2026@gmail.com', 'email_verified', true),
      now(), now(), now()
    );
  end if;
  insert into public.users (id, nombre, rol, email, activo)
    values (v_uid, 'Sandra Cardona', 'admin', 'sandracardona.venus2026@gmail.com', true)
    on conflict (id) do update set rol = 'admin', activo = true, nombre = 'Sandra Cardona';
end $$;
```
> Nota para quien ejecute: confirmar que las columnas de `auth.users`/`auth.identities` coinciden con cómo se sembraron los usuarios existentes (mismo proyecto, misma versión de GoTrue). Si la inserción en `auth.users` falla por una columna requerida adicional, replicar exactamente el INSERT que funcionó para Camilo/Beatriz.

- [ ] **Step 2: Aplicar el seed** vía MCP `supabase.execute_sql` (`project_id: "xqspsaghukeynlizbjvc"`) con el contenido del seed. Expected: sin error.

- [ ] **Step 3: Verificar**
```sql
select u.nombre, u.rol, u.activo, (a.id is not null) as tiene_auth
from public.users u
left join auth.users a on a.id = u.id
where u.email = 'sandracardona.venus2026@gmail.com';
```
Expected: una fila `Sandra Cardona | admin | true | true`.

- [ ] **Step 4: Agregar Sandra al picker** — en `lib/usuarios.ts`, reemplazar el arreglo `USUARIOS` por:
```ts
export const USUARIOS: UsuarioPicker[] = [
  { nombre: 'Andrés Artunduaga', email: 'venusdelcaqueta@gmail.com' },
  { nombre: 'Sandra Cardona',    email: 'sandracardona.venus2026@gmail.com' },
  { nombre: 'Camilo Artunduaga', email: 'artuneleven1@gmail.com' },
  { nombre: 'Beatriz Bueno',     email: 'beatrizbueno1979@gmail.com' },
]
```

- [ ] **Step 5: Typecheck y commit**
Run: `npx tsc --noEmit` (Expected: sin errores)
```bash
git add supabase/seeds/sandra_admin.sql lib/usuarios.ts
git commit -m "feat: seed de Sandra como admin y picker actualizado"
```

---

## Task 8: Regenerar `lib/database.types.ts`

**Files:** Modify `lib/database.types.ts`

- [ ] **Step 1: Generar tipos** con MCP `supabase.generate_typescript_types` (`project_id: "xqspsaghukeynlizbjvc"`) y sobrescribir `lib/database.types.ts` con el resultado completo.

- [ ] **Step 2: Verificar columnas de auditoría**
Run: `grep -n "created_by\|updated_by" lib/database.types.ts | head`
Expected: aparecen `created_by`/`updated_by` en varias tablas (p. ej. `productos_calzado`, `ventas`).

- [ ] **Step 3: Typecheck**
Run: `npx tsc --noEmit`
Expected: sin errores. (Las consultas existentes en `lib/ventas.ts` no seleccionan las columnas nuevas, así que no se rompen.)

- [ ] **Step 4: Commit**
```bash
git add lib/database.types.ts
git commit -m "chore(types): regenerar tras roles y auditoría SP-1"
```

---

## Task 9: Verificación final

**Files:** ninguno (verificación).

- [ ] **Step 1: Suite completa**
Run: `npx tsc --noEmit && npm test`
Expected: tsc limpio; todos los tests pasan (`carrito` + `permisos`).

- [ ] **Step 2: Recap RLS por rol** vía MCP `supabase.execute_sql` (sanidad combinada):
```sql
do $$
declare v_admin uuid; v_emp uuid; v_pid uuid;
begin
  select id into v_emp from public.users where rol='empleado' limit 1;
  select id into v_admin from public.users where rol='admin' limit 1;
  if v_admin is null then raise exception 'FALLO: no existe usuario admin (seed Sandra pendiente)'; end if;

  -- admin edita inventario pero NO ve costos
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  set local role authenticated;
  insert into public.productos_varios (nombre, unidad_medida, precio_venta, stock_actual)
    values ('CHK ADMIN','unidad',1000,1) returning id into v_pid;
  if exists (select 1 from public.historial_precios_varios) then
    raise exception 'FALLO: admin vio costos';
  end if;
  reset role;

  raise exception 'T9_OK_ROLLBACK';
end $$;
```
Expected: termina con `T9_OK_ROLLBACK`.

- [ ] **Step 3: Verificación manual en Expo Go (opcional)**
Login como Sandra (`sandracardona.venus2026@gmail.com`, PIN `4321`) → debe ver 11 tiles (incluye proveedores y gastos fijos, NO balance ni empleados). Login como Camilo → 7 tiles operativos (incluye Devoluciones, que abre el placeholder "En construcción").

- [ ] **Step 4: Solicitar code review** del branch (skill `requesting-code-review`) y decidir merge a `main` con el usuario.

---

## Cierre
- [ ] Todos los tasks completos; `tsc` y `npm test` verdes; smoke tests RLS en verde.
- [ ] SP-1 mergeado. Continúa **SP-2** (Granja sin stock + precio mín/máx) con su propio spec → plan.
