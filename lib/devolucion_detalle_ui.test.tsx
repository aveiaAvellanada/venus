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
    useLocalSearchParams: () => ({ id: 'd1' }),
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
  obtenerDevolucionDetalle: (...args: unknown[]) => mockDetalle(...args),
}))

import { TemaProvider } from './tema'
import DevolucionDetalleScreen from '../app/(app)/devoluciones/[id]'

const DETALLE = {
  id: 'd1',
  venta_id: 'v1',
  numero_venta: 98,
  tipo: 'cambio',
  monto_devuelto: 0,
  monto_cobrado: 12000,
  hora: '1:10 p. m.',
  fecha: '15 jul 2026',
  motivo: 'talla equivocada',
  metodo_reembolso: null,
  metodo_cobro: 'efectivo',
  items: [{ descripcion: 'Adidas VL Court', talla: '39', color: 'Blanco', cantidad: 1 }],
}

async function montar() {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <DevolucionDetalleScreen />
      </TemaProvider>
    )
  })
  return arbol
}

const existeTexto = (arbol: ReturnType<typeof renderer.create>, texto: string) =>
  arbol.root.findAllByProps({ children: texto }).length > 0

describe('Detalle de devolución', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDetalle.mockResolvedValue(DETALLE)
  })

  it('muestra tipo, motivo, montos e items', async () => {
    const arbol = await montar()
    expect(existeTexto(arbol, 'CAMBIO')).toBe(true)
    expect(existeTexto(arbol, 'talla equivocada')).toBe(true)
    expect(existeTexto(arbol, 'Adidas VL Court')).toBe(true)
    expect(existeTexto(arbol, '$12.000')).toBe(true)
  })

  it('navega a la venta original', async () => {
    const arbol = await montar()
    const fila = arbol.root.findByProps({ accessibilityLabel: 'Venta #98' })
    await act(async () => fila.props.onPress())
    expect(mockPush).toHaveBeenCalledWith('/ventas/v1')
  })

  it('no encontrada: estado vacío', async () => {
    mockDetalle.mockResolvedValue(null)
    const arbol = await montar()
    expect(existeTexto(arbol, 'No encontramos esta devolución')).toBe(true)
  })
})
