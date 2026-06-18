# Diseño — Caja: reabrir mismo día + modo automático

**Fecha:** 2026-06-18
**Módulo:** 7 — Caja
**Rama:** `feat/caja-automatico-reabrir`
**Estado:** aprobado en brainstorming, pendiente de revisión del spec

---

## 1. Contexto y problema

La Caja registra un ciclo de apertura/cierre por día (tabla `cierres_caja` con
`unique (fecha)`). Hoy:

1. **No hay forma de reabrir una caja cerrada.** El botón "Abrir Caja del Día"
   solo se renderiza cuando no existe fila de hoy (`!estadoCaja`). Si la caja de
   hoy queda `cerrada` (por error o por una prueba), la pantalla muestra un
   resumen de solo lectura sin acción, y el `unique (fecha)` impide insertar otra
   fila. Queda bloqueado el resto del día.
2. **El modo automático del PRD §3.7.1 no existe.** `abrirCaja()` siempre escribe
   `modo: 'manual'`; no hay configuración de horarios ni job programado.
3. **El historial** está limitado en la UI a `rol === 'dueno'`, pero la RLS lo
   permite a dueño+admin; Sandra debe poder verlo.
4. **`cerrado_por`** existe en la tabla pero no se llena al cerrar.

## 2. Decisiones tomadas (brainstorming)

- **Reabrir mismo día:** permitido, para **todos los roles** (igual que abrir/
  cerrar). Abrir y cerrar varias veces el mismo día es válido.
- **Cierre automático:** **cierre "blando"** — a la hora fijada marca `cerrada`
  con los totales del sistema, **sin** `efectivo_contado` ni `diferencia`, y
  dispara el correo del reporte. El cuadre físico esos días no se hace.
- **Manual vs automático:** los botones manuales (abrir/cerrar/reabrir) están
  **siempre disponibles**, incluso en modo automático (red de seguridad).
- **Historial:** visible para **dueño + admin**.
- **WhatsApp:** se mantiene **asistido** (link `wa.me` que envía un humano). El
  cierre automático envía **solo correo** (Resend, ya automatizado). No se
  integra WhatsApp Business API en esta entrega.

## 3. Alcance

**Incluye:**
- Reabrir caja del día (UI + `lib/caja.ts` + sin cambios de RLS).
- Historial para dueño + admin (solo UI).
- `cerrado_por` al cerrar (trigger).
- Tabla `caja_config` + pantalla de configuración de horarios (solo dueño).
- Edge Function `caja-scheduler` + agendado con `pg_cron` + `pg_net`.

**No incluye (fuera de alcance):**
- WhatsApp automático (queda asistido; sin Cloud API).
- Cuadre físico en el cierre automático.
- Programación por día de la semana / festivos (el automático corre todos los
  días; ver §10).

---

## 4. Cambios en el modelo de datos

### 4.1 Nueva tabla `public.caja_config` (singleton, solo dueño)

```sql
create table public.caja_config (
  id               uuid primary key default gen_random_uuid(),
  modo_automatico  boolean not null default false,
  hora_apertura    time,            -- hora local Bogotá, p.ej. 06:00
  hora_cierre      time,            -- hora local Bogotá, p.ej. 23:00
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.users(id) on delete set null,
  updated_by       uuid references public.users(id) on delete set null
);
```

- Auditoría: triggers `set_audit_fields` + `set_updated_at` (patrón existente).
- Se siembra **una** fila: `insert into public.caja_config (modo_automatico) values (false);`
- RLS (idéntico patrón a `reporte_config`):
  - SELECT/UPDATE solo `private.is_owner()`.
  - `revoke insert, update, delete ... from authenticated; grant update ... to authenticated; grant all ... to service_role`.
  - La Edge Function lee con `service_role`.

### 4.2 Trigger `cerrado_por` en `cierres_caja`

Trigger `before update` que, cuando `estado` pasa a `'cerrada'` y `cerrado_por`
viene nulo, lo fija a `auth.uid()`:

```sql
create or replace function private.set_cerrado_por()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'cerrada' and old.estado is distinct from 'cerrada'
     and new.cerrado_por is null then
    new.cerrado_por := auth.uid();   -- null cuando cierra el service_role (sistema)
  end if;
  return new;
end $$;
```

- **Manual:** el cliente está autenticado → `auth.uid()` = quién cerró.
- **Automático:** corre con `service_role` → `auth.uid()` null = "sistema"
  (representación correcta de un cierre automático).
- No requiere cambios en el cliente para llenar el campo.

---

## 5. Capa de datos (`lib/caja.ts`)

### 5.1 `reabrirCaja()` (nueva)

```ts
export async function reabrirCaja() {
  const caja = await obtenerCajaHoy()
  if (!caja) throw new Error('No hay caja de hoy para reabrir.')
  if (caja.estado === 'abierta') return caja
  const { data, error } = await supabase
    .from('cierres_caja')
    .update({
      estado: 'abierta',
      cierre_at: null,
      efectivo_contado: null,
      diferencia: null,
      diferencia_nota: null,
    })
    .eq('id', caja.id)
    .select()
    .single()
  if (error) throw error
  return data
}
```

- No inserta (respeta `unique (fecha)`); la RLS de update de la fila de hoy ya
  lo permite para cualquier rol.

### 5.2 `cerrarCaja()` (sin cambio funcional)

El `cerrado_por` lo pone el trigger; no se toca la firma. (Opcional: dejar de
depender del trigger no es necesario.)

---

## 6. Cambios de UI

### 6.1 `app/(app)/caja/index.tsx`

- Cuando `estadoCaja.estado === 'cerrada'`: además del "Resumen Final de Caja",
  mostrar botón **"Abrir caja de nuevo"** que llama a `reabrirCaja()` y recarga.
- Estados de carga/spinner como el botón de abrir existente.

### 6.2 `app/(app)/caja/_layout.tsx`

- Header `index`: mostrar el botón **"Historial"** para `dueno` **o** `admin`.
- Agregar `<Stack.Screen name="config" .../>` para la pantalla de configuración,
  y un acceso a config en el header (solo `dueno`).

### 6.3 `app/(app)/caja/historial.tsx`

- Cambiar el gate `perfil?.rol !== 'dueno'` por permitir `dueno` **y** `admin`.
- Mostrar **quién cerró** (`cerrado_por`) cuando exista (null = "Automático").

### 6.4 `app/(app)/caja/config.tsx` (nueva, solo dueño)

- Toggle "Modo automático", e inputs de `hora_apertura` y `hora_cierre`.
- Carga/guarda la fila única de `caja_config`. Redirige a `/caja` si no es dueño.

---

## 7. Modo automático — Edge Function `caja-scheduler`

### 7.1 Responsabilidad

Función Deno en `supabase/functions/caja-scheduler/index.ts`, invocada cada
~15 min, con `service_role`. Idempotente. Lógica en hora local Bogotá:

1. Leer `caja_config`. Si `modo_automatico = false` → `skipped`.
2. Calcular `hoy` (fecha Bogotá) y `ahora` (hora Bogotá).
3. **Abrir:** si `ahora >= hora_apertura` y `ahora < hora_cierre` y **no existe**
   fila de hoy → insertar `estado='abierta'`, `modo='automatico'`, totales 0.
4. **Cerrar (blando):** si `ahora >= hora_cierre` y la fila de hoy está
   `abierta` → `update` a `estado='cerrada'`, `cierre_at=now()`, totales del
   sistema (vía `obtener_resumen_dia`), `efectivo_contado=null`,
   `diferencia=null`. Luego invocar el envío del **correo** reutilizando
   `enviar-reporte-diario` (idempotente por `reporte_envios`).

### 7.2 Idempotencia y auto-recuperación

- Abrir solo si no hay fila → no duplica (y el `unique (fecha)` es respaldo).
- Cerrar solo si está `abierta` → no recierra.
- Si una corrida del cron se pierde, la siguiente (≤15 min después) ejecuta la
  acción pendiente. No depende de acertar el minuto exacto.

### 7.3 Agendado

- Instalar extensiones: `create extension if not exists pg_cron;` y
  `create extension if not exists pg_net;` (disponibles, sin instalar aún).
- `cron.schedule` cada 15 min hace un `net.http_post` a la URL de la función
  `caja-scheduler` con el header de autorización (`service_role`/secret).
- Alternativa equivalente: cron nativo de funciones de Supabase (si está
  disponible en el plan); no cambia la función, solo el disparador.

### 7.4 Reutilización del correo

`caja-scheduler` invoca la lógica de `enviar-reporte-diario` (HTTP interno o
función compartida). No se duplica la integración con Resend; el dedupe por
`reporte_envios` evita correos repetidos si el reporte ya salió ese día.

---

## 8. Permisos (resumen)

| Acción | Dueño | Admin | Empleado |
|---|:---:|:---:|:---:|
| Abrir / cerrar / **reabrir** caja de hoy | ✅ | ✅ | ✅ |
| Ver caja del día actual | ✅ | ✅ | ✅ |
| Ver **historial** | ✅ | ✅ | ❌ |
| Configurar horarios automáticos | ✅ | ❌ | ❌ |

Sin cambios en la RLS de `cierres_caja` (ya soporta reabrir y el histórico
dueño+admin). Solo se alinea la UI.

---

## 9. Pruebas

- **`lib/caja.test.ts` (o existente):** `reabrirCaja()` — caso cerrada→abierta
  limpia campos de cierre; caso sin caja lanza error; caso ya abierta es no-op.
- **Smoke SQL** `supabase/tests/smoke_test_caja_scheduler.sql`: simula
  `caja_config` con horas y verifica que la lógica de abrir/cerrar blando
  produce el estado esperado (a nivel de las consultas que usa la función).
- **Trigger `cerrado_por`:** smoke que cierra como usuario y verifica
  `cerrado_por = uid`; cierre vía service_role deja `cerrado_por null`.
- Verificación final: `tsc --noEmit` limpio + `npm test` verde.
- La Edge Function se prueba invocándola manualmente con distintas horas
  simuladas (parámetro de fecha/hora de override para test, como hace
  `enviar-reporte-diario` con `fecha`).

## 10. Limitaciones conocidas

- **WhatsApp** no se envía automáticamente (queda asistido). Consistente con M13.
- El cierre automático **no cuadra efectivo físico** (cierre blando por diseño).
- El automático corre **todos los días**; en días que la tienda no abre quedará
  una fila con totales 0 cerrada en blando (inofensivo). Si más adelante se
  quiere excluir domingos/festivos, se agrega a `caja_config` sin rehacer el
  resto.

## 11. Archivos afectados

- **Migraciones nuevas:** `caja_config` + RLS + seed; trigger `set_cerrado_por`;
  `create extension` pg_cron/pg_net + `cron.schedule`.
- **Edge Function nueva:** `supabase/functions/caja-scheduler/index.ts`.
- **`lib/caja.ts`:** `reabrirCaja()`.
- **UI:** `app/(app)/caja/index.tsx`, `_layout.tsx`, `historial.tsx`,
  `config.tsx` (nueva).
- **Tests:** unit de `reabrirCaja` + smoke SQL.
