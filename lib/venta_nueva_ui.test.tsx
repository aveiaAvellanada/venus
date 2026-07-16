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
    // El carrito inicia el precio del calzado en precioMax (220.000), no en `precio` (180.000) —
    // lógica preexistente de lib/carrito.ts (precioInicial), sin modificar por este task.
    expect(todoElTexto(arbol)).toContain('220.000')
  })

  test('en cobrar: sin pagos muestra "Faltan"; al cuadrar muestra "Cuadra"', async () => {
    const arbol = await montar({ conItem: true })
    presionarPorLabel(arbol, 'Cobrar $220.000')
    expect(todoElTexto(arbol)).toContain('Faltan')
    // seleccionar Efectivo: 1 método → autollenado con el total → cuadra
    presionarPorLabel(arbol, 'Efectivo')
    expect(todoElTexto(arbol)).toContain('Cuadra')
  })

  test('confirmación: overlay y pantalla de venta registrada', async () => {
    mockRegistrar.mockResolvedValue({ numero: 42 })
    const arbol = await montar({ conItem: true })
    presionarPorLabel(arbol, 'Cobrar $220.000')
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
})
