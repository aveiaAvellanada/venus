import React from 'react'
import { PLANTILLAS } from './permisos'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@react-native-community/datetimepicker', () => () => null)
jest.mock('expo-image-picker', () => ({}))
jest.mock('expo-document-picker', () => ({}))
jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))
jest.mock('./imagenes', () => ({ comprimirBajoLimite: jest.fn(), comprimirYSubirImagen: jest.fn() }))
jest.mock('./storage', () => ({ bytesDesdeUriLocal: jest.fn() }))

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
const mockParams = jest.fn(() => ({ id: 'c1' }))
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams(),
  useFocusEffect: (cb: () => void) => {
    const React = require('react')
    React.useEffect(() => { cb() }, [cb])
  },
  Redirect: (props: { href: string }) => {
    const React = require('react')
    return React.createElement('Text', null, `Redirect:${props.href}`)
  },
}))
jest.mock('./auth', () => ({ useAuth: jest.fn(), useRequireModulo: jest.fn(() => null) }))
jest.mock('./proveedores', () => ({
  listarProveedores: jest.fn(),
  crearProveedor: jest.fn(),
  obtenerCompraPorId: jest.fn(() => Promise.resolve(null)),
  completarInformacionFinanciera: jest.fn(),
}))
jest.mock('./inventario', () => ({ listarCalzado: jest.fn() }))
jest.mock('./compras', () => ({
  ...jest.requireActual('./compras'),
  listarCompras: jest.fn(),
  obtenerCompra: jest.fn(),
  pagosDeCompra: jest.fn(),
  documentosDeCompra: jest.fn(),
  registrarCompra: jest.fn(),
  registrarLlegada: jest.fn(),
  registrarPago: jest.fn(),
  fijarFotos: jest.fn(),
  subirFactura: jest.fn(),
  costosPorProducto: jest.fn(),
}))
jest.mock('./intentoVenta', () => ({ generarClave: () => 'clave-x' }))

import { useAuth } from './auth'
import { listarProveedores } from './proveedores'
import { listarCalzado } from './inventario'
import {
  costosPorProducto, documentosDeCompra, listarCompras, obtenerCompra, pagosDeCompra, registrarCompra, registrarLlegada,
  type CompraDetalle, type CompraListado, type Factura,
} from './compras'
import { TemaProvider } from './tema'
import { ToastProvider } from '../components/ui'
import Lista from '../app/(app)/recibir-mercancia/index'
import Nueva from '../app/(app)/recibir-mercancia/nueva'
import Detalle from '../app/(app)/recibir-mercancia/[id]'
import Completar from '../app/(app)/recibir-mercancia/completar/[id]'

jest.useFakeTimers()

const DUENO = { id: 'dueno-1', nombre: 'Andrés', rol: 'dueno', permisos: [], activo: true }
const EMPLEADO = { id: 'emp-1', nombre: 'Camilo', rol: 'empleado', permisos: PLANTILLAS.operativo.permisos, activo: true }
const comoDe = (perfil: object) => (useAuth as jest.Mock).mockReturnValue({ session: {}, perfil, cargando: false })

type Nodo = renderer.ReactTestInstance
let arbol: renderer.ReactTestRenderer | null = null

async function pintar(ui: React.ReactElement) {
  await act(async () => {
    arbol = renderer.create(<TemaProvider><ToastProvider>{ui}</ToastProvider></TemaProvider>)
  })
  await act(async () => { await Promise.resolve() })
  return arbol!
}

const textos = (): string[] =>
  arbol!.root.findAll((n: Nodo) => (n.type as unknown) === 'Text').map((n: Nodo) =>
    [n.props.children].flat(5).filter((c: unknown) => typeof c === 'string' || typeof c === 'number').join(''))
const hay = (t: string) => textos().some((x) => x.includes(t))
const boton = (etiqueta: string): Nodo => {
  const nodos = arbol!.root.findAll((n: Nodo) => n.props.accessibilityLabel === etiqueta && n.props.accessibilityRole === 'button')
  if (!nodos.length) throw new Error(`No hay botón "${etiqueta}"`)
  return nodos[0]
}
const tocar = async (etiqueta: string) => {
  await act(async () => { boton(etiqueta).props.onPress() })
  await act(async () => { await Promise.resolve() })
}

const compra = (o: Partial<CompraListado>): CompraListado => ({
  id: 'c1', proveedor_id: 'p1', proveedor: 'Calzado Andino', estado: 'completada', condicion_pago: 'contado', total: 500000,
  saldo_pendiente: 0, fecha_vencimiento: null, numero_factura: 'FV-77', fecha_factura: '2026-10-20', registrada_por: 'dueno-1',
  created_at: '2026-10-20T15:00:00Z', pares: 10, ...o,
})

const EXISTENTES = {
  '38': { id: 'a38', precio_minimo: 80000, precio_maximo: 100000 },
  '39': { id: 'a39', precio_minimo: 80000, precio_maximo: 100000 },
}
const borrador = (filaExtra: object = {}): { clave: string; factura: Factura } => ({
  clave: 'clave-guardada',
  factura: {
    proveedorId: 'p1', numeroFactura: 'FV-1', fechaFactura: '2026-10-20', condicion: 'contado', fechaVencimiento: '', notas: '',
    filas: [{
      id: 'f1', referencia: 'TA-1', descripcion: 'Tennis A', marca: 'Bosi', categoria: 'Tennis', color: 'Negro',
      existentes: EXISTENTES, cantidades: { '38': '2', '39': '1' }, foto: '',
      rangos: [{ desde: '20', hasta: '45', costo: '50.000', minimo: '80.000', maximo: '100.000' }],
      ...filaExtra,
    }],
  },
})

beforeEach(async () => {
  jest.clearAllMocks()
  await AsyncStorage.clear()
  mockParams.mockReturnValue({ id: 'c1' })
  ;(listarProveedores as jest.Mock).mockResolvedValue([{ id: 'p1', nombre: 'Calzado Andino', activo: true }])
  ;(listarCalzado as jest.Mock).mockResolvedValue([])
  ;(costosPorProducto as jest.Mock).mockResolvedValue(new Map())
  ;(registrarCompra as jest.Mock).mockResolvedValue({ compra_id: 'c9', repetida: false })
  ;(registrarLlegada as jest.Mock).mockResolvedValue('c10')
  ;(pagosDeCompra as jest.Mock).mockResolvedValue([])
  ;(documentosDeCompra as jest.Mock).mockResolvedValue([])
})

afterEach(async () => {
  if (arbol) await act(async () => { arbol!.unmount() })
  arbol = null
})

describe('Lista de compras', () => {
  it('el dueño ve todas, con lo que debe y su estado, y filtra las por pagar', async () => {
    comoDe(DUENO)
    ;(listarCompras as jest.Mock).mockResolvedValue([
      compra({}),
      compra({ id: 'c2', proveedor: 'Botas del Sur', condicion_pago: 'credito', total: 300000, saldo_pendiente: 300000, fecha_vencimiento: '2099-01-01' }),
    ])
    await pintar(<Lista />)
    expect(hay('Compras')).toBe(true)
    expect(hay('Calzado Andino')).toBe(true)
    expect(hay('$500.000')).toBe(true)
    expect(hay('CONTADO')).toBe(true)
    expect(hay('Por pagar')).toBe(true)
    expect(hay('$300.000')).toBe(true)
    await act(async () => {
      arbol!.root.findAll((n: Nodo) => n.props.children === 'Por pagar' && (n.type as unknown) === 'Text')
        .map((n: Nodo) => { let p: Nodo | null = n; while (p && !p.props.onPress) p = p.parent; return p })
        .filter(Boolean).pop()!.props.onPress()
    })
    expect(hay('Calzado Andino')).toBe(false)
    expect(hay('Botas del Sur')).toBe(true)
  })

  it('un empleado sin costos ve solo sus llegadas pendientes y sin montos', async () => {
    comoDe(EMPLEADO)
    ;(listarCompras as jest.Mock).mockResolvedValue([
      compra({ estado: 'pendiente_revision', total: null, condicion_pago: null, registrada_por: 'emp-1' }),
    ])
    await pintar(<Lista />)
    expect(hay('Mercancía recibida')).toBe(true)
    expect(hay('PENDIENTE DE COSTOS')).toBe(true)
    expect(hay('$')).toBe(false)
    expect(boton('Recibir mercancía')).toBeTruthy()
  })
})

describe('Nueva compra', () => {
  it('con costos: revisar y guardar manda la factura con la clave del borrador', async () => {
    comoDe(DUENO)
    await AsyncStorage.setItem('venus.compra.borrador', JSON.stringify(borrador()))
    await pintar(<Nueva />)
    expect(hay('Nueva compra')).toBe(true)
    expect(hay('TA-1')).toBe(true)
    expect(hay('38×2  39×1')).toBe(true)
    expect(hay('$150.000')).toBe(true)
    await tocar('Revisar')
    expect(hay('Confirmar compra')).toBe(true)
    expect(hay('FV-1')).toBe(true)
    await tocar('Guardar y subir stock')
    expect(registrarCompra).toHaveBeenCalledWith(expect.objectContaining({ proveedorId: 'p1', numeroFactura: 'FV-1' }), 'clave-guardada')
    expect(mockRouter.replace).toHaveBeenCalledWith('/recibir-mercancia/c9')
    expect(await AsyncStorage.getItem('venus.compra.borrador')).toBeNull()
  })

  it('con costos: lo que falta impide guardar y se explica', async () => {
    comoDe(DUENO)
    await AsyncStorage.setItem('venus.compra.borrador', JSON.stringify(borrador({
      referencia: 'NV-9', existentes: {}, descripcion: '', categoria: '', rangos: [{ desde: '20', hasta: '45', costo: '', minimo: '', maximo: '' }],
    })))
    await pintar(<Nueva />)
    await tocar('Revisar')
    expect(hay('Falta la descripción de NV-9.')).toBe(true)
    expect(boton('Guardar y subir stock').props.accessibilityState.disabled).toBe(true)
  })

  it('sin costos: es la llegada física, sin precios, de lo que ya existe', async () => {
    comoDe(EMPLEADO)
    await AsyncStorage.setItem('venus.compra.borrador', JSON.stringify(borrador()))
    await pintar(<Nueva />)
    expect(hay('Recibir mercancía')).toBe(true)
    expect(hay('$')).toBe(false)
    await tocar('Revisar')
    await tocar('Confirmar llegada')
    expect(registrarLlegada).toHaveBeenCalledWith('p1', 'emp-1', [
      { producto_calzado_id: 'a38', descripcion: 'Tennis A', referencia: 'TA-1', color: 'Negro', talla: '38', cantidad: 2 },
      { producto_calzado_id: 'a39', descripcion: 'Tennis A', referencia: 'TA-1', color: 'Negro', talla: '39', cantidad: 1 },
    ])
    expect(registrarCompra).not.toHaveBeenCalled()
  })

  it('sin costos: una talla que no está en el inventario no se puede registrar', async () => {
    comoDe(EMPLEADO)
    await AsyncStorage.setItem('venus.compra.borrador', JSON.stringify(borrador({ cantidades: { '40': '1' } })))
    await pintar(<Nueva />)
    await tocar('Revisar')
    expect(hay('TA-1 Negro: la talla 40 no existe en el inventario.')).toBe(true)
    expect(boton('Confirmar llegada').props.accessibilityState.disabled).toBe(true)
  })
})

describe('Detalle de compra', () => {
  const detalle = (o: Partial<CompraDetalle>): CompraDetalle => ({
    ...compra({}), monto_pagado: 0, notas: null,
    items: [
      { id: 'i1', producto_calzado_id: 'a38', referencia: 'TA-1', descripcion: 'Tennis A', color: 'Negro', talla: '38', cantidad: 2, costo_unitario: 50000, subtotal: 100000 },
      { id: 'i2', producto_calzado_id: 'a39', referencia: 'TA-1', descripcion: 'Tennis A', color: 'Negro', talla: '39', cantidad: 1, costo_unitario: 50000, subtotal: 50000 },
    ],
    ...o,
  })

  it('una llegada pendiente lleva al dueño a completar costos', async () => {
    comoDe(DUENO)
    ;(obtenerCompra as jest.Mock).mockResolvedValue(detalle({ estado: 'pendiente_revision', total: null, condicion_pago: null }))
    ;(documentosDeCompra as jest.Mock).mockResolvedValue([])
    await pintar(<Detalle />)
    expect(hay('PENDIENTE DE COSTOS')).toBe(true)
    expect(hay('38×2 · 39×1')).toBe(true)
    await tocar('Completar costos y pago')
    expect(mockRouter.push).toHaveBeenCalledWith('/recibir-mercancia/completar/c1')
  })

  it('una compra a crédito muestra lo que se debe y sus pagos', async () => {
    comoDe(DUENO)
    ;(obtenerCompra as jest.Mock).mockResolvedValue(detalle({
      condicion_pago: 'credito', total: 150000, monto_pagado: 50000, saldo_pendiente: 100000, fecha_vencimiento: '2099-01-01',
    }))
    ;(pagosDeCompra as jest.Mock).mockResolvedValue([{ id: 'pg1', monto: 50000, fecha: '2026-10-21', notas: 'Nequi' }])
    ;(documentosDeCompra as jest.Mock).mockResolvedValue([])
    await pintar(<Detalle />)
    expect(hay('$100.000')).toBe(true)
    expect(hay('Nequi')).toBe(true)
    expect(boton('Registrar pago')).toBeTruthy()
  })
})

describe('Completar costos', () => {
  it('sin permiso de costos redirige', async () => {
    comoDe(EMPLEADO)
    await pintar(<Completar />)
    expect(hay('Redirect:/')).toBe(true)
  })
})
