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
const mockBack = jest.fn()
jest.mock('expo-router', () => {
  const ReactMock = require('react')
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
    useLocalSearchParams: () => ({ id: 'v1' }),
    useFocusEffect: (cb: () => void) => {
      ReactMock.useEffect(() => {
        cb()
      }, [cb])
    },
  }
})

jest.mock('./supabase', () => ({ supabase: {} }))
jest.mock('../lib/supabase', () => ({ supabase: {} }))

const mockDetalle = jest.fn()
jest.mock('../lib/movimientos', () => ({
  ...jest.requireActual('../lib/movimientos'),
  obtenerVentaDetalle: (...args: unknown[]) => mockDetalle(...args),
}))

import { TemaProvider } from './tema'
import VentaDetalleScreen from '../app/(app)/ventas/[id]'

const DETALLE = {
  id: 'v1',
  numero: 102,
  total: 195000,
  estado: 'completada',
  fecha: '15 jul 2026',
  hora: '2:14 p. m.',
  creada: '2026-07-15T19:14:00.000Z',
  vendedor: 'Camilo Artunduaga',
  cliente: { nombre: 'Ana', apellido: 'Torres', telefono: '3001234567', documento: '1117123456' },
  nota: 'cliente pidió factura',
  efectivo_recibido: 200000,
  cambio: 5000,
  saldo_pendiente: 0,
  corregida: false,
  correccion_motivo: null,
  items: [
    { descripcion: 'Nike Air Max', talla: '40', color: 'Negro', cantidad: 1, precio_unitario: 180000, subtotal: 180000, garantia_dias: 30 },
    { descripcion: 'Medias x3', talla: null, color: null, cantidad: 3, precio_unitario: 5000, subtotal: 15000, garantia_dias: null },
  ],
  pagos: [{ metodo: 'efectivo', monto: 195000 }],
}

async function montar() {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <VentaDetalleScreen />
      </TemaProvider>
    )
  })
  return arbol
}

const existeTexto = (arbol: ReturnType<typeof renderer.create>, texto: string) =>
  arbol.root.findAllByProps({ children: texto }).length > 0

describe('Detalle de venta', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDetalle.mockResolvedValue(DETALLE)
  })

  it('muestra todas las secciones', async () => {
    const arbol = await montar()
    for (const t of [
      'Venta #102',
      'COMPLETADA',
      'Ana Torres',
      'CC / NIT: 1117123456',
      '3001234567',
      'Nike Air Max',
      'Medias x3',
      'cliente pidió factura',
    ]) {
      expect({ [t]: existeTexto(arbol, t) }).toEqual({ [t]: true })
    }
    expect(existeTexto(arbol, '$195.000')).toBe(true) // total
    expect(existeTexto(arbol, '$5.000')).toBe(true) // cambio
  })

  it('imprime la garantía prometida de cada zapato con su fecha de vencimiento', async () => {
    const arbol = await montar()
    const textos = arbol.root.findAllByType(require('react-native').Text)
      .map((t: renderer.ReactTestInstance) => [].concat(t.props.children).join(''))
    expect(textos.some((t: string) => t.startsWith('Garantía: 30 días · hasta 14 de ago de 2026'))).toBe(true)
    // los productos sin garantía (Granja) no muestran la línea
    expect(textos.filter((t: string) => t.startsWith('Garantía:'))).toHaveLength(1)
  })

  it('cliente solo con razón social: la muestra como título', async () => {
    mockDetalle.mockResolvedValue({
      ...DETALLE,
      cliente: { nombre: null, apellido: null, telefono: null, documento: 'Ferretería El Sol SAS' },
    })
    const arbol = await montar()
    expect(existeTexto(arbol, 'Ferretería El Sol SAS')).toBe(true)
  })

  it('el CTA de devolución navega con el número de la venta', async () => {
    const arbol = await montar()
    const cta = arbol.root.findByProps({ accessibilityLabel: 'Hacer devolución' })
    await act(async () => cta.props.onPress())
    expect(mockPush).toHaveBeenCalledWith('/devoluciones/nueva?numero=102')
  })

  it('venta cancelada: badge y sin CTA de devolución', async () => {
    mockDetalle.mockResolvedValue({ ...DETALLE, estado: 'cancelada' })
    const arbol = await montar()
    expect(existeTexto(arbol, 'CANCELADA')).toBe(true)
    expect(arbol.root.findAllByProps({ accessibilityLabel: 'Hacer devolución' })).toHaveLength(0)
  })

  it('venta no encontrada: estado vacío', async () => {
    mockDetalle.mockResolvedValue(null)
    const arbol = await montar()
    expect(existeTexto(arbol, 'No encontramos esta venta')).toBe(true)
  })
})
