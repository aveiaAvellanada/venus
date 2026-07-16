# Métodos de pago: renombrar Daviplata → Bre‑B y agregar "Otro"

**Fecha:** 2026-06-19
**Estado:** aprobado (pendiente de plan de implementación)

## Objetivo
La tienda no usa Daviplata sino **Bre‑B**. Además se necesita una cuarta opción
genérica **"Otro"** para pagos que no caen en efectivo/Nequi/Bre‑B.

Resultado: los métodos de pago pasan de 3 a **4**: `efectivo`, `nequi`, `bre_b`, `otro`.

## Decisiones (confirmadas con el usuario)
1. **Renombrado a fondo** del dato `daviplata → bre_b` (no solo la etiqueta). Es seguro:
   en producción **no existe ninguna venta con daviplata ni nequi** (solo 4 con efectivo),
   así que no hay datos que migrar.
2. **"Otro" es un método simple** (sin nota de texto): se guarda como `otro` y aparece
   como su propia línea en los desgloses, igual que los demás.

## Convenciones de nombres
- Valor guardado (DB): `bre_b`, `otro` (minúsculas, como `efectivo`/`nequi`).
- Llaves de agregación en el JSON de las funciones: `total_bre_b` / `total_otro`
  (en `obtener_resumen_dia`, `obtener_reporte_diario`) y `bre_b` / `otro`
  (en `obtener_balance.ingresos`, `obtener_reporte_periodo`, reporte diario).
- Etiquetas en UI: **Efectivo**, **Nequi**, **Bre‑B**, **Otro**.
- Orden en todas las pantallas: efectivo, nequi, bre_b, otro.
- La etiqueta visible es exactamente `Bre-B` (guion ASCII normal `-`, sin espacios) y `Otro`.

## Cambios

### A. Base de datos (una migración, aplicada a producción)
1. Reemplazar las **3 restricciones CHECK** para que el conjunto válido sea
   `('efectivo','nequi','bre_b','otro')`:
   - `metodos_pago_venta_metodo_check`
   - `devoluciones_metodo_reembolso_check`
   - `devoluciones_metodo_cobro_check`
   (drop + add; ninguna fila viola el nuevo CHECK porque no hay 'daviplata').
2. Recrear **6 funciones** preservando su lógica actual, con `daviplata → bre_b`
   y un bucket nuevo `otro`:
   - `obtener_resumen_dia` — agrega `total_bre_b`, `total_otro`.
   - `obtener_balance` — en `ingresos`: `bre_b`, `otro`.
   - `obtener_reporte_diario` — `bre_b`, `otro` (y el texto del mensaje).
   - `obtener_reporte_periodo` — `bre_b`, `otro`.
   - `registrar_venta` — acepta los métodos nuevos (validación vía CHECK).
   - `registrar_devolucion` — acepta `metodo_reembolso`/`metodo_cobro` nuevos.
   - Mantener firmas, `security definer`, `search_path` y grants existentes.

*Fuera de alcance:* `proveedor_cuentas_bancarias_tipo_cuenta_check` (tipo de cuenta
bancaria del proveedor) y el placeholder "…Nequi, Daviplata" en el detalle de
proveedor — son otro concepto (dónde se le paga al proveedor), no el método de cobro
al cliente. No se tocan.

### B. Código (`lib/`)
- `carrito.ts`: `MetodoPago = 'efectivo' | 'nequi' | 'bre_b' | 'otro'`.
- `devoluciones.ts`: `MetodoDinero = 'efectivo' | 'nequi' | 'bre_b' | 'otro'`.
- `caja.ts`: `total_daviplata → total_bre_b` y agregar `total_otro` (en los ceros por
  defecto, el mapeo en vivo y el mapeo del cierre).
- `balance.ts`: tipo `ingresos` → `bre_b`, `otro`.
- `reportes.ts`: `total_daviplata → total_bre_b` + `total_otro`; en el tipo de período
  `daviplata → bre_b` + `otro`.
- `reporteDiario.ts`: tipo y mensaje (WhatsApp/correo) → `bre_b`, `otro`.
- `database.types.ts`: actualizar las llaves de retorno de las funciones afectadas
  (`total_daviplata → total_bre_b`, agregar `total_otro`, etc.).

### C. Pantallas
- `ventas/nueva.tsx`: `METODOS` → `['efectivo','nequi','bre_b','otro']`; `ETIQUETA`
  agrega `bre_b: 'Bre‑B'`, `otro: 'Otro'`; estado `montos` inicial con las 4 llaves
  (3 ocurrencias).
- `devoluciones/nueva.tsx`: lista `METODOS` del `MetodoPicker` → 4 opciones.
- `caja/index.tsx`: tarjeta "Daviplata" → "Bre‑B"; agregar tarjeta "Otro"; mapeo
  `total_daviplata → total_bre_b` + `total_otro`.
- `reportes/index.tsx`, `reportes/periodos.tsx`, `balance/index.tsx`: la línea
  "Daviplata" → "Bre‑B" y agregar línea "Otro".

### D. Tests
- Actualizar `balance_ui.test.tsx` y `reportes_ui.test.tsx` (hoy usan `daviplata`/
  `total_daviplata` en los mocks y verifican el texto "Daviplata"): renombrar a
  `bre_b`/"Bre‑B" y agregar `otro` en los mocks.
- Nuevo **smoke test SQL** (`supabase/tests/smoke_test_metodos_pago.sql`, estilo
  transacción + ROLLBACK): registrar una venta con los 4 métodos y verificar que
  `obtener_resumen_dia` y `obtener_balance` devuelven los buckets correctos
  (incluyendo `bre_b` y `otro`).
- Verificación final: `tsc --noEmit` 0 errores y toda la suite Jest verde.

## Nota de despliegue
Se renombran **llaves del JSON que la app lee**, por lo que **DB y app se despliegan
juntas** (sin compatibilidad con builds viejos, a diferencia del cambio de "marca").
Impacto real ≈ nulo: daviplata siempre estuvo en $0 y `efectivo`/`nequi` no cambian.

## Criterios de aceptación
- Las 4 opciones aparecen en Nueva venta y Devoluciones, en el orden definido.
- Caja, Reportes (hoy y período) y Balance muestran líneas Bre‑B y Otro con sus totales.
- Una venta/devolución con `bre_b` u `otro` se guarda sin violar CHECK y se refleja en
  los totales.
- `tsc` 0, suite Jest verde, smoke test SQL verde.
