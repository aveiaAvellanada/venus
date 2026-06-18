# Especificación de Diseño: Reportes de Período (M12 iteración 2)

> Diseño aprobado el 2026-06-17. Módulo `reportes` (Andrés + Sandra; operativos no acceden).
> Segunda iteración de M12. La iteración 1 (Dashboard del día) ya está MERGEADA en `main`.
> Sin datos de costo/margen → ambos roles ven todo (no hay recorte solo-dueño aquí).

## 1. Introducción y Objetivos

**Reportes de Período (M12 it.2)** añade una segunda pantalla a `/reportes`: un reporte
agregado de un período (semana o mes), navegable hacia atrás. Da a Andrés y Sandra la
visión histórica del negocio (cuánto se vendió, cómo se compara con el período anterior,
qué se vendió más, qué no se movió). Es **solo lectura**.

## 2. Reglas de negocio

### 2.1 Contenido del reporte
Un **mismo formato** para semana y mes (no dos reportes divergentes), para el período
seleccionado `[desde, hasta]`:
- **Total vendido** del período + **comparación con el período anterior** (mismo largo):
  flecha ↑/↓ y porcentaje.
- **Número de ventas** del período.
- **Desglose por método:** efectivo / Nequi / Daviplata.
- **Día con más ventas** del período (fecha + monto).
- **Top 10 productos por unidades** vendidas (muestra unidades; el monto vendido como
  dato secundario).
- **Productos de calzado sin movimiento** en el período (activos que no se vendieron).

### 2.2 Bases de cálculo (consistencia)
- **Total vendido, nº de ventas y desglose por método:** **netos de devoluciones, por la
  fecha de la venta** — misma base que `obtener_resumen_dia` (Dashboard "Hoy") y Balance.
  Estados de venta contados: `('completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total')`.
  Devoluciones se netean por la fecha de la venta original (resta `monto_devuelto`, suma
  `monto_cobrado`).
- **Día con más ventas:** entre los días del período, el de mayor total **neto** vendido.
- **Top productos y sin movimiento:** por **unidades brutas** vendidas (suma de
  `venta_items.cantidad` sin netear devoluciones — representa "qué se movió"). Decisión
  explícita: el dinero se reporta neto, las unidades brutas. Aplica a calzado y Granja
  para el top; "sin movimiento" aplica solo a **calzado** (Granja no tiene stock).
- **Comparación con período anterior:** período inmediatamente anterior del mismo largo
  (`[desde - largo, desde - 1]`, donde `largo = hasta - desde + 1`), comparando el total
  vendido neto.

### 2.3 Permisos
Módulo `reportes` (`STAFF_ADMIN` = Andrés + Sandra). Ningún dato es de costo/margen, así
que **ambos ven el reporte completo**. La agregación vive en un RPC `SECURITY DEFINER`
gateado con `private.is_staff_admin()` (los operativos no acceden ni por UI ni por RPC).

## 3. Capa de Base de Datos

Migración nueva. No crea tablas; solo el RPC de agregación.

### 3.1 RPC `obtener_reporte_periodo`
```
obtener_reporte_periodo(p_desde date, p_hasta date) returns json
```
`SECURITY DEFINER`, `set search_path = ''`, `if not private.is_staff_admin() then raise`.
Rango inclusivo `[p_desde, p_hasta]` en `America/Bogota`. Calcula internamente el período
anterior (mismo largo) para `total_anterior`. Devuelve:
```json
{
  "total_vendido": n,
  "total_anterior": n,
  "num_ventas": n,
  "efectivo": n, "nequi": n, "daviplata": n,
  "dia_top": { "fecha": "YYYY-MM-DD", "monto": n },
  "top_productos": [ { "producto": "texto", "unidades": n, "monto": n } ],
  "sin_movimiento": [ { "id": "uuid", "producto": "texto" } ]
}
```
- `dia_top` es `null` si no hubo ventas en el período.
- `top_productos`: agrupado por `venta_items.descripcion_snapshot` (nombre estable al
  momento de la venta), `sum(cantidad)` desc, límite 10; `monto = sum(subtotal)`.
- `sin_movimiento`: `productos_calzado` con `activo = true` cuyo `id` no aparece en
  `venta_items.producto_calzado_id` de ventas del período (estados contados).
`grant execute` a `authenticated` (el cuerpo gatea a staff_admin). Smoke test SQL con
centinela `REPORTE_OK_ROLLBACK`.

## 4. Capa de acceso a datos (`lib/reportes.ts`)

- **Acceso a datos:** `obtenerReportePeriodo(desde, hasta)` → invoca el RPC y normaliza el
  JSON a un tipo `ReportePeriodo`.
- **Reutiliza lógica pura existente** (sin lógica pura nueva):
  - `rangoPeriodo(tipo, refDate)` de `lib/balance.ts` para obtener `{desde, hasta}` de la
    semana/mes que contiene `refDate` (se importa desde `lib/balance`).
  - `compararConAyer(actual, anterior)` de `lib/reportes.ts` para la comparación con el
    período anterior (la función es genérica: compara dos números).
- Tipos nuevos: `ReportePeriodo`, `TopProducto`, `ProductoSinMovimiento`, `DiaTop`.

## 5. Interfaz de Usuario (`app/(app)/reportes/periodos.tsx`)

Nueva screen en el Stack existente de `/reportes` (añadir `<Stack.Screen name="periodos" ...>`
en `_layout.tsx`). Botón/enlace en el dashboard (`index.tsx`) que navega a `/reportes/periodos`.

### 5.1 `periodos.tsx`
- **Selector de período:** Semana / Mes; flechas ‹ › que mueven `refDate` una semana o un
  mes atrás/adelante (patrón de `app/(app)/balance/index.tsx`). Default: mes actual.
  Calcula `[desde, hasta]` con `rangoPeriodo` y llama `obtenerReportePeriodo`.
- **Tarjeta de total:** total vendido (COP) + comparación con período anterior (flecha ↑
  verde / ↓ rojo + %; "—" si el período anterior fue 0, vía `compararConAyer().sinBase`).
- **Métricas:** nº de ventas; desglose por método; día con más ventas (fecha + monto).
- **Top 10 productos:** lista con nombre + unidades (y monto secundario).
- **Sin movimiento:** lista de productos de calzado activos no vendidos (o "Todo el
  catálogo tuvo movimiento" si vacía).
- Carga/error en español; COP formateado; gate `if (!requireModulo)` antes de cargar
  (lección M8). Estilo consistente con pantallas existentes.

## 6. Estrategia de Pruebas
1. **Smoke SQL** (vía MCP, rollback + centinela `REPORTE_OK_ROLLBACK`, fechas en un año
   aislado de datos reales — lección M11): sembrar ventas con pagos en el período y en el
   período anterior; varios productos con distintas unidades; un producto de calzado
   activo sin ventas. Verificar: total y desglose netos, `total_anterior`, `num_ventas`,
   `dia_top` correcto, orden y límite del `top_productos` por unidades, presencia del
   producto en `sin_movimiento`; y el **gate** (un operativo ⇒ excepción).
2. **Jest UI** (`lib/reportes_ui.test.tsx`, ampliado): render del reporte de período;
   cambiar de período (Semana/Mes o flechas) vuelve a invocar `obtenerReportePeriodo`;
   gating del módulo; el botón del dashboard navega a `/reportes/periodos`.
3. **Regresión:** `npx tsc --noEmit` 0 · `npm test` verde.

## 7. Fuera de alcance (M12 it.2)
- Valor total del inventario a costo (no hay costo por producto en el esquema).
- Gráficos / visualizaciones (solo cifras y listas).
- Exportar a Excel/PDF.
- Reportes automáticos por WhatsApp/correo (M13) y análisis IA (M14).
