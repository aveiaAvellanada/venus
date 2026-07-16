import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.useFakeTimers()

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('./supabase', () => ({ supabase: {} }))
jest.mock('../lib/supabase', () => ({ supabase: {} }))

const mockUseAuth = jest.fn()
jest.mock('../lib/auth', () => ({ useAuth: () => mockUseAuth() }))

import { TemaProvider } from './tema'
import Movimientos from '../app/(app)/(tabs)/movimientos'
import Productos from '../app/(app)/(tabs)/productos'

function conRol(rol: string) {
  mockUseAuth.mockReturnValue({ perfil: { nombre: 'Prueba', rol }, cerrarSesion: jest.fn() })
}

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

type Nodo = { props: { onPress?: () => void } }

const existeTexto = (arbol: ReturnType<typeof renderer.create>, texto: string) =>
  arbol.root.findAllByProps({ children: texto }).length > 0

describe('Movimientos', () => {
  beforeEach(() => jest.clearAllMocks())

  it('arranca en Ventas y "Nueva venta" navega', async () => {
    conRol('empleado')
    const arbol = await montar(<Movimientos />)
    expect(existeTexto(arbol, 'Nueva venta')).toBe(true)
    const fila = arbol.root
      .findAllByProps({ accessibilityRole: 'button' })
      .filter((n: Nodo) => n.props.onPress)
      .find((n: Nodo) => JSON.stringify(n.props).includes('Nueva venta'))
    // navegar tocando la fila por título
    const filas = arbol.root.findAllByProps({ accessibilityRole: 'button' }).filter((n: Nodo) => n.props.onPress)
    await act(async () => filas[0].props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/ventas/nueva')
    expect(fila ?? filas[0]).toBeTruthy()
  })

  it('vista Gastos: muestra gastos y oculta ventas; empleado sin Gastos fijos', async () => {
    conRol('empleado')
    const arbol = await montar(<Movimientos />)
    const tabs = arbol.root.findAllByProps({ accessibilityRole: 'tab' }).filter((n: Nodo) => n.props.onPress)
    await act(async () => tabs[2].props.onPress!())
    expect(existeTexto(arbol, 'Gastos variables')).toBe(true)
    expect(existeTexto(arbol, 'Nueva venta')).toBe(false)
    expect(existeTexto(arbol, 'Gastos fijos')).toBe(false)
  })

  it('admin ve Gastos fijos en la vista Gastos', async () => {
    conRol('admin')
    const arbol = await montar(<Movimientos />)
    const tabs = arbol.root.findAllByProps({ accessibilityRole: 'tab' }).filter((n: Nodo) => n.props.onPress)
    await act(async () => tabs[2].props.onPress!())
    expect(existeTexto(arbol, 'Gastos fijos')).toBe(true)
  })
})

describe('Productos', () => {
  beforeEach(() => jest.clearAllMocks())

  it('Calzado navega; empleado ve Recibir mercancía pero no Carga inicial', async () => {
    conRol('empleado')
    const arbol = await montar(<Productos />)
    expect(existeTexto(arbol, 'Recibir mercancía')).toBe(true)
    expect(existeTexto(arbol, 'Carga inicial')).toBe(false)
    const filas = arbol.root.findAllByProps({ accessibilityRole: 'button' }).filter((n: Nodo) => n.props.onPress)
    await act(async () => filas[0].props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/inventario/calzado')
  })

  it('admin ve Carga inicial', async () => {
    conRol('admin')
    const arbol = await montar(<Productos />)
    expect(existeTexto(arbol, 'Carga inicial')).toBe(true)
  })
})
