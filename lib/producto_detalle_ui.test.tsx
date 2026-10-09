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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockUseAuth = jest.fn()
jest.mock('../lib/auth', () => ({ useAuth: () => mockUseAuth() }))

const mockListarCalzado = jest.fn()
jest.mock('../lib/inventario', () => ({
  listarCalzado: (...args: unknown[]) => mockListarCalzado(...args),
}))

import { Text } from 'react-native'
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

  it('sin permiso de inventario no ve Ver ficha (solo vende)', async () => {
    mockUseAuth.mockReturnValue({ perfil: perfilPrueba('operativo', 'Prueba', ['ventas']), cerrarSesion: jest.fn() })
    const arbol = await montar()
    expect(arbol.root.findAllByProps({ accessibilityLabel: 'Ver ficha' })).toHaveLength(0)
  })

  it('con permiso de inventario (plantilla operativa) sí ve Ver ficha', async () => {
    conRol('empleado')
    const arbol = await montar()
    const negro = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Negro')!
    await act(async () => negro.props.onPress!())
    const talla40 = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Talla 40: 5 disponibles')!
    await act(async () => talla40.props.onPress!())
    expect(arbol.root.findAllByProps({ accessibilityLabel: 'Ver ficha' }).length).toBeGreaterThan(0)
  })

  it('elegir talla habilita Agregar al carrito y NO navega (se queda en Productos)', async () => {
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
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('Compra rápida limpia el carrito, agrega el ítem y navega con modo=rapida', async () => {
    conRol('empleado')
    const arbol = await montar()
    const negro = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Negro')!
    await act(async () => negro.props.onPress!())
    const talla40 = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Talla 40: 5 disponibles')!
    await act(async () => talla40.props.onPress!())
    const cta = arbol.root
      .findAllByProps({ accessibilityLabel: 'Compra rápida' })
      .find((n: Nodo) => n.props.onPress)!
    await act(async () => cta.props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/ventas/nueva?modo=rapida')
  })

  it('agregar al carrito muestra toast "Agregado: talla N · Color"', async () => {
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
    const textos = arbol.root
      .findAllByType(Text)
      .map((t: { props: { children?: unknown } }) => JSON.stringify(t.props.children))
    expect(textos.join(' ')).toContain('Agregado: talla 40 · Negro')
  })
})
