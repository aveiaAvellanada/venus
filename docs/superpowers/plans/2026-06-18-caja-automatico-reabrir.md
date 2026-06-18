# Caja: reabrir mismo día + modo automático — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir reabrir la caja del mismo día y agregar un modo automático que abre/cierra la caja por horario configurable, enviando el correo del reporte al cierre.

**Architecture:** La lógica de decisión (abrir/cerrar/nada según hora y estado) es una función pura testeada en `lib/cajaScheduler.ts`. Una Edge Function `caja-scheduler` (Deno, `service_role`) la usa para hacer el IO contra Supabase y se dispara cada 15 min vía `pg_cron` + `pg_net`. El resto son cambios de UI y dos migraciones (tabla de config y trigger de auditoría).

**Tech Stack:** React Native/Expo + TypeScript estricto, expo-router, Supabase (PostgreSQL 17, RLS, RPC, Edge Functions Deno), Jest (jest-expo), pg_cron + pg_net + Supabase Vault.

## Global Constraints

- TypeScript estricto en todo el proyecto (`tsc --noEmit` debe salir 0).
- Toda la UI en español.
- RLS activado en todas las tablas; la lógica de negocio sensible va en RPC/funciones.
- Health check del proyecto: `tsc --noEmit` limpio **y** `npm test` verde antes de cada commit final de tarea.
- Convención de migraciones: `supabase/migrations/YYYYMMDDHHMMSS_nombre.sql` (timestamp creciente; si colisiona, súbelo 1s).
- Proyecto Supabase ref: `xqspsaghukeynlizbjvc`; URL base de funciones: `https://xqspsaghukeynlizbjvc.supabase.co/functions/v1/`.
- Los wrappers finos de Supabase NO se unit-testean (convención del repo: se mockea `./supabase` como `{}` y solo se prueba lógica pura); se validan con smoke SQL + `tsc` + prueba en dispositivo.
- Patrón de auditoría existente: triggers `private.set_audit_fields` y `private.set_updated_at`. Helpers de rol: `private.is_owner()`, `private.is_staff_admin()`. Fecha local: `private.hoy_bogota()`.

---

## File Structure

- `supabase/migrations/<ts>_caja_config.sql` — tabla singleton `caja_config` + RLS + seed.
- `supabase/migrations/<ts>_caja_cerrado_por.sql` — trigger `set_cerrado_por` sobre `cierres_caja`.
- `supabase/migrations/<ts>_caja_scheduler_cron.sql` — extensiones + `cron.schedule` (lee la key de Vault).
- `supabase/tests/smoke_test_caja_config.sql` — smoke RLS de `caja_config`.
- `supabase/tests/smoke_test_caja_cerrado_por.sql` — smoke del trigger.
- `lib/cajaScheduler.ts` — **pura**: `decidirAccionCaja()` (+ tipos). Testeada.
- `lib/cajaScheduler.test.ts` — tests Jest de `decidirAccionCaja`.
- `lib/caja.ts` — agregar `reabrirCaja()`.
- `supabase/functions/caja-scheduler/index.ts` — Edge Function (Deno) del modo automático.
- `app/(app)/caja/index.tsx` — botón "Abrir caja de nuevo" cuando está cerrada.
- `app/(app)/caja/_layout.tsx` — header Historial para dueño+admin; registrar screen `config` + acceso (solo dueño).
- `app/(app)/caja/historial.tsx` — permitir admin; mostrar quién cerró.
- `app/(app)/caja/config.tsx` — **nueva** pantalla de horarios (solo dueño).

---

## Task 1: Migración `caja_config` (tabla singleton + RLS)

**Files:**
- Create: `supabase/migrations/<ts>_caja_config.sql`
- Test: `supabase/tests/smoke_test_caja_config.sql`

**Interfaces:**
- Produces: tabla `public.caja_config` con columnas `id, modo_automatico boolean, hora_apertura time, hora_cierre time, created_at, updated_at, created_by, updated_by`; una única fila sembrada.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/<ts>_caja_config.sql` (usa un timestamp posterior a `20260618032754`):

```sql
-- Caja: configuración de horarios del modo automático (singleton, solo dueño).
create table if not exists public.caja_config (
  id              uuid primary key default gen_random_uuid(),
  modo_automatico boolean not null default false,
  hora_apertura   time,
  hora_cierre     time,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null,
  updated_by      uuid references public.users(id) on delete set null
);

drop trigger if exists trg_caja_config_audit on public.caja_config;
create trigger trg_caja_config_audit before insert or update on public.caja_config
  for each row execute function private.set_audit_fields();
drop trigger if exists trg_caja_config_updated_at on public.caja_config;
create trigger trg_caja_config_updated_at before update on public.caja_config
  for each row execute function private.set_updated_at();

alter table public.caja_config enable row level security;
drop policy if exists caja_config_sel on public.caja_config;
drop policy if exists caja_config_upd on public.caja_config;
create policy caja_config_sel on public.caja_config for select to authenticated using (private.is_owner());
create policy caja_config_upd on public.caja_config for update to authenticated using (private.is_owner()) with check (private.is_owner());

revoke insert, update, delete on public.caja_config from authenticated;
grant select on public.caja_config to authenticated;
grant update on public.caja_config to authenticated;
grant select, insert, update, delete on public.caja_config to service_role;

insert into public.caja_config (modo_automatico) values (false);
```

- [ ] **Step 2: Aplicar la migración**

Aplicar vía MCP Supabase `apply_migration` (name: `caja_config`, query = contenido del archivo) sobre el proyecto `xqspsaghukeynlizbjvc`.
Expected: sin error; `select count(*) from public.caja_config;` devuelve 1.

- [ ] **Step 3: Escribir el smoke test**

Crear `supabase/tests/smoke_test_caja_config.sql`:

```sql
-- Verifica que existe exactamente una fila de config y default en false.
do $$
declare n int; v boolean;
begin
  select count(*), bool_or(modo_automatico) into n, v from public.caja_config;
  assert n = 1, 'caja_config debe tener exactamente 1 fila, hay ' || n;
  assert v = false, 'modo_automatico default debe ser false';
end $$;
```

- [ ] **Step 4: Ejecutar el smoke test**

Ejecutar el contenido vía MCP `execute_sql` sobre `xqspsaghukeynlizbjvc`.
Expected: sin error (los `assert` pasan).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_caja_config.sql supabase/tests/smoke_test_caja_config.sql
git commit -m "feat(caja): tabla caja_config (singleton, solo dueño) + RLS"
```

---

## Task 2: Trigger `set_cerrado_por` en `cierres_caja`

**Files:**
- Create: `supabase/migrations/<ts>_caja_cerrado_por.sql`
- Test: `supabase/tests/smoke_test_caja_cerrado_por.sql`

**Interfaces:**
- Produces: al pasar `cierres_caja.estado` a `'cerrada'` con `cerrado_por` nulo, se fija `cerrado_por = auth.uid()` (null cuando cierra el `service_role`).

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/<ts>_caja_cerrado_por.sql`:

```sql
-- Audita quién cerró la caja. Manual: auth.uid(); automático (service_role): null = "sistema".
create or replace function private.set_cerrado_por()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'cerrada' and old.estado is distinct from 'cerrada'
     and new.cerrado_por is null then
    new.cerrado_por := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists trg_cierres_set_cerrado_por on public.cierres_caja;
create trigger trg_cierres_set_cerrado_por before update on public.cierres_caja
  for each row execute function private.set_cerrado_por();
```

- [ ] **Step 2: Aplicar la migración**

Aplicar vía MCP `apply_migration` (name: `caja_cerrado_por`). Expected: sin error.

- [ ] **Step 3: Escribir el smoke test**

Crear `supabase/tests/smoke_test_caja_cerrado_por.sql`:

```sql
-- Cierre vía service_role (sin auth.uid()) deja cerrado_por null = sistema.
do $$
declare v_id uuid; v_cp uuid;
begin
  insert into public.cierres_caja (fecha, estado, modo, apertura_at)
  values (date '1999-01-01', 'abierta', 'automatico', now())
  returning id into v_id;

  update public.cierres_caja set estado = 'cerrada', cierre_at = now() where id = v_id;
  select cerrado_por into v_cp from public.cierres_caja where id = v_id;
  assert v_cp is null, 'cierre por service_role debe dejar cerrado_por null';

  delete from public.cierres_caja where id = v_id;
end $$;
```

- [ ] **Step 4: Ejecutar el smoke test**

Ejecutar vía MCP `execute_sql`. Expected: sin error.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_caja_cerrado_por.sql supabase/tests/smoke_test_caja_cerrado_por.sql
git commit -m "feat(caja): trigger set_cerrado_por audita quién cerró"
```

---

## Task 3: Lógica pura de decisión del scheduler (TDD)

**Files:**
- Create: `lib/cajaScheduler.ts`
- Test: `lib/cajaScheduler.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AccionCaja = 'abrir' | 'cerrar_blando' | 'nada'
  export interface CajaConfigDec { modo_automatico: boolean; hora_apertura: string | null; hora_cierre: string | null }
  export interface CajaHoyDec { estado: 'abierta' | 'cerrada' }
  export function decidirAccionCaja(cfg: CajaConfigDec, ahoraHHMM: string, cajaHoy: CajaHoyDec | null): AccionCaja
  ```
  `ahoraHHMM`, `hora_apertura`, `hora_cierre` se comparan normalizados a `HH:MM` (se ignoran segundos). Se asume `hora_cierre > hora_apertura` el mismo día.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/cajaScheduler.test.ts`:

```ts
import { decidirAccionCaja } from './cajaScheduler'

const cfg = { modo_automatico: true, hora_apertura: '06:00', hora_cierre: '23:00' }

describe('decidirAccionCaja', () => {
  it('no hace nada si el modo automático está apagado', () => {
    expect(decidirAccionCaja({ ...cfg, modo_automatico: false }, '07:00', null)).toBe('nada')
  })
  it('no hace nada si faltan horas configuradas', () => {
    expect(decidirAccionCaja({ modo_automatico: true, hora_apertura: null, hora_cierre: '23:00' }, '07:00', null)).toBe('nada')
  })
  it('abre si pasó la apertura, antes del cierre y no hay caja', () => {
    expect(decidirAccionCaja(cfg, '06:00', null)).toBe('abrir')
    expect(decidirAccionCaja(cfg, '12:30', null)).toBe('abrir')
  })
  it('no abre si ya existe la caja de hoy', () => {
    expect(decidirAccionCaja(cfg, '12:30', { estado: 'abierta' })).toBe('nada')
    expect(decidirAccionCaja(cfg, '12:30', { estado: 'cerrada' })).toBe('nada')
  })
  it('no abre antes de la hora de apertura', () => {
    expect(decidirAccionCaja(cfg, '05:59', null)).toBe('nada')
  })
  it('cierra (blando) si pasó el cierre y la caja sigue abierta', () => {
    expect(decidirAccionCaja(cfg, '23:00', { estado: 'abierta' })).toBe('cerrar_blando')
    expect(decidirAccionCaja(cfg, '23:45', { estado: 'abierta' })).toBe('cerrar_blando')
  })
  it('no recierra si la caja ya está cerrada', () => {
    expect(decidirAccionCaja(cfg, '23:30', { estado: 'cerrada' })).toBe('nada')
  })
  it('no cierra ni reabre si pasó el cierre y no hay caja', () => {
    expect(decidirAccionCaja(cfg, '23:30', null)).toBe('nada')
  })
  it('ignora los segundos al comparar', () => {
    expect(decidirAccionCaja(cfg, '23:00:30', { estado: 'abierta' })).toBe('cerrar_blando')
  })
})
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- cajaScheduler`
Expected: FAIL ("Cannot find module './cajaScheduler'").

- [ ] **Step 3: Implementar `lib/cajaScheduler.ts`**

```ts
export type AccionCaja = 'abrir' | 'cerrar_blando' | 'nada'

export interface CajaConfigDec {
  modo_automatico: boolean
  hora_apertura: string | null
  hora_cierre: string | null
}

export interface CajaHoyDec {
  estado: 'abierta' | 'cerrada'
}

const hhmm = (t: string) => t.slice(0, 5)

export function decidirAccionCaja(
  cfg: CajaConfigDec,
  ahoraHHMM: string,
  cajaHoy: CajaHoyDec | null,
): AccionCaja {
  if (!cfg.modo_automatico || !cfg.hora_apertura || !cfg.hora_cierre) return 'nada'
  const ahora = hhmm(ahoraHHMM)
  const apertura = hhmm(cfg.hora_apertura)
  const cierre = hhmm(cfg.hora_cierre)

  if (ahora >= cierre) {
    return cajaHoy?.estado === 'abierta' ? 'cerrar_blando' : 'nada'
  }
  if (ahora >= apertura) {
    return cajaHoy ? 'nada' : 'abrir'
  }
  return 'nada'
}
```

- [ ] **Step 4: Correr el test para verlo pasar**

Run: `npm test -- cajaScheduler`
Expected: PASS (todos los casos).

- [ ] **Step 5: Commit**

```bash
git add lib/cajaScheduler.ts lib/cajaScheduler.test.ts
git commit -m "feat(caja): decidirAccionCaja — lógica pura del scheduler (TDD)"
```

---

## Task 4: `reabrirCaja()` + botón "Abrir caja de nuevo"

**Files:**
- Modify: `lib/caja.ts` (agregar `reabrirCaja`)
- Modify: `app/(app)/caja/index.tsx` (botón cuando `estado === 'cerrada'`)

**Interfaces:**
- Consumes: `obtenerCajaHoy()` de `lib/caja.ts`.
- Produces: `export async function reabrirCaja(): Promise<any>` — UPDATE de la fila de hoy a `abierta`, limpiando campos de cierre.

- [ ] **Step 1: Agregar `reabrirCaja` en `lib/caja.ts`**

Al final del archivo:

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

- [ ] **Step 2: Agregar el botón en `index.tsx`**

En `app/(app)/caja/index.tsx`: importar `reabrirCaja` junto a las demás (`import { obtenerCajaHoy, abrirCaja, reabrirCaja, obtenerResumenEnVivo } from '../../../lib/caja'`).

Agregar handler dentro del componente (junto a `handleAbrir`):

```tsx
async function handleReabrir() {
  setAbriendo(true)
  try {
    await reabrirCaja()
    await cargarDatos()
  } catch (e) {
    console.error(e)
  } finally {
    setAbriendo(false)
  }
}
```

En el bloque de retorno, reemplazar el botón de cierre condicional para incluir el caso cerrado. Sustituir:

```tsx
      {isAbierto && (
        <Pressable style={styles.btnCerrar} onPress={() => router.push('/caja/cierre')}>
          <Text style={styles.btnCerrarText}>Ir a Cerrar Caja</Text>
        </Pressable>
      )}
```

por:

```tsx
      {isAbierto ? (
        <Pressable style={styles.btnCerrar} onPress={() => router.push('/caja/cierre')}>
          <Text style={styles.btnCerrarText}>Ir a Cerrar Caja</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.btnGigante} onPress={handleReabrir} disabled={abriendo}>
          {abriendo ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnGiganteText}>Abrir caja de nuevo</Text>}
        </Pressable>
      )}
```

- [ ] **Step 3: Verificar tipos y tests**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` exit 0; suite verde (220/220 + el nuevo de Task 3).

- [ ] **Step 4: Commit**

```bash
git add lib/caja.ts "app/(app)/caja/index.tsx"
git commit -m "feat(caja): reabrir la caja del mismo día desde el dashboard"
```

---

## Task 5: Historial para dueño + admin y mostrar quién cerró

**Files:**
- Modify: `app/(app)/caja/_layout.tsx` (header Historial visible para dueño+admin)
- Modify: `app/(app)/caja/historial.tsx` (permitir admin; mostrar `cerrado_por`)

**Interfaces:**
- Consumes: `perfil` de `useAuth()` (`rol: 'dueno' | 'admin' | 'empleado'`); columna `cierres_caja.cerrado_por` (uuid o null).

- [ ] **Step 1: `_layout.tsx` — mostrar "Historial" a dueño y admin**

Reemplazar la condición del `headerRight` del screen `index`:

```tsx
          headerRight: () => (perfil?.rol === 'dueno' || perfil?.rol === 'admin') ? (
            <Pressable onPress={() => router.push('/caja/historial')} hitSlop={10}>
              <Text style={{ color: '#1E66F5', fontWeight: 'bold', fontSize: 16 }}>Historial</Text>
            </Pressable>
          ) : null
```

- [ ] **Step 2: `historial.tsx` — permitir admin y traer el nombre de quién cerró**

Reemplazar las dos comprobaciones `perfil?.rol !== 'dueno'` por una constante al inicio del componente:

```tsx
  const puedeVer = perfil?.rol === 'dueno' || perfil?.rol === 'admin'
```

- En el `useEffect`, cambiar `if (perfil?.rol !== 'dueno') return` por `if (!puedeVer) return`, y traer el nombre del que cerró:

```tsx
      const { data, error } = await supabase
        .from('cierres_caja')
        .select('*, cerrado_por_user:users!cerrado_por(nombre)')
        .order('fecha', { ascending: false })
```

- En el `if (perfil?.rol !== 'dueno')` del render, usar `if (!puedeVer) return <Redirect href="/caja" />`.
- Dentro del `renderItem`, debajo de la fila de totales, agregar la línea de quién cerró (solo si está cerrada):

```tsx
              {item.estado === 'cerrada' && (
                <Text style={styles.nota}>
                  Cerró: {item.cerrado_por_user?.nombre ?? 'Automático'}
                </Text>
              )}
```

- [ ] **Step 3: Verificar tipos y tests**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` exit 0; suite verde.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/caja/_layout.tsx" "app/(app)/caja/historial.tsx"
git commit -m "feat(caja): historial para dueño+admin y mostrar quién cerró"
```

---

## Task 6: Pantalla de configuración de horarios (solo dueño)

**Files:**
- Create: `app/(app)/caja/config.tsx`
- Modify: `app/(app)/caja/_layout.tsx` (registrar screen `config` + acceso en header del index para dueño)

**Interfaces:**
- Consumes: tabla `public.caja_config` (Task 1); `useAuth()`.

- [ ] **Step 1: Crear `app/(app)/caja/config.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TextInput, Switch, Pressable, ActivityIndicator, Alert } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { useAuth } from '../../../lib/auth'
import { supabase } from '../../../lib/supabase'

export default function CajaConfig() {
  const { perfil } = useAuth()
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [auto, setAuto] = useState(false)
  const [apertura, setApertura] = useState('')   // 'HH:MM'
  const [cierre, setCierre] = useState('')        // 'HH:MM'

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('caja_config').select('*').limit(1).single()
      if (data) {
        setAuto(data.modo_automatico)
        setApertura((data.hora_apertura ?? '').slice(0, 5))
        setCierre((data.hora_cierre ?? '').slice(0, 5))
      }
      setCargando(false)
    }
    if (perfil?.rol === 'dueno') load()
  }, [perfil])

  if (perfil?.rol !== 'dueno') return <Redirect href="/caja" />
  if (cargando) {
    return <View style={[styles.container, styles.centro]}><ActivityIndicator size="large" color="#1E66F5" /></View>
  }

  const validHora = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

  async function guardar() {
    if (auto && (!validHora(apertura) || !validHora(cierre))) {
      Alert.alert('Horas inválidas', 'Usa el formato HH:MM (ej. 06:00 y 23:00).'); return
    }
    if (auto && cierre <= apertura) {
      Alert.alert('Horario inválido', 'La hora de cierre debe ser posterior a la de apertura.'); return
    }
    setGuardando(true)
    const { error } = await supabase.from('caja_config').update({
      modo_automatico: auto,
      hora_apertura: auto ? apertura : null,
      hora_cierre: auto ? cierre : null,
    }).not('id', 'is', null)
    setGuardando(false)
    if (error) { Alert.alert('Error', error.message); return }
    Alert.alert('Guardado', 'La configuración de caja se actualizó.', [{ text: 'OK', onPress: () => router.back() }])
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Horario automático de Caja</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Modo automático</Text>
        <Switch value={auto} onValueChange={setAuto} />
      </View>
      {auto && (
        <>
          <Text style={styles.label}>Hora de apertura (HH:MM)</Text>
          <TextInput style={styles.input} placeholder="06:00" value={apertura} onChangeText={setApertura} keyboardType="numbers-and-punctuation" />
          <Text style={styles.label}>Hora de cierre (HH:MM)</Text>
          <TextInput style={styles.input} placeholder="23:00" value={cierre} onChangeText={setCierre} keyboardType="numbers-and-punctuation" />
          <Text style={styles.hint}>El cierre automático calcula los totales del sistema y envía el reporte por correo. No cuenta el efectivo físico.</Text>
        </>
      )}
      <Pressable style={[styles.btn, guardando && { opacity: 0.7 }]} onPress={guardar} disabled={guardando}>
        {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Guardar</Text>}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, gap: 16 },
  centro: { justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '600', color: '#334155' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', padding: 14, borderRadius: 12, fontSize: 18 },
  hint: { fontSize: 13, color: '#64748B' },
  btn: { backgroundColor: '#1E66F5', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
})
```

- [ ] **Step 2: Registrar la screen y el acceso en `_layout.tsx`**

Agregar dentro del `<Stack>`:

```tsx
      <Stack.Screen name="config" options={{ title: 'Configurar Caja' }} />
```

Y en el `headerRight` del screen `index`, para el dueño, ofrecer también el acceso a config. Reemplazar el `headerRight` (que en Task 5 ya muestra "Historial" a dueño+admin) por uno que para el dueño muestre ambos enlaces:

```tsx
          headerRight: () => {
            const esDuenoAdmin = perfil?.rol === 'dueno' || perfil?.rol === 'admin'
            if (!esDuenoAdmin) return null
            return (
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {perfil?.rol === 'dueno' && (
                  <Pressable onPress={() => router.push('/caja/config')} hitSlop={10}>
                    <Text style={{ color: '#1E66F5', fontWeight: 'bold', fontSize: 16 }}>Config</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => router.push('/caja/historial')} hitSlop={10}>
                  <Text style={{ color: '#1E66F5', fontWeight: 'bold', fontSize: 16 }}>Historial</Text>
                </Pressable>
              </View>
            )
          }
```

Añadir `View` al import de `react-native` en `_layout.tsx` (`import { Pressable, Text, View } from 'react-native'`).

- [ ] **Step 3: Verificar tipos y tests**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` exit 0; suite verde.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/caja/config.tsx" "app/(app)/caja/_layout.tsx"
git commit -m "feat(caja): pantalla de configuración de horario automático (solo dueño)"
```

---

## Task 7: Edge Function `caja-scheduler`

**Files:**
- Create: `supabase/functions/caja-scheduler/index.ts`

**Interfaces:**
- Consumes: `caja_config`, `cierres_caja`, RPC `obtener_resumen_dia(p_fecha)`, función `enviar-reporte-diario`. Replica la regla pura de `decidirAccionCaja` (Task 3) — la canónica testeada vive en `lib/cajaScheduler.ts`.
- Produces: endpoint POST que, según la hora Bogotá, abre o cierra-blando la caja del día y dispara el correo al cerrar. Idempotente.

- [ ] **Step 1: Implementar la función**

Crear `supabase/functions/caja-scheduler/index.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Réplica de la regla pura testeada en lib/cajaScheduler.ts (runtime Deno separado).
type Accion = 'abrir' | 'cerrar_blando' | 'nada'
const hhmm = (t: string) => t.slice(0, 5)
function decidirAccionCaja(
  cfg: { modo_automatico: boolean; hora_apertura: string | null; hora_cierre: string | null },
  ahora: string,
  caja: { estado: string } | null,
): Accion {
  if (!cfg.modo_automatico || !cfg.hora_apertura || !cfg.hora_cierre) return 'nada'
  const a = hhmm(ahora), ap = hhmm(cfg.hora_apertura), ci = hhmm(cfg.hora_cierre)
  if (a >= ci) return caja?.estado === 'abierta' ? 'cerrar_blando' : 'nada'
  if (a >= ap) return caja ? 'nada' : 'abrir'
  return 'nada'
}

Deno.serve(async () => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, key)

    const ahoraBogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const fecha = ahoraBogota.toLocaleDateString('en-CA') // YYYY-MM-DD
    const horaHHMM = ahoraBogota.toTimeString().slice(0, 5) // HH:MM

    const { data: cfg } = await admin.from('caja_config').select('*').limit(1).single()
    if (!cfg) return json({ skipped: 'sin_config' })

    const { data: caja } = await admin.from('cierres_caja').select('*').eq('fecha', fecha).maybeSingle()
    const accion = decidirAccionCaja(cfg, horaHHMM, caja)

    if (accion === 'abrir') {
      const { error } = await admin.from('cierres_caja').insert({
        fecha, estado: 'abierta', modo: 'automatico', apertura_at: new Date().toISOString(),
        total_ventas: 0, total_general: 0, total_efectivo: 0, total_nequi: 0, total_daviplata: 0,
      })
      if (error) throw error
      return json({ accion: 'abierta', fecha })
    }

    if (accion === 'cerrar_blando') {
      const { data: r } = await admin.rpc('obtener_resumen_dia', { p_fecha: fecha })
      const res = (r ?? {}) as Record<string, number>
      const { error } = await admin.from('cierres_caja').update({
        estado: 'cerrada', cierre_at: new Date().toISOString(),
        total_ventas: Number(res.total_ventas ?? 0), total_general: Number(res.total_general ?? 0),
        total_efectivo: Number(res.total_efectivo ?? 0), total_nequi: Number(res.total_nequi ?? 0),
        total_daviplata: Number(res.total_daviplata ?? 0),
        efectivo_contado: null, diferencia: null, diferencia_nota: null,
      }).eq('id', caja!.id)
      if (error) throw error

      // Dispara el correo del reporte (idempotente por reporte_envios). Fire-and-forget.
      fetch(`${url}/functions/v1/enviar-reporte-diario`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha }),
      }).catch((e) => console.warn('reporte no disparado:', e))

      return json({ accion: 'cerrada_blando', fecha })
    }

    return json({ accion: 'nada', fecha, hora: horaHHMM })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
```

- [ ] **Step 2: Desplegar la función**

Desplegar vía MCP Supabase `deploy_edge_function` (name: `caja-scheduler`, contenido del archivo) sobre `xqspsaghukeynlizbjvc`.
Expected: despliegue OK; aparece en `list_edge_functions`.

- [ ] **Step 3: Probar manualmente la idempotencia**

Con `caja_config.modo_automatico=false`, invocar la función (MCP `execute_sql` con `net.http_post`, o `curl` desde `!`): debe responder `{"accion":"nada"...}` o `{"skipped":...}`.
Activar `modo_automatico=true`, `hora_apertura='00:00'`, `hora_cierre='23:59'` temporalmente y, sin fila de hoy, invocar: debe crear la caja (`accion: abierta`). Invocar de nuevo: `accion: nada` (no duplica). Restaurar la config de prueba después.
Expected: comportamiento idempotente confirmado.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/caja-scheduler/index.ts
git commit -m "feat(caja): Edge Function caja-scheduler (abre/cierra blando + dispara correo)"
```

---

## Task 8: Agendar el scheduler con pg_cron + pg_net (vía Vault)

**Files:**
- Create: `supabase/migrations/<ts>_caja_scheduler_cron.sql`

**Interfaces:**
- Consumes: la Edge Function `caja-scheduler` desplegada (Task 7); secreto `service_role_key` guardado en Supabase Vault.
- Produces: un job `cron.schedule` que invoca la función cada 15 min.

- [ ] **Step 1: Guardar el service_role key en Vault**

Vía MCP `execute_sql` (NO commitear la key en SQL):

```sql
select vault.create_secret('<SERVICE_ROLE_KEY_AQUI>', 'service_role_key', 'Key para jobs de cron');
```

Expected: devuelve un uuid. (Si ya existe, omitir.)

- [ ] **Step 2: Escribir la migración del cron**

Crear `supabase/migrations/<ts>_caja_scheduler_cron.sql` (sin secretos; lee de Vault):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Limpia un agendado previo con el mismo nombre (idempotente al reaplicar).
select cron.unschedule('caja-scheduler-15m')
where exists (select 1 from cron.job where jobname = 'caja-scheduler-15m');

select cron.schedule(
  'caja-scheduler-15m',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://xqspsaghukeynlizbjvc.supabase.co/functions/v1/caja-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 3: Aplicar la migración**

Aplicar vía MCP `apply_migration` (name: `caja_scheduler_cron`).
Expected: sin error; `select jobname, schedule from cron.job where jobname = 'caja-scheduler-15m';` devuelve la fila.

- [ ] **Step 4: Verificar una corrida**

Esperar a la siguiente marca de 15 min (o invocar `caja-scheduler` manualmente) y revisar:

```sql
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'caja-scheduler-15m')
order by start_time desc limit 3;
```

Expected: corridas con `status = 'succeeded'`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_caja_scheduler_cron.sql
git commit -m "feat(caja): agenda caja-scheduler cada 15 min (pg_cron+pg_net via Vault)"
```

---

## Verificación final (después de todas las tareas)

- [ ] `npx tsc --noEmit` → exit 0.
- [ ] `npm test` → suite verde (incluye `lib/cajaScheduler.test.ts`).
- [ ] Smoke SQL de Tasks 1 y 2 sin errores.
- [ ] En dispositivo: cerrar caja → aparece "Abrir caja de nuevo" → reabre. Sandra ve "Historial". Dueño ve "Config" y puede fijar horario.
- [ ] Registrar el cierre de la migración de roles/estado en `claude-mem` (sp9-balance-reportes-state) y actualizar `openspec/changes/tasks.json`.

## Notas de cobertura del spec

- §4.1 caja_config → Task 1. §4.2 cerrado_por → Task 2. §5.1 reabrirCaja → Task 4.
- §6.1 botón reabrir → Task 4. §6.2/§6.3 historial+layout → Tasks 5/6. §6.4 config → Task 6.
- §7 scheduler/cierre blando/correo → Tasks 3 (lógica) + 7 (función) + 8 (agenda).
- §8 permisos: sin cambios de RLS (ya soportado); UI alineada en Tasks 4–6.
- §10 limitaciones (WhatsApp asistido, sin cuadre físico, corre todos los días): respetadas; no se construye WhatsApp automático.
