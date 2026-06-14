# Auth + Navegación con Gating por Rol — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montar expo-router sobre el proyecto Venus con login usuario+PIN y navegación tipo cuadrícula gated por rol (`dueno`/`empleado`) desde un mapa de permisos central, con pantallas placeholder.

**Architecture:** Un solo grupo protegido `(app)` y un grupo `(auth)`; los `_layout.tsx` de cada grupo hacen `<Redirect>` según haya sesión. Un `AuthProvider` expone sesión + perfil (`rol`) y los hooks `useAuth`/`useRequireModulo`. `lib/permisos.ts` es la fuente única de verdad (qué rol ve/accede cada módulo); el home se genera desde ahí y cada pantalla se protege con el mismo mapa.

**Tech Stack:** Expo SDK 56, expo-router, React Native 0.85, TypeScript estricto, Supabase JS, Jest (jest-expo) para tests de funciones puras.

**Spec:** `docs/superpowers/specs/2026-06-13-auth-navegacion-rol-design.md`

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `package.json` | `main` → `expo-router/entry`; scripts test; config jest |
| `app.json` | agregar `scheme` |
| `app/_layout.tsx` | raíz: monta `AuthProvider`, muestra carga, `Stack` |
| `app/(auth)/_layout.tsx` | redirige a `/` si hay sesión |
| `app/(auth)/login.tsx` | picker de usuarios + PIN |
| `app/(app)/_layout.tsx` | redirige a `/login` si no hay sesión |
| `app/(app)/index.tsx` | home cuadrícula (desde `modulosPara`) |
| `app/(app)/modulo/[id].tsx` | placeholder protegido por `useRequireModulo` |
| `lib/permisos.ts` | mapa de módulos + `modulosPara` / `puedeAcceder` (puras) |
| `lib/permisos.test.ts` | tests Jest del mapa |
| `lib/usuarios.ts` | lista `{nombre,email}` para el picker pre-auth |
| `lib/auth.tsx` | `AuthProvider`, `useAuth`, `useRequireModulo` |

Eliminados: `App.tsx`, `index.ts` (reemplazados por la entry de expo-router).

---

## Task 1: Instalar expo-router y migrar la entry

**Files:**
- Modify: `package.json` (campo `main`)
- Modify: `app.json` (agregar `scheme`)
- Create: `app/_layout.tsx`
- Create: `app/(app)/index.tsx` (temporal mínimo, se reemplaza en Task 7)
- Delete: `App.tsx`, `index.ts`

- [ ] **Step 1: Instalar dependencias de expo-router**

Run:
```bash
cd ~/Development/work/Venus
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants react-native-gesture-handler
```
Expected: instala y actualiza `package.json` sin errores.

- [ ] **Step 2: Cambiar la entry en package.json**

En `package.json`, reemplazar la línea `"main": "index.ts",` por:
```json
  "main": "expo-router/entry",
```

- [ ] **Step 3: Agregar scheme en app.json**

En `app.json`, dentro de `"expo"`, agregar (después de `"slug": "Venus",`):
```json
    "scheme": "venus",
```

- [ ] **Step 4: Borrar la entry vieja**

Run:
```bash
rm App.tsx index.ts
```

- [ ] **Step 5: Crear el layout raíz mínimo**

Create `app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router'

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
```

- [ ] **Step 6: Crear un home temporal para arrancar**

Create `app/(app)/index.tsx`:
```tsx
import { Text, View } from 'react-native'

export default function Home() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Venus — arrancó expo-router</Text>
    </View>
  )
}
```

- [ ] **Step 7: Verificar que compila TypeScript**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 8: Verificar que la app arranca**

Run: `npx expo start --android` (o el dispositivo disponible). Confirmar que abre y muestra "Venus — arrancó expo-router". Detener con Ctrl+C.
Expected: la app monta sin error de bundling.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: instalar expo-router y migrar entry"
```

---

## Task 2: Mapa de permisos + tests (TDD)

**Files:**
- Create: `lib/permisos.ts`
- Test: `lib/permisos.test.ts`
- Modify: `package.json` (script test + config jest)

- [ ] **Step 1: Instalar Jest**

Run:
```bash
npx expo install jest-expo jest --dev
npm install --save-dev @types/jest
```
Expected: dependencias dev agregadas.

- [ ] **Step 2: Configurar Jest en package.json**

En `package.json`, agregar a `"scripts"`:
```json
    "test": "jest"
```
Y agregar al nivel raíz del objeto:
```json
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))"
    ]
  }
```

- [ ] **Step 3: Escribir el test que falla**

Create `lib/permisos.test.ts`:
```ts
import { MODULOS, modulosPara, puedeAcceder } from './permisos'

describe('permisos', () => {
  test('el dueño ve los 13 módulos', () => {
    expect(modulosPara('dueno')).toHaveLength(13)
  })

  test('el empleado ve exactamente 5 módulos', () => {
    const ids = modulosPara('empleado').map(m => m.id).sort()
    expect(ids).toEqual(
      ['cierre-caja', 'inventario-calzado', 'inventario-varios', 'recibir-mercancia', 'ventas'].sort()
    )
  })

  test('el empleado NO ve módulos financieros', () => {
    const idsEmpleado = modulosPara('empleado').map(m => m.id)
    for (const prohibido of ['balance', 'reportes', 'gastos-fijos', 'gastos-variables', 'analisis-ia', 'proveedores']) {
      expect(idsEmpleado).not.toContain(prohibido)
    }
  })

  test('puedeAcceder respeta el mapa', () => {
    expect(puedeAcceder('empleado', 'ventas')).toBe(true)
    expect(puedeAcceder('empleado', 'cierre-caja')).toBe(true)
    expect(puedeAcceder('empleado', 'balance')).toBe(false)
    expect(puedeAcceder('dueno', 'balance')).toBe(true)
  })

  test('puedeAcceder con id inexistente es false', () => {
    expect(puedeAcceder('dueno', 'no-existe')).toBe(false)
  })

  test('no hay ids de módulo duplicados', () => {
    const ids = MODULOS.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 4: Correr el test y ver que falla**

Run: `npm test`
Expected: FAIL — `Cannot find module './permisos'`.

- [ ] **Step 5: Implementar lib/permisos.ts**

Create `lib/permisos.ts`:
```ts
export type Rol = 'dueno' | 'empleado'

export interface Modulo {
  id: string
  titulo: string
  icono: string
  roles: Rol[]
}

export const MODULOS: Modulo[] = [
  { id: 'ventas',             titulo: 'Ventas',             icono: '🛒', roles: ['dueno', 'empleado'] },
  { id: 'inventario-calzado', titulo: 'Inventario calzado', icono: '👟', roles: ['dueno', 'empleado'] },
  { id: 'inventario-varios',  titulo: 'Productos varios',   icono: '📦', roles: ['dueno', 'empleado'] },
  { id: 'recibir-mercancia',  titulo: 'Recibir mercancía',  icono: '📥', roles: ['dueno', 'empleado'] },
  { id: 'cierre-caja',        titulo: 'Cierre de caja',     icono: '🧾', roles: ['dueno', 'empleado'] },
  { id: 'proveedores',        titulo: 'Proveedores',        icono: '🚚', roles: ['dueno'] },
  { id: 'empleado',           titulo: 'Empleado',           icono: '👤', roles: ['dueno'] },
  { id: 'reportes',           titulo: 'Reportes',           icono: '📊', roles: ['dueno'] },
  { id: 'analisis-ia',        titulo: 'Análisis IA',        icono: '🤖', roles: ['dueno'] },
  { id: 'gastos-fijos',       titulo: 'Gastos fijos',       icono: '📌', roles: ['dueno'] },
  { id: 'gastos-variables',   titulo: 'Gastos variables',   icono: '💸', roles: ['dueno'] },
  { id: 'balance',            titulo: 'Balance',            icono: '⚖️', roles: ['dueno'] },
  { id: 'carga-inicial',      titulo: 'Carga inicial',      icono: '📷', roles: ['dueno'] },
]

export const modulosPara = (rol: Rol): Modulo[] =>
  MODULOS.filter(m => m.roles.includes(rol))

export const puedeAcceder = (rol: Rol, id: string): boolean =>
  MODULOS.find(m => m.id === id)?.roles.includes(rol) ?? false
```

- [ ] **Step 6: Correr los tests y ver que pasan**

Run: `npm test`
Expected: PASS — 6 tests verdes.

- [ ] **Step 7: Commit**

```bash
git add lib/permisos.ts lib/permisos.test.ts package.json package-lock.json
git commit -m "feat: mapa de permisos central con tests"
```

---

## Task 3: Config de usuarios para el picker

**Files:**
- Create: `lib/usuarios.ts`

- [ ] **Step 1: Crear lib/usuarios.ts**

Create `lib/usuarios.ts`:
```ts
export interface UsuarioPicker {
  nombre: string
  email: string
}

// Lista fija para el picker pre-login (RLS bloquea leer public.users sin sesión).
// Agregar un usuario = agregarlo aquí + crearlo en Supabase Auth.
export const USUARIOS: UsuarioPicker[] = [
  { nombre: 'Andrés Artunduaga', email: 'venusdelcaqueta@gmail.com' },
  { nombre: 'Camilo Artunduaga', email: 'artuneleven1@gmail.com' },
  { nombre: 'Beatriz Bueno',     email: 'beatrizbueno1979@gmail.com' },
]
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/usuarios.ts
git commit -m "feat: lista de usuarios para el picker de login"
```

---

## Task 4: AuthProvider + hooks

**Files:**
- Create: `lib/auth.tsx`

- [ ] **Step 1: Crear lib/auth.tsx**

Create `lib/auth.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { Redirect } from 'expo-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { puedeAcceder, type Rol } from './permisos'

export interface Perfil {
  id: string
  nombre: string
  rol: Rol
  activo: boolean
}

interface AuthState {
  session: Session | null
  perfil: Perfil | null
  cargando: boolean
  iniciarSesion: (email: string, pin: string) => Promise<{ error: string | null }>
  cerrarSesion: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

async function fetchPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, nombre, rol, activo')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return { id: data.id, nombre: data.nombre, rol: data.rol as Rol, activo: data.activo }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let montado = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!montado) return
      setSession(data.session)
      if (data.session) setPerfil(await fetchPerfil(data.session.user.id))
      setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nuevaSesion) => {
      if (!montado) return
      setSession(nuevaSesion)
      setPerfil(nuevaSesion ? await fetchPerfil(nuevaSesion.user.id) : null)
    })
    return () => {
      montado = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function iniciarSesion(email: string, pin: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pin })
    if (error) return { error: 'PIN incorrecto. Intenta de nuevo.' }
    return { error: null }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, perfil, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

// Devuelve un <Redirect> si el rol actual no puede ver el módulo, o null si sí puede.
// La pantalla lo llama incondicionalmente al inicio y renderiza el resultado.
export function useRequireModulo(id: string) {
  const { perfil } = useAuth()
  if (perfil && !puedeAcceder(perfil.rol, id)) {
    return <Redirect href="/" />
  }
  return null
}
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.tsx
git commit -m "feat: AuthProvider con sesión, perfil y guard por módulo"
```

---

## Task 5: Layouts con redirects por sesión

**Files:**
- Modify: `app/_layout.tsx`
- Create: `app/(auth)/_layout.tsx`
- Create: `app/(app)/_layout.tsx`

- [ ] **Step 1: Reemplazar el layout raíz para montar AuthProvider**

Replace `app/_layout.tsx` con:
```tsx
import { Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { AuthProvider, useAuth } from '../lib/auth'

function Navegacion() {
  const { cargando } = useAuth()
  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }
  return <Stack screenOptions={{ headerShown: false }} />
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Navegacion />
    </AuthProvider>
  )
}
```

- [ ] **Step 2: Crear el layout del grupo (auth)**

Create `app/(auth)/_layout.tsx`:
```tsx
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../lib/auth'

export default function AuthLayout() {
  const { session } = useAuth()
  if (session) return <Redirect href="/" />
  return <Stack screenOptions={{ headerShown: false }} />
}
```

- [ ] **Step 3: Crear el layout del grupo (app)**

Create `app/(app)/_layout.tsx`:
```tsx
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../lib/auth'

export default function AppLayout() {
  const { session } = useAuth()
  if (!session) return <Redirect href="/login" />
  return <Stack screenOptions={{ headerShown: false }} />
}
```

- [ ] **Step 4: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx app/(auth)/_layout.tsx app/(app)/_layout.tsx
git commit -m "feat: layouts con redirect por estado de sesión"
```

---

## Task 6: Pantalla de login (picker + PIN)

**Files:**
- Create: `app/(auth)/login.tsx`

- [ ] **Step 1: Crear la pantalla de login**

Create `app/(auth)/login.tsx`:
```tsx
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useAuth } from '../../lib/auth'
import { USUARIOS, type UsuarioPicker } from '../../lib/usuarios'

export default function Login() {
  const { iniciarSesion } = useAuth()
  const [usuario, setUsuario] = useState<UsuarioPicker | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function entrar() {
    if (!usuario || pin.length < 4) return
    setCargando(true)
    setError(null)
    const res = await iniciarSesion(usuario.email, pin)
    setCargando(false)
    if (res.error) {
      setError(res.error)
      setPin('')
    }
    // Si entra bien, onAuthStateChange + (auth)/_layout redirigen a "/".
  }

  if (!usuario) {
    return (
      <View style={styles.container}>
        <Text style={styles.titulo}>¿Quién eres?</Text>
        {USUARIOS.map(u => (
          <Pressable key={u.email} style={styles.userBtn} onPress={() => setUsuario(u)}>
            <Text style={styles.userBtnText}>{u.nombre}</Text>
          </Pressable>
        ))}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>{usuario.nombre}</Text>
      <Text style={styles.sub}>Escribe tu PIN</Text>
      <TextInput
        style={styles.pinInput}
        value={pin}
        onChangeText={t => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        autoFocus
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.primaryBtn, (cargando || pin.length < 4) && styles.btnDisabled]}
        onPress={entrar}
        disabled={cargando || pin.length < 4}
      >
        {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Entrar</Text>}
      </Pressable>
      <Pressable
        onPress={() => {
          setUsuario(null)
          setPin('')
          setError(null)
        }}
      >
        <Text style={styles.link}>← Cambiar usuario</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#fff' },
  titulo: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 18, textAlign: 'center', color: '#444' },
  userBtn: { backgroundColor: '#1E66F5', borderRadius: 16, paddingVertical: 24, alignItems: 'center' },
  userBtnText: { color: '#fff', fontSize: 24, fontWeight: '600' },
  pinInput: {
    borderWidth: 2, borderColor: '#1E66F5', borderRadius: 16, fontSize: 32,
    textAlign: 'center', letterSpacing: 12, paddingVertical: 16,
  },
  primaryBtn: { backgroundColor: '#1E66F5', borderRadius: 16, paddingVertical: 20, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  error: { color: '#D20F39', fontSize: 16, textAlign: 'center' },
  link: { color: '#1E66F5', fontSize: 16, textAlign: 'center', marginTop: 8 },
})
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/(auth)/login.tsx
git commit -m "feat: pantalla de login con picker de usuario y PIN"
```

---

## Task 7: Home en cuadrícula

**Files:**
- Modify: `app/(app)/index.tsx` (reemplaza el temporal de Task 1)

- [ ] **Step 1: Reemplazar el home temporal por la cuadrícula real**

Replace `app/(app)/index.tsx` con:
```tsx
import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../../lib/auth'
import { modulosPara } from '../../lib/permisos'

export default function Home() {
  const { perfil, cerrarSesion } = useAuth()
  const router = useRouter()
  if (!perfil) return null
  const modulos = modulosPara(perfil.rol)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.saludo}>Hola, {perfil.nombre.split(' ')[0]}</Text>
        <Pressable onPress={cerrarSesion} hitSlop={12}>
          <Text style={styles.salir}>Salir</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.grid}>
        {modulos.map(m => (
          <Pressable key={m.id} style={styles.tile} onPress={() => router.push(`/modulo/${m.id}`)}>
            <Text style={styles.icono}>{m.icono}</Text>
            <Text style={styles.tileText}>{m.titulo}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  saludo: { fontSize: 26, fontWeight: '700' },
  salir: { fontSize: 18, color: '#D20F39', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16, gap: 16 },
  tile: {
    width: '47%', aspectRatio: 1, backgroundColor: '#EFF5FF', borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  icono: { fontSize: 48 },
  tileText: { fontSize: 18, fontWeight: '600', textAlign: 'center', paddingHorizontal: 8 },
})
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/index.tsx
git commit -m "feat: home en cuadrícula generado desde el mapa de permisos"
```

---

## Task 8: Pantalla placeholder protegida

**Files:**
- Create: `app/(app)/modulo/[id].tsx`

- [ ] **Step 1: Crear el placeholder con guard de rol**

Create `app/(app)/modulo/[id].tsx`:
```tsx
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRequireModulo } from '../../../lib/auth'
import { MODULOS } from '../../../lib/permisos'

export default function ModuloPlaceholder() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const redireccion = useRequireModulo(id ?? '')
  if (redireccion) return redireccion

  const modulo = MODULOS.find(m => m.id === id)
  return (
    <View style={styles.container}>
      <Text style={styles.icono}>{modulo?.icono ?? '❓'}</Text>
      <Text style={styles.titulo}>{modulo?.titulo ?? 'Módulo'}</Text>
      <Text style={styles.sub}>En construcción</Text>
      <Pressable style={styles.btn} onPress={() => router.back()}>
        <Text style={styles.btnText}>← Volver</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#fff' },
  icono: { fontSize: 64 },
  titulo: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 18, color: '#777' },
  btn: { marginTop: 24, backgroundColor: '#1E66F5', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
})
```

- [ ] **Step 2: Verificar TypeScript**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/modulo/[id].tsx
git commit -m "feat: pantalla placeholder de módulo con guard por rol"
```

---

## Task 9: Fijar los PINs en Supabase

**Files:** (ninguno; cambio en backend Supabase vía MCP)

Este paso usa la herramienta MCP `mcp__plugin_supabase_supabase__execute_sql` (project_id `xqspsaghukeynlizbjvc`). Setea la contraseña directamente como hash bcrypt en `auth.users`, lo que **evita** la validación de longitud mínima del API (los PINs son de 4 dígitos).

- [ ] **Step 1: Confirmar que pgcrypto está disponible**

Ejecutar SQL:
```sql
select extname, extnamespace::regnamespace as schema
from pg_extension where extname = 'pgcrypto';
```
Expected: una fila (típicamente en schema `extensions`). Si no existe, ejecutar `create extension if not exists pgcrypto with schema extensions;` primero.

- [ ] **Step 2: Fijar los PINs como contraseñas**

Ejecutar SQL (usa `crypt`/`gen_salt` de pgcrypto; si no están en el search_path, prefijar con `extensions.`):
```sql
update auth.users set encrypted_password = crypt('1234', gen_salt('bf'))
  where email = 'venusdelcaqueta@gmail.com';
update auth.users set encrypted_password = crypt('1111', gen_salt('bf'))
  where email = 'artuneleven1@gmail.com';
update auth.users set encrypted_password = crypt('2222', gen_salt('bf'))
  where email = 'beatrizbueno1979@gmail.com';
```
Expected: `UPDATE 1` por cada sentencia.

- [ ] **Step 3: Verificar que los hashes quedaron**

Ejecutar SQL:
```sql
select email, encrypted_password is not null as tiene_clave
from auth.users
where email in ('venusdelcaqueta@gmail.com', 'artuneleven1@gmail.com', 'beatrizbueno1979@gmail.com');
```
Expected: 3 filas con `tiene_clave = true`.

(La verificación real de que el PIN funciona se hace en Task 10, iniciando sesión desde la app.)

---

## Task 10: Verificación end-to-end y cierre

**Files:** (ninguno)

- [ ] **Step 1: Correr toda la suite de tests**

Run: `npm test`
Expected: PASS — los 6 tests de permisos verdes.

- [ ] **Step 2: TypeScript limpio**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificación manual en dispositivo**

Run: `npx expo start --android`. Verificar:
1. Arranca en la pantalla de login mostrando los 3 nombres.
2. Login como **Camilo (empleado, PIN 1111)** → el home muestra exactamente 5 tiles (Ventas, Inventario calzado, Productos varios, Recibir mercancía, Cierre de caja).
3. Tocar un tile → abre placeholder "En construcción" → "Volver" regresa al home.
4. "Salir" → vuelve al login.
5. Login como **Andrés (dueño, PIN 1234)** → el home muestra los 13 tiles.
6. Cerrar y reabrir la app → entra directo (sesión persistida), sin pedir PIN.
7. PIN incorrecto → muestra "PIN incorrecto. Intenta de nuevo." y limpia el campo.

- [ ] **Step 4: Verificar el guard de acceso directo (defensa en profundidad)**

Estando logueado como **empleado**, forzar navegación directa a una ruta de dueño. En la barra de comandos de Expo o con un deep link: abrir `venus://modulo/balance` (o temporalmente cambiar un tile a `router.push('/modulo/balance')`).
Expected: redirige inmediatamente al home `/`, no muestra el placeholder de balance.

- [ ] **Step 5: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "test: verificación end-to-end auth + navegación por rol"
```

---

## Notas para el implementador

- **TypeScript estricto** está activo; mantenerlo (sin `any` salvo el cast puntual `data.rol as Rol` en `fetchPerfil`, justificado porque la DB tipa `rol` como `string`).
- **Sin NativeWind**: estilos con `StyleSheet`. Targets táctiles grandes (≥56px de alto) y alto contraste por la audiencia no técnica.
- **Tests de UI no incluidos**: el RN testing harness no está configurado y queda fuera de alcance; la lógica de gating crítica vive en `lib/permisos.ts`, que sí está cubierta por Jest. El resto se valida manualmente (Task 10).
- **Rutas**: el login vive en `/login` (no `index`) a propósito, para que `(app)/index.tsx` sea el único dueño de la ruta `/` y no colisione.
