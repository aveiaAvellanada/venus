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
jest.mock('expo-router', () => {
  const ReactMock = require('react')
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
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

const mockListarVentas = jest.fn()
const mockListarDevs = jest.fn()
jest.mock('../lib/movimientos', () => ({
  ...jest.requireActual('../lib/movimientos'),
  listarVentasPeriodo: (...args: unknown[]) => mockListarVentas(...args),
  listarDevoluciones: (...args: unknown[]) => mockListarDevs(...args),
}))

const mockGastosPeriodo = jest.fn()
jest.mock('../lib/dashboard', () => ({
  ...jest.requireActual('../lib/dashboard'),
  obtenerGastosPeriodo: (...args: unknown[]) => mockGastosPeriodo(...args),
}))

const mockListarCalzado = jest.fn()
const mockListarVarios = jest.fn()
jest.mock('../lib/inventario', () => ({
  listarCalzado: (...args: unknown[]) => mockListarCalzado(...args),
  listarVarios: (...args: unknown[]) => mockListarVarios(...args),
}))

import { rangoParaPeriodo } from './dashboard'
import { TemaProvider } from './tema'
import Movimientos from '../app/(app)/(tabs)/movimientos'
import Productos from '../app/(app)/(tabs)/productos'

const VENTAS = [
  { id: 'v1', numero: 102, total: 195000, estado: 'completada', hora: '2:14 p. m.', metodos: ['efectivo'] },
  { id: 'v2', numero: 101, total: 180000, estado: 'cancelada', hora: '1:48 p. m.', metodos: ['nequi'] },
]

const DEVS = [
  {
    id: 'd1',
    venta_id: 'v1',
    numero_venta: 102,
    tipo: 'parcial',
    monto_devuelto: 85000,
    monto_cobrado: 0,
    hora: '2:40 p. m.',
    fecha: '15 jul 2026',
  },
]

const GASTOS = {
  total: 315000,
  gastos: [{ tipo: 'fijo', nombre: 'Arriendo', detalle: null, monto: 300000, fecha: '2026-07-01' }],
}

function conRol(rol: string) {
  mockUseAuth.mockReturnValue({ perfil: { nombre: 'Prueba Uno', rol }, cerrarSesion: jest.fn() })
}

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

type Nodo = { props: { onPress?: () => void; accessibilityLabel?: string } }

const existeTexto = (arbol: ReturnType<typeof renderer.create>, texto: string) =>
  arbol.root.findAllByProps({ children: texto }).length > 0

const tabs = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root.findAllByProps({ accessibilityRole: 'tab' }).filter((n: Nodo) => n.props.onPress)

const botones = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root.findAllByProps({ accessibilityRole: 'button' }).filter((n: Nodo) => n.props.onPress)

describe('Movimientos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListarVentas.mockResolvedValue(VENTAS)
    mockListarDevs.mockResolvedValue(DEVS)
    mockGastosPeriodo.mockResolvedValue(GASTOS)
  })

  it('staff: vista Ventas lista las ventas y navega al detalle', async () => {
    conRol('dueno')
    const arbol = await montar(<Movimientos />)
    expect(existeTexto(arbol, 'Venta #102')).toBe(true)
    expect(existeTexto(arbol, 'CANCELADA')).toBe(true)
    const fila = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Venta #102')
    await act(async () => fila!.props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/ventas/v1')
  })

  it('toggle a Devoluciones: lista y navega al detalle', async () => {
    conRol('dueno')
    const arbol = await montar(<Movimientos />)
    await act(async () => tabs(arbol)[1].props.onPress!())
    expect(mockListarDevs).toHaveBeenCalled()
    expect(existeTexto(arbol, 'PARCIAL')).toBe(true)
    const fila = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Devolución venta #102')
    await act(async () => fila!.props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/devoluciones/d1')
  })

  it('toggle a Gastos: staff ve total y filas', async () => {
    conRol('admin')
    const arbol = await montar(<Movimientos />)
    await act(async () => tabs(arbol)[2].props.onPress!())
    expect(existeTexto(arbol, 'Arriendo')).toBe(true)
    expect(existeTexto(arbol, 'Total gastos')).toBe(true)
    expect(existeTexto(arbol, 'Gastos fijos')).toBe(true)
  })

  it('empleado: sin chips de período y consulta solo hoy', async () => {
    conRol('empleado')
    const arbol = await montar(<Movimientos />)
    expect(existeTexto(arbol, 'Semana')).toBe(false)
    const hoy = rangoParaPeriodo('hoy')
    expect(mockListarVentas).toHaveBeenCalledWith(hoy.desde, hoy.hasta)
  })
})

const CALZADO = [
  {
    id: 'c1', descripcion: 'Nike Air Max', marca: 'Nike', referencia: '4521', categoria: 'Deportivo',
    talla: '40', color: 'Negro', precio_minimo: 150000, precio_maximo: 220000, stock_actual: 5,
    stock_minimo: 1, foto_url: null, proveedor_id: null, activo: true,
  },
  {
    id: 'c2', descripcion: 'Nike Air Max', marca: 'Nike', referencia: '4521', categoria: 'Deportivo',
    talla: '39', color: 'Blanco', precio_minimo: 140000, precio_maximo: 200000, stock_actual: 2,
    stock_minimo: 1, foto_url: null, proveedor_id: null, activo: true,
  },
  {
    id: 'c3', descripcion: 'Croydon Urbano', marca: 'Croydon', referencia: '3310', categoria: 'Clásico',
    talla: '41', color: 'Café', precio_minimo: 95000, precio_maximo: 95000, stock_actual: 0,
    stock_minimo: 1, foto_url: null, proveedor_id: null, activo: true,
  },
]

const VARIOS = [
  { id: 'g1', nombre: 'Huevos', unidad_medida: 'unidad', precio_sugerido: null, foto_url: null, activo: true },
]

describe('Productos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListarCalzado.mockResolvedValue(CALZADO)
    mockListarVarios.mockResolvedValue(VARIOS)
  })

  it('agrupa por referencia: un card por modelo, con agotado, y navega al detalle', async () => {
    conRol('empleado')
    const arbol = await montar(<Productos />)
    const cards = botones(arbol).filter((n: Nodo) => n.props.accessibilityLabel === 'Nike Air Max')
    expect(cards).toHaveLength(1)
    expect(existeTexto(arbol, 'AGOTADO')).toBe(true)
    await act(async () => cards[0].props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/productos/4521')
  })

  it('la búsqueda filtra los modelos', async () => {
    conRol('empleado')
    const arbol = await montar(<Productos />)
    const input = arbol.root.findByType(require('react-native').TextInput)
    await act(async () => input.props.onChangeText('croydon'))
    expect(botones(arbol).filter((n: Nodo) => n.props.accessibilityLabel === 'Nike Air Max')).toHaveLength(0)
    expect(
      botones(arbol).filter((n: Nodo) => n.props.accessibilityLabel === 'Croydon Urbano').length
    ).toBeGreaterThan(0)
  })

  it('toggle Granja lista los productos varios', async () => {
    conRol('empleado')
    const arbol = await montar(<Productos />)
    await act(async () => tabs(arbol)[1].props.onPress!())
    expect(mockListarVarios).toHaveBeenCalled()
    expect(existeTexto(arbol, 'Huevos')).toBe(true)
  })

  it('empleado ve Recibir mercancía pero no Carga inicial; admin sí', async () => {
    conRol('empleado')
    const a = await montar(<Productos />)
    expect(existeTexto(a, 'Recibir mercancía')).toBe(true)
    expect(existeTexto(a, 'Carga inicial')).toBe(false)
    conRol('admin')
    const b = await montar(<Productos />)
    expect(existeTexto(b, 'Carga inicial')).toBe(true)
  })
})
