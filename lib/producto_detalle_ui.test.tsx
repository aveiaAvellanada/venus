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
const mockBack = jest.fn()
let mockParams: { ref: string; color?: string } = { ref: '4521' }
jest.mock('expo-router', () => {
  const ReactMock = require('react')
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void) => {
      ReactMock.useEffect(() => {
        cb()
      }, [cb])
    },
  }
})

jest.mock('./supabase', () => ({ supabase: {} }))
jest.mock('../lib/supabase', () => ({ supabase: {} }))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockUseAuth = jest.fn()
jest.mock('../lib/auth', () => ({ useAuth: () => mockUseAuth() }))

const mockListarCalzado = jest.fn()
jest.mock('../lib/inventario', () => ({
  listarCalzado: (...args: unknown[]) => mockListarCalzado(...args),
}))

import { TemaProvider } from './tema'
import { CarritoProvider } from './carrito-contexto'
import { ToastProvider } from '../components/ui'
import ProductoDetalleScreen from '../app/(app)/productos/[ref]'
import { perfilPrueba, type TipoPerfilPrueba } from './perfilPrueba'
// Roles de antes → perfiles con permisos: 'admin' = plantilla administrativa, 'empleado' = operativa.
const tipoPrueba = (rol: string): TipoPerfilPrueba =>
  rol === 'dueno' ? 'dueno' : rol === 'admin' ? 'administrativo' : 'operativo'


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
  mockUseAuth.mockReturnValue({ perfil: perfilPrueba(tipoPrueba(rol), 'Prueba'), cerrarSesion: jest.fn() })
}

async function montar() {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <ToastProvider>
          <CarritoProvider>
            <ProductoDetalleScreen />
          </CarritoProvider>
        </ToastProvider>
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

const elegir = async (arbol: ReturnType<typeof renderer.create>, etiqueta: string) => {
  const nodo = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === etiqueta)!
  await act(async () => nodo.props.onPress!())
}

const barraAgregar = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root.findAllByProps({ accessibilityLabel: 'Agregar al carrito' }).find((n: Nodo) => n.props.accessibilityState)!

describe('Detalle de producto', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockParams = { ref: '4521' }
    mockListarCalzado.mockResolvedValue(CALZADO)
  })

  it('abre en el primer color con stock: Color, Marca · Ref y precio Max/Min en un renglón', async () => {
    conRol('empleado')
    const arbol = await montar()
    expect(existeTexto(arbol, 'Nike Air Max')).toBe(true)
    expect(existeTexto(arbol, 'Nike · Ref 4521')).toBe(true)
    expect(existeTexto(arbol, 'Color: Negro')).toBe(true)
    expect(existeTexto(arbol, '$220.000')).toBe(true)
    expect(existeTexto(arbol, 'Max')).toBe(true)
    expect(existeTexto(arbol, '$150.000')).toBe(true)
    expect(existeTexto(arbol, 'Min')).toBe(true)
  })

  it('respeta el color de la tarjeta tocada (?color=)', async () => {
    mockParams = { ref: '4521', color: 'Blanco' }
    conRol('empleado')
    const arbol = await montar()
    expect(existeTexto(arbol, 'Color: Blanco')).toBe(true)
    expect(botones(arbol).some((n: Nodo) => n.props.accessibilityLabel === 'Talla 39: 2 disponibles')).toBe(true)
  })

  it('miniaturas por color (sin pills); elegir color filtra tallas y la talla sin stock lleva raya y está deshabilitada', async () => {
    conRol('empleado')
    const arbol = await montar()
    await elegir(arbol, 'Blanco')
    expect(existeTexto(arbol, 'Color: Blanco')).toBe(true)
    await elegir(arbol, 'Negro')
    // color Negro tiene tallas 40 (stock 5) y 41 (stock 0); la 39 es de Blanco
    expect(botones(arbol).some((n: Nodo) => n.props.accessibilityLabel === 'Talla 39: 2 disponibles')).toBe(false)
    const talla41 = arbol.root
      .findAllByProps({ accessibilityLabel: 'Talla 41: 0 disponibles' })
      .find((n: Nodo) => n.props.accessibilityState)!
    expect(talla41.props.accessibilityState?.disabled).toBe(true)
    expect(arbol.root.findAllByProps({ testID: 'raya-diagonal' }).length).toBeGreaterThan(0)
  })

  it('un solo color: sin tira de miniaturas', async () => {
    mockListarCalzado.mockResolvedValue(CALZADO.filter((c) => c.color === 'Negro'))
    conRol('empleado')
    const arbol = await montar()
    expect(botones(arbol).some((n: Nodo) => n.props.accessibilityLabel === 'Negro')).toBe(false)
  })

  it('dueño: elegir talla muestra su precio exacto y el mínimo', async () => {
    conRol('dueno')
    const arbol = await montar()
    await elegir(arbol, 'Talla 40: 5 disponibles')
    expect(existeTexto(arbol, '$220.000')).toBe(true)
    expect(existeTexto(arbol, 'Precio de venta · mínimo $150.000')).toBe(true)
  })

  it('Ver ficha es un enlace siempre visible (sin talla elegida) para quien tiene inventario', async () => {
    conRol('empleado')
    const arbol = await montar()
    const ficha = arbol.root.findAllByProps({ accessibilityLabel: 'Ver ficha' }).find((n: Nodo) => n.props.onPress)!
    expect(ficha.props.accessibilityRole).toBe('link')
    await act(async () => ficha.props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/inventario/calzado/c1')
  })

  it('sin permiso de inventario no ve Ver ficha (solo vende)', async () => {
    mockUseAuth.mockReturnValue({ perfil: perfilPrueba('operativo', 'Prueba', ['ventas']), cerrarSesion: jest.fn() })
    const arbol = await montar()
    expect(arbol.root.findAllByProps({ accessibilityLabel: 'Ver ficha' })).toHaveLength(0)
  })

  it('un solo botón de compra: sin Compra rápida; la barra se habilita al elegir talla con stock', async () => {
    conRol('empleado')
    const arbol = await montar()
    expect(arbol.root.findAllByProps({ accessibilityLabel: 'Compra rápida' })).toHaveLength(0)
    expect(barraAgregar(arbol).props.accessibilityState).toMatchObject({ disabled: true })
    await elegir(arbol, 'Talla 40: 5 disponibles')
    expect(barraAgregar(arbol).props.accessibilityState).toMatchObject({ disabled: false })
  })

  it('agregar abre "Producto añadido al carrito"; Seguir vuelve a la lista sin navegar al carrito', async () => {
    conRol('empleado')
    const arbol = await montar()
    await elegir(arbol, 'Talla 40: 5 disponibles')
    await act(async () => barraAgregar(arbol).props.onPress!())
    expect(existeTexto(arbol, 'Producto añadido al carrito')).toBe(true)
    expect(existeTexto(arbol, 'Nike Air Max Negro')).toBe(true)
    expect(existeTexto(arbol, 'Talla 40')).toBe(true)
    const seguir = arbol.root.findAllByProps({ accessibilityLabel: 'Seguir' }).find((n: Nodo) => n.props.onPress)!
    await act(async () => seguir.props.onPress!())
    expect(mockBack).toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('Ir al carrito navega al carrito', async () => {
    conRol('empleado')
    const arbol = await montar()
    await elegir(arbol, 'Talla 40: 5 disponibles')
    await act(async () => barraAgregar(arbol).props.onPress!())
    const ir = arbol.root.findAllByProps({ accessibilityLabel: 'Ir al carrito' }).find((n: Nodo) => n.props.onPress)!
    await act(async () => ir.props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/ventas/nueva')
  })
})
