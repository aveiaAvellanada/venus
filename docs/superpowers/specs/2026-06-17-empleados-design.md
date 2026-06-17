# Especificación de Diseño: Gestión de Empleados (M8)

> Diseño aprobado el 2026-06-17. **Solo Andrés (dueño).** Las tablas `empleado_config`,
> `empleado_dias_trabajados` y `empleado_pagos` ya existen en el remoto con RLS `ALL`
> owner-only (`private.is_owner()`); este módulo NO las recrea.

## 1. Introducción y Objetivos

**Gestión de Empleados (M8)** permite a Andrés administrar a los empleados ya
provisionados del negocio: configurar sueldo, activar/desactivar, ver días trabajados
del mes y registrar pagos de sueldo con su historial. Todo auditado.

### Alcance v1 y diferido
- **v1 (este spec):** gestionar empleados **existentes** (cuentas Auth ya creadas).
- **Diferido a fast-follow (M8.2):** crear la cuenta Auth de un empleado **desde la
  app** (PRD §3.8.1). Requiere una Edge Function con `service_role` (infra aún no usada
  en el proyecto) y volver dinámico el selector de login (`lib/usuarios.ts` hoy es fijo).
  Se hará cuando se justifique esa infra (M13 también la necesita). Mientras tanto, las
  cuentas se provisionan manualmente (como hoy).

### Roles y Permisos
- **Solo el dueño (Andrés).** El módulo ya existe en `lib/permisos.ts` como
  `gestion-empleado` con `roles: SOLO_DUENO`. La RLS de las 3 tablas ya es owner-only.
- "Empleados del negocio" = todos los usuarios **excepto el dueño** (es decir, `rol` en
  `('admin','empleado')`; incluye a Sandra, que también recibe sueldo).
- La seguridad real es **RLS**: solo el dueño lee/escribe `empleado_*` y `users`
  (UPDATE/INSERT). Desactivar (`users.activo=false`) **bloquea el login**
  (`lib/auth.tsx` ya rechaza perfiles inactivos).

---

## 2. Reglas de negocio

### 2.1 Días trabajados
Un día cuenta como **trabajado** si, en zona horaria `America/Bogota`, el empleado
registró ≥1 venta (`ventas.created_by`) **o** ≥1 cierre de caja
(`cierres_caja.created_by`/`cerrado_por`) ese día. Andrés puede **ajustar manualmente**
vía `empleado_dias_trabajados` (la tabla restringe `tipo` a `('trabajado','ausencia','adicional')`):
- `tipo='trabajado'` o `'adicional'` (manual) **suma** un día que la actividad no detectó.
- `tipo='ausencia'` **resta** un día (situación especial).

Días del mes = `distinct(fechas de actividad ∪ manuales 'trabajado'/'adicional') − fechas 'ausencia'`.

### 2.2 Cálculo del pago (proporcional por días)
- `diasEsperadosMes(diasTrabajoSemana, anio, mes)` = `round(diasTrabajoSemana × díasDelMes / 7)`.
  Si `diasTrabajoSemana` es nulo, se asume 6.
- `montoSugeridoPago(sueldoMensual, diasTrabajados, diasEsperados)` =
  `diasEsperados > 0 ? round(sueldoMensual × min(diasTrabajados, diasEsperados) / diasEsperados) : sueldoMensual`.
  (Se topa en el sueldo mensual; trabajar días extra no paga de más.)
- El monto sugerido es **solo una guía**: Andrés confirma o ajusta el monto antes de registrar.

### 2.3 Auditoría
`empleado_pagos` y `empleado_dias_trabajados` registran `registrado_por` fijado de forma
**inviolable** desde `auth.uid()` por trigger en INSERT (hoy solo tienen trigger de
`updated_at`).

---

## 3. Capa de Base de Datos (migración mínima)

Migración nueva (timestamp creciente). **No** recrea las tablas existentes. Contiene:

### 3.1 Triggers de auditoría de `registrado_por`
Función `private.set_registrado_por()` (SECURITY DEFINER): en INSERT fija
`new.registrado_por := auth.uid()` (ignora lo que mande el cliente). Triggers
`BEFORE INSERT` en `empleado_pagos` y `empleado_dias_trabajados`.

### 3.2 RPC `obtener_dias_trabajados`
```
obtener_dias_trabajados(p_empleado_id uuid, p_anio int, p_mes int) returns int
```
`SECURITY DEFINER`, `set search_path=''`, gateado a dueño (`if not private.is_owner() then raise`).
Cuenta las fechas distintas (zona Bogotá) del mes `p_anio/p_mes` que cumplen la regla
2.1 (ventas ∪ cierres ∪ manuales 'trabajado', menos 'ausente'). `grant execute` a
`authenticated` (el cuerpo gatea al dueño). Smoke test SQL con centinela `*_OK_ROLLBACK`.

> No se necesita RPC para registrar el pago ni la config: el dueño escribe directo a las
> tablas vía RLS owner-only. La auditoría la garantiza el trigger 3.1.

---

## 4. Capa de acceso a datos (`lib/empleados.ts`)

- **Lógica pura** (con `lib/empleados.test.ts`, jest TDD):
  - `diasEsperadosMes(diasTrabajoSemana, anio, mes): number`
  - `montoSugeridoPago(sueldoMensual, diasTrabajados, diasEsperados): number`
- **Acceso a datos:**
  - `listarEmpleados()` → usuarios con `rol in ('admin','empleado')` + su `empleado_config` (left join).
  - `obtenerEmpleado(empleadoId)` → datos del usuario + config + días del mes actual.
  - `guardarConfigEmpleado(empleadoId, {sueldo_mensual, fecha_inicio, dias_trabajo_semana})` → upsert en `empleado_config`.
  - `setActivoEmpleado(empleadoId, activo)` → update `users.activo` (bloquea/permite login) y espeja `empleado_config.activo`.
  - `actualizarNombreEmpleado(empleadoId, nombre)` → update `users.nombre`.
  - `diasTrabajadosMes(empleadoId, anio, mes)` → invoca RPC `obtener_dias_trabajados`.
  - `registrarPagoEmpleado({empleado_id, monto, fecha_pago, periodo_inicio, periodo_fin, dias_trabajados, nota})` → insert `empleado_pagos`.
  - `historialPagos(empleadoId)` → lista de `empleado_pagos` desc por fecha.
- Tras la migración, **regenerar `lib/database.types.ts`** vía MCP.

---

## 5. Interfaz de Usuario (`app/(app)/empleados/`)

Añadir `ruta: '/empleados'` al módulo `gestion-empleado` en `lib/permisos.ts`.

```
/app/(app)/empleados/
  ├── _layout.tsx   <-- Stack + useRequireModulo('gestion-empleado')  (solo dueño)
  ├── index.tsx     <-- Lista de empleados
  └── [id].tsx      <-- Detalle: editar, activar/desactivar, días, pagos
```

### 5.1 `index.tsx`
Lista de empleados con: nombre, rol, estado (Activo/Inactivo), sueldo mensual y días
trabajados del mes actual. Toca un empleado → `[id]`.

### 5.2 `[id].tsx`
- **Datos:** editar nombre y sueldo mensual (y `dias_trabajo_semana`, `fecha_inicio`);
  guardar con `guardarConfigEmpleado`/`actualizarNombreEmpleado`.
- **Estado:** botón Activar/Desactivar (`setActivoEmpleado`), con aviso de que desactivar
  impide el login.
- **Días del mes:** muestra los días trabajados (RPC).
- **Registrar pago:** muestra el monto sugerido (`montoSugeridoPago` con los días del RPC
  y `diasEsperadosMes`), editable; al confirmar llama `registrarPagoEmpleado`.
- **Historial de pagos:** lista (fecha, monto, período, días).
- Todo en **español**; estilo consistente con las pantallas existentes (p. ej.
  `recibir-mercancia`).

---

## 6. Estrategia de Pruebas
1. **Smoke SQL** (vía MCP) del RPC `obtener_dias_trabajados` y de los triggers de
   `registrado_por`, en transacción con `rollback` + centinela `*_OK_ROLLBACK`
   (sembrar `auth.users` antes de `public.users`; simular `auth.uid()` como en los smoke
   existentes).
2. **Jest lógica pura** `lib/empleados.test.ts`: `diasEsperadosMes` y `montoSugeridoPago`
   (proporcional, tope en sueldo, días esperados 0).
3. **Jest UI** `lib/empleados_ui.test.tsx`: gating dueño-only (un `empleado`/`admin` NO
   accede); que registrar pago invoque `registrarPagoEmpleado` con el payload correcto;
   que desactivar invoque `setActivoEmpleado`.
4. **Regresión:** `npx tsc --noEmit` 0 · `npm test` verde.

---

## 7. Fuera de alcance (M8 v1)
- Crear cuenta Auth desde la app (fast-follow M8.2 con Edge Function).
- Nómina electrónica / prestaciones de ley.
- Reportes de costo laboral (vive en Balance M11 / Reportes M12).
