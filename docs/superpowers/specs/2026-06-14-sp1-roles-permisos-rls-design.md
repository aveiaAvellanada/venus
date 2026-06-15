# Diseño — SP-1: Fundación de roles, permisos, RLS y auditoría

Fecha: 2026-06-14
Estado: Aprobado
Parte de: Alineación con `docs/Venus_PRD_v4.0.md` (sub-proyecto 1 de 3). Siguientes: SP-2 (Granja sin stock + precio mín/máx) y SP-3 (detalle de venta + Devoluciones).

## 1. Objetivo y alcance

Llevar el modelo de roles, permisos, RLS y la auditoría base del código ya construido (auth + Nueva Venta) al modelo de v4.0: tres niveles de rol, matriz de permisos correcta, RLS reescrito y columnas de auditoría `created_by`/`updated_by`. Es la fundación de la que dependen SP-2 y SP-3.

### Dentro del alcance
- Tercer rol `admin` (Sandra, "administrativa") en datos, helpers y app.
- Matriz de permisos v4.0 en `lib/permisos.ts` (con renombres Granja/Caja y tile de Devoluciones).
- Reescritura de políticas RLS según la matriz.
- Auditoría base: columnas `created_by`/`updated_by` + trigger que las llena desde `auth.uid()`.
- Seed de Sandra (`rol='admin'`) vía SQL directo.

### Fuera del alcance (sub-proyectos posteriores)
- Log completo de auditoría con diffs + pantalla "historial por empleado" (sub-proyecto dedicado).
- Granja sin stock y precio en venta; precio mín/máx + regateo en calzado (**SP-2**).
- Pantalla de detalle de venta y módulo **Devoluciones** funcional (**SP-3**) — en SP-1 solo se agrega el *tile* placeholder.
- Seed de Nikol (sin email todavía).

## 2. Decisiones (aprobadas)

| Tema | Decisión |
|---|---|
| Modelo de rol | Tres roles discretos: `dueno` / `admin` / `empleado`. |
| Auditoría en SP-1 | Base: `created_by`/`updated_by` automáticos. Log completo después. |
| Seed | Sandra ahora como `admin` (PIN temporal); Nikol después. |
| Devoluciones | Agregar el tile al home ya (ruta al placeholder hasta SP-3). |

## 3. Modelo de roles

- Migración: `alter table public.users drop constraint` del check actual de `rol` y recrear `check (rol in ('dueno','admin','empleado'))`.
- Nuevos helpers en esquema `private` (SQL, estable, como los existentes):
  - `private.is_admin()` → `user_role() = 'admin'`.
  - `private.is_staff_admin()` → `user_role() in ('dueno','admin')` (nivel administrativo: dueño o admin).
  - Se conservan `is_owner()`, `is_employee()`, `user_role()`, `hoy_bogota()`.
  - `grant execute` a `authenticated` y `service_role`.
- `lib/permisos.ts`: `export type Rol = 'dueno' | 'admin' | 'empleado'`.
- `lib/auth.tsx`: `Perfil.rol` ya tipa `Rol`; el cast en `fetchPerfil` sigue válido (un rol fuera de dominio degrada a sin-acceso, fail-closed).

## 4. Permisos en la app

Matriz v4.0 (rol → módulos), reflejada en `MODULOS` de `lib/permisos.ts`:

| Módulo (id) | dueno | admin | empleado |
|---|---|---|---|
| ventas | ✅ | ✅ | ✅ |
| devoluciones | ✅ | ✅ | ✅ |
| inventario-calzado | ✅ | ✅ | ✅ |
| granja (ex inventario-varios) | ✅ | ✅ | ✅ |
| recibir-mercancia | ✅ | ✅ | ✅ |
| caja (ex cierre-caja) | ✅ | ✅ | ✅ |
| gastos-variables | ✅ | ✅ | ✅ |
| proveedores | ✅ | ✅ | ❌ |
| gastos-fijos | ✅ | ✅ | ❌ |
| reportes | ✅ | ✅ | ❌ |
| gestion-empleado | ✅ | ❌ | ❌ |
| balance | ✅ | ❌ | ❌ |
| analisis-ia | ✅ | ❌ | ❌ |
| carga-inicial | ✅ | ✅ | ❌ |

Cambios concretos:
- `type Rol` agrega `'admin'`.
- Renombrar `id` y/o título: `inventario-varios` → **`granja`** (título "Granja"); `cierre-caja` → **`caja`** (título "Caja"). (Nota: cambiar el `id` afecta la ruta del placeholder `/modulo/<id>`; aceptable porque esos módulos aún son placeholder.)
- Agregar módulo **`devoluciones`** (título "Devoluciones", icono ↩️, roles `dueno,admin,empleado`, sin `ruta` → usa el placeholder `/modulo/devoluciones`).
- Actualizar los `roles` de cada módulo a la tabla de arriba.
- `lib/permisos.test.ts`: casos para los tres roles (operativo ve los 7 módulos operativos; admin ve 11; dueño ve los 14; financieros solo dueño; admin no ve balance/gestion-empleado/analisis-ia).

## 5. Reescritura de RLS

Una o varias migraciones que hacen `drop policy ... ; create policy ...` por su nombre actual. Reglas nuevas por grupo (todas `to authenticated`):

**Inventario — escritura abierta al staff:**
- `productos_calzado` / `productos_varios`: SELECT `true` (sin cambio); INSERT/UPDATE `with check (true)` / `using (true)` (cualquier staff edita); DELETE → `private.is_staff_admin()` (borrar producto se reserva a admin/dueño; los agotados se desactivan con `activo`, no se borran).

**Costos — solo dueño (sin cambio):**
- `historial_precios_calzado` / `historial_precios_varios`: `is_owner()`.

**Proveedores — admin + dueño (lectura abierta para recepción):**
- `proveedores`: SELECT `true` (operativos eligen proveedor al recibir mercancía); INSERT/UPDATE/DELETE → `is_staff_admin()`.
- `proveedor_cuentas_bancarias`: todo → `is_staff_admin()`.

**Compras / documentos — recepción por staff, finanzas admin + dueño:**
- `compras` SELECT: `is_staff_admin() or (registrada_por = auth.uid() and estado='pendiente_revision')`.
- `compras` INSERT: `is_staff_admin() or (is_employee() and estado='pendiente_revision' and registrada_por=auth.uid() and total is null and condicion_pago is null and monto_pagado=0 and saldo_pendiente=0)`.
- `compras` UPDATE/DELETE → `is_staff_admin()`.
- `compra_items` análogo (admin reemplaza a owner en review; empleado inserta sin costos).
- `compra_documentos` → `is_staff_admin()`.

**Gastos:**
- `gastos_fijos` / `gastos_fijos_pagos`: todo → `is_staff_admin()`.
- `gastos_variables` (dividir la policy `for all` en cuatro): SELECT `is_staff_admin() or created_by = auth.uid()`; INSERT `with check (is_staff_admin() or created_by = auth.uid())` (cualquier staff registra; el trigger setea `created_by`); UPDATE/DELETE → `is_staff_admin()`. (Requiere `created_by`, de §6.)

**Caja:**
- `cierres_caja`: SELECT/INSERT/UPDATE → `is_staff_admin() or fecha = private.hoy_bogota()` (todos abren/cierran y ven hoy; admin/dueño ven histórico); DELETE → `is_staff_admin()`.

**Ventas — admin ve todo:**
- `ventas` SELECT: `is_staff_admin() or estado='separada' or (created_at at time zone 'America/Bogota')::date = private.hoy_bogota()`.
- `ventas` INSERT: `is_staff_admin() or vendedor_id = auth.uid()`.
- `ventas` UPDATE: USING `is_staff_admin() or (is_employee() and (estado='separada' or hoy))`; WITH CHECK `is_staff_admin() or (is_employee() and corregida=false)`.
- `venta_items` / `metodos_pago_venta`: SELECT agrega `is_staff_admin()` a la herencia por venta; INSERT igual que hoy pero con `is_staff_admin()` en vez de `is_owner()`; UPDATE/DELETE permanecen **solo dueño** (corrección de líneas es sensible; se conserva conservador).

**Usuarios:**
- `users` SELECT: `id = auth.uid() or is_staff_admin()` (admin/dueño ven la lista; operativo se ve a sí mismo). INSERT/UPDATE/DELETE permanecen **solo dueño** (gestión de empleados).

Las tablas no mencionadas (`clima_registro`, `empleado_config`, `empleado_dias_trabajados`, `empleado_pagos`) permanecen **solo dueño** (sin cambio).

## 6. Auditoría base

- Agregar `created_by uuid references public.users(id)` y `updated_by uuid references public.users(id)` (ambos nullable) a: `productos_calzado`, `productos_varios`, `proveedores`, `proveedor_cuentas_bancarias`, `compras`, `compra_items`, `gastos_fijos`, `gastos_fijos_pagos`, `gastos_variables`, `cierres_caja`, `ventas`, `venta_items`, `metodos_pago_venta`.
- Trigger `private.set_audit_fields()`: en `INSERT` setea `new.created_by = auth.uid()` (si no viene); en `UPDATE` setea `new.updated_by = auth.uid()`. Se aplica `before insert or update` vía bucle `DO` sobre la lista de tablas (igual patrón que `set_updated_at`).
- El BEFORE trigger corre antes del WITH CHECK de RLS, así que `created_by` ya está disponible para la policy de `gastos_variables`.

## 7. Seed de Sandra

- Crear `sandracardona.venus2026@gmail.com` en `auth.users` + `auth.identities` (password bcrypt vía `extensions.crypt`, PIN temporal compartido a cambiar al primer ingreso; `auth.identities.email` es columna generada — no insertar). Fila en `public.users` con `nombre='Sandra Cardona'`, `rol='admin'`, `activo=true`.
- `lib/usuarios.ts`: agregar a Sandra al picker hardcodeado.

## 8. Impacto en lo ya construido

- Home grid: empleados verán más tiles (correcto por la matriz). Nueva Venta sigue operando (gating `useRequireModulo('ventas')` incluye empleado).
- La RPC `registrar_venta` no cambia en SP-1; los nuevos `created_by` en `ventas`/`venta_items`/`metodos_pago_venta` los setea el trigger (la RPC ya corre como `SECURITY DEFINER`; `auth.uid()` sigue disponible).
- `lib/database.types.ts` se regenera tras las migraciones (nuevas columnas; `rol` sigue `string`).

## 9. Testing
- `lib/permisos.test.ts`: matriz de los 3 roles (conteos por rol; financieros solo dueño; admin sin balance/gestion-empleado/analisis-ia; devoluciones visible a los 3).
- RLS smoke tests SQL (vía MCP, con `set_config('request.jwt.claims', ...)` por rol, en bloques `DO` que revierten con centinela):
  - empleado: edita `productos_calzado`; NO ve `historial_precios_calzado`; NO escribe `proveedores`; inserta `gastos_variables`.
  - admin: edita inventario; gestiona `proveedores` y `gastos_fijos`; ve `ventas` de cualquier día; NO ve `historial_precios` (costos); NO escribe `empleado_*`.
  - dueño: todo.
  - auditoría: un insert setea `created_by = auth.uid()`.
- `npx tsc --noEmit` y `npm test` verdes.

## 10. Archivos
- `supabase/migrations/<ts>_sp1_roles_helpers.sql` (constraint + helpers)
- `supabase/migrations/<ts>_sp1_auditoria.sql` (columnas + trigger)
- `supabase/migrations/<ts>_sp1_rls_inventario_proveedores.sql`
- `supabase/migrations/<ts>_sp1_rls_compras_gastos.sql`
- `supabase/migrations/<ts>_sp1_rls_ventas_caja_users.sql`
- `supabase/seeds/sandra_admin.sql` (seed, aplicado manualmente)
- `lib/permisos.ts` + `lib/permisos.test.ts`
- `lib/usuarios.ts`
- `lib/database.types.ts` (regenerado)
