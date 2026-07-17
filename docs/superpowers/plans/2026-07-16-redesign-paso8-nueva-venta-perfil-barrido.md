# Paso 8 — Nueva Venta + Perfil + Barrido: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el paso 8 del rediseño: componentes `Toast`/`OverlayExito`, Nueva Venta restilizada, Perfil pulido, 5 pantallas eliminadas con redirecciones y ~25 pantallas restilizadas al nuevo lenguaje visual.

**Architecture:** Solo capa de presentación — la lógica de negocio, hooks de datos y backend no cambian. Componentes nuevos en `components/ui/` consumiendo `useTema()`; pantallas reescritas usando la librería existente (Boton, Tarjeta, CampoTexto, Chip, FilaLista, EstadoVacio, Esqueleto).

**Tech Stack:** React Native (Expo SDK 54), TypeScript estricto, expo-router, react-native-reanimated 4, lucide-react-native, expo-haptics, jest + react-test-renderer.

**Spec:** `docs/superpowers/specs/2026-07-16-paso8-nueva-venta-perfil-barrido-design.md`

## Global Constraints

- Rama de trabajo: `feat/redesign-nueva-venta`. Un commit por task. NUNCA tocar backend/RPCs/RLS.
- TypeScript estricto; verificar con `npx tsc --noEmit` antes de cada commit.
- Tests con `npx jest` (suite completa al cerrar cada task; durante el desarrollo se puede filtrar por archivo).
- UI 100% en español; `accessibilityLabel`/`Role`/`State` en español en cada control nuevo.
- Cero colores/tamaños hardcoded en pantallas tocadas: todo vía `useTema()` (`paleta.*`) y `tipografia`/`espacio`/`radio`/`tabular` de `lib/theme.ts`.
- Dinero SIEMPRE con `tabular`: `<Text style={[tipografia.h3, tabular]}>`.
- Teclados semánticos: `number-pad` montos, `decimal-pad` cantidades Granja, `phone-pad` teléfonos.
- Componente `Sheet`: NO construirlo (diferido por spec).
- Iconos: `lucide-react-native` (build CJS ya mapeado en jest `moduleNameMapper`).
- Tests que importan `lib/supabase` transitivamente: fijar `process.env.EXPO_PUBLIC_SUPABASE_URL/..._PUBLISHABLE_KEY` dummy ANTES de los imports y `jest.mock('./supabase'|'../lib/supabase')` (patrón de `lib/producto_detalle_ui.test.tsx`).
- Tests con Reanimated: `jest.useFakeTimers()` obligatorio.

### Reglas de restilizado (aplican a TODA pantalla tocada — "las Reglas")

Mapeo mecánico de patrones viejos → nuevos. Ejemplos con código exacto:

1. **Contenedor de pantalla:**
   ```tsx
   const { paleta } = useTema()
   // raíz:
   <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
   ```
   Imports: `import { useTema } from '../../../lib/tema'` y
   `import { espacio, radio, tabular, tipografia } from '../../../lib/theme'`
   (ajustar profundidad de `../`).

2. **Header con volver** (reemplaza los `<Pressable>← Texto</Pressable>` viejos):
   ```tsx
   <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m,
     paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m }}>
     <Presionable accessibilityRole="button" accessibilityLabel="Volver"
       onPress={() => router.back()} hitSlop={12}>
       <ArrowLeft size={24} color={paleta.texto} />
     </Presionable>
     <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Título</Text>
   </View>
   ```
   (`ArrowLeft` de lucide; `Presionable` de `components/ui`.)

3. **Botones:** todo `Pressable` con fondo azul → `<Boton titulo="..." onPress={...} />`;
   variantes `secundario` (fondo suave), `peligro`, `fantasma` (solo texto);
   `cargando={guardando}` reemplaza los `<ActivityIndicator color="#fff" />`
   dentro de botones; `deshabilitado={...}` reemplaza `opacity: 0.4`.

4. **Inputs:** `TextInput` con borde → `<CampoTexto etiqueta="..." error={...} />`
   (la etiqueta reemplaza el `<Text>` label de arriba; `error` reemplaza textos
   rojos sueltos debajo).

5. **Cards / secciones con borde o sombra:** → `<Tarjeta>` (padding `espacio.l`
   incluido). Filas navegables dentro → `<FilaLista icono={<CirculoIcono …>}
   titulo subtitulo chevron onPress />` con separador
   `<View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} />`.

6. **Estados de carga:** spinner de pantalla completa →
   `<ActivityIndicator size="large" color={paleta.primario} />` centrado, o
   `<Esqueleto …>` si la pantalla ya distingue primera carga.

7. **Estados vacíos:** textos "No hay…" sueltos →
   `<EstadoVacio icono={<IconoLucide />} titulo="…" mensaje="…" />`.

8. **Textos:** mapear tamaños viejos → escala: 26–28/800→`h1`, 20–22/700→`h2`,
   17–18/600-700→`h3` o `cuerpoLg`, 15–16→`cuerpo`, 13→`etiqueta` o `caption`,
   11–12 gris→`caption`/`micro`. Colores: `#666/#777/#888`→`paleta.texto2` o
   `texto3`; `#D20F39`→`paleta.peligroTexto`; `#1E7A34`→`paleta.exitoTexto`;
   `#1E66F5`→`paleta.primario`.

9. **Alerts informativos** (un solo botón "OK"/"Aceptar" sin decisión) →
   `useToast().mostrar(mensaje, 'error'|'info')`. Confirmaciones (2+ opciones o
   destructivas) siguen en `Alert.alert`.

10. **Emojis estructurales** (iconos de módulo `🛒`) → icono Lucide equivalente
    en `CirculoIcono`. Emojis en texto de contenido pueden quedarse.

11. **Lógica intacta:** no renombrar estados, no cambiar llamadas a `lib/*`,
    no alterar flujos ni validaciones. Solo JSX y estilos.

---

### Task 1: Componente `Toast` + `ToastProvider` montado

**Files:**
- Create: `components/ui/Toast.tsx`
- Create: `components/ui/Toast.test.tsx`
- Modify: `components/ui/index.ts` (agregar export)
- Modify: `app/(app)/_layout.tsx` (montar provider)

**Interfaces:**
- Consumes: `useTema()` de `lib/tema`, tokens de `lib/theme`.
- Produces: `ToastProvider` (componente), `useToast(): { mostrar(mensaje: string, tipo?: 'exito' | 'error' | 'info'): void }`, tipo `TipoToast`. Tasks 3, 6 y el barrido dependen de esta firma exacta.

- [ ] **Step 1: Escribir tests que fallan**

```tsx
// components/ui/Toast.test.tsx
import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { Text } from 'react-native'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.useFakeTimers()

import { TemaProvider } from '../../lib/tema'
import { ToastProvider, useToast } from './Toast'

function Disparador({ mensaje, tipo }: { mensaje: string; tipo?: 'exito' | 'error' | 'info' }) {
  const { mostrar } = useToast()
  return <Text onPress={() => mostrar(mensaje, tipo)}>disparar</Text>
}

function montar(mensaje: string, tipo?: 'exito' | 'error' | 'info') {
  let arbol: renderer.ReactTestRenderer
  act(() => {
    arbol = renderer.create(
      <TemaProvider>
        <ToastProvider>
          <Disparador mensaje={mensaje} tipo={tipo} />
        </ToastProvider>
      </TemaProvider>
    )
  })
  return arbol!
}

const textos = (arbol: renderer.ReactTestRenderer) =>
  arbol.root.findAllByType(Text).map(t => t.props.children).flat().join(' ')

describe('Toast', () => {
  test('mostrar() renderiza el mensaje', () => {
    const arbol = montar('Agregado: talla 40 · Negro')
    act(() => { arbol.root.findAllByType(Text)[0].props.onPress() })
    expect(textos(arbol)).toContain('Agregado: talla 40 · Negro')
  })

  test('se autodescarta a los 2.5s', () => {
    const arbol = montar('Hola')
    act(() => { arbol.root.findAllByType(Text)[0].props.onPress() })
    expect(textos(arbol)).toContain('Hola')
    act(() => { jest.advanceTimersByTime(2600) })
    expect(textos(arbol)).not.toContain('Hola')
  })

  test('un toast a la vez: el nuevo reemplaza al anterior', () => {
    const arbol = montar('Primero')
    const boton = arbol.root.findAllByType(Text)[0]
    act(() => { boton.props.onPress() })
    act(() => { arbol.update(
      <TemaProvider><ToastProvider><Disparador mensaje="Segundo" /></ToastProvider></TemaProvider>
    ) })
    act(() => { arbol.root.findAllByType(Text)[0].props.onPress() })
    expect(textos(arbol)).toContain('Segundo')
    expect(textos(arbol)).not.toContain('Primero')
  })

  test('useToast fuera del provider lanza error', () => {
    function Suelto() { useToast(); return null }
    expect(() => renderer.create(<Suelto />)).toThrow('ToastProvider')
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx jest components/ui/Toast.test.tsx`
Expected: FAIL — "Cannot find module './Toast'"

- [ ] **Step 3: Implementar `Toast.tsx`**

```tsx
// components/ui/Toast.tsx
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { CircleAlert, CircleCheck, Info } from 'lucide-react-native'
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'

export type TipoToast = 'exito' | 'error' | 'info'

interface ContextoToast {
  mostrar: (mensaje: string, tipo?: TipoToast) => void
}

const Contexto = createContext<ContextoToast | null>(null)

export function useToast(): ContextoToast {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [actual, setActual] = useState<{ id: number; mensaje: string; tipo: TipoToast } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mostrar = useCallback((mensaje: string, tipo: TipoToast = 'exito') => {
    if (timer.current) clearTimeout(timer.current)
    setActual(prev => ({ id: (prev?.id ?? 0) + 1, mensaje, tipo }))
    timer.current = setTimeout(() => setActual(null), 2500)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <Contexto.Provider value={{ mostrar }}>
      {children}
      {actual ? <VistaToast key={actual.id} mensaje={actual.mensaje} tipo={actual.tipo} /> : null}
    </Contexto.Provider>
  )
}

function VistaToast({ mensaje, tipo }: { mensaje: string; tipo: TipoToast }) {
  const { paleta } = useTema()
  const reducido = useReducedMotion()

  const Icono = { exito: CircleCheck, error: CircleAlert, info: Info }[tipo]
  const color = {
    exito: paleta.exitoTexto,
    error: paleta.peligroTexto,
    info: paleta.texto2,
  }[tipo]

  return (
    <Animated.View
      entering={reducido ? FadeIn.duration(150) : FadeInDown.duration(200)}
      exiting={FadeOut.duration(150)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: espacio.xl,
        right: espacio.xl,
        bottom: 96,
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.s,
        backgroundColor: paleta.superficie,
        borderWidth: 1,
        borderColor: paleta.borde,
        borderRadius: radio.md,
        paddingVertical: espacio.m,
        paddingHorizontal: espacio.l,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Icono size={20} color={color} />
      <Text style={[tipografia.cuerpo, { color: paleta.texto, flex: 1 }]} numberOfLines={2}>
        {mensaje}
      </Text>
    </Animated.View>
  )
}
```

- [ ] **Step 4: Correr tests hasta verde**

Run: `npx jest components/ui/Toast.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Exportar en el barrel y montar el provider**

En `components/ui/index.ts` agregar:

```ts
export { ToastProvider, useToast } from './Toast'
export type { TipoToast } from './Toast'
```

En `app/(app)/_layout.tsx`:

```tsx
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { CarritoProvider } from '../../lib/carrito-contexto'
import { ToastProvider } from '../../components/ui'

export default function AppLayout() {
  const { session } = useAuth()
  if (!session) return <Redirect href="/login" />
  return (
    <CarritoProvider>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ToastProvider>
    </CarritoProvider>
  )
}
```

- [ ] **Step 6: Verificar y commit**

Run: `npx tsc --noEmit && npx jest`
Expected: sin errores de tipos; suite completa PASS.

```bash
git add components/ui/Toast.tsx components/ui/Toast.test.tsx components/ui/index.ts "app/(app)/_layout.tsx"
git commit -m "feat(ui): Toast global con ToastProvider y useToast"
```

---

### Task 2: Componente `OverlayExito` (receta 10)

**Files:**
- Create: `components/ui/OverlayExito.tsx`
- Create: `components/ui/OverlayExito.test.tsx`
- Modify: `components/ui/index.ts`

**Interfaces:**
- Consumes: `useTema()`, expo-haptics, Reanimated.
- Produces: `OverlayExito({ visible: boolean; mensaje?: string; onFin: () => void })`. Tasks 4 (confirmación de venta) y 12 (cierre de caja) dependen de esta firma.

- [ ] **Step 1: Escribir tests que fallan**

```tsx
// components/ui/OverlayExito.test.tsx
import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.useFakeTimers()

const mockNotification = jest.fn(() => Promise.resolve())
jest.mock('expo-haptics', () => ({
  notificationAsync: (...a: unknown[]) => mockNotification(...a),
  NotificationFeedbackType: { Success: 'success' },
}))

import { TemaProvider } from '../../lib/tema'
import { OverlayExito } from './OverlayExito'

describe('OverlayExito', () => {
  test('visible dispara haptic y llama onFin a los 1.2s', () => {
    const onFin = jest.fn()
    act(() => {
      renderer.create(
        <TemaProvider>
          <OverlayExito visible mensaje="Venta registrada" onFin={onFin} />
        </TemaProvider>
      )
    })
    expect(mockNotification).toHaveBeenCalled()
    expect(onFin).not.toHaveBeenCalled()
    act(() => { jest.advanceTimersByTime(1300) })
    expect(onFin).toHaveBeenCalledTimes(1)
  })

  test('no visible: no renderiza ni agenda nada', () => {
    const onFin = jest.fn()
    let arbol: renderer.ReactTestRenderer
    act(() => {
      arbol = renderer.create(
        <TemaProvider><OverlayExito visible={false} onFin={onFin} /></TemaProvider>
      )
    })
    expect(arbol!.toJSON()).toBeNull()
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onFin).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx jest components/ui/OverlayExito.test.tsx`
Expected: FAIL — "Cannot find module './OverlayExito'"

- [ ] **Step 3: Implementar**

```tsx
// components/ui/OverlayExito.tsx
import React, { useEffect, useRef } from 'react'
import { Text } from 'react-native'
import * as Haptics from 'expo-haptics'
import { CircleCheck } from 'lucide-react-native'
import Animated, {
  Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion,
  useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated'
import { useTema } from '../../lib/tema'
import { espacio, tipografia } from '../../lib/theme'

interface Props {
  visible: boolean
  mensaje?: string
  onFin: () => void
}

export function OverlayExito({ visible, mensaje, onFin }: Props) {
  const { paleta } = useTema()
  const reducido = useReducedMotion()
  const escala = useSharedValue(0.6)
  const flash = useSharedValue(0)
  const onFinRef = useRef(onFin)
  onFinRef.current = onFin

  useEffect(() => {
    if (!visible) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    if (!reducido) {
      escala.value = withSpring(1, { damping: 12, stiffness: 180 })
      flash.value = withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 250, easing: Easing.in(Easing.quad) })
      )
    } else {
      escala.value = 1
    }
    const t = setTimeout(() => onFinRef.current(), 1200)
    return () => clearTimeout(t)
  }, [visible, reducido, escala, flash])

  const estiloIcono = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }))
  const estiloFlash = useAnimatedStyle(() => ({ opacity: flash.value }))

  if (!visible) return null

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      accessibilityLiveRegion="assertive"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center', gap: espacio.l,
        backgroundColor: paleta.fondo, zIndex: 10,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: paleta.exitoSoft }, estiloFlash]}
      />
      <Animated.View style={estiloIcono}>
        <CircleCheck size={96} color={paleta.exito} strokeWidth={1.5} />
      </Animated.View>
      {mensaje ? (
        <Text style={[tipografia.h2, { color: paleta.texto, textAlign: 'center' }]}>{mensaje}</Text>
      ) : null}
    </Animated.View>
  )
}
```

- [ ] **Step 4: Correr tests hasta verde**

Run: `npx jest components/ui/OverlayExito.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Exportar y commit**

En `components/ui/index.ts`: `export { OverlayExito } from './OverlayExito'`

Run: `npx tsc --noEmit && npx jest`
Expected: PASS

```bash
git add components/ui/OverlayExito.tsx components/ui/OverlayExito.test.tsx components/ui/index.ts
git commit -m "feat(ui): OverlayExito — receta 10 de éxito de venta/cierre"
```

---

### Task 3: Toast "Agregado" en el detalle de producto

**Files:**
- Modify: `app/(app)/productos/[ref].tsx` (~línea 175, handler de agregar al carrito)
- Modify: `lib/producto_detalle_ui.test.tsx`

**Interfaces:**
- Consumes: `useToast()` de Task 1; `ChipTalla`/`PillColor` existentes con selección de talla y color en estado local del screen.

- [ ] **Step 1: Test que falla — el flujo agregar muestra el toast**

En `lib/producto_detalle_ui.test.tsx`: envolver el render existente también con
`ToastProvider` (import desde `../components/ui`), y agregar al final:

```tsx
test('agregar al carrito muestra toast "Agregado: talla N · Color"', async () => {
  const arbol = await montarDetalle() // usar el helper de montaje existente del archivo
  // seleccionar talla y color como lo hace el test existente de "Agregar al carrito"
  // ... (reusar los pasos de selección del test previo)
  // tras presionar "Agregar al carrito":
  const textos = arbol.root.findAllByType(Text).map(t => JSON.stringify(t.props.children))
  expect(textos.join(' ')).toContain('Agregado')
})
```

Nota: adaptar al helper real del archivo (el test existente "Agregar al carrito"
ya monta, selecciona talla/color y presiona el botón — copiar esa secuencia y
añadir la aserción del toast).

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx jest lib/producto_detalle_ui.test.tsx`
Expected: FAIL en el test nuevo (el toast no existe aún; si falla antes por el
provider, montar `ToastProvider` primero y re-correr).

- [ ] **Step 3: Implementar en `[ref].tsx`**

```tsx
import { useToast } from '../../../components/ui'
// dentro del componente:
const { mostrar } = useToast()
// en el handler de agregar (donde está el Haptics.impactAsync):
mostrar(`Agregado: talla ${tallaSeleccionada} · ${colorSeleccionado}`)
```

(Usar los nombres reales de las variables de selección del archivo.)

- [ ] **Step 4: Verde y commit**

Run: `npx tsc --noEmit && npx jest lib/producto_detalle_ui.test.tsx`
Expected: PASS

```bash
git add "app/(app)/productos/[ref].tsx" lib/producto_detalle_ui.test.tsx
git commit -m "feat(productos): toast de confirmación al agregar al carrito"
```

---

### Task 4: Nueva Venta restilizada

**Files:**
- Modify: `app/(app)/ventas/nueva.tsx` (reescritura de presentación completa)
- Create: `lib/venta_nueva_ui.test.tsx`

**Interfaces:**
- Consumes: `useCarrito()` (items, dispatch), funciones puras de `lib/carrito`
  (`totalCarrito`, `pagosCuadran`, `montoEfectivo`, `calcularCambio`,
  `bajoMinimo`), `buscarProductos`/`registrarVenta` de `lib/ventas`,
  `obtenerCajaHoy` de `lib/caja`, `OverlayExito` (Task 2), componentes ui.
- Produces: pantalla con la MISMA lógica (guard de caja, wizard 3 etapas,
  autollenado de monto con 1 método, `puedeConfirmar`); "Salir"/"Listo" ahora
  `router.back()` con fallback `router.replace('/movimientos')`.

- [ ] **Step 1: Escribir tests de UI que fallan**

```tsx
// lib/venta_nueva_ui.test.tsx
import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { Text } from 'react-native'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.useFakeTimers()

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}))

const mockBack = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack, canGoBack: () => true }),
}))

jest.mock('./supabase', () => ({ supabase: {} }))
jest.mock('../lib/supabase', () => ({ supabase: {} }))
jest.mock('../lib/auth', () => ({ useRequireModulo: () => null }))

const mockObtenerCajaHoy = jest.fn()
jest.mock('../lib/caja', () => ({ obtenerCajaHoy: () => mockObtenerCajaHoy() }))

const mockBuscar = jest.fn()
const mockRegistrar = jest.fn()
jest.mock('../lib/ventas', () => ({
  buscarProductos: (...a: unknown[]) => mockBuscar(...a),
  registrarVenta: (...a: unknown[]) => mockRegistrar(...a),
}))

import { TemaProvider } from './tema'
import { CarritoProvider, useCarrito } from './carrito-contexto'
import { ToastProvider } from '../components/ui'
import NuevaVenta from '../app/(app)/ventas/nueva'

const ZAPATO = {
  id: 'z1', tipo: 'calzado' as const, titulo: 'Nike Air 40 Negro', detalle: 'Deportivo',
  precio: 180000, precioMin: 150000, precioMax: 220000, stock: 5,
}

function Sembrador({ children }: { children: React.ReactNode }) {
  const { dispatch } = useCarrito()
  React.useEffect(() => { dispatch({ tipo: 'agregar', producto: ZAPATO }) }, [dispatch])
  return <>{children}</>
}

async function montar({ conItem = false } = {}) {
  mockObtenerCajaHoy.mockResolvedValue({ estado: 'abierta' })
  let arbol: renderer.ReactTestRenderer
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <CarritoProvider>
          <ToastProvider>
            {conItem ? <Sembrador><NuevaVenta /></Sembrador> : <NuevaVenta />}
          </ToastProvider>
        </CarritoProvider>
      </TemaProvider>
    )
  })
  return arbol!
}

const todoElTexto = (arbol: renderer.ReactTestRenderer) =>
  arbol.root.findAllByType(Text).map(t =>
    Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
  ).join(' | ')

const presionarPorLabel = (arbol: renderer.ReactTestRenderer, label: string) => {
  const nodo = arbol.root.findAll(n => n.props?.accessibilityLabel === label && !!n.props.onPress)[0]
  act(() => { nodo.props.onPress() })
}

describe('Nueva Venta restilizada', () => {
  beforeEach(() => jest.clearAllMocks())

  test('caja cerrada muestra estado bloqueado con acción a Caja', async () => {
    mockObtenerCajaHoy.mockResolvedValue({ estado: 'cerrada' })
    let arbol: renderer.ReactTestRenderer
    await act(async () => {
      arbol = renderer.create(
        <TemaProvider><CarritoProvider><ToastProvider><NuevaVenta /></ToastProvider></CarritoProvider></TemaProvider>
      )
    })
    expect(todoElTexto(arbol!)).toContain('Caja cerrada')
    expect(todoElTexto(arbol!)).toContain('Ir a Caja')
  })

  test('con item en el carrito el CTA muestra el total', async () => {
    const arbol = await montar({ conItem: true })
    expect(todoElTexto(arbol)).toContain('Cobrar')
    expect(todoElTexto(arbol)).toContain('180.000')
  })

  test('en cobrar: sin pagos muestra "Faltan"; al cuadrar muestra "Cuadra"', async () => {
    const arbol = await montar({ conItem: true })
    presionarPorLabel(arbol, 'Cobrar $180.000')
    expect(todoElTexto(arbol)).toContain('Faltan')
    // seleccionar Efectivo: 1 método → autollenado con el total → cuadra
    presionarPorLabel(arbol, 'Efectivo')
    expect(todoElTexto(arbol)).toContain('Cuadra')
  })

  test('confirmación: overlay y pantalla de venta registrada', async () => {
    mockRegistrar.mockResolvedValue({ numero: 42 })
    const arbol = await montar({ conItem: true })
    presionarPorLabel(arbol, 'Cobrar $180.000')
    presionarPorLabel(arbol, 'Efectivo')
    // llenar efectivo recibido
    const inputs = arbol.root.findAll(n => n.props?.placeholder === '¿Con cuánto paga?')
    act(() => { inputs[0].props.onChangeText('200000') })
    await act(async () => {
      presionarPorLabel(arbol, 'Confirmar venta')
    })
    expect(todoElTexto(arbol)).toContain('Venta #42 registrada')
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx jest lib/venta_nueva_ui.test.tsx`
Expected: FAIL — los labels/textos nuevos ("Ir a Caja", "Faltan", "Cuadra",
overlay) no existen en la pantalla vieja. (El test 2 puede pasar de casualidad;
está bien.)

- [ ] **Step 3: Reescribir la presentación de `nueva.tsx`**

Reescribir el archivo completo. La lógica (estados, handlers, guard, cálculos)
se conserva LITERAL de la versión actual; cambia el JSX y los estilos. Código
completo:

```tsx
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Check, Lock, Minus, Plus, Search, X } from 'lucide-react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useRequireModulo } from '../../../lib/auth'
import { useCarrito } from '../../../lib/carrito-contexto'
import {
  bajoMinimo, calcularCambio, montoEfectivo, pagosCuadran, totalCarrito,
  type AccionCarrito, type ItemCarrito, type MetodoPago, type PagoInput, type ProductoVendible,
} from '../../../lib/carrito'
import { buscarProductos, registrarVenta } from '../../../lib/ventas'
import { obtenerCajaHoy } from '../../../lib/caja'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import {
  Boton, CampoTexto, Chip, EstadoVacio, OverlayExito, Presionable, Tarjeta,
} from '../../../components/ui'

type Etapa = 'carrito' | 'cobrar' | 'confirmacion'
const METODOS: MetodoPago[] = ['efectivo', 'nequi', 'bre_b', 'otro']
const ETIQUETA: Record<MetodoPago, string> = { efectivo: 'Efectivo', nequi: 'Nequi', bre_b: 'Bre-B', otro: 'Otro' }
const pesos = (n: number) => '$' + n.toLocaleString('es-CO')
const soloEntero = (t: string) => t.replace(/[^0-9]/g, '')
const soloDecimal = (t: string) => {
  const limpio = t.replace(/[^0-9.]/g, '')
  const partes = limpio.split('.')
  return partes.length <= 1 ? limpio : partes[0] + '.' + partes.slice(1).join('')
}

function Paso({ onPress, etiqueta, children }: {
  onPress: () => void; etiqueta: string; children: ReactNode
}) {
  const { paleta } = useTema()
  return (
    <Presionable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      hitSlop={10}
      style={{
        width: 36, height: 36, borderRadius: radio.full,
        backgroundColor: paleta.primarioSoft, alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </Presionable>
  )
}

function LineaCarrito({ item, dispatch }: { item: ItemCarrito; dispatch: (a: AccionCarrito) => void }) {
  const { paleta } = useTema()
  const esCalzado = item.producto.tipo === 'calzado'
  const [precioTxt, setPrecioTxt] = useState(String(item.precio))
  const [cantTxt, setCantTxt] = useState(String(item.cantidad))
  const bajo = bajoMinimo(item)

  function commitPrecio() {
    dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: Number(soloEntero(precioTxt)) || 0 })
  }
  function commitCantidad() {
    dispatch({ tipo: 'cambiarCantidad', id: item.producto.id, cantidad: Number(soloDecimal(cantTxt)) || 0 })
  }

  const inputInline = {
    borderWidth: 1.5,
    borderColor: bajo ? paleta.peligro : paleta.bordeFuerte,
    borderRadius: radio.sm,
    paddingVertical: 6,
    paddingHorizontal: espacio.s,
    minWidth: 84,
    color: paleta.texto,
    backgroundColor: paleta.superficie,
    ...tipografia.cuerpo,
    ...tabular,
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.s }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]} numberOfLines={1}>
          {item.producto.titulo}
        </Text>
        {esCalzado ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
              <Text style={[tipografia.caption, { color: paleta.texto2 }]}>Precio c/u</Text>
              <TextInput
                accessibilityLabel="Precio unitario"
                style={inputInline}
                keyboardType="number-pad"
                value={precioTxt}
                onChangeText={t => setPrecioTxt(soloEntero(t))}
                onEndEditing={commitPrecio}
              />
            </View>
            <Text style={[tipografia.caption, { color: bajo ? paleta.peligroTexto : paleta.texto3 }]}>
              Rango {pesos(item.producto.precioMin ?? 0)}–{pesos(item.producto.precioMax ?? 0)}
              {bajo ? ' · bajo el mínimo' : ''}
            </Text>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
            <TextInput
              accessibilityLabel="Cantidad"
              style={inputInline}
              keyboardType="decimal-pad"
              value={cantTxt}
              onChangeText={t => setCantTxt(soloDecimal(t))}
              onEndEditing={commitCantidad}
            />
            <Text style={[tipografia.caption, { color: paleta.texto2 }]}>{item.producto.unidad} ×</Text>
            <TextInput
              accessibilityLabel="Precio unitario"
              style={inputInline}
              keyboardType="number-pad"
              value={precioTxt}
              onChangeText={t => setPrecioTxt(soloEntero(t))}
              onEndEditing={commitPrecio}
            />
          </View>
        )}
        <Text style={[tipografia.caption, tabular, { color: paleta.texto2 }]}>
          Subtotal {pesos(item.subtotal)}
        </Text>
      </View>
      {esCalzado ? (
        <>
          <Paso etiqueta="Quitar uno"
            onPress={() => dispatch({ tipo: 'cambiarCantidad', id: item.producto.id, cantidad: item.cantidad - 1 })}>
            <Minus size={18} color={paleta.primario} />
          </Paso>
          <Text style={[tipografia.h3, tabular, { color: paleta.texto, minWidth: 28, textAlign: 'center' }]}>
            {item.cantidad}
          </Text>
          <Paso etiqueta="Agregar uno"
            onPress={() => dispatch({ tipo: 'agregar', producto: item.producto })}>
            <Plus size={18} color={paleta.primario} />
          </Paso>
        </>
      ) : (
        <Paso etiqueta="Quitar del carrito"
          onPress={() => dispatch({ tipo: 'quitar', id: item.producto.id })}>
          <X size={18} color={paleta.primario} />
        </Paso>
      )}
    </View>
  )
}

export default function NuevaVenta() {
  const redir = useRequireModulo('ventas')
  const router = useRouter()
  const { paleta } = useTema()

  const [etapa, setEtapa] = useState<Etapa>('carrito')
  // Carrito compartido: el detalle de producto (tab Productos) también agrega aquí.
  const { items, dispatch } = useCarrito()
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<ProductoVendible[]>([])
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [primeraCarga, setPrimeraCarga] = useState(true)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [metodos, setMetodos] = useState<MetodoPago[]>([])
  const [montos, setMontos] = useState<Record<MetodoPago, string>>({ efectivo: '', nequi: '', bre_b: '', otro: '' })
  const [recibido, setRecibido] = useState('')
  const [cliente, setCliente] = useState({ nombre: '', apellido: '', telefono: '' })
  const [guardando, setGuardando] = useState(false)
  const [numeroVenta, setNumeroVenta] = useState<number | null>(null)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [cajaEstado, setCajaEstado] = useState<'loading' | 'ok' | 'bloqueado'>('loading')

  useEffect(() => {
    obtenerCajaHoy()
      .then(c => {
        if (!c || c.estado !== 'abierta') setCajaEstado('bloqueado')
        else setCajaEstado('ok')
      })
      .catch(() => setCajaEstado('bloqueado'))
  }, [])

  const buscar = useCallback((texto: string) => {
    setQuery(texto)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setBuscando(true)
      setErrorBusqueda(null)
      try {
        setResultados(await buscarProductos(texto))
        setPrimeraCarga(false)
      } catch {
        setErrorBusqueda('No se pudo buscar. Revisa tu conexión.')
      } finally {
        setBuscando(false)
      }
    }, 300)
  }, [])

  if (redir) return redir

  const salirAtras = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/movimientos')
  }

  if (cajaEstado === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={paleta.primario} />
      </View>
    )
  }

  if (cajaEstado === 'bloqueado') {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, justifyContent: 'center', padding: espacio.xl, gap: espacio.l }}>
        <EstadoVacio
          icono={<Lock />}
          titulo="Caja cerrada"
          mensaje="La caja de hoy no está abierta."
          textoAccion="Ir a Caja"
          onAccion={() => router.replace('/caja')}
        />
        <Boton titulo="Volver" variante="fantasma" onPress={salirAtras} />
      </View>
    )
  }

  const total = totalCarrito(items)
  const pagos: PagoInput[] = metodos.map(m => ({ metodo: m, monto: Number(montos[m]) || 0 }))
  const sumaPagos = pagos.reduce((s, p) => s + p.monto, 0)
  const diferencia = total - sumaPagos
  const efectivoMonto = montoEfectivo(pagos)
  const recibidoNum = Number(recibido) || 0
  const cambio = calcularCambio(recibidoNum, efectivoMonto)
  const puedeConfirmar = pagosCuadran(pagos, total) && (efectivoMonto === 0 || recibidoNum >= efectivoMonto)

  function toggleMetodo(m: MetodoPago) {
    setMetodos(prev => {
      const next = prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
      if (next.length === 1) setMontos(mm => ({ ...mm, [next[0]]: String(total) }))
      return next
    })
  }

  async function confirmar() {
    setGuardando(true)
    try {
      const { numero } = await registrarVenta({
        items,
        pagos,
        efectivoRecibido: efectivoMonto > 0 ? recibidoNum : null,
        cliente: {
          nombre: cliente.nombre || undefined,
          apellido: cliente.apellido || undefined,
          telefono: cliente.telefono || undefined,
        },
      })
      setNumeroVenta(numero)
      setOverlayVisible(true)
      setEtapa('confirmacion')
    } catch (e) {
      Alert.alert('No se registró', e instanceof Error ? e.message : 'Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  function salirDelFlujo() {
    if (items.length > 0) {
      Alert.alert('¿Descartar la venta?', 'Perderás el carrito actual.', [
        { text: 'Seguir', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: salirAtras },
      ])
    } else {
      salirAtras()
    }
  }

  function nuevaVenta() {
    dispatch({ tipo: 'limpiar' })
    setMetodos([])
    setMontos({ efectivo: '', nequi: '', bre_b: '', otro: '' })
    setRecibido('')
    setCliente({ nombre: '', apellido: '', telefono: '' })
    setNumeroVenta(null)
    setQuery('')
    setResultados([])
    setEtapa('carrito')
  }

  if (etapa === 'confirmacion') {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, alignItems: 'center', justifyContent: 'center', padding: espacio.xl, gap: espacio.l }}>
        <Check size={64} color={paleta.exito} strokeWidth={2.5} />
        <Text style={[tipografia.h1, { color: paleta.texto, textAlign: 'center' }]}>
          Venta #{numeroVenta} registrada
        </Text>
        <View style={{ alignSelf: 'stretch', gap: espacio.s }}>
          <Boton titulo="Nueva venta" onPress={nuevaVenta} />
          <Boton titulo="Listo" variante="fantasma" onPress={salirAtras} />
        </View>
        <OverlayExito visible={overlayVisible} onFin={() => setOverlayVisible(false)} />
      </View>
    )
  }

  if (etapa === 'cobrar') {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: paleta.fondo }}
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 56, gap: espacio.l }}
        keyboardShouldPersistTaps="handled"
      >
        <Presionable
          accessibilityRole="button"
          accessibilityLabel="Volver al carrito"
          hitSlop={12}
          onPress={() => {
            setMetodos([])
            setMontos({ efectivo: '', nequi: '', bre_b: '', otro: '' })
            setRecibido('')
            setEtapa('carrito')
          }}
        >
          <Text style={[tipografia.cuerpoLg, { color: paleta.primario }]}>← Carrito</Text>
        </Presionable>

        <Text style={[tipografia.displayXL, tabular, { color: paleta.texto, textAlign: 'center' }]}>
          {pesos(total)}
        </Text>

        <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Método de pago</Text>
        <View style={{ flexDirection: 'row', gap: espacio.s }}>
          {METODOS.map(m => (
            <Chip key={m} etiqueta={ETIQUETA[m]} activo={metodos.includes(m)} onPress={() => toggleMetodo(m)} />
          ))}
        </View>

        {metodos.map(m => (
          <CampoTexto
            key={m}
            etiqueta={ETIQUETA[m]}
            keyboardType="number-pad"
            value={montos[m]}
            onChangeText={t => setMontos(mm => ({ ...mm, [m]: soloEntero(t) }))}
            placeholder="0"
          />
        ))}

        {metodos.length > 0 ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[tipografia.cuerpoLg, tabular, {
              textAlign: 'center',
              color: diferencia === 0 ? paleta.exitoTexto : paleta.peligroTexto,
            }]}
          >
            {diferencia === 0
              ? '✓ Cuadra'
              : diferencia > 0
                ? `Faltan ${pesos(diferencia)}`
                : `Sobran ${pesos(-diferencia)}`}
          </Text>
        ) : (
          <Text style={[tipografia.cuerpo, tabular, { textAlign: 'center', color: paleta.peligroTexto }]}>
            Faltan {pesos(total)}
          </Text>
        )}

        {efectivoMonto > 0 ? (
          <View style={{ gap: espacio.xs }}>
            <CampoTexto
              etiqueta="Efectivo recibido"
              keyboardType="number-pad"
              value={recibido}
              onChangeText={t => setRecibido(soloEntero(t))}
              placeholder="¿Con cuánto paga?"
            />
            <Text style={[tipografia.h3, tabular, { color: paleta.exitoTexto }]}>
              Cambio: {pesos(cambio)}
            </Text>
          </View>
        ) : null}

        <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Datos del cliente (opcional)</Text>
        <CampoTexto placeholder="Nombre" value={cliente.nombre}
          onChangeText={t => setCliente(c => ({ ...c, nombre: t }))} />
        <CampoTexto placeholder="Apellido" value={cliente.apellido}
          onChangeText={t => setCliente(c => ({ ...c, apellido: t }))} />
        <CampoTexto placeholder="Teléfono" keyboardType="phone-pad" value={cliente.telefono}
          onChangeText={t => setCliente(c => ({ ...c, telefono: t }))} />

        <Boton
          titulo="Confirmar venta"
          onPress={confirmar}
          cargando={guardando}
          deshabilitado={!puedeConfirmar}
        />
      </ScrollView>
    )
  }

  // etapa === 'carrito'
  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m }}>
        <Presionable accessibilityRole="button" accessibilityLabel="Salir de la venta"
          onPress={salirDelFlujo} hitSlop={12}>
          <X size={24} color={paleta.texto} />
        </Presionable>
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Nueva venta</Text>
      </View>

      <View style={{ paddingHorizontal: espacio.xl }}>
        <View style={{ position: 'relative' }}>
          <CampoTexto
            placeholder="Buscar producto"
            value={query}
            onChangeText={buscar}
            autoFocus
            style={{ paddingLeft: 44 }}
          />
          <View style={{ position: 'absolute', left: espacio.m, top: 15 }} pointerEvents="none">
            <Search size={20} color={paleta.texto3} />
          </View>
        </View>
      </View>

      {buscando ? <ActivityIndicator style={{ marginVertical: espacio.s }} color={paleta.primario} /> : null}
      {errorBusqueda ? (
        <Text style={[tipografia.cuerpo, { color: paleta.peligroTexto, textAlign: 'center', marginVertical: espacio.xs }]}>
          {errorBusqueda}
        </Text>
      ) : null}

      <ScrollView style={{ flex: 1, marginTop: espacio.s, paddingHorizontal: espacio.xl }} keyboardShouldPersistTaps="handled">
        {resultados.map((p, i) => {
          const fila = (
            <Presionable
              accessibilityRole="button"
              accessibilityLabel={`Agregar ${p.titulo}`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                dispatch({ tipo: 'agregar', producto: p })
              }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: espacio.m,
                paddingVertical: espacio.m, borderBottomWidth: 1, borderBottomColor: paleta.borde,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]} numberOfLines={1}>{p.titulo}</Text>
                <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                  {p.detalle}{p.tipo === 'calzado' ? ` · Stock: ${p.stock}` : ''}
                </Text>
              </View>
              <Text style={[tipografia.h3, tabular, { color: paleta.texto }]}>{pesos(p.precio)}</Text>
            </Presionable>
          )
          return primeraCarga && i < 8 ? (
            <Animated.View key={`${p.tipo}-${p.id}`} entering={FadeInDown.duration(220).delay(i * 40)}>
              {fila}
            </Animated.View>
          ) : (
            <View key={`${p.tipo}-${p.id}`}>{fila}</View>
          )
        })}
      </ScrollView>

      <Tarjeta estilo={{ borderRadius: 0, borderTopLeftRadius: radio.lg, borderTopRightRadius: radio.lg, borderBottomWidth: 0, gap: espacio.s, paddingBottom: espacio.xxl }}>
        <ScrollView style={{ maxHeight: 220 }}>
          {items.map((i: ItemCarrito) => (
            <LineaCarrito key={`${i.producto.tipo}-${i.producto.id}`} item={i} dispatch={dispatch} />
          ))}
        </ScrollView>
        <Boton
          titulo={total > 0 ? `Cobrar ${pesos(total)}` : 'Cobrar'}
          onPress={() => setEtapa('cobrar')}
          deshabilitado={items.length === 0}
        />
      </Tarjeta>
    </View>
  )
}
```

Notas de implementación:
- El stagger de resultados (receta 5) solo aplica mientras `primeraCarga` —
  tras la primera búsqueda exitosa se apaga (nunca al re-filtrar).
- `CampoTexto` acepta `style` vía `TextInputProps`… **verificar**: el estilo del
  input está fijo dentro del componente; si `style` no se propaga al TextInput,
  quitar `paddingLeft: 44` + icono superpuesto y usar `CampoTexto` sin icono
  (el placeholder "Buscar producto" es suficiente). No modificar `CampoTexto`.
- `pesos()` usa es-CO: en jest el locale puede formatear `180.000` — si la
  aserción del CTA falla por el separador, ajustar la aserción, no el código.

- [ ] **Step 4: Correr tests hasta verde**

Run: `npx jest lib/venta_nueva_ui.test.tsx`
Expected: PASS (4 tests). Ajustar labels de test si difieren (p.ej. el label
exacto del CTA es el `titulo` del Boton: `Cobrar $180.000`).

- [ ] **Step 5: Suite completa + tipos + commit**

Run: `npx tsc --noEmit && npx jest`
Expected: PASS completo (la suite vieja de ventas no existe para esta pantalla;
si algún test de integración referencia textos viejos, actualizarlo).

```bash
git add "app/(app)/ventas/nueva.tsx" lib/venta_nueva_ui.test.tsx
git commit -m "feat(venta): Nueva Venta restilizada — wizard con librería ui, diferencia en vivo y OverlayExito"
```

---

### Task 5: Perfil — pulido menor

**Files:**
- Modify: `app/(app)/(tabs)/perfil.tsx`
- Modify: `lib/tabs_perfil_ui.test.tsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: badge de rol "Dueño"/"Administrativa"/"Operativo"; fila
  "Cerrar sesión" con título en color peligro.

- [ ] **Step 1: Actualizar tests (fallan primero)**

En `lib/tabs_perfil_ui.test.tsx`: cambiar las aserciones de rol de MAYÚSCULAS
("DUEÑO", "OPERATIVO") a capitalizado ("Dueño", "Operativo").

Run: `npx jest lib/tabs_perfil_ui.test.tsx`
Expected: FAIL en las aserciones de rol.

- [ ] **Step 2: Implementar en `perfil.tsx`**

```tsx
const NOMBRE_ROL: Record<Rol, string> = {
  dueno: 'Dueño',
  admin: 'Administrativa',
  empleado: 'Operativo',
}
```

Para el título en peligro: `FilaLista` no expone color de título — pasar el
título estilizado NO es posible sin tocar el componente. Solución mínima sin
tocar `FilaLista`: reemplazar esa fila por un patrón inline equivalente:

```tsx
<Tarjeta estilo={{ paddingVertical: espacio.xs, borderColor: paleta.peligroSoft }}>
  <Presionable
    accessibilityRole="button"
    accessibilityLabel="Cerrar sesión"
    onPress={confirmarSalida}
    style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, minHeight: 64, paddingVertical: espacio.s }}
  >
    <CirculoIcono tono="peligro"><LogOut /></CirculoIcono>
    <Text style={[tipografia.h3, { color: paleta.peligroTexto }]}>Cerrar sesión</Text>
  </Presionable>
</Tarjeta>
```

(Agregar `Presionable` al import de `components/ui`.)

- [ ] **Step 3: Verde + commit**

Run: `npx tsc --noEmit && npx jest lib/tabs_perfil_ui.test.tsx`
Expected: PASS

```bash
git add "app/(app)/(tabs)/perfil.tsx" lib/tabs_perfil_ui.test.tsx
git commit -m "feat(perfil): rol capitalizado y cerrar sesión en color peligro"
```

---

### Task 6: Fase 4a — eliminar pantallas redundantes y redirigir

**Files:**
- Delete: `app/(app)/ventas/index.tsx`, `app/(app)/devoluciones/index.tsx`,
  `app/(app)/inventario/calzado/index.tsx`, `app/(app)/inventario/granja/index.tsx`,
  `app/(app)/modulo/[id].tsx` (y el directorio `app/(app)/modulo/`)
- Modify: `lib/permisos.ts`, `lib/permisos.test.ts`
- Modify: `app/(app)/(tabs)/index.tsx` (acceso Análisis IA)
- Modify: `app/(app)/inventario/calzado/editor.tsx:39`,
  `app/(app)/inventario/granja/editor.tsx:30`, `app/(app)/inventario/carga.tsx:80`
- Modify/Delete tests: `lib/devoluciones_ui.test.tsx`, `lib/devoluciones.test.ts`
  (solo las partes que rendericen `devoluciones/index`; los tests de
  `devoluciones/nueva` y lógica se conservan)

**Interfaces:**
- Consumes: `useToast()` (Task 1) para el acceso Análisis IA.
- Produces: rutas nuevas en `MODULOS`: ventas → `/ventas/nueva`, devoluciones →
  `/movimientos`, inventario-calzado → `/productos`, granja → `/productos`.
  El barrido (Tasks 7–14) asume estas rutas.

- [ ] **Step 1: Borrar las 5 pantallas**

```bash
git rm "app/(app)/ventas/index.tsx" "app/(app)/devoluciones/index.tsx" \
  "app/(app)/inventario/calzado/index.tsx" "app/(app)/inventario/granja/index.tsx" \
  "app/(app)/modulo/[id].tsx"
```

- [ ] **Step 2: Actualizar `lib/permisos.ts` (solo campo `ruta`; ids y roles intactos)**

```ts
{ id: 'ventas',             titulo: 'Ventas',             icono: '🛒', roles: TODOS, ruta: '/ventas/nueva' },
{ id: 'devoluciones',       titulo: 'Devoluciones',       icono: '↩️', roles: TODOS, ruta: '/movimientos' },
{ id: 'inventario-calzado', titulo: 'Inventario calzado', icono: '👟', roles: TODOS, ruta: '/productos' },
{ id: 'granja',             titulo: 'Granja',             icono: '🥚', roles: TODOS, ruta: '/productos' },
```

Y en `lib/permisos.test.ts` actualizar las aserciones de ruta correspondientes
(p.ej. `'/ventas'` → `'/ventas/nueva'`).

- [ ] **Step 3: Acceso "Análisis IA" en `(tabs)/index.tsx`**

El módulo no existe (el placeholder muere). En el array `ACCESOS`
(`app/(app)/(tabs)/index.tsx:57-61`) quitar la propiedad `ruta` de la entrada
`analisis-ia` (hacer `ruta` opcional en el tipo del array) y en el `onPress`
(~línea 351):

```tsx
onPress={() => (a.ruta ? router.push(a.ruta) : mostrar('Análisis IA estará disponible pronto', 'info'))}
```

con `const { mostrar } = useToast()` en el componente (import de
`../../../components/ui`).

- [ ] **Step 4: Redirigir navegaciones muertas**

- `inventario/calzado/editor.tsx:39`: `router.replace('/(app)/inventario/calzado')` → `router.replace('/productos')`
- `inventario/granja/editor.tsx:30`: `router.replace('/(app)/inventario/granja')` → `router.replace('/productos')`
- `inventario/carga.tsx:80`: `router.push('/inventario/calzado')` → `router.push('/productos')`

Luego barrer el resto:

```bash
grep -rn "'/ventas'\|\"/ventas\"\|/devoluciones'\|inventario/calzado'\|inventario/granja'\|/modulo/" app components lib --include="*.ts" --include="*.tsx" | grep -v ".test."
```

Expected: 0 resultados tras corregir cada hit (los ids de módulo tipo
`useRequireModulo('ventas')` NO son rutas — no tocarlos).

- [ ] **Step 5: Actualizar/eliminar tests de pantallas borradas**

- `lib/devoluciones_ui.test.tsx`: si renderiza `app/(app)/devoluciones/index`,
  eliminar esos describe/tests (conservar los de `devoluciones/nueva`). Si todo
  el archivo es del index, `git rm` completo.
- `lib/devoluciones.test.ts`: es de lógica (`lib/devoluciones.ts`) — solo tocar
  si importa la pantalla borrada (improbable; verificar con grep).
- Cualquier otra suite que importe las pantallas borradas:
  `grep -rln "ventas/index\|devoluciones/index\|calzado/index\|granja/index\|modulo/\[id\]" lib/*.test.*`

- [ ] **Step 6: Verificación completa + commit**

Run: `npx tsc --noEmit && npx jest`
Expected: PASS. Además correr el grep del Step 4 de nuevo: 0 resultados.

```bash
git add -A
git commit -m "refactor(rutas): eliminar pantallas reemplazadas por tabs y redirigir rutas muertas"
```

---

## Fase 4b — Barrido de restilizado (Tasks 7–14)

Cada task de grupo sigue el MISMO ciclo; las "Reglas de restilizado" de
Global Constraints son la especificación del cambio. Ciclo por task:

1. Leer las pantallas del grupo completas.
2. Restilizar aplicando las Reglas 1–11 (solo JSX/estilos; lógica intacta).
3. Actualizar las suites del grupo (labels/estructura que cambien). No borrar
   aserciones de comportamiento; solo adaptar selectores/textos.
4. `npx tsc --noEmit && npx jest <suites del grupo>` en verde.
5. `npx jest` completo en verde.
6. Commit con el mensaje indicado.

### Task 7: Barrido — Devoluciones

**Files:**
- Modify: `app/(app)/devoluciones/nueva.tsx`
- Test: `lib/devoluciones_ui.test.tsx`

Particularidades:
- Es la pantalla más compleja del barrido (~460+ líneas, wizard de devolución).
  NO cambiar el flujo: solo aplicar Reglas (header con `ArrowLeft`, botones →
  `Boton`, inputs → `CampoTexto`, cards → `Tarjeta`, montos con `tabular`).
- El `Alert` "Aceptar" de éxito (línea ~396) es informativo →
  `useToast().mostrar('Devolución registrada')` + `router.back()` directo
  (Regla 9).

- [ ] Steps 1–6 del ciclo. Commit:

```bash
git commit -m "feat(ui): devoluciones/nueva restilizada"
```

### Task 8: Barrido — Inventario

**Files:**
- Modify: `app/(app)/inventario/calzado/[id].tsx`, `app/(app)/inventario/calzado/editor.tsx`,
  `app/(app)/inventario/granja/editor.tsx`, `app/(app)/inventario/carga.tsx`
- Test: suites que los rendericen (verificar con
  `grep -rln "inventario/calzado\|inventario/granja\|inventario/carga" lib/*.test.*`)

Particularidades:
- `calzado/editor.tsx`: las chips de categoría deben usar las 7 canónicas de
  `lib/excel.ts` (`CATEGORIAS`) si no lo hacen ya — verificar y corregir con
  import directo (el bug conocido vivía en el index borrado; confirmar que el
  editor no lo replique).
- `carga.tsx`: pantalla con subida de Excel/fotos; los `Alert` de progreso/éxito
  informativos → Toast (Regla 9), los de confirmación se quedan.

- [ ] Steps 1–6 del ciclo. Commit:

```bash
git commit -m "feat(ui): inventario (ficha, editores, carga) restilizado"
```

### Task 9: Barrido — Recibir mercancía

**Files:**
- Modify: `app/(app)/recibir-mercancia/index.tsx`, `app/(app)/recibir-mercancia/nueva.tsx`,
  `app/(app)/recibir-mercancia/[id].tsx`
- Test: `lib/recibir_mercancia_ui.test.tsx`

- [ ] Steps 1–6 del ciclo. Commit:

```bash
git commit -m "feat(ui): recibir mercancía restilizada"
```

### Task 10: Barrido — Proveedores

**Files:**
- Modify: `app/(app)/proveedores/index.tsx`, `app/(app)/proveedores/[id].tsx`,
  `app/(app)/proveedores/editor.tsx`
- Test: `lib/proveedores_ui.test.tsx`

Particularidades:
- Botón WhatsApp directo: conservar funcionalidad; icono `MessageCircle` de
  lucide con `paleta.exito`.

- [ ] Steps 1–6 del ciclo. Commit:

```bash
git commit -m "feat(ui): proveedores restilizado"
```

### Task 11: Barrido — Gastos

**Files:**
- Modify: `app/(app)/gastos/index.tsx`, `app/(app)/gastos/fijos.tsx`,
  `app/(app)/gastos/fijos-editor.tsx`, `app/(app)/gastos/pagar.tsx`
- Test: suites que los rendericen (grep como en Task 8)

- [ ] Steps 1–6 del ciclo. Commit:

```bash
git commit -m "feat(ui): gastos (variables, fijos, editor, pagar) restilizados"
```

### Task 12: Barrido — Caja

**Files:**
- Modify: `app/(app)/caja/index.tsx`, `app/(app)/caja/cierre.tsx`,
  `app/(app)/caja/config.tsx`, `app/(app)/caja/historial.tsx`
- Test: suites que los rendericen (grep)

Particularidades:
- `cierre.tsx`: al cierre exitoso, mostrar `<OverlayExito visible={...}
  mensaje="Caja cerrada" onFin={...} />` antes del estado final (receta 10;
  mismo patrón que la confirmación de venta en Task 4). La diferencia de caja
  (sobrante/faltante) nunca solo color: mantener texto con signo (Regla del
  checklist §8).

- [ ] Steps 1–6 del ciclo. Commit:

```bash
git commit -m "feat(ui): caja (apertura, cierre con OverlayExito, config, historial) restilizada"
```

### Task 13: Barrido — Empleados

**Files:**
- Modify: `app/(app)/empleados/index.tsx`, `app/(app)/empleados/[id].tsx`
- Test: `lib/empleados_ui.test.tsx`

- [ ] Steps 1–6 del ciclo. Commit:

```bash
git commit -m "feat(ui): empleados restilizado"
```

### Task 14: Barrido — Balance y Reportes

**Files:**
- Modify: `app/(app)/balance/index.tsx`, `app/(app)/reportes/index.tsx`,
  `app/(app)/reportes/config.tsx`, `app/(app)/reportes/periodos.tsx`
- Test: `lib/balance_ui.test.tsx`, `lib/reportes_ui.test.tsx`,
  `lib/reporteDiario_ui.test.tsx` (si renderiza `reportes/config`)

Particularidades:
- Montos y métricas: usar `TarjetaMetrica` donde la pantalla ya muestre pares
  etiqueta+valor en cards; siempre `tabular`.

- [ ] Steps 1–6 del ciclo. Commit:

```bash
git commit -m "feat(ui): balance y reportes restilizados"
```

---

### Task 15: Cierre — verificación integral

**Files:**
- Modify (si hace falta): lo que surja de la verificación.

- [ ] **Step 1: Suite completa y tipos**

Run: `npx tsc --noEmit && npx jest`
Expected: PASS total, 0 errores.

- [ ] **Step 2: Grep de deuda visual en pantallas tocadas**

```bash
grep -rn "#1E66F5\|#D20F39\|#1E7A34\|#666\|#777\|#888\|#EEE\|#DDD\|#CCC" app --include="*.tsx" | grep -v node_modules
```

Expected: 0 resultados en `app/` (los hex viejos solo pueden quedar en
`lib/theme.ts`).

- [ ] **Step 3: Grep de rutas muertas (re-verificación)**

```bash
grep -rn "'/ventas'\|/devoluciones'\|inventario/calzado'\|inventario/granja'\|/modulo/" app components lib --include="*.ts*" | grep -v ".test."
```

Expected: 0 resultados.

- [ ] **Step 4: Commit final si hubo correcciones**

```bash
git add -A && git commit -m "chore: cierre del paso 8 — verificación integral"
```

(Si no hubo cambios, omitir el commit.)

Nota post-plan: el smoke en dispositivo Android (paso 9 de §9.3) sigue
pendiente y CRÍTICO — proponer al usuario hacerlo antes del merge a main.
