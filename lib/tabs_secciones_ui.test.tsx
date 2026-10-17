import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('@react-native-community/datetimepicker', () => () => null)

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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

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
import { CarritoProvider } from './carrito-contexto'
import { ToastProvider } from '../components/ui'
import Movimientos from '../app/(app)/(tabs)/movimientos'
import Productos from '../app/(app)/(tabs)/productos'
import { perfilPrueba, type TipoPerfilPrueba } from './perfilPrueba'
// Roles de antes → perfiles con permisos: 'admin' = plantilla administrativa, 'empleado' = operativa.
const tipoPrueba = (rol: string): TipoPerfilPrueba =>
  rol === 'dueno' ? 'dueno' : rol === 'admin' ? 'administrativo' : 'operativo'


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
  mockUseAuth.mockReturnValue({ perfil: perfilPrueba(tipoPrueba(rol)), cerrarSesion: jest.fn() })
}

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <CarritoProvider>
          <ToastProvider>{ui}</ToastProvider>
        </CarritoProvider>
      </TemaProvider>
    )
  })
  return arbol
}

type Nodo = { props: { onPress?: () => void; accessibilityLabel?: string; accessibilityState?: { disabled?: boolean; selected?: boolean } } }

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

  it('ya no tiene vista de Gastos: solo Ventas y Devoluciones', async () => {
    conRol('admin')
    const arbol = await montar(<Movimientos />)
    expect(tabs(arbol)).toHaveLength(2)
    expect(existeTexto(arbol, 'Gastos')).toBe(false)
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
    id: 'c3', descripcion: 'Croydon Urbano', marca: 'Croydon', referencia: '3310', categoria: 'Clasico',
    talla: '41', color: 'Café', precio_minimo: 95000, precio_maximo: 95000, stock_actual: 0,
    stock_minimo: 1, foto_url: null, proveedor_id: null, activo: true,
  },
]

const VARIOS = [
  { id: 'g1', nombre: 'Huevos', unidad_medida: 'libra', precio_sugerido: null, foto_url: null, activo: true },
]

describe('Productos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListarCalzado.mockResolvedValue(CALZADO)
    mockListarVarios.mockResolvedValue(VARIOS)
  })

  const tarjetas = (arbol: ReturnType<typeof renderer.create>, etiqueta: string) =>
    botones(arbol).filter((n: Nodo) => n.props.accessibilityLabel === etiqueta)

  it('una tarjeta por modelo + color; color agotado con insignia; abre el detalle con el color', async () => {
    conRol('empleado')
    const arbol = await montar(<Productos />)
    expect(tarjetas(arbol, 'Nike Air Max · Negro')).toHaveLength(1)
    expect(tarjetas(arbol, 'Nike Air Max · Blanco')).toHaveLength(1)
    expect(existeTexto(arbol, 'AGOTADO')).toBe(true)
    await act(async () => tarjetas(arbol, 'Nike Air Max · Blanco')[0].props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/productos/4521?color=Blanco')
  })

  it('precio en dos renglones Max/Min; sin referencia ni chips de categoría', async () => {
    conRol('empleado')
    const arbol = await montar(<Productos />)
    expect(existeTexto(arbol, '$220.000')).toBe(true)
    expect(existeTexto(arbol, '$150.000')).toBe(true)
    expect(existeTexto(arbol, 'Max')).toBe(true)
    expect(existeTexto(arbol, 'Min')).toBe(true)
    // un solo precio: una línea sin etiqueta
    expect(existeTexto(arbol, '$95.000')).toBe(true)
    expect(existeTexto(arbol, 'Ref 4521')).toBe(false)
    expect(existeTexto(arbol, 'Ver descontinuados')).toBe(false)
    expect(existeTexto(arbol, '2 colores')).toBe(true)
  })

  it('la búsqueda filtra (también por referencia)', async () => {
    conRol('empleado')
    const arbol = await montar(<Productos />)
    const input = arbol.root.findByType(require('react-native').TextInput)
    await act(async () => input.props.onChangeText('3310'))
    expect(tarjetas(arbol, 'Nike Air Max · Negro')).toHaveLength(0)
    expect(tarjetas(arbol, 'Croydon Urbano · Café')).toHaveLength(1)
  })

  it('filtros: panel con contador en vivo; aplica solo con Mostrar artículos y resalta el ícono', async () => {
    conRol('empleado')
    const arbol = await montar(<Productos />)
    const icono = () => arbol.root.findAllByProps({ accessibilityLabel: 'Filtros' }).find((n: Nodo) => n.props.onPress)!
    await act(async () => icono().props.onPress!())
    expect(existeTexto(arbol, '3 artículos encontrados')).toBe(true)
    // Marca → Croydon: el contador cambia en vivo, la lista todavía no
    await act(async () => arbol.root.findByProps({ accessibilityLabel: 'Marca', accessibilityRole: 'button' }).props.onPress())
    await act(async () => arbol.root.findByProps({ accessibilityLabel: 'Croydon', accessibilityRole: 'checkbox' }).props.onPress())
    expect(existeTexto(arbol, '1 artículo encontrado')).toBe(true)
    expect(tarjetas(arbol, 'Nike Air Max · Negro')).toHaveLength(1)
    const mostrar = arbol.root.findAllByProps({ accessibilityLabel: 'Mostrar artículos' }).find((n: Nodo) => n.props.onPress)!
    await act(async () => mostrar.props.onPress!())
    expect(tarjetas(arbol, 'Nike Air Max · Negro')).toHaveLength(0)
    expect(tarjetas(arbol, 'Croydon Urbano · Café')).toHaveLength(1)
    expect(icono().props.accessibilityState).toMatchObject({ selected: true })
  })

  it('filtros: la X cierra sin aplicar y Tipo de zapato es selección múltiple', async () => {
    conRol('empleado')
    const arbol = await montar(<Productos />)
    const icono = arbol.root.findAllByProps({ accessibilityLabel: 'Filtros' }).find((n: Nodo) => n.props.onPress)!
    await act(async () => icono.props.onPress!())
    await act(async () => arbol.root.findByProps({ accessibilityLabel: 'Tipo de zapato', accessibilityRole: 'button' }).props.onPress())
    await act(async () => arbol.root.findByProps({ accessibilityLabel: 'Deportivo', accessibilityRole: 'checkbox' }).props.onPress())
    await act(async () => arbol.root.findByProps({ accessibilityLabel: 'Clásico', accessibilityRole: 'checkbox' }).props.onPress())
    expect(existeTexto(arbol, 'Deportivo, Clásico')).toBe(true)
    expect(existeTexto(arbol, '3 artículos encontrados')).toBe(true)
    await act(async () => arbol.root.findByProps({ accessibilityLabel: 'Cerrar filtros' }).props.onPress())
    expect(icono.props.accessibilityState).toMatchObject({ selected: false })
  })

  it('Granja: tarjetas con precio al vender; la hoja agrega y muestra "Producto añadido al carrito"', async () => {
    conRol('empleado')
    const arbol = await montar(<Productos />)
    await act(async () => tabs(arbol)[1].props.onPress!())
    expect(mockListarVarios).toHaveBeenCalled()
    expect(existeTexto(arbol, 'Huevos')).toBe(true)
    expect(existeTexto(arbol, 'Precio al vender')).toBe(true)
    expect(existeTexto(arbol, 'Por libra')).toBe(true)
    await act(async () => tarjetas(arbol, 'Huevos')[0].props.onPress!())
    expect(existeTexto(arbol, 'Compra rápida')).toBe(false)
    const barra = () => arbol.root.findAllByProps({ accessibilityLabel: 'Agregar al carrito' }).find((n: Nodo) => n.props.accessibilityState)!
    expect(barra().props.accessibilityState).toMatchObject({ disabled: true })
    const inputs = arbol.root.findAllByType(require('react-native').TextInput)
    await act(async () => inputs[inputs.length - 2].props.onChangeText('2'))
    await act(async () => inputs[inputs.length - 1].props.onChangeText('5000'))
    expect(barra().props.accessibilityState).toMatchObject({ disabled: false })
    await act(async () => barra().props.onPress!())
    expect(existeTexto(arbol, 'Producto añadido al carrito')).toBe(true)
    expect(existeTexto(arbol, '2 libras')).toBe(true)
    expect(existeTexto(arbol, '$10.000')).toBe(true)
    const ir = arbol.root.findAllByProps({ accessibilityLabel: 'Ir al carrito' }).find((n: Nodo) => n.props.onPress)!
    await act(async () => ir.props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/ventas/nueva')
  })

  it('Granja: el lápiz solo con permiso de inventario y abre el editor', async () => {
    mockUseAuth.mockReturnValue({ perfil: perfilPrueba('operativo', 'Prueba', ['ventas']), cerrarSesion: jest.fn() })
    const sinPermiso = await montar(<Productos />)
    await act(async () => tabs(sinPermiso)[1].props.onPress!())
    expect(sinPermiso.root.findAllByProps({ accessibilityLabel: 'Editar Huevos' })).toHaveLength(0)
    conRol('empleado')
    const arbol = await montar(<Productos />)
    await act(async () => tabs(arbol)[1].props.onPress!())
    const lapiz = arbol.root.findAllByProps({ accessibilityLabel: 'Editar Huevos' }).find((n: Nodo) => n.props.onPress)!
    await act(async () => lapiz.props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/inventario/granja/editor?id=g1')
  })

  // Recibir mercancía se movió a Perfil → Negocio; Carga inicial también vive en Perfil.
  it('Productos ya no muestra Recibir mercancía ni Carga inicial', async () => {
    conRol('dueno')
    const a = await montar(<Productos />)
    expect(existeTexto(a, 'Recibir mercancía')).toBe(false)
    expect(existeTexto(a, 'Carga inicial')).toBe(false)
  })
})
