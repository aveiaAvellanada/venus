# Caja — Cómo se supone que funciona (y cómo está hoy)

> Documento de entendimiento del **Módulo 7 — Caja**. Sirve para decidir qué
> cambiar. Separa tres cosas: (A) lo que dice el PRD v4.0 (la especificación),
> (B) cómo está implementado hoy en el código, y (C) los huecos/decisiones
> pendientes.
>
> Fuentes: `docs/Venus_PRD_v4.0.md` §3.7 · `app/(app)/caja/*` ·
> `lib/caja.ts` · migración RLS `20260615190000_sp1_rls_ventas_caja_users.sql` ·
> esquema `cierres_caja` en `20260612210115_init_venus_schema.sql`.

---

## 1. Qué es y para qué sirve

La Caja registra la **apertura y el cierre del día operativo** del negocio.
Reemplaza el "cuadre" manual con calculadora: al final del día se compara el
**efectivo que debería haber** (según las ventas en efectivo) contra el
**efectivo físico contado en la gaveta**, y cualquier diferencia queda
registrada con una justificación.

Es el cierre contable diario de la tienda: un registro por día.

---

## 2. Quién lo usa (usuarios y permisos)

| Acción | Dueño (Andrés) | Admin (Sandra) | Empleados (Camilo, Beatriz, Nikol) |
|---|:---:|:---:|:---:|
| Abrir caja del día | ✅ | ✅ | ✅ |
| Cerrar caja del día | ✅ | ✅ | ✅ |
| Ver la caja / resumen del **día actual** | ✅ | ✅ | ✅ |
| Ver **historial** de días anteriores | ✅ | ✅ (por RLS) | ❌ |
| Cambiar modo (automático/manual) y horarios | ✅ | ❌ | ❌ |

Notas importantes:

- **Todos abren y cierran.** La caja no es una función exclusiva del dueño; es
  parte de la operación diaria de cualquier empleado ("Abrir caja al llegar,
  cerrar al irse").
- **El historial es restringido.** Según el PRD, solo Andrés ve el histórico de
  cierres de días anteriores, el comparativo entre días, las diferencias y quién
  cerró.
- **Matiz código vs PRD en el historial:** el PRD dice "solo Andrés". En el
  código, la pantalla de historial (`historial.tsx`) y el botón "Historial" del
  encabezado están restringidos a `rol === 'dueno'`. Pero la **política RLS** de
  `cierres_caja` permite el SELECT histórico a `is_staff_admin()` (dueño **y**
  admin). O sea: hoy Sandra no ve el botón de Historial en la UI, pero la base
  de datos sí la dejaría leerlo. Es una incoherencia menor a alinear (decidir si
  Sandra ve historial o no).

---

## 3. Cómo se supone que funciona (PRD v4.0 §3.7)

### 3.1 Modos de operación

**Modo manual:** cualquier empleado toca "Abrir caja" al llegar y "Cerrar caja"
al irse. Útil para días con horario irregular o festivos.

**Modo automático (configurable por Andrés):** Andrés define hora de apertura
(ej. 6:00 AM) y de cierre (ej. 11:00 PM); el sistema abre y cierra solo cada
día. Al cierre automático se genera el resumen y se envía a Andrés por WhatsApp.
El horario se cambia cuando se quiera desde Configuración. Andrés puede alternar
entre modos en cualquier momento.

### 3.2 El cierre del día

Al cerrar, el sistema muestra el resumen del día:

- Total vendido y número de ventas.
- Desglose por método de pago (efectivo / Nequi / Daviplata).
- Devoluciones del día.
- El empleado **cuenta el efectivo físico** e ingresa el monto.
- El sistema **compara**: efectivo en gaveta vs efectivo registrado en ventas.
- Si hay **diferencia** (sobrante o faltante), queda registrada con una **nota**.
- Andrés recibe el resumen por WhatsApp al cerrar.

### 3.3 Qué ve cada uno

- **Todos los empleados:** el cierre del día actual.
- **Solo Andrés:** historial completo de días anteriores, comparativo entre
  días, diferencias y quién cerró cada caja.

---

## 4. Cómo está implementado hoy (código)

### 4.1 Pantallas (`app/(app)/caja/`)

- **`index.tsx` — Dashboard de Caja.** Al entrar llama a `obtenerCajaHoy()`:
  - Si **no hay** registro de hoy → muestra el botón gigante **"Abrir Caja del
    Día"**.
  - Si hay registro **abierta** → muestra el dashboard en vivo (total general,
    nº de ventas, desglose efectivo/Nequi/Daviplata) + botón **"Ir a Cerrar
    Caja"**.
  - Si hay registro **cerrada** → muestra el "Resumen Final de Caja" de solo
    lectura, con los totales guardados y **sin ningún botón de acción**.
  - El botón "Historial" del encabezado solo aparece para el dueño.
- **`cierre.tsx` — Calculadora de Cierre (modal).** Muestra el efectivo
  esperado, pide cuánto hay en gaveta, calcula la diferencia en vivo (sobrante
  verde / faltante rojo / cuadre gris). Si hay diferencia, **exige una nota**.
  Al confirmar: guarda el cierre, dispara el **correo** del reporte diario
  (fire-and-forget) y ofrece **enviar el resumen por WhatsApp** (link asistido).
- **`historial.tsx` — Historial de Cierres (solo dueño).** Lista todos los
  cierres por fecha descendente, con total general, diferencia y nota.

### 4.2 Lógica de datos (`lib/caja.ts`)

- `obtenerCajaHoy()` → busca en `cierres_caja` la fila con `fecha = hoy`
  (fecha en zona horaria America/Bogotá). Devuelve la fila o `null`.
- `abrirCaja()` → **inserta** una fila nueva con `estado = 'abierta'`,
  `modo = 'manual'`, `apertura_at = now()` y todos los totales en 0.
- `obtenerResumenEnVivo()` → llama al RPC `obtener_resumen_dia(p_fecha)` que
  netea ventas − devoluciones del día y devuelve los totales por método de pago.
- `cerrarCaja({ efectivo_contado, diferencia, nota })` → recalcula el resumen,
  **actualiza** la fila a `estado = 'cerrada'`, fija `cierre_at`, guarda totales,
  efectivo contado, diferencia y nota. Valida que exista caja y que no esté ya
  cerrada.

### 4.3 Modelo de datos — tabla `public.cierres_caja`

Campos: `id`, `fecha`, `modo` (`automatico`|`manual`), `estado`
(`abierta`|`cerrada`), `apertura_at`, `cierre_at`, `total_ventas`,
`total_general`, `total_efectivo`, `total_nequi`, `total_daviplata`,
`efectivo_contado`, `diferencia`, `diferencia_nota`, `cerrado_por`,
`created_at`, `updated_at`.

🔑 **Restricción clave:** `constraint cierres_caja_fecha_unica unique (fecha)` →
**solo puede existir UNA fila por día.** Esto es el corazón del comportamiento:
un día = un ciclo de apertura/cierre.

### 4.4 Reglas de acceso (RLS sobre `cierres_caja`)

- **SELECT:** `is_staff_admin()` (dueño+admin) ve todo; cualquier otro
  autenticado solo ve la fila cuya `fecha = hoy_bogota()`.
- **INSERT/UPDATE:** `is_staff_admin()` sin restricción; el resto solo puede
  insertar/actualizar la fila de **hoy**.
- **DELETE:** solo `is_staff_admin()` (dueño+admin).

---

## 5. Huecos y discrepancias (lo que falta decidir/arreglar)

1. **No hay forma de reabrir una caja cerrada (el bug reportado).**
   El botón "Abrir Caja del Día" solo se renderiza cuando **no existe** fila de
   hoy. Una vez la caja de hoy queda `cerrada`, la pantalla muestra el resumen
   de solo lectura sin ninguna acción. Y como hay `unique (fecha)`, ni siquiera
   se podría insertar otra fila para hoy. Resultado: si alguien cierra por error
   (o cierra una prueba), **queda bloqueado todo el día sin recuperación dentro
   de la app**. → Decidir: ¿se permite "Reabrir caja" (UPDATE de la fila de hoy
   de `cerrada` a `abierta`)? ¿para todos o solo dueño?

2. **Modo automático no existe en el código.** El PRD describe apertura/cierre
   por horario configurable y envío del resumen al cierre automático. Hoy
   `abrirCaja()` siempre escribe `modo: 'manual'` y no hay pantalla de
   configuración de horarios ni job programado. Todo es manual. → Decidir si el
   modo automático entra en esta versión o se difiere.

3. **Historial: PRD dice "solo Andrés", RLS permite dueño+admin.** La UI hoy lo
   limita a dueño, pero la base dejaría leer a Sandra. → Alinear: o se abre el
   botón a admin, o se restringe la RLS a solo dueño.

4. **`cerrado_por` no se está llenando.** La tabla tiene la columna para
   auditar **quién cerró** (el PRD pide "quién cerró" en el historial), pero
   `cerrarCaja()` no la setea. → Confirmar si un trigger de auditoría la llena;
   si no, agregarla al UPDATE del cierre.

5. **El resumen del PRD pide "devoluciones del día" explícitas.** El RPC ya
   netea devoluciones en los totales, pero el cierre no muestra una línea
   separada de devoluciones. → Decidir si se muestra el desglose.

---

## 6. Resumen para decidir

La lógica central ("un día = una fila en `cierres_caja`, abrir → vender →
contar efectivo → cerrar con diferencia justificada") está implementada y es
sólida. Lo que falta es, sobre todo:

- **El caso de recuperación** cuando la caja ya está cerrada (reabrir) — es el
  problema que disparó este documento.
- **El modo automático** (probablemente diferible).
- **Pulir auditoría y permisos** (quién cerró, historial dueño vs admin).

El siguiente paso es decidir el punto 1 (reabrir: sí/no y quién), que desbloquea
el flujo actual, y de paso resolver el registro de prueba que hoy tiene la caja
del 2026-06-18 en estado `cerrada`.
