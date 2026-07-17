# Diseño — Retoques de menú, rediseño de Caja, reorganización de Perfil, alertas de Gastos Fijos, filtros de Balance y fix de safe-area

**Fecha:** 2026-07-16
**Módulos:** 1 (Nueva Venta, solo FAB), 7 (Caja), 9 (Gastos Fijos), 11 (Balance), Perfil/navegación transversal
**Rama:** por definir en el plan de implementación
**Estado:** aprobado en brainstorming, pendiente de revisión del spec

---

## 1. Contexto y problema

Batch de ajustes de UI/UX solicitados sobre la rama `feat/redesign-nueva-venta` en curso, agrupados porque se piden implementar juntos ("vamos con todo eso"). Son subsistemas independientes entre sí, pero comparten pantallas (Perfil, menú principal) por lo que se diseñan y documentan en un solo spec:

- **A.** Cuatro retoques puntuales de UI (login, tarjetas de pago del menú, gráfico de ventas por período, sombra del FAB).
- **B.** Rediseño del módulo Caja: elimina el dashboard redundante, mueve la configuración a Perfil, agrega modo de cierre "con/sin diferencia" y horario automático por día de la semana.
- **C.** Reorganización del Perfil: Proveedores, Reportes, Balance y Análisis IA se mueven ahí, junto con la config de Caja ya movida en B.
- **D.** Alertas de Gastos Fijos próximos a vencer, con confirmación de pago desde el menú.
- **E.** Balance: agrega filtro por Año y por Rango personalizado (mantiene Semana y Mes existentes).
- **F.** Fix de fondo: ~20 pantallas usan `paddingBottom` fijo en vez de `useSafeAreaInsets().bottom`, lo que causa que contenido importante quede tapado por la barra de gestos de Android en algunos dispositivos.

## 2. Decisiones tomadas (brainstorming)

- **Cierre "sin diferencia":** 100% automático. Al confirmar el modal, el sistema calcula el efectivo esperado según las ventas del día y cierra la caja con ese valor — no se pide efectivo contado ni justificación.
- **Horario automático:** por día de la semana (lunes–domingo, la tienda opera los 7 días pero puede tener horas distintas por día). No se piden horarios partidos (múltiples bloques por día) ni periodos/temporadas — fuera de alcance por ahora.
- **Apertura de caja:** sin cambios, se mantiene el flujo actual.
- **Alertas de gastos fijos:** aparecen 3 días antes del `dia_pago`, como banner en el menú principal (visible solo para quien tiene acceso a Gastos Fijos: dueño y administrativa).
- **Balance:** selector con pestañas Mes / Año / Rango — se agregan Año y Rango; Semana (ya existente) se mantiene.
- **Perfil:** las secciones nuevas se agrupan por tema con encabezado, siguiendo el patrón visual ya existente (`Text` con `tipografia.micro` + `Tarjeta` con `FilaLista`).

## 3. Alcance

**Incluye:**
- Los 6 puntos A–F descritos arriba.

**No incluye (fuera de alcance):**
- Horarios partidos / múltiples bloques por día en el automático de Caja.
- Periodos o temporadas con reglas distintas de horario.
- Cambios al flujo de apertura de caja.
- WhatsApp automático (ya fuera de alcance desde M13, sin cambios aquí).
- Cambios al modelo de permisos por rol (se respeta el PRD v4.0 existente).

---

## 4. A — Retoques rápidos de UI

### 4.1 Login (`app/(auth)/login.tsx:174-184`)
Eliminar el `Pressable` de "¿Se te olvidó tu clave?" (hoy solo dispara un `Alert` informativo, no es un flujo real de recuperación).

### 4.2 Tarjetas de método de pago (`app/(app)/(tabs)/index.tsx:81-88, 281-291`)
- `metodosDe()` deja de filtrar "Otro" cuando su monto es 0 — los 4 métodos (Efectivo, Nequi, Bre-B, Otro) siempre se muestran.
- El contenedor cambia de `flexDirection: 'row'` a una grilla 2x2 (`flexWrap: 'wrap'`, cada `TarjetaMetrica mini` con `width: '48%'` en vez de `flex: 1`), con `gap` vertical y horizontal.
- Orden: fila 1 = Efectivo, Nequi; fila 2 = Bre-B, Otro.

### 4.3 Gráfico "Ventas por período" (`index.tsx:197-222, 294-299`)
La `Tarjeta` que envuelve `<GraficoBarras>` (línea 294) se oculta cuando `periodo === 'hoy'`. Sigue visible para Semana y Mes. Los chips de período (`PERIODOS`, líneas 65-69) no cambian.

### 4.4 Sombra del FAB (`components/ui/TabBar.tsx:119-129`)
Se elimina el drop-shadow coloreado (`shadowColor: paleta.primario`, `shadowOpacity: 0.35`, `shadowRadius: 14`, `shadowOffset: { width: 0, height: 6 }`, `elevation: 8`). El círculo del FAB queda sin sombra propia (el `LinearGradient` de relleno no cambia).

---

## 5. B — Rediseño de Caja

### 5.1 Modelo de datos — `caja_config`

Migración que altera la tabla existente (`supabase/migrations/20260618171100_caja_config.sql`):

```sql
alter table public.caja_config
  add column horario_semanal jsonb not null default '{}'::jsonb,
  add column modo_cierre text not null default 'con_diferencia'
    check (modo_cierre in ('con_diferencia', 'sin_diferencia'));

-- Migra hora_apertura/hora_cierre existentes a los 7 días antes de eliminarlas
update public.caja_config
set horario_semanal = (
  select jsonb_object_agg(dia, jsonb_build_object('apertura', hora_apertura, 'cierre', hora_cierre))
  from unnest(array['lunes','martes','miercoles','jueves','viernes','sabado','domingo']) as dia
);

alter table public.caja_config
  drop column hora_apertura,
  drop column hora_cierre;
```

- `horario_semanal` shape: `{ "lunes": {"apertura": "08:00", "cierre": "19:00"}, "martes": {...}, ..., "domingo": {...} }`.
- RLS sin cambios (solo dueño, patrón ya existente).

### 5.2 Edge Function `caja-scheduler`
Se actualiza para leer `horario_semanal[díaDeHoy]` en vez de `hora_apertura`/`hora_cierre` planos, usando el día de la semana en hora local Bogotá.

### 5.3 Nueva función de cierre automático reutilizable
Extraer la lógica de "cierre blando" que ya existe en `caja-scheduler` (calcular totales del sistema vía `obtener_resumen_dia`, `efectivo_contado = esperado`, `diferencia = 0`, sin nota) a una función/RPC compartida `cerrar_caja_sin_diferencia()`, invocable tanto por el scheduler como por la acción manual del usuario cuando `modo_cierre = 'sin_diferencia'`.

### 5.4 Comportamiento del ícono "Caja" en el menú (`app/(app)/(tabs)/index.tsx`)
- Caja **cerrada** → sin cambios, `router.push('/caja')` (flujo de apertura actual).
- Caja **abierta** y `modo_cierre = 'con_diferencia'` → `router.push('/caja/cierre')` directo (se salta el dashboard).
- Caja **abierta** y `modo_cierre = 'sin_diferencia'` → modal de confirmación in-place ("¿Seguro que quieres cerrar la caja?"); al confirmar, llama a `cerrar_caja_sin_diferencia()` y refresca el menú.

### 5.5 Simplificación de `app/(app)/caja/index.tsx`
El bloque de dashboard que se renderiza hoy cuando la caja está abierta (badge ABIERTA/CERRADA, `TarjetaMetrica` de total, desglose por método, íconos de config/historial, CTA "Ir a Cerrar Caja") se elimina — ya no es alcanzable desde la navegación normal (el menú ahora enruta directo a `/caja/cierre` o al modal). La pantalla queda solo con el flujo de apertura (caso "sin caja hoy"), sin cambios ahí.

---

## 6. C — Reorganización del Perfil

En `app/(app)/(tabs)/perfil.tsx`, reutilizando el patrón de sección existente (`Text` `tipografia.micro`/`paleta.texto3` + `Tarjeta` con `FilaLista` y divisores):

- **Sección "Caja y equipo"** (dueño-only, ya existe):
  - Fila "Automatización de caja" → renombrada a **"Caja"**, subtítulo "Horario, modo de cierre e historial", sigue apuntando a `/caja/config`.
  - `caja/config.tsx` gana: 7 filas de horario (una por día de semana, cada una con hora apertura/cierre), selector "Modo de cierre" (Con diferencia / Sin diferencia), y una fila nueva "Historial de cierres" → `/caja/historial` (se mueve aquí desde el ícono que tenía el dashboard eliminado en B).
  - Fila "Empleados" sin cambios.
- **Nueva sección "Negocio"** (visibilidad según permisos ya definidos en el PRD v4.0 §2): Proveedores, Reportes, Balance, Análisis IA, en ese orden. Balance y Análisis IA solo dueño; Proveedores y Reportes también visibles para Sandra (administrativa).
- Secciones "Apariencia" y "Cerrar sesión" sin cambios.

Nota: las rutas actuales de Proveedores/Reportes/Balance/Análisis IA (`app/(app)/proveedores`, etc.) no se mueven de carpeta — solo cambia desde dónde se navega a ellas (Perfil en vez de donde estén hoy sus entradas de navegación, si las hubiera fuera del perfil).

---

## 7. D — Alertas de Gastos Fijos

- Nuevo banner en `app/(app)/(tabs)/index.tsx`, visible solo si el usuario tiene acceso a Gastos Fijos (dueño y administrativa, per PRD v4.0).
- Consulta gastos fijos cuyo `dia_pago` cae dentro de los próximos 3 días **y sin pago registrado en el período actual** (misma condición `yaPagado` que ya usa `app/(app)/gastos/fijos.tsx:92`, vía join con `gastos_fijos_pagos` filtrado al mes en curso).
- Cada ítem del banner: nombre del gasto, monto, días restantes; botón "Confirmar pago" navega a `app/(app)/gastos/pagar.tsx` pre-cargado con ese `gasto_fijo_id` (reutiliza `registrarPagoFijo()` en `lib/gastos.ts`, sin duplicar lógica de registro).

---

## 8. E — Balance: filtros de mes/año/rango

- `SelectorTipo` en `app/(app)/balance/index.tsx` (hoy Semana/Mes) gana dos pestañas: **Año** y **Rango**. Semana y Mes se mantienen sin cambios.
- **Año:** navegación prev/next (`mover(-1|1)`) por año calendario completo.
- **Rango:** abre un selector de fecha inicio/fin personalizado (nuevo componente o reutilizando un date picker ya presente en el proyecto, a definir en el plan).
- `rangoPeriodo(tipo, refDate)` en `lib/balance.ts:33-44` se extiende con los casos `'año'` y `'rango'` para calcular `{desde, hasta}`. El RPC `obtener_balance(p_desde, p_hasta)` no cambia — ya acepta cualquier rango de fechas.

---

## 9. F — Fix de safe-area (barra de gestos Android)

- Causa raíz: ~20 pantallas usan `paddingBottom` fijo (`100` o `espacio.xxxl`) en vez de derivarlo de `useSafeAreaInsets().bottom`; solo `components/ui/TabBar.tsx` lo hace correctamente hoy.
- Se crea un hook compartido, p. ej. `hooks/usePaddingInferior.ts`, que retorna `insets.bottom + espacio.xxxl` (o el espaciado base que ya use cada pantalla), y se reemplaza el valor fijo en las pantallas afectadas: `gastos/fijos.tsx`, `balance/index.tsx`, `caja/index.tsx`, `reportes/index.tsx`, `empleados/index.tsx`, `proveedores/index.tsx`, y el resto de pantallas con scroll detectadas por grep de `paddingBottom:\s*(100|espacio\.xxxl)`.
- El plan de implementación debe incluir un grep final de verificación (`paddingBottom: 100` y `paddingBottom: espacio.xxxl` sin `useSafeAreaInsets` en el mismo archivo) para confirmar que no queda ninguna pantalla con el valor fijo sin corregir.

---

## 10. Permisos (resumen, sin cambios respecto al PRD v4.0 §2)

| Acción | Dueño | Sandra (admin) | Empleado operativo |
|---|:---:|:---:|:---:|
| Configurar Caja (horario, modo de cierre, historial) | ✅ | ❌ | ❌ |
| Cerrar caja (con o sin diferencia, según config) | ✅ | ✅ | ✅ |
| Ver/confirmar alertas de Gastos Fijos | ✅ | ✅ | ❌ |
| Ver Balance (con filtros nuevos) | ✅ | ❌ | ❌ |
| Ver Proveedores / Reportes desde Perfil | ✅ | ✅ | ❌ |
| Ver Análisis IA desde Perfil | ✅ | ❌ | ❌ |

---

## 11. Pruebas

- **Unit:** `rangoPeriodo()` casos `'año'` y `'rango'` en `lib/balance.test.ts`; `cerrar_caja_sin_diferencia()` (o su wrapper en `lib/caja.ts`) — caso feliz y caso "ya cerrada".
- **Smoke SQL:** migración de `hora_apertura`/`hora_cierre` → `horario_semanal` no pierde datos existentes; `caja-scheduler` actualizado respeta el día de la semana correcto.
- **Componentes:** grilla 2x2 de métodos de pago renderiza 4 tarjetas siempre; gráfico de período ausente cuando `periodo === 'hoy'`.
- Verificación final: `tsc --noEmit` limpio + `npm test` verde + recorrido manual en un dispositivo/emulador Android con barra de gestos para confirmar el fix de safe-area.

## 12. Archivos afectados (referencia, no exhaustivo — el plan de implementación detalla el resto)

- **Migraciones:** alter `caja_config` (horario_semanal, modo_cierre) + función `cerrar_caja_sin_diferencia`.
- **Edge Function:** `supabase/functions/caja-scheduler/index.ts`.
- **`lib/`:** `caja.ts`, `balance.ts`, `gastos.ts` (sin cambios de firma, reutilizado), nuevo `hooks/usePaddingInferior.ts`.
- **UI:** `app/(auth)/login.tsx`, `app/(app)/(tabs)/index.tsx`, `components/ui/TabBar.tsx`, `app/(app)/caja/index.tsx`, `app/(app)/caja/config.tsx`, `app/(app)/(tabs)/perfil.tsx`, `app/(app)/balance/index.tsx`, `app/(app)/gastos/pagar.tsx`, y ~20 pantallas con el fix de safe-area (§9).
