import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { Text } from 'react-native'
import Slider from '@react-native-community/slider'

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
let mockParams: { modo?: string } = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}))

jest.mock('./supabase', () => ({ supabase: {} }))
jest.mock('../lib/supabase', () => ({ supabase: {} }))
jest.mock('../lib/auth', () => ({ useRequireModulo: () => null }))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockObtenerCajaHoy = jest.fn()
jest.mock('../lib/caja', () => ({ obtenerCajaHoy: () => mockObtenerCajaHoy() }))

const mockRegistrar = jest.fn()
jest.mock('../lib/ventas', () => ({
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

// Siembra el ítem antes de montar `children`: en producción el dispatch
// ocurre en la pantalla de origen, antes de navegar aquí (ver
// app/(app)/productos/[ref].tsx), así que `NuevaVenta` siempre monta con
// el carrito ya poblado. Si sembráramos con un efecto que corre DESPUÉS
// de que `NuevaVenta` monta, el `useState` inicial de `etapa` (que lee
// `items.length` una sola vez, al montar) no vería el ítem a tiempo.
function Sembrador({ children }: { children: React.ReactNode }) {
  const { dispatch } = useCarrito()
  const [listo, setListo] = React.useState(false)
  React.useEffect(() => {
    dispatch({ tipo: 'agregar', producto: ZAPATO })
    setListo(true)
  }, [dispatch])
  return listo ? <>{children}</> : null
}

// Lee el carrito compartido desde fuera de la pantalla (como lo vería Productos).
let itemsEnCarrito = -1
function Sonda() {
  itemsEnCarrito = useCarrito().items.length
  return null
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
            <Sonda />
          </ToastProvider>
        </CarritoProvider>
      </TemaProvider>
    )
  })
  return arbol!
}

const todoElTexto = (arbol: renderer.ReactTestRenderer) =>
  arbol.root.findAllByType(Text).map((t: renderer.ReactTestInstance) =>
    Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)
  ).join(' | ')

const presionarPorLabel = (arbol: renderer.ReactTestRenderer, label: string) => {
  const nodo = arbol.root.findAll(
    (n: renderer.ReactTestInstance) => n.props?.accessibilityLabel === label && !!n.props.onPress
  )[0]
  act(() => { nodo.props.onPress() })
}

describe('Nueva Venta restilizada', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockParams = {}
  })

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
    // El calzado entra en su precio MÍNIMO (150.000), no en el máximo ni en `precio` (rediseño B2).
    expect(todoElTexto(arbol)).toContain('Cobrar $150.000')
    // Sin el texto "c/u" y con resumen Artículos / Total
    expect(todoElTexto(arbol)).not.toContain('c/u')
    expect(todoElTexto(arbol)).toContain('Artículos')
    expect(todoElTexto(arbol)).toContain('Mín $150.000')
    expect(todoElTexto(arbol)).toContain('Máx $220.000')
  })

  test('en cobrar: sin pagos muestra "Faltan"; al cuadrar muestra "Cuadra"', async () => {
    const arbol = await montar({ conItem: true })
    presionarPorLabel(arbol, 'Cobrar $150.000')
    expect(todoElTexto(arbol)).toContain('Faltan')
    // seleccionar Efectivo: 1 método → autollenado con el total → cuadra
    presionarPorLabel(arbol, 'Efectivo')
    expect(todoElTexto(arbol)).toContain('Cuadra')
  })

  test('confirmación: overlay y pantalla de venta registrada', async () => {
    mockRegistrar.mockResolvedValue({ numero: 42 })
    const arbol = await montar({ conItem: true })
    presionarPorLabel(arbol, 'Cobrar $150.000')
    presionarPorLabel(arbol, 'Efectivo')
    // llenar efectivo recibido (>= total autollenado de 220.000)
    const inputs = arbol.root.findAll(
      (n: renderer.ReactTestInstance) => n.props?.placeholder === '¿Con cuánto paga?'
    )
    act(() => { inputs[0].props.onChangeText('250000') })
    await act(async () => {
      presionarPorLabel(arbol, 'Confirmar venta')
    })
    expect(todoElTexto(arbol)).toContain('Venta #42 registrada')
  })

  test('reintentar tras un fallo de red reusa la clave de la venta (no duplica)', async () => {
    mockRegistrar
      .mockRejectedValueOnce(new Error('Sin conexión: no sabemos si la venta se guardó.'))
      .mockResolvedValueOnce({ numero: 43, repetida: true })
    const arbol = await montar({ conItem: true })
    presionarPorLabel(arbol, 'Cobrar $150.000')
    presionarPorLabel(arbol, 'Efectivo')
    const inputs = arbol.root.findAll(
      (n: renderer.ReactTestInstance) => n.props?.placeholder === '¿Con cuánto paga?'
    )
    act(() => { inputs[0].props.onChangeText('250000') })
    await act(async () => { presionarPorLabel(arbol, 'Confirmar venta') })
    await act(async () => { presionarPorLabel(arbol, 'Confirmar venta') })
    expect(mockRegistrar).toHaveBeenCalledTimes(2)
    const [clave1, clave2] = mockRegistrar.mock.calls.map((c) => c[1])
    expect(clave1).toEqual(expect.any(String))
    expect(clave2).toBe(clave1)
    expect(todoElTexto(arbol)).toContain('Venta #43 registrada')
  })

  test('carrito vacío muestra el estado vacío en vez del buscador', async () => {
    const arbol = await montar()
    expect(todoElTexto(arbol)).toContain('Tu carrito está vacío')
  })

  test('modo=rapida con 1 ítem entra directo a ajustar precio (sin ver el carrito completo)', async () => {
    mockParams = { modo: 'rapida' }
    const arbol = await montar({ conItem: true })
    expect(todoElTexto(arbol)).toContain('Continuar a pago')
    presionarPorLabel(arbol, 'Continuar a pago')
    expect(todoElTexto(arbol)).toContain('Faltan')
  })

  // Bug A1: el carrito es global (CarritoProvider); si no se vacía al registrar,
  // lo vendido sigue ahí y se puede vender otra vez al volver.
  test('tras registrar con éxito el carrito queda vacío, aunque se salga con "Listo"', async () => {
    mockRegistrar.mockResolvedValue({ numero: 50 })
    const arbol = await montar({ conItem: true })
    expect(itemsEnCarrito).toBe(1)
    presionarPorLabel(arbol, 'Cobrar $150.000')
    presionarPorLabel(arbol, 'Efectivo')
    const inputs = arbol.root.findAll(
      (n: renderer.ReactTestInstance) => n.props?.placeholder === '¿Con cuánto paga?'
    )
    act(() => { inputs[0].props.onChangeText('250000') })
    await act(async () => { presionarPorLabel(arbol, 'Confirmar venta') })
    expect(itemsEnCarrito).toBe(0)
    // la confirmación lee el snapshot, no el carrito ya vacío
    expect(todoElTexto(arbol)).toContain('Venta #50 registrada')
    presionarPorLabel(arbol, 'Listo')
    expect(mockBack).toHaveBeenCalled()
    expect(itemsEnCarrito).toBe(0)
  })

  test('si el registro falla, el carrito NO se vacía (se reintenta con la misma clave)', async () => {
    mockRegistrar.mockRejectedValueOnce(new Error('Sin conexión'))
    const arbol = await montar({ conItem: true })
    presionarPorLabel(arbol, 'Cobrar $150.000')
    presionarPorLabel(arbol, 'Efectivo')
    const inputs = arbol.root.findAll(
      (n: renderer.ReactTestInstance) => n.props?.placeholder === '¿Con cuánto paga?'
    )
    act(() => { inputs[0].props.onChangeText('250000') })
    await act(async () => { presionarPorLabel(arbol, 'Confirmar venta') })
    expect(mockRegistrar).toHaveBeenCalledTimes(1)
    expect(itemsEnCarrito).toBe(1)
  })

  const barraCobrar = (arbol: renderer.ReactTestRenderer) =>
    arbol.root.findAll(
      (n: renderer.ReactTestInstance) =>
        typeof n.props?.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('Cobrar') && !!n.props.accessibilityState
    )[0]

  test('deslizador de $1.000 en $1.000 entre mínimo y máximo, sincronizado con la caja de precio', async () => {
    const arbol = await montar({ conItem: true })
    const slider = arbol.root.findByType(Slider)
    expect(slider.props.minimumValue).toBe(150000)
    expect(slider.props.maximumValue).toBe(220000)
    expect(slider.props.step).toBe(1000)
    act(() => { slider.props.onValueChange(187000) })
    const caja = arbol.root.findByProps({ accessibilityLabel: 'Precio' })
    expect(caja.props.value).toBe('187.000')
    expect(todoElTexto(arbol)).toContain('Cobrar $187.000')
    // escribir el precio exacto mueve el deslizador
    act(() => { caja.props.onFocus() })
    act(() => { caja.props.onChangeText('199500') })
    expect(arbol.root.findByType(Slider).props.value).toBe(199500)
    expect(todoElTexto(arbol)).toContain('Cobrar $199.500')
  })

  test('precio fuera del rango: aviso y Cobrar deshabilitado hasta corregirlo', async () => {
    const arbol = await montar({ conItem: true })
    const caja = arbol.root.findByProps({ accessibilityLabel: 'Precio' })
    act(() => { caja.props.onFocus() })
    act(() => { caja.props.onChangeText('140000') })
    expect(todoElTexto(arbol)).toContain('Fuera del rango: $150.000 – $220.000')
    expect(barraCobrar(arbol).props.accessibilityState).toMatchObject({ disabled: true })
    act(() => { caja.props.onChangeText('230000') })
    expect(barraCobrar(arbol).props.accessibilityState).toMatchObject({ disabled: true })
    act(() => { caja.props.onChangeText('200000') })
    expect(todoElTexto(arbol)).not.toContain('Fuera del rango')
    expect(barraCobrar(arbol).props.accessibilityState).toMatchObject({ disabled: false })
  })

  test('el + se deshabilita al llegar al stock', async () => {
    const arbol = await montar({ conItem: true })
    const mas = () => arbol.root.findAll(
      (n: renderer.ReactTestInstance) => n.props?.accessibilityLabel === 'Agregar uno' && !!n.props.accessibilityState
    )[0]
    for (let k = 0; k < 4; k++) act(() => { mas().props.onPress() })
    expect(itemsEnCarrito).toBe(1)
    expect(mas().props.accessibilityState).toMatchObject({ disabled: true })
  })

  test('cédula o razón social se envía con la venta; la confirmación muestra total y métodos', async () => {
    mockRegistrar.mockResolvedValue({ numero: 60 })
    const arbol = await montar({ conItem: true })
    presionarPorLabel(arbol, 'Cobrar $150.000')
    presionarPorLabel(arbol, 'Nequi')
    const doc = arbol.root.findAll(
      (n: renderer.ReactTestInstance) => n.props?.placeholder === 'Cédula o razón social' && !!n.props.onChangeText
    )[0]
    act(() => { doc.props.onChangeText(' 1117123456 ') })
    await act(async () => { presionarPorLabel(arbol, 'Confirmar venta') })
    expect(mockRegistrar.mock.calls[0][0].cliente.documento).toBe('1117123456')
    expect(todoElTexto(arbol)).toContain('Venta #60 registrada')
    expect(todoElTexto(arbol)).toContain('$150.000 · Nequi')
  })
})
