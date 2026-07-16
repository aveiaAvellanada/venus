import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.useFakeTimers()

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const ReactMock = require('react')
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({ ref: '4521' }),
    useFocusEffect: (cb: () => void) => {
      ReactMock.useEffect(() => {
        cb()
      }, [cb])
    },
  }
})

jest.mock('./supabase', () => ({ supabase: {} }))
jest.mock('../lib/supabase', () => ({ supabase: {} }))

const mockUseAuth = jest.fn()
jest.mock('../lib/auth', () => ({ useAuth: () => mockUseAuth() }))

const mockListarCalzado = jest.fn()
jest.mock('../lib/inventario', () => ({
  listarCalzado: (...args: unknown[]) => mockListarCalzado(...args),
}))

import { TemaProvider } from './tema'
import { CarritoProvider } from './carrito-contexto'
import ProductoDetalleScreen from '../app/(app)/productos/[ref]'

const CALZADO = [
  {
    id: 'c1', descripcion: 'Nike Air Max', marca: 'Nike', referencia: '4521', categoria: 'Deportivo',
    talla: '40', color: 'Negro', precio_minimo: 150000, precio_maximo: 220000, stock_actual: 5,
    stock_minimo: 1, foto_url: null, proveedor_id: null, activo: true,
  },
  {
    id: 'c2', descripcion: 'Nike Air Max', marca: 'Nike', referencia: '4521', categoria: 'Deportivo',
    talla: '41', color: 'Negro', precio_minimo: 150000, precio_maximo: 220000, stock_actual: 0,
    stock_minimo: 1, foto_url: null, proveedor_id: null, activo: true,
  },
  {
    id: 'c3', descripcion: 'Nike Air Max', marca: 'Nike', referencia: '4521', categoria: 'Deportivo',
    talla: '39', color: 'Blanco', precio_minimo: 140000, precio_maximo: 200000, stock_actual: 2,
    stock_minimo: 1, foto_url: null, proveedor_id: null, activo: true,
  },
]

function conRol(rol: string) {
  mockUseAuth.mockReturnValue({ perfil: { nombre: 'Prueba', rol }, cerrarSesion: jest.fn() })
}

async function montar() {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <CarritoProvider>
          <ProductoDetalleScreen />
        </CarritoProvider>
      </TemaProvider>
    )
  })
  return arbol
}

type Nodo = { props: { onPress?: () => void; accessibilityLabel?: string; accessibilityState?: { disabled?: boolean } } }

const botones = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root.findAllByProps({ accessibilityRole: 'button' }).filter((n: Nodo) => n.props.onPress || n.props.accessibilityState?.disabled)

const existeTexto = (arbol: ReturnType<typeof renderer.create>, texto: string) =>
  arbol.root.findAllByProps({ children: texto }).length > 0

describe('Detalle de producto', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListarCalzado.mockResolvedValue(CALZADO)
  })

  it('muestra nombre, ref y rango de precio', async () => {
    conRol('empleado')
    const arbol = await montar()
    expect(existeTexto(arbol, 'Nike Air Max')).toBe(true)
    expect(existeTexto(arbol, '$140.000 – $220.000')).toBe(true)
  })

  it('elegir color filtra las tallas y la talla sin stock queda deshabilitada', async () => {
    conRol('empleado')
    const arbol = await montar()
    const negro = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Negro')!
    await act(async () => negro.props.onPress!())
    // color Negro tiene tallas 40 (stock 5) y 41 (stock 0); la 39 es de Blanco
    expect(botones(arbol).some((n: Nodo) => n.props.accessibilityLabel === 'Talla 39: 2 disponibles')).toBe(false)
    const talla41 = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Talla 41: 0 disponibles')!
    expect(talla41.props.accessibilityState?.disabled).toBe(true)
  })

  it('dueño: elegir talla muestra su precio y Ver ficha navega a la variante', async () => {
    conRol('dueno')
    const arbol = await montar()
    const negro = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Negro')!
    await act(async () => negro.props.onPress!())
    const talla40 = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Talla 40: 5 disponibles')!
    await act(async () => talla40.props.onPress!())
    expect(existeTexto(arbol, '$220.000')).toBe(true)
    const ficha = arbol.root.findByProps({ accessibilityLabel: 'Ver ficha' })
    await act(async () => ficha.props.onPress())
    expect(mockPush).toHaveBeenCalledWith('/inventario/calzado/c1')
  })

  it('empleado no ve Ver ficha', async () => {
    conRol('empleado')
    const arbol = await montar()
    expect(arbol.root.findAllByProps({ accessibilityLabel: 'Ver ficha' })).toHaveLength(0)
  })

  it('elegir talla habilita Agregar al carrito y navega a Nueva Venta', async () => {
    conRol('empleado')
    const arbol = await montar()
    const negro = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Negro')!
    await act(async () => negro.props.onPress!())
    const talla40 = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Talla 40: 5 disponibles')!
    await act(async () => talla40.props.onPress!())
    const cta = arbol.root
      .findAllByProps({ accessibilityLabel: 'Agregar al carrito' })
      .find((n: Nodo) => n.props.onPress)!
    await act(async () => cta.props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/ventas/nueva')
  })
})
