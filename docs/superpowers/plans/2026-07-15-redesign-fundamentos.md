# Rediseño Venus — Fase Fundamentos (theme + componentes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la base del rediseño visual (redisign-visual.md): tokens de tema claro/oscuro, fuente Plus Jakarta Sans, `TemaProvider`, y la librería `components/ui/` — sin cambiar ninguna pantalla existente todavía.

**Architecture:** Tokens puros en `lib/theme.ts` (testeables sin React). Contexto de tema con persistencia en `lib/tema.tsx`. Componentes en `components/ui/` que solo consumen tokens vía `useTema()`. Las pantallas existentes NO se tocan (siguen funcionando con sus estilos actuales); la migración de pantallas es de planes posteriores.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript estricto, Reanimated 4 (nuevo), lucide-react-native (nuevo), @expo-google-fonts/plus-jakarta-sans (nuevo), jest-expo + react-test-renderer.

## Global Constraints

- TypeScript estricto; `npx tsc --noEmit` debe pasar en cada commit.
- Todos los tests con `npx jest` (jest-expo); patrón de mocks POR ARCHIVO como en `lib/balance_ui.test.tsx` (no hay setup global de mocks de Supabase).
- Nombres de componentes, props y UI **en español** (convención del repo: `permisos.ts`, `iniciarSesion`).
- Valores de tokens EXACTOS de `redisign-visual.md` §1–§5 (no inventar hex ni duraciones).
- Con fuentes custom en Android NO se usa `fontWeight`; cada peso es una `fontFamily` distinta (`PlusJakartaSans_700Bold`, etc.).
- Animar solo `transform`/`opacity`; respetar `useReducedMotion()`.
- Commits con convención del repo: `feat(ui): …`, `chore: …`, cuerpo en español.
- Los mensajes de commit terminan con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Rama nueva + commit de los documentos de diseño

**Files:**
- Commit: `redisign.md`, `redisign-visual.md`, `design.md`, `skills-lock.json`, `docs/superpowers/plans/2026-07-15-redesign-fundamentos.md`

**Interfaces:**
- Produces: rama `feat/redesign-fundamentos` (base de todos los tasks siguientes).

- [ ] **Step 1: Crear la rama desde main**

```bash
git checkout main && git pull && git checkout -b feat/redesign-fundamentos
```

Nota: los archivos sin trackear (redisign*.md, etc.) viajan solos al cambiar de rama. `skills-lock.json` está modificado (skills instalados hoy); viaja también.

- [ ] **Step 2: Commit de docs**

```bash
git add redisign.md redisign-visual.md design.md skills-lock.json docs/superpowers/plans/2026-07-15-redesign-fundamentos.md
git commit -m "docs(redesign): decisiones de estructura + spec visual v1.0 + plan fundamentos

redisign.md (partes A–F), redisign-visual.md (tokens claro/oscuro, Plus
Jakarta Sans, Lucide, motion system, componentes, pantallas) y plan de
la fase fundamentos.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

NO commitear: `plantilla_carga_inventario.*`, `venus_about.md`, `ARCHITECTURE.md`, `what do/`, `.claude/launch.json` (no son de este feature).

---

### Task 2: Dependencias + setup de jest para Reanimated

**Files:**
- Modify: `package.json` (deps + bloque jest)
- Create: `jest.setup.js`

**Interfaces:**
- Produces: paquetes `react-native-reanimated`, `react-native-worklets`, `react-native-svg`, `expo-font`, `expo-haptics`, `expo-linear-gradient`, `@expo-google-fonts/plus-jakarta-sans`, `lucide-react-native` instalados y transformados por jest.

- [ ] **Step 1: Instalar dependencias con versiones de Expo**

```bash
npx expo install react-native-reanimated react-native-worklets react-native-svg expo-font expo-haptics expo-linear-gradient @expo-google-fonts/plus-jakarta-sans
npm install lucide-react-native
```

- [ ] **Step 2: Verificar babel**

```bash
ls babel.config.js 2>/dev/null || echo "sin babel.config.js propio"
```

Expo SDK 54 (`babel-preset-expo`) añade el plugin de worklets automáticamente al detectar reanimated. Si NO existe `babel.config.js`, no hay nada que hacer. Si existe, verificar que use `babel-preset-expo` y nada más que interfiera.

- [ ] **Step 3: Setup de jest para Reanimated**

Crear `jest.setup.js`:

```js
// Setup global de jest: matchers/mocks de Reanimated
require('react-native-reanimated').setUpTests()
```

En `package.json`, dentro del bloque `"jest"`, añadir:

```json
"setupFiles": ["<rootDir>/jest.setup.js"]
```

y en `transformIgnorePatterns` añadir `lucide-react-native` a la lista de excepciones (antes de `react-native-svg`):

```json
"node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|lucide-react-native|react-native-svg))"
```

Fallback: si `setUpTests` no existe en la versión instalada, en su lugar cada test usará `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))` y `jest.setup.js` quedará vacío.

- [ ] **Step 4: Verificar que nada se rompió**

```bash
npx tsc --noEmit && npx jest 2>&1 | tail -5
```

Expected: tsc sin errores; la suite existente pasa completa.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json jest.setup.js
git commit -m "chore(redesign): deps del rediseño (reanimated, lucide, PJS, svg, haptics)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `lib/theme.ts` — tokens puros

**Files:**
- Create: `lib/theme.ts`
- Test: `lib/theme.test.ts`

**Interfaces:**
- Produces (usado por TODOS los tasks siguientes):
  - `type ModoTema = 'claro' | 'oscuro' | 'sistema'`
  - `interface Paleta { primario, primarioPress, primarioSoft, sobrePrimario, acento, acentoSoft, fondo, superficie, superficie2, borde, bordeFuerte, texto, texto2, texto3, textoDeshabilitado, exito, exitoSoft, exitoTexto, peligro, peligroSoft, peligroTexto, advertencia, advertenciaSoft, advertenciaTexto, overlay: string; gradienteHero: [string, string]; sombraFab: string }`
  - `paletaClara: Paleta`, `paletaOscura: Paleta`
  - `fuentes: { regular, media, semi, negrita, extra }` (nombres de fontFamily)
  - `tipografia: { displayXL, display, h1, h2, h3, cuerpoLg, cuerpo, etiqueta, caption, micro }` (cada uno `{ fontSize, lineHeight, fontFamily, ... }`)
  - `tabular: { fontVariant: ['tabular-nums'] }`
  - `espacio: { xs:4, s:8, m:12, l:16, xl:20, xxl:24, xxxl:32 }`
  - `radio: { sm:12, md:16, lg:20, xl:28, full:999 }`
  - `motion: { rapido:120, base:200, lento:300, sheet:350, easeEnter, easeMove, easeSheet, springPress:{damping:18,stiffness:320}, springLayout:{damping:22,stiffness:260}, escalaPress:0.97 }`

- [ ] **Step 1: Test que falla**

Crear `lib/theme.test.ts`:

```ts
import { paletaClara, paletaOscura, tipografia, espacio, radio, motion, fuentes } from './theme'

const esHex = (v: string) => /^#[0-9A-F]{6}$/i.test(v)

describe('tokens de tema', () => {
  it('ambas paletas tienen exactamente las mismas claves', () => {
    expect(Object.keys(paletaOscura).sort()).toEqual(Object.keys(paletaClara).sort())
  })

  it('los colores son hex válidos (excepto overlay y gradiente)', () => {
    for (const p of [paletaClara, paletaOscura]) {
      for (const [k, v] of Object.entries(p)) {
        if (k === 'overlay' || k === 'gradienteHero' || k === 'sombraFab') continue
        expect({ [k]: esHex(v as string) }).toEqual({ [k]: true })
      }
    }
  })

  it('valores canónicos de la spec §1', () => {
    expect(paletaClara.primario).toBe('#1E66F5')
    expect(paletaClara.superficie).toBe('#F6F8FC')
    expect(paletaClara.texto).toBe('#0B1220')
    expect(paletaOscura.primario).toBe('#4C82F7')
    expect(paletaOscura.fondo).toBe('#0B1220')
    expect(paletaOscura.superficie).toBe('#121C30')
  })

  it('tipografía: escala y familias por peso (sin fontWeight)', () => {
    expect(tipografia.displayXL.fontSize).toBe(40)
    expect(tipografia.micro.fontSize).toBe(11)
    expect(tipografia.h2.fontFamily).toBe(fuentes.negrita)
    for (const t of Object.values(tipografia)) {
      expect((t as { fontWeight?: string }).fontWeight).toBeUndefined()
    }
  })

  it('espaciado base 4, radios y motion de la spec §3/§5', () => {
    expect(Object.values(espacio)).toEqual([4, 8, 12, 16, 20, 24, 32])
    expect(radio).toEqual({ sm: 12, md: 16, lg: 20, xl: 28, full: 999 })
    expect(motion.springPress).toEqual({ damping: 18, stiffness: 320 })
    expect(motion.escalaPress).toBe(0.97)
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx jest lib/theme.test.ts`
Expected: FAIL — `Cannot find module './theme'`

- [ ] **Step 3: Implementar `lib/theme.ts`**

```ts
// Tokens del rediseño Venus — fuente única de verdad visual.
// Valores exactos de redisign-visual.md §1–§5. No usar hex sueltos fuera de aquí.

export type ModoTema = 'claro' | 'oscuro' | 'sistema'

export interface Paleta {
  primario: string
  primarioPress: string
  primarioSoft: string
  sobrePrimario: string
  acento: string
  acentoSoft: string
  fondo: string
  superficie: string
  superficie2: string
  borde: string
  bordeFuerte: string
  texto: string
  texto2: string
  texto3: string
  textoDeshabilitado: string
  exito: string
  exitoSoft: string
  exitoTexto: string
  peligro: string
  peligroSoft: string
  peligroTexto: string
  advertencia: string
  advertenciaSoft: string
  advertenciaTexto: string
  overlay: string
  gradienteHero: [string, string]
  sombraFab: string
}

export const paletaClara: Paleta = {
  primario: '#1E66F5',
  primarioPress: '#1747C8',
  primarioSoft: '#EBF1FE',
  sobrePrimario: '#FFFFFF',
  acento: '#F59E0B',
  acentoSoft: '#FEF3C7',
  fondo: '#FFFFFF',
  superficie: '#F6F8FC',
  superficie2: '#EEF2F9',
  borde: '#E2E8F0',
  bordeFuerte: '#CBD5E1',
  texto: '#0B1220',
  texto2: '#475569',
  texto3: '#64748B',
  textoDeshabilitado: '#94A3B8',
  exito: '#16A34A',
  exitoSoft: '#E7F6EC',
  exitoTexto: '#15803D',
  peligro: '#DC2626',
  peligroSoft: '#FDECEC',
  peligroTexto: '#B91C1C',
  advertencia: '#D97706',
  advertenciaSoft: '#FEF3C7',
  advertenciaTexto: '#92400E',
  overlay: 'rgba(11,18,32,0.5)',
  gradienteHero: ['#1E66F5', '#1747C8'],
  sombraFab: 'rgba(30,102,245,0.38)',
}

export const paletaOscura: Paleta = {
  primario: '#4C82F7',
  primarioPress: '#6D9AF9',
  primarioSoft: '#16264A',
  sobrePrimario: '#FFFFFF',
  acento: '#F5B840',
  acentoSoft: '#3A2A10',
  fondo: '#0B1220',
  superficie: '#121C30',
  superficie2: '#1A2740',
  borde: '#26334D',
  bordeFuerte: '#33425F',
  texto: '#F2F6FC',
  texto2: '#A9B4C6',
  texto3: '#8291A9',
  textoDeshabilitado: '#5B6A83',
  exito: '#3FBF6F',
  exitoSoft: '#0F2E1C',
  exitoTexto: '#7BDCA0',
  peligro: '#F07171',
  peligroSoft: '#3A1520',
  peligroTexto: '#F5A3A3',
  advertencia: '#F2A93B',
  advertenciaSoft: '#3A2A10',
  advertenciaTexto: '#F7C87E',
  overlay: 'rgba(0,0,0,0.6)',
  gradienteHero: ['#1D3A75', '#142850'],
  sombraFab: 'rgba(76,130,247,0.5)',
}

// Con fuentes custom, cada peso es una familia (Android ignora fontWeight).
export const fuentes = {
  regular: 'PlusJakartaSans_400Regular',
  media: 'PlusJakartaSans_500Medium',
  semi: 'PlusJakartaSans_600SemiBold',
  negrita: 'PlusJakartaSans_700Bold',
  extra: 'PlusJakartaSans_800ExtraBold',
} as const

export const tipografia = {
  displayXL: { fontSize: 40, lineHeight: 48, fontFamily: fuentes.extra, letterSpacing: -0.8 },
  display: { fontSize: 32, lineHeight: 38, fontFamily: fuentes.extra, letterSpacing: -0.5 },
  h1: { fontSize: 28, lineHeight: 34, fontFamily: fuentes.extra, letterSpacing: -0.4 },
  h2: { fontSize: 22, lineHeight: 28, fontFamily: fuentes.negrita },
  h3: { fontSize: 18, lineHeight: 24, fontFamily: fuentes.negrita },
  cuerpoLg: { fontSize: 17, lineHeight: 24, fontFamily: fuentes.semi },
  cuerpo: { fontSize: 15, lineHeight: 22, fontFamily: fuentes.media },
  etiqueta: { fontSize: 13, lineHeight: 18, fontFamily: fuentes.semi },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fuentes.semi },
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fuentes.negrita,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
} as const

// Dinero SIEMPRE tabular: <Text style={[tipografia.h3, tabular]}>
export const tabular = { fontVariant: ['tabular-nums'] as ['tabular-nums'] }

export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 } as const

export const radio = { sm: 12, md: 16, lg: 20, xl: 28, full: 999 } as const

export const motion = {
  rapido: 120,
  base: 200,
  lento: 300,
  sheet: 350,
  easeEnter: [0.22, 1, 0.36, 1] as const,
  easeMove: [0.25, 1, 0.5, 1] as const,
  easeSheet: [0.32, 0.72, 0, 1] as const,
  springPress: { damping: 18, stiffness: 320 },
  springLayout: { damping: 22, stiffness: 260 },
  escalaPress: 0.97,
} as const
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx jest lib/theme.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/theme.ts lib/theme.test.ts
git commit -m "feat(ui): tokens de tema claro/oscuro del rediseño (lib/theme.ts)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `lib/tema.tsx` — TemaProvider con persistencia

**Files:**
- Create: `lib/tema.tsx`
- Test: `lib/tema.test.tsx`

**Interfaces:**
- Consumes: `paletaClara`, `paletaOscura`, `ModoTema`, `Paleta` de `lib/theme.ts`.
- Produces:
  - `TemaProvider({ children })` — null hasta leer AsyncStorage (evita flash de tema).
  - `useTema(): { paleta: Paleta; esOscuro: boolean; modo: ModoTema; setModo: (m: ModoTema) => void }` — lanza Error fuera del provider.
  - Clave de persistencia: `'venus.tema'`.

- [ ] **Step 1: Test que falla**

Crear `lib/tema.test.tsx`:

```tsx
import React from 'react'
import { Text } from 'react-native'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

import AsyncStorage from '@react-native-async-storage/async-storage'
import { TemaProvider, useTema } from './tema'

function Sonda() {
  const { paleta, esOscuro, modo, setModo } = useTema()
  return (
    <Text
      testID="sonda"
      onPress={() => setModo('oscuro')}
    >{`${modo}|${esOscuro}|${paleta.primario}`}</Text>
  )
}

async function montar() {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <Sonda />
      </TemaProvider>
    )
  })
  return arbol
}

const leerSonda = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root.findByProps({ testID: 'sonda' }).props.children as string

describe('TemaProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    jest.clearAllMocks()
  })

  it('por defecto modo sistema → claro (useColorScheme null en tests)', async () => {
    const arbol = await montar()
    expect(leerSonda(arbol)).toBe('sistema|false|#1E66F5')
  })

  it('setModo cambia a oscuro y persiste en venus.tema', async () => {
    const arbol = await montar()
    await act(async () => {
      arbol.root.findByProps({ testID: 'sonda' }).props.onPress()
    })
    expect(leerSonda(arbol)).toBe('oscuro|true|#4C82F7')
    expect(await AsyncStorage.getItem('venus.tema')).toBe('oscuro')
  })

  it('carga el modo persistido al montar', async () => {
    await AsyncStorage.setItem('venus.tema', 'oscuro')
    const arbol = await montar()
    expect(leerSonda(arbol)).toBe('oscuro|true|#4C82F7')
  })

  it('useTema fuera del provider lanza error claro', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderer.create(<Sonda />)).toThrow('useTema debe usarse dentro de <TemaProvider>')
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx jest lib/tema.test.tsx`
Expected: FAIL — `Cannot find module './tema'`

- [ ] **Step 3: Implementar `lib/tema.tsx`**

```tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ModoTema, Paleta, paletaClara, paletaOscura } from './theme'

const CLAVE_TEMA = 'venus.tema'

interface ContextoTema {
  paleta: Paleta
  esOscuro: boolean
  modo: ModoTema
  setModo: (modo: ModoTema) => void
}

const Contexto = createContext<ContextoTema | null>(null)

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const sistema = useColorScheme()
  const [modo, setModoEstado] = useState<ModoTema>('sistema')
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_TEMA)
      .then((v) => {
        if (v === 'claro' || v === 'oscuro' || v === 'sistema') setModoEstado(v)
      })
      .catch(() => {})
      .finally(() => setCargado(true))
  }, [])

  const setModo = useCallback((m: ModoTema) => {
    setModoEstado(m)
    AsyncStorage.setItem(CLAVE_TEMA, m).catch(() => {})
  }, [])

  const esOscuro = modo === 'oscuro' || (modo === 'sistema' && sistema === 'dark')

  const valor = useMemo(
    () => ({ paleta: esOscuro ? paletaOscura : paletaClara, esOscuro, modo, setModo }),
    [esOscuro, modo, setModo]
  )

  // El splash sigue visible mientras se lee la preferencia: sin flash de tema.
  if (!cargado) return null

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useTema(): ContextoTema {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useTema debe usarse dentro de <TemaProvider>')
  return ctx
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx jest lib/tema.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/tema.tsx lib/tema.test.tsx
git commit -m "feat(ui): TemaProvider con persistencia claro/oscuro/sistema

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Fuentes + provider en `app/_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `TemaProvider`, `useTema` de `lib/tema`.
- Produces: app entera envuelta en `TemaProvider`; fuentes PJS cargadas antes de render; StatusBar según tema.

- [ ] **Step 1: Modificar `app/_layout.tsx`**

Reemplazar el contenido actual conservando `Navegacion` INTACTO (solo cambia `RootLayout` y se añaden imports):

```tsx
import { useCallback } from 'react'
import { Stack } from 'expo-router'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import { AuthProvider, useAuth } from '../lib/auth'
import { TemaProvider, useTema } from '../lib/tema'

SplashScreen.preventAutoHideAsync().catch(() => {})

// ... function Navegacion() SIN CAMBIOS ...

function BarraEstado() {
  const { esOscuro } = useTema()
  return <StatusBar style={esOscuro ? 'light' : 'dark'} />
}

export default function RootLayout() {
  const [fuentesListas] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  })

  if (fuentesListas) SplashScreen.hideAsync().catch(() => {})
  if (!fuentesListas) return null

  return (
    <TemaProvider>
      <BarraEstado />
      <AuthProvider>
        <Navegacion />
      </AuthProvider>
    </TemaProvider>
  )
}
```

Nota: `expo-splash-screen` viene con Expo; si `npx tsc` no lo encuentra, `npx expo install expo-splash-screen`.

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit && npx jest 2>&1 | tail -5
```

Expected: tsc limpio; TODA la suite existente sigue pasando (ningún test monta `app/_layout.tsx` directamente).

- [ ] **Step 3: Smoke en dispositivo/emulador (manual, si hay uno conectado)**

```bash
npx expo start --android
```

Expected: la app abre, login se ve igual que antes (las fuentes aún no se usan en pantallas). Si no hay dispositivo, se difiere al final de la fase.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx package.json package-lock.json
git commit -m "feat(ui): carga Plus Jakarta Sans + TemaProvider + StatusBar por tema

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `Presionable` + `Boton`

**Files:**
- Create: `components/ui/Presionable.tsx`, `components/ui/Boton.tsx`
- Test: `components/ui/Boton.test.tsx`

**Interfaces:**
- Consumes: `useTema`, tokens de `lib/theme`.
- Produces:
  - `Presionable(props: PressableProps & { escala?: number; style?: StyleProp<ViewStyle> })` — Pressable animado con scale spring al presionar; respeta reduced motion.
  - `Boton({ titulo: string; onPress: () => void; variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma'; tamano?: 'lg' | 'md'; cargando?: boolean; deshabilitado?: boolean; icono?: React.ReactNode })`

- [ ] **Step 1: Test que falla**

Crear `components/ui/Boton.test.tsx`:

```tsx
import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { ActivityIndicator } from 'react-native'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

import { TemaProvider } from '../../lib/tema'
import { paletaClara } from '../../lib/theme'
import { Boton } from './Boton'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

const aplanar = (estilo: unknown): Record<string, unknown> =>
  Object.assign({}, ...[estilo].flat(Infinity).filter(Boolean) as object[])

describe('Boton', () => {
  it('primario: fondo primario, texto sobrePrimario, alto 56', async () => {
    const arbol = await montar(<Boton titulo="Abrir Caja" onPress={() => {}} />)
    const btn = arbol.root.findByProps({ accessibilityRole: 'button' })
    const estilo = aplanar(btn.props.style)
    expect(estilo.backgroundColor).toBe(paletaClara.primario)
    expect(estilo.height).toBe(56)
    expect(arbol.root.findByProps({ children: 'Abrir Caja' })).toBeTruthy()
  })

  it('secundario y peligro usan sus tokens', async () => {
    const a = await montar(<Boton titulo="Editar" variante="secundario" onPress={() => {}} />)
    expect(aplanar(a.root.findByProps({ accessibilityRole: 'button' }).props.style).backgroundColor)
      .toBe(paletaClara.primarioSoft)
    const b = await montar(<Boton titulo="Cerrar caja" variante="peligro" onPress={() => {}} />)
    expect(aplanar(b.root.findByProps({ accessibilityRole: 'button' }).props.style).backgroundColor)
      .toBe(paletaClara.peligro)
  })

  it('cargando: spinner visible, onPress bloqueado, estado accesible', async () => {
    const onPress = jest.fn()
    const arbol = await montar(<Boton titulo="Guardar" cargando onPress={onPress} />)
    expect(arbol.root.findAllByType(ActivityIndicator)).toHaveLength(1)
    const btn = arbol.root.findByProps({ accessibilityRole: 'button' })
    expect(btn.props.accessibilityState).toEqual({ disabled: true, busy: true })
    btn.props.onPress?.()
    expect(onPress).not.toHaveBeenCalled()
  })

  it('deshabilitado: opacity 0.45 y sin onPress', async () => {
    const onPress = jest.fn()
    const arbol = await montar(<Boton titulo="Confirmar" deshabilitado onPress={onPress} />)
    const btn = arbol.root.findByProps({ accessibilityRole: 'button' })
    expect(aplanar(btn.props.style).opacity).toBe(0.45)
    btn.props.onPress?.()
    expect(onPress).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx jest components/ui/Boton.test.tsx`
Expected: FAIL — `Cannot find module './Boton'`

- [ ] **Step 3: Implementar**

`components/ui/Presionable.tsx`:

```tsx
import React from 'react'
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { motion } from '../../lib/theme'

const PressableAnimado = Animated.createAnimatedComponent(Pressable)

type Props = PressableProps & {
  escala?: number
  style?: StyleProp<ViewStyle>
}

// Receta 1 del motion system: scale al presionar con springPress.
export function Presionable({ escala = motion.escalaPress, style, onPressIn, onPressOut, ...resto }: Props) {
  const s = useSharedValue(1)
  const reducido = useReducedMotion()

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }))

  return (
    <PressableAnimado
      style={[style, reducido ? undefined : animado]}
      onPressIn={(e) => {
        s.value = withSpring(escala, motion.springPress)
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, motion.springPress)
        onPressOut?.(e)
      }}
      {...resto}
    />
  )
}
```

`components/ui/Boton.tsx`:

```tsx
import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import { Presionable } from './Presionable'

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma'

interface Props {
  titulo: string
  onPress: () => void
  variante?: VarianteBoton
  tamano?: 'lg' | 'md'
  cargando?: boolean
  deshabilitado?: boolean
  icono?: React.ReactNode
}

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  tamano = 'lg',
  cargando = false,
  deshabilitado = false,
  icono,
}: Props) {
  const { paleta } = useTema()
  const inactivo = deshabilitado || cargando

  const colores = {
    primario: { fondo: paleta.primario, texto: paleta.sobrePrimario },
    secundario: { fondo: paleta.primarioSoft, texto: paleta.primario },
    peligro: { fondo: paleta.peligro, texto: paleta.sobrePrimario },
    fantasma: { fondo: 'transparent', texto: paleta.primario },
  }[variante]

  return (
    <Presionable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      disabled={inactivo}
      onPress={inactivo ? undefined : onPress}
      style={[
        estilos.base,
        { backgroundColor: colores.fondo, height: tamano === 'lg' ? 56 : 48 },
        inactivo && !cargando ? estilos.deshabilitado : null,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colores.texto} />
      ) : icono ? (
        <View>{icono}</View>
      ) : null}
      <Text style={[tipografia.cuerpoLg, { color: colores.texto }]}>{titulo}</Text>
    </Presionable>
  )
}

const estilos = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
    borderRadius: radio.md,
    paddingHorizontal: espacio.xxl,
  },
  deshabilitado: { opacity: 0.45 },
})
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx jest components/ui/Boton.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/ui/Presionable.tsx components/ui/Boton.tsx components/ui/Boton.test.tsx
git commit -m "feat(ui): Presionable (press-scale spring) y Boton con 4 variantes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: `Tarjeta`, `TarjetaMetrica`, `Badge`, `CirculoIcono`

**Files:**
- Create: `components/ui/Tarjeta.tsx`, `components/ui/TarjetaMetrica.tsx`, `components/ui/Badge.tsx`, `components/ui/CirculoIcono.tsx`
- Test: `components/ui/Tarjeta.test.tsx`

**Interfaces:**
- Consumes: `useTema`, tokens, `Presionable`.
- Produces:
  - `Tarjeta({ children; onPress?; estilo?: StyleProp<ViewStyle> })` — superficie, borde 1px, radio md, padding 16; con onPress usa Presionable.
  - `TarjetaMetrica({ etiqueta: string; valor: string; sub?: string; mini?: boolean; icono?: React.ReactNode })` — label micro + valor tabular grande (display) o mini (cuerpoLg).
  - `Badge({ texto: string; tipo?: 'exito' | 'peligro' | 'advertencia' | 'neutro'; punto?: boolean })` — pill; `punto` = punto pulsante (receta 11, único loop).
  - `CirculoIcono({ tono?: 'primario' | 'exito' | 'peligro' | 'acento'; tamano?: number; children: React.ReactElement })` — círculo soft; clona el hijo (icono Lucide) con `color` y `size`.

- [ ] **Step 1: Test que falla**

Crear `components/ui/Tarjeta.test.tsx`:

```tsx
import React from 'react'
import { Text } from 'react-native'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

import { TemaProvider } from '../../lib/tema'
import { paletaClara } from '../../lib/theme'
import { Tarjeta } from './Tarjeta'
import { TarjetaMetrica } from './TarjetaMetrica'
import { Badge } from './Badge'
import { CirculoIcono } from './CirculoIcono'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

const aplanar = (estilo: unknown): Record<string, unknown> =>
  Object.assign({}, ...[estilo].flat(Infinity).filter(Boolean) as object[])

function IconoFalso(props: { color?: string; size?: number }) {
  return <Text testID="icono-falso">{`${props.color}|${props.size}`}</Text>
}

describe('Tarjeta y compañía', () => {
  it('Tarjeta: superficie + borde + radio 16', async () => {
    const arbol = await montar(
      <Tarjeta>
        <Text>hola</Text>
      </Tarjeta>
    )
    const estilo = aplanar(arbol.root.findByProps({ testID: 'tarjeta' }).props.style)
    expect(estilo.backgroundColor).toBe(paletaClara.superficie)
    expect(estilo.borderColor).toBe(paletaClara.borde)
    expect(estilo.borderRadius).toBe(16)
  })

  it('TarjetaMetrica muestra etiqueta y valor tabular', async () => {
    const arbol = await montar(<TarjetaMetrica etiqueta="Total vendido" valor="$1.250.000" sub="18 ventas" />)
    expect(arbol.root.findByProps({ children: 'Total vendido' })).toBeTruthy()
    const valor = arbol.root.findByProps({ children: '$1.250.000' })
    expect(aplanar(valor.props.style).fontVariant).toEqual(['tabular-nums'])
  })

  it('Badge exito y peligro usan tokens soft/texto', async () => {
    const a = await montar(<Badge texto="ABIERTA" tipo="exito" punto />)
    const badgeA = aplanar(a.root.findByProps({ testID: 'badge' }).props.style)
    expect(badgeA.backgroundColor).toBe(paletaClara.exitoSoft)
    const b = await montar(<Badge texto="CERRADA" tipo="peligro" />)
    const badgeB = aplanar(b.root.findByProps({ testID: 'badge' }).props.style)
    expect(badgeB.backgroundColor).toBe(paletaClara.peligroSoft)
  })

  it('CirculoIcono clona el icono con color del tono y size', async () => {
    const arbol = await montar(
      <CirculoIcono tono="exito">
        <IconoFalso />
      </CirculoIcono>
    )
    expect(arbol.root.findByProps({ testID: 'icono-falso' }).props.children)
      .toBe(`${paletaClara.exito}|21`)
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx jest components/ui/Tarjeta.test.tsx`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar los 4 componentes**

`components/ui/Tarjeta.tsx`:

```tsx
import React from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio } from '../../lib/theme'
import { Presionable } from './Presionable'

interface Props {
  children: React.ReactNode
  onPress?: () => void
  estilo?: StyleProp<ViewStyle>
}

export function Tarjeta({ children, onPress, estilo }: Props) {
  const { paleta } = useTema()
  const base: ViewStyle = {
    backgroundColor: paleta.superficie,
    borderWidth: 1,
    borderColor: paleta.borde,
    borderRadius: radio.md,
    padding: espacio.l,
  }
  if (onPress) {
    return (
      <Presionable testID="tarjeta" accessibilityRole="button" onPress={onPress} style={[base, estilo]}>
        {children}
      </Presionable>
    )
  }
  return (
    <View testID="tarjeta" style={[base, estilo]}>
      {children}
    </View>
  )
}
```

`components/ui/TarjetaMetrica.tsx`:

```tsx
import React from 'react'
import { Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, tabular, tipografia } from '../../lib/theme'
import { Tarjeta } from './Tarjeta'

interface Props {
  etiqueta: string
  valor: string
  sub?: string
  mini?: boolean
  icono?: React.ReactNode
}

export function TarjetaMetrica({ etiqueta, valor, sub, mini = false, icono }: Props) {
  const { paleta } = useTema()
  return (
    <Tarjeta estilo={mini ? { padding: espacio.m, flex: 1 } : undefined}>
      <View style={{ gap: espacio.xs }}>
        {icono}
        <Text style={[tipografia.micro, { color: paleta.texto3 }]}>{etiqueta}</Text>
        <Text style={[mini ? tipografia.cuerpoLg : tipografia.display, tabular, { color: paleta.texto }]}>
          {valor}
        </Text>
        {sub ? <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{sub}</Text> : null}
      </View>
    </Tarjeta>
  )
}
```

`components/ui/Badge.tsx`:

```tsx
import React, { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useTema } from '../../lib/tema'
import { radio, tipografia } from '../../lib/theme'

export type TipoBadge = 'exito' | 'peligro' | 'advertencia' | 'neutro'

interface Props {
  texto: string
  tipo?: TipoBadge
  punto?: boolean
}

// Receta 11: el punto pulsante (caja ABIERTA) es el único loop de la app.
function PuntoPulsante({ color }: { color: string }) {
  const op = useSharedValue(1)
  const reducido = useReducedMotion()

  useEffect(() => {
    if (reducido) return
    op.value = withRepeat(
      withSequence(withTiming(0.45, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1
    )
  }, [op, reducido])

  const estilo = useAnimatedStyle(() => ({ opacity: op.value }))
  return (
    <Animated.View
      style={[{ width: 7, height: 7, borderRadius: radio.full, backgroundColor: color }, estilo]}
    />
  )
}

export function Badge({ texto, tipo = 'neutro', punto = false }: Props) {
  const { paleta } = useTema()
  const colores = {
    exito: { fondo: paleta.exitoSoft, texto: paleta.exitoTexto },
    peligro: { fondo: paleta.peligroSoft, texto: paleta.peligroTexto },
    advertencia: { fondo: paleta.advertenciaSoft, texto: paleta.advertenciaTexto },
    neutro: { fondo: paleta.superficie2, texto: paleta.texto2 },
  }[tipo]

  return (
    <View
      testID="badge"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: colores.fondo,
        borderRadius: radio.full,
        paddingVertical: 6,
        paddingHorizontal: 12,
      }}
    >
      {punto ? <PuntoPulsante color={colores.texto} /> : null}
      <Text style={[tipografia.micro, { color: colores.texto }]}>{texto}</Text>
    </View>
  )
}
```

`components/ui/CirculoIcono.tsx`:

```tsx
import React from 'react'
import { View } from 'react-native'
import { useTema } from '../../lib/tema'
import { radio } from '../../lib/theme'

export type TonoIcono = 'primario' | 'exito' | 'peligro' | 'acento'

interface Props {
  tono?: TonoIcono
  tamano?: number
  children: React.ReactElement<{ color?: string; size?: number }>
}

// Contenedor soft que reemplaza la calidez de los emojis (spec §4).
export function CirculoIcono({ tono = 'primario', tamano = 44, children }: Props) {
  const { paleta } = useTema()
  const colores = {
    primario: { fondo: paleta.primarioSoft, icono: paleta.primario },
    exito: { fondo: paleta.exitoSoft, icono: paleta.exito },
    peligro: { fondo: paleta.peligroSoft, icono: paleta.peligro },
    acento: { fondo: paleta.acentoSoft, icono: paleta.acento },
  }[tono]

  return (
    <View
      style={{
        width: tamano,
        height: tamano,
        borderRadius: radio.full,
        backgroundColor: colores.fondo,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {React.cloneElement(children, { color: colores.icono, size: Math.round(tamano * 0.48) })}
    </View>
  )
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx jest components/ui/Tarjeta.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/ui/Tarjeta.tsx components/ui/TarjetaMetrica.tsx components/ui/Badge.tsx components/ui/CirculoIcono.tsx components/ui/Tarjeta.test.tsx
git commit -m "feat(ui): Tarjeta, TarjetaMetrica, Badge (punto pulsante) y CirculoIcono

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: `Chip` + `ControlSegmentado`

**Files:**
- Create: `components/ui/Chip.tsx`, `components/ui/ControlSegmentado.tsx`
- Test: `components/ui/ControlSegmentado.test.tsx`

**Interfaces:**
- Consumes: `useTema`, tokens, `motion.springLayout`.
- Produces:
  - `Chip({ etiqueta: string; activo: boolean; onPress: () => void })` — pill 36dp.
  - `ControlSegmentado({ opciones: string[]; indice: number; onCambio: (i: number) => void })` — pill deslizante con spring (receta 3).

- [ ] **Step 1: Test que falla**

Crear `components/ui/ControlSegmentado.test.tsx`:

```tsx
import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

import { TemaProvider } from '../../lib/tema'
import { paletaClara } from '../../lib/theme'
import { Chip } from './Chip'
import { ControlSegmentado } from './ControlSegmentado'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

const aplanar = (estilo: unknown): Record<string, unknown> =>
  Object.assign({}, ...[estilo].flat(Infinity).filter(Boolean) as object[])

describe('Chip', () => {
  it('activo usa primario, inactivo usa superficie', async () => {
    const a = await montar(<Chip etiqueta="Hoy" activo onPress={() => {}} />)
    expect(aplanar(a.root.findByProps({ accessibilityRole: 'button' }).props.style).backgroundColor)
      .toBe(paletaClara.primario)
    const b = await montar(<Chip etiqueta="Semana" activo={false} onPress={() => {}} />)
    expect(aplanar(b.root.findByProps({ accessibilityRole: 'button' }).props.style).backgroundColor)
      .toBe(paletaClara.superficie)
  })
})

describe('ControlSegmentado', () => {
  it('renderiza las opciones y marca la activa como seleccionada', async () => {
    const arbol = await montar(
      <ControlSegmentado opciones={['Ventas', 'Devoluciones', 'Gastos']} indice={0} onCambio={() => {}} />
    )
    const tabs = arbol.root.findAllByProps({ accessibilityRole: 'tab' }).filter((n) => n.props.onPress)
    expect(tabs).toHaveLength(3)
    expect(tabs[0].props.accessibilityState).toEqual({ selected: true })
    expect(tabs[1].props.accessibilityState).toEqual({ selected: false })
  })

  it('tocar una opción llama onCambio con su índice', async () => {
    const onCambio = jest.fn()
    const arbol = await montar(
      <ControlSegmentado opciones={['Calzado', 'Granja']} indice={0} onCambio={onCambio} />
    )
    const tabs = arbol.root.findAllByProps({ accessibilityRole: 'tab' }).filter((n) => n.props.onPress)
    await act(async () => {
      tabs[1].props.onPress()
    })
    expect(onCambio).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx jest components/ui/ControlSegmentado.test.tsx`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar**

`components/ui/Chip.tsx`:

```tsx
import React from 'react'
import { Pressable, Text } from 'react-native'
import { useTema } from '../../lib/tema'
import { radio, tipografia } from '../../lib/theme'

interface Props {
  etiqueta: string
  activo: boolean
  onPress: () => void
}

export function Chip({ etiqueta, activo, onPress }: Props) {
  const { paleta } = useTema()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      onPress={onPress}
      hitSlop={6}
      style={{
        height: 36,
        paddingHorizontal: 16,
        borderRadius: radio.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: activo ? paleta.primario : paleta.superficie,
        borderWidth: 1,
        borderColor: activo ? paleta.primario : paleta.borde,
      }}
    >
      <Text style={[tipografia.etiqueta, { color: activo ? paleta.sobrePrimario : paleta.texto2 }]}>
        {etiqueta}
      </Text>
    </Pressable>
  )
}
```

`components/ui/ControlSegmentado.tsx`:

```tsx
import React, { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useTema } from '../../lib/tema'
import { motion, radio, tipografia } from '../../lib/theme'

interface Props {
  opciones: string[]
  indice: number
  onCambio: (indice: number) => void
}

const RELLENO = 4

// Receta 3: pill deslizante con springLayout.
export function ControlSegmentado({ opciones, indice, onCambio }: Props) {
  const { paleta, esOscuro } = useTema()
  const [ancho, setAncho] = useState(0)
  const x = useSharedValue(0)

  const anchoPill = ancho > 0 ? (ancho - RELLENO * 2) / opciones.length : 0

  useEffect(() => {
    x.value = withSpring(RELLENO + indice * anchoPill, motion.springLayout)
  }, [indice, anchoPill, x])

  const estiloPill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  return (
    <View
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        backgroundColor: paleta.superficie2,
        borderRadius: radio.full,
        padding: RELLENO,
      }}
    >
      {anchoPill > 0 ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: RELLENO,
              bottom: RELLENO,
              left: 0,
              width: anchoPill,
              borderRadius: radio.full,
              backgroundColor: esOscuro ? paleta.superficie : paleta.fondo,
              elevation: 2,
              shadowColor: '#0B1220',
              shadowOpacity: 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            },
            estiloPill,
          ]}
        />
      ) : null}
      {opciones.map((opcion, i) => (
        <Pressable
          key={opcion}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === indice }}
          onPress={() => onCambio(i)}
          style={{ flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            style={[tipografia.etiqueta, { color: i === indice ? paleta.primario : paleta.texto2 }]}
          >
            {opcion}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx jest components/ui/ControlSegmentado.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/ui/Chip.tsx components/ui/ControlSegmentado.tsx components/ui/ControlSegmentado.test.tsx
git commit -m "feat(ui): Chip de filtro y ControlSegmentado con pill deslizante

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: `CampoTexto` + `FilaLista`

**Files:**
- Create: `components/ui/CampoTexto.tsx`, `components/ui/FilaLista.tsx`
- Test: `components/ui/CampoTexto.test.tsx`

**Interfaces:**
- Consumes: `useTema`, tokens.
- Produces:
  - `CampoTexto({ etiqueta: string; error?: string; gigante?: boolean } & TextInputProps)` — label siempre visible; focus ring primario; error debajo del campo.
  - `FilaLista({ icono?: React.ReactNode; titulo: string; subtitulo?: string; derecha?: React.ReactNode; chevron?: boolean; onPress?: () => void })` — fila 64dp mínimo; press → superficie2.

- [ ] **Step 1: Test que falla**

Crear `components/ui/CampoTexto.test.tsx`:

```tsx
import React from 'react'
import { Text, TextInput } from 'react-native'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

import { TemaProvider } from '../../lib/tema'
import { paletaClara } from '../../lib/theme'
import { CampoTexto } from './CampoTexto'
import { FilaLista } from './FilaLista'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

const aplanar = (estilo: unknown): Record<string, unknown> =>
  Object.assign({}, ...[estilo].flat(Infinity).filter(Boolean) as object[])

describe('CampoTexto', () => {
  it('label visible y borde normal', async () => {
    const arbol = await montar(<CampoTexto etiqueta="Nombre del cliente" placeholder="Ana" />)
    expect(arbol.root.findByProps({ children: 'Nombre del cliente' })).toBeTruthy()
    const input = arbol.root.findByType(TextInput)
    expect(aplanar(input.props.style).borderColor).toBe(paletaClara.bordeFuerte)
  })

  it('focus pinta el borde primario; blur lo devuelve', async () => {
    const arbol = await montar(<CampoTexto etiqueta="Precio" />)
    const input = arbol.root.findByType(TextInput)
    await act(async () => input.props.onFocus?.({}))
    expect(aplanar(input.props.style).borderColor).toBe(paletaClara.primario)
    await act(async () => input.props.onBlur?.({}))
    expect(aplanar(input.props.style).borderColor).toBe(paletaClara.bordeFuerte)
  })

  it('error: borde peligro + mensaje debajo', async () => {
    const arbol = await montar(
      <CampoTexto etiqueta="Precio final" error="Está por debajo del precio mínimo" />
    )
    const input = arbol.root.findByType(TextInput)
    expect(aplanar(input.props.style).borderColor).toBe(paletaClara.peligro)
    expect(arbol.root.findByProps({ children: 'Está por debajo del precio mínimo' })).toBeTruthy()
  })
})

describe('FilaLista', () => {
  it('muestra título, subtítulo y llama onPress', async () => {
    const onPress = jest.fn()
    const arbol = await montar(
      <FilaLista titulo="Venta #102" subtitulo="2:14 PM · Efectivo" onPress={onPress} chevron />
    )
    expect(arbol.root.findByProps({ children: 'Venta #102' })).toBeTruthy()
    const fila = arbol.root.findByProps({ accessibilityRole: 'button' })
    fila.props.onPress()
    expect(onPress).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx jest components/ui/CampoTexto.test.tsx`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar**

`components/ui/CampoTexto.tsx`:

```tsx
import React, { useState } from 'react'
import { Text, TextInput, TextInputProps, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../lib/theme'

interface Props extends TextInputProps {
  etiqueta: string
  error?: string
  gigante?: boolean
}

export function CampoTexto({ etiqueta, error, gigante = false, onFocus, onBlur, ...resto }: Props) {
  const { paleta } = useTema()
  const [enfocado, setEnfocado] = useState(false)

  const colorBorde = error ? paleta.peligro : enfocado ? paleta.primario : paleta.bordeFuerte

  return (
    <View style={{ gap: 6 }}>
      <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>{etiqueta}</Text>
      <TextInput
        placeholderTextColor={paleta.textoDeshabilitado}
        onFocus={(e) => {
          setEnfocado(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setEnfocado(false)
          onBlur?.(e)
        }}
        style={[
          gigante ? [tipografia.display, tabular, { textAlign: 'center' as const }] : tipografia.cuerpo,
          {
            height: gigante ? 64 : 52,
            borderWidth: 2,
            borderColor: colorBorde,
            borderRadius: radio.sm,
            backgroundColor: paleta.superficie,
            color: paleta.texto,
            paddingHorizontal: espacio.l,
          },
        ]}
        {...resto}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[tipografia.caption, { color: paleta.peligroTexto }]}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}
```

`components/ui/FilaLista.tsx`:

```tsx
import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { useTema } from '../../lib/tema'
import { espacio, tipografia } from '../../lib/theme'

interface Props {
  icono?: React.ReactNode
  titulo: string
  subtitulo?: string
  derecha?: React.ReactNode
  chevron?: boolean
  onPress?: () => void
}

export function FilaLista({ icono, titulo, subtitulo, derecha, chevron = false, onPress }: Props) {
  const { paleta } = useTema()

  const contenido = (presionada: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        minHeight: 64,
        paddingVertical: espacio.s,
        backgroundColor: presionada ? paleta.superficie2 : 'transparent',
        borderRadius: 12,
      }}
    >
      {icono}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[tipografia.h3, { color: paleta.texto }]} numberOfLines={1}>
          {titulo}
        </Text>
        {subtitulo ? (
          <Text style={[tipografia.caption, { color: paleta.texto3 }]} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>
      {derecha}
      {chevron ? <ChevronRight size={20} color={paleta.texto3} /> : null}
    </View>
  )

  if (!onPress) return contenido(false)

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => contenido(pressed)}
    </Pressable>
  )
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx jest components/ui/CampoTexto.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/ui/CampoTexto.tsx components/ui/FilaLista.tsx components/ui/CampoTexto.test.tsx
git commit -m "feat(ui): CampoTexto (focus/error) y FilaLista con press-feedback

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: `Esqueleto`, `EstadoVacio`, barrel y verificación final

**Files:**
- Create: `components/ui/Esqueleto.tsx`, `components/ui/EstadoVacio.tsx`, `components/ui/index.ts`
- Test: `components/ui/EstadoVacio.test.tsx`

**Interfaces:**
- Consumes: `useTema`, tokens, `Boton`, `CirculoIcono`.
- Produces:
  - `Esqueleto({ ancho?: number | string; alto?: number; radio?: number })` — pulso opacidad 0.5↔1 (receta 7).
  - `EstadoVacio({ icono?: React.ReactElement; titulo: string; mensaje?: string; textoAccion?: string; onAccion?: () => void })`
  - `components/ui/index.ts` reexporta TODO: `Presionable, Boton, Tarjeta, TarjetaMetrica, Badge, CirculoIcono, Chip, ControlSegmentado, CampoTexto, FilaLista, Esqueleto, EstadoVacio` + sus types.

- [ ] **Step 1: Test que falla**

Crear `components/ui/EstadoVacio.test.tsx`:

```tsx
import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

import { TemaProvider } from '../../lib/tema'
import { EstadoVacio } from './EstadoVacio'
import { Esqueleto } from './Esqueleto'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

describe('EstadoVacio', () => {
  it('muestra título, mensaje y acción que responde', async () => {
    const onAccion = jest.fn()
    const arbol = await montar(
      <EstadoVacio
        titulo="Aún no hay ventas hoy"
        mensaje="Toca + para registrar la primera"
        textoAccion="Nueva venta"
        onAccion={onAccion}
      />
    )
    expect(arbol.root.findByProps({ children: 'Aún no hay ventas hoy' })).toBeTruthy()
    arbol.root.findByProps({ accessibilityRole: 'button' }).props.onPress()
    expect(onAccion).toHaveBeenCalled()
  })

  it('sin acción no renderiza botón', async () => {
    const arbol = await montar(<EstadoVacio titulo="No hay registros de caja." />)
    expect(arbol.root.findAllByProps({ accessibilityRole: 'button' }).filter((n) => n.props.onPress)).toHaveLength(0)
  })
})

describe('Esqueleto', () => {
  it('renderiza con dimensiones dadas', async () => {
    const arbol = await montar(<Esqueleto ancho={120} alto={16} />)
    expect(arbol.root.findByProps({ testID: 'esqueleto' })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx jest components/ui/EstadoVacio.test.tsx`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar**

`components/ui/Esqueleto.tsx`:

```tsx
import React, { useEffect } from 'react'
import { DimensionValue } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useTema } from '../../lib/tema'

interface Props {
  ancho?: DimensionValue
  alto?: number
  radio?: number
}

// Receta 7: pulso de opacidad 0.5 ↔ 1 cada 1000ms.
export function Esqueleto({ ancho = '100%', alto = 16, radio: r = 8 }: Props) {
  const { paleta } = useTema()
  const op = useSharedValue(1)
  const reducido = useReducedMotion()

  useEffect(() => {
    if (reducido) return
    op.value = withRepeat(
      withSequence(withTiming(0.5, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1
    )
  }, [op, reducido])

  const estilo = useAnimatedStyle(() => ({ opacity: op.value }))

  return (
    <Animated.View
      testID="esqueleto"
      style={[{ width: ancho, height: alto, borderRadius: r, backgroundColor: paleta.superficie2 }, estilo]}
    />
  )
}
```

`components/ui/EstadoVacio.tsx`:

```tsx
import React from 'react'
import { Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import { Boton } from './Boton'

interface Props {
  icono?: React.ReactElement<{ color?: string; size?: number }>
  titulo: string
  mensaje?: string
  textoAccion?: string
  onAccion?: () => void
}

export function EstadoVacio({ icono, titulo, mensaje, textoAccion, onAccion }: Props) {
  const { paleta } = useTema()
  return (
    <View style={{ alignItems: 'center', gap: espacio.m, paddingVertical: espacio.xxxl }}>
      {icono ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radio.full,
            backgroundColor: paleta.superficie2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {React.cloneElement(icono, { color: paleta.texto3, size: 28 })}
        </View>
      ) : null}
      <Text style={[tipografia.h3, { color: paleta.texto, textAlign: 'center' }]}>{titulo}</Text>
      {mensaje ? (
        <Text style={[tipografia.cuerpo, { color: paleta.texto2, textAlign: 'center' }]}>{mensaje}</Text>
      ) : null}
      {textoAccion && onAccion ? (
        <Boton titulo={textoAccion} variante="secundario" tamano="md" onPress={onAccion} />
      ) : null}
    </View>
  )
}
```

`components/ui/index.ts`:

```ts
export { Presionable } from './Presionable'
export { Boton } from './Boton'
export type { VarianteBoton } from './Boton'
export { Tarjeta } from './Tarjeta'
export { TarjetaMetrica } from './TarjetaMetrica'
export { Badge } from './Badge'
export type { TipoBadge } from './Badge'
export { CirculoIcono } from './CirculoIcono'
export type { TonoIcono } from './CirculoIcono'
export { Chip } from './Chip'
export { ControlSegmentado } from './ControlSegmentado'
export { CampoTexto } from './CampoTexto'
export { FilaLista } from './FilaLista'
export { Esqueleto } from './Esqueleto'
export { EstadoVacio } from './EstadoVacio'
```

- [ ] **Step 4: Verificar que pasa + suite completa + tipos**

```bash
npx jest components/ui/EstadoVacio.test.tsx
npx tsc --noEmit
npx jest 2>&1 | tail -5
```

Expected: los 3 tests nuevos PASS; tsc limpio; TODA la suite (existente + nueva) en verde.

- [ ] **Step 5: Commit final de la fase**

```bash
git add components/ui/Esqueleto.tsx components/ui/EstadoVacio.tsx components/ui/index.ts components/ui/EstadoVacio.test.tsx
git commit -m "feat(ui): Esqueleto, EstadoVacio y barrel de components/ui

Cierra la fase fundamentos del rediseño (pasos 1-2 de redisign-visual.md §9.3).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review (hecho al escribir el plan)

1. **Cobertura de spec (fase 1-2 de §9.3):** deps ✓ (Task 2), theme.ts ✓ (3), ThemeProvider+persistencia ✓ (4), fuentes ✓ (5), componentes base §6.2–6.11 parciales ✓ (6–10). Fuera de alcance a propósito (van con sus pantallas en planes siguientes): TabBar (§6.1), Sheet, Toast, TecladoPin, ChipTalla, PillColor, GraficoBarras.
2. **Placeholders:** ninguno; todo el código está inline.
3. **Consistencia de tipos:** `useTema()` → `{ paleta, esOscuro, modo, setModo }` usada igual en Tasks 6–10; tokens importados de `lib/theme` con los mismos nombres definidos en Task 3.
