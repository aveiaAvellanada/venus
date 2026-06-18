# Especificación de Diseño: Reportes y Dashboard (M12) — v1 Dashboard

> Diseño aprobado el 2026-06-17. Módulo `reportes` (Andrés + Sandra; operativos no acceden).
> **Alcance v1: solo el Dashboard del día.** Reportes semanal/mensual = iteración 2 (fuera de alcance).
> El módulo `reportes` ya existe en `lib/permisos.ts` con `roles: STAFF_ADMIN` (falta `ruta`).

## 1. Introducción y Objetivos

**Dashboard (M12 v1)** da a Andrés y Sandra un vistazo del estado del negocio "hoy"
en una sola pantalla (`/reportes`): cuánto se ha vendido, comparado con ayer, y las
alertas que requieren acción. Es **solo lectura**. Los widgets financieros y de
gestión (deuda de proveedores, actividad de empleados) son **exclusivos del dueño**,
por la regla de AGENTS.md (§1: solo Andrés ve deudas con proveedores y datos de
empleados).

## 2. Reglas de negocio

### 2.1 Contenido por rol

**Ambos (Andrés + Sandra):**
- **Ventas de hoy:** total vendido, número de ventas, desglose efectivo / Nequi / Daviplata.
- **Comparación con ayer:** flecha ↑/↓ y porcentaje de variación del total vendido.
- **Stock bajo:** productos de calzado activos con `stock_actual <= stock_minimo`
  (lista con descripción/talla y el stock actual).

**Solo Andrés (widgets financieros / de gestión):**
- **Proveedores con pago por vencer:** compras a crédito (`condicion_pago = 'credito'`)
  con `saldo_pendiente > 0` y `fecha_vencimiento` dentro de los próximos **7 días o ya
  vencidas**. Muestra proveedor, fecha de vencimiento y saldo. Ordenadas por
  vencimiento ascendente (las vencidas primero).
- **Empleados sin actividad hoy:** empleados con `empleado_config.activo = true` que
  NO tienen ninguna actividad registrada hoy (venta, cierre de caja, o registro manual
  de día trabajado), en zona `America/Bogota`.

### 2.2 Atribución temporal
- "Hoy" y "ayer" se interpretan en `America/Bogota` (consistente con `obtener_resumen_dia`
  y el resto del sistema).
- La comparación con ayer usa el **total vendido** (no el neto de devoluciones; coincide
  con `total_general` de `obtener_resumen_dia`, que ya netea devoluciones por fecha de venta).

### 2.3 Permisos
- Pantalla gateada al módulo `reportes` (`STAFF_ADMIN` = Andrés + Sandra) vía
  `useRequireModulo`. Los operativos no tienen el módulo.
- Los widgets solo-dueño viven detrás de un **RPC `SECURITY DEFINER` gateado con
  `private.is_owner()`**; ningún rol no-dueño obtiene esos datos (ni en UI ni en RPC).
  La UI además solo renderiza esas secciones si el rol es dueño.

## 3. Capa de Base de Datos

Migración nueva. No crea tablas; solo un RPC de agregación para los widgets del dueño.
Las ventas y el stock bajo NO necesitan migración (ver §4).

### 3.1 RPC `obtener_dashboard_dueno`
```
obtener_dashboard_dueno(p_dias_alerta int) returns json
```
`SECURITY DEFINER`, `set search_path = ''`, `if not private.is_owner() then raise`.
`p_dias_alerta` = ventana de vencimiento (default de uso: 7). Devuelve:
```json
{
  "proveedores_por_vencer": [
    { "proveedor": "texto", "fecha_vencimiento": "YYYY-MM-DD", "saldo": n, "vencida": bool }
  ],
  "empleados_sin_actividad": [
    { "id": "uuid", "nombre": "texto" }
  ]
}
```
- **proveedores_por_vencer:** `compras` join `proveedores`, con `condicion_pago='credito'`,
  `saldo_pendiente > 0`, `estado='completada'`, y `fecha_vencimiento <= (hoy_bogota + p_dias_alerta)`.
  `vencida = fecha_vencimiento < hoy_bogota`. Orden por `fecha_vencimiento` asc.
- **empleados_sin_actividad:** empleados con `empleado_config.activo = true` que NO aparecen
  en: ventas con `created_by` = empleado hoy, ni cierres con `created_by`/`cerrado_por` =
  empleado hoy, ni `empleado_dias_trabajados` con `fecha` = hoy y `tipo='trabajado'`.
  (Misma lógica de "actividad" que `obtener_dias_trabajados`, acotada a hoy.)

`grant execute` a `authenticated` (el cuerpo gatea al dueño). Smoke SQL con centinela
`DASHBOARD_OK_ROLLBACK`.

## 4. Capa de acceso a datos (`lib/reportes.ts`)

- **Ventas hoy/ayer (ambos roles):** reutiliza el RPC existente
  `obtener_resumen_dia(fecha)` — se invoca dos veces (hoy y ayer). Sin migración.
  Devuelve `{ total_ventas, total_general, total_efectivo, total_nequi, total_daviplata }`.
- **Stock bajo (ambos roles):** consulta directa a `productos_calzado`
  (`activo = true and stock_actual <= stock_minimo`) — legible por todo el staff vía RLS.
- **Widgets del dueño:** `obtenerDashboardDueno(diasAlerta = 7)` → invoca el RPC y
  normaliza el JSON a un tipo tipado. Solo se llama si el rol es dueño.
- **Lógica pura** (`lib/reportes.test.ts`, jest TDD):
  - `compararConAyer(hoy: number, ayer: number): { pct: number; direccion: 'sube' | 'baja' | 'igual' }`.
    Si `ayer === 0`: si `hoy > 0` ⇒ `{ pct: 100, direccion: 'sube' }` con bandera de
    "sin base" (se decide en UI mostrar "—"); si ambos 0 ⇒ `{ pct: 0, direccion: 'igual' }`.
    Evita división por cero. `pct` redondeado a entero.

## 5. Interfaz de Usuario (`app/(app)/reportes/`)

Añadir `ruta: '/reportes'` al módulo `reportes` en `lib/permisos.ts`.

```
/app/(app)/reportes/
  ├── _layout.tsx   <-- Stack + useRequireModulo('reportes')  (Andrés + Sandra)
  └── index.tsx     <-- Dashboard del día
```

### 5.1 `index.tsx`
- **Ventas de hoy (ambos):** tarjeta con total vendido (COP), nº de ventas, y desglose
  por método. Flecha ↑/↓ + porcentaje vs ayer (verde si sube, rojo si baja; "—" si ayer
  fue 0 y no hay base de comparación).
- **Stock bajo (ambos):** lista (o "Todo en orden" si vacía).
- **Proveedores por vencer (solo dueño):** lista con proveedor, fecha y saldo; las
  vencidas resaltadas en rojo.
- **Empleados sin actividad hoy (solo dueño):** lista de nombres (o "Todos activos hoy").
- Gating: `if (!requireModulo)` antes de disparar la carga (lección M8); las secciones
  solo-dueño se renderizan solo si `perfil.rol === 'dueno'` y solo entonces se llama
  `obtenerDashboardDueno`. Pull-to-refresh. Carga/errores en español; COP formateado;
  estilo consistente con pantallas existentes.

## 6. Estrategia de Pruebas
1. **Smoke SQL** (vía MCP, rollback + centinela `DASHBOARD_OK_ROLLBACK`): sembrar compras
   a crédito con `fecha_vencimiento` vencida / dentro de ventana / fuera de ventana;
   empleados activos con y sin actividad hoy; verificar el JSON y el **gate** (un no-dueño
   ⇒ excepción). Fechas en un año aislado de datos reales (lección M11: el smoke corre
   contra la BD real dentro de la TX).
2. **Jest lógica pura** `lib/reportes.test.ts`: `compararConAyer` (sube/baja/igual, ayer=0,
   ambos 0, redondeo).
3. **Jest UI** `lib/reportes_ui.test.tsx`: gating del módulo; **Sandra (admin) NO ve** las
   secciones de proveedores/empleados ni se invoca `obtenerDashboardDueno`; render de
   métricas de ventas y comparación; flecha/color según sube/baja.
4. **Regresión:** `npx tsc --noEmit` 0 · `npm test` verde.

## 7. Fuera de alcance (M12 v1)
- Reportes semanal y mensual (total, día top, producto más vendido, desglose por método,
  top 10, productos sin movimiento, comparación con período anterior) → **iteración 2**.
- Valor total del inventario (requiere costos registrados) → iteración 2.
- Gráficos / visualizaciones (solo cifras y listas en v1).
- Reportes automáticos por WhatsApp/correo (M13) y análisis IA (M14).
