# Especificación de Diseño: Balance (M11)

> Diseño aprobado el 2026-06-17. **Solo Andrés (dueño).** Primer módulo de SP-9.
> El módulo `balance` ya existe en `lib/permisos.ts` como `SOLO_DUENO` (falta `ruta`).

## 1. Introducción y Objetivos

**Balance (M11)** muestra si el negocio gana o pierde dinero real en un período,
combinando todos los ingresos y egresos. Es un **estado de flujo de caja** (base caja:
dinero que entró − dinero que salió en el período), **solo lectura**, solo para el dueño.

## 2. Reglas de negocio

### 2.1 Fórmula
```
INGRESOS NETOS = ventas del período (efectivo+nequi+daviplata)
                 − reembolsos + cobros de cambios
EGRESOS        = gastos fijos pagados + gastos variables
                 + pagos a proveedores + sueldos pagados
BALANCE        = INGRESOS NETOS − EGRESOS   (negativo = pérdida, en rojo)
```

### 2.2 Atribución temporal (decisiones de producto)
- **Ventas:** por `ventas.created_at` (zona America/Bogota), estados
  `('completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total')`.
  Ingreso bruto = suma de `metodos_pago_venta.monto` por método.
- **Devoluciones:** se netean **por la fecha de la VENTA original** (join `devoluciones→ventas`,
  filtro por `ventas.created_at`). Consistente con `obtener_resumen_dia` (decisión M2). Resta
  `monto_devuelto`, suma `monto_cobrado` (cobros de diferencia en cambios = ingreso).
- **Egresos = pagos reales del período** (base caja), cada uno por su propia fecha:
  - Gastos fijos: `gastos_fijos_pagos.monto_pagado` por `fecha_pago`.
  - Gastos variables: `gastos_variables.monto` por `fecha`.
  - Pagos a proveedores: `compra_pagos.monto` por `fecha` (lo PAGADO, no el costo recibido a crédito).
  - Sueldos: `empleado_pagos.monto` por `fecha_pago`.

### 2.3 Proyección del mes
Solo para el mes en curso: `proyeccionMes(balanceAcumulado, díaActual, díasDelMes) =
round(balanceAcumulado / díaActual × díasDelMes)`. Estima el cierre según el promedio
diario de lo que va del mes.

### 2.4 Permisos
Solo el dueño. La agregación vive en un RPC `SECURITY DEFINER` gateado con
`private.is_owner()` (las tablas de finanzas ya son dueño-only / staff por RLS; el RPC
centraliza y blinda). Ningún rol no-dueño ve estos montos (ni en UI ni en RPC).

## 3. Capa de Base de Datos (migración mínima)

Migración nueva. No crea tablas; solo el RPC de agregación.

### 3.1 RPC `obtener_balance`
```
obtener_balance(p_desde date, p_hasta date) returns json
```
`SECURITY DEFINER`, `set search_path=''`, `if not private.is_owner() then raise`.
Rango inclusivo `[p_desde, p_hasta]` interpretado en `America/Bogota`. Devuelve:
```json
{
  "ingresos": { "efectivo": n, "nequi": n, "daviplata": n,
                "reembolsos": n, "cobros_cambios": n, "total_neto": n },
  "egresos":  { "gastos_fijos": n, "gastos_variables": n,
                "pagos_proveedores": n, "sueldos": n, "total": n },
  "balance":  n
}
```
`grant execute` a `authenticated` (el cuerpo gatea al dueño). Smoke test SQL con centinela
`*_OK_ROLLBACK`.

## 4. Capa de acceso a datos (`lib/balance.ts`)

- **Lógica pura** (con `lib/balance.test.ts`, jest TDD):
  - `proyeccionMes(balanceAcumulado, diaActual, diasDelMes): number`.
  - `rangoPeriodo(tipo: 'semana'|'mes', refDate: Date): { desde: string; hasta: string }`
    (devuelve fechas ISO `YYYY-MM-DD` del período que contiene `refDate`; para 'mes',
    primer y último día; para 'semana', lunes a domingo).
- **Acceso a datos:** `obtenerBalance(desde, hasta)` → invoca el RPC y normaliza el JSON
  a un tipo `Balance` tipado.
- Tras la migración, **regenerar `lib/database.types.ts`** vía MCP.

## 5. Interfaz de Usuario (`app/(app)/balance/`)

Añadir `ruta: '/balance'` al módulo `balance` en `lib/permisos.ts`.

```
/app/(app)/balance/
  ├── _layout.tsx   <-- Stack + useRequireModulo('balance')  (solo dueño)
  └── index.tsx     <-- Balance del período
```

### 5.1 `index.tsx`
- **Selector de período:** Semana / Mes / Rango personalizado (default: mes actual).
  Navegación histórica mes a mes (flechas ‹ ›).
- **Tarjetas:** Total ingresos netos · Total egresos · **Balance** (Ganancia en verde /
  Pérdida en rojo con el monto).
- **Desglose de egresos** por categoría (gastos fijos, variables, proveedores, sueldos).
- **Proyección del mes** (solo si el período es el mes en curso): muestra el cierre
  estimado con `proyeccionMes`.
- Todo en español, COP formateado; estilo consistente con pantallas existentes.

## 6. Estrategia de Pruebas
1. **Smoke SQL** (vía MCP, rollback + centinela): sembrar ventas con pagos en distintos
   meses, una devolución en mes posterior a su venta (verificar que resta en el mes de la
   VENTA), gastos fijos/variables, compra_pagos y empleado_pagos; verificar ingresos
   netos, egresos por categoría y balance; y el **gate dueño-only** (un empleado ⇒ excepción).
2. **Jest lógica pura** `lib/balance.test.ts`: `proyeccionMes` (incl. balance negativo) y
   `rangoPeriodo` (mes/semana, bordes de mes).
3. **Jest UI** `lib/balance_ui.test.tsx`: gating dueño-only (empleado/admin no accede);
   balance negativo se muestra en rojo; cambiar de período vuelve a llamar `obtenerBalance`.
4. **Regresión:** `npx tsc --noEmit` 0 · `npm test` verde.

## 7. Fuera de alcance (M11)
- Reportes/Dashboard con gráficos (M12), reportes automáticos (M13), análisis IA (M14).
- Base devengo / costo de mercancía vendida (COGS) y márgenes por producto (esto es flujo
  de caja, no P&L contable).
- Exportar a Excel/PDF.
