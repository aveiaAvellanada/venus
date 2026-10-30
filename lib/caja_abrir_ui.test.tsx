import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { TextInput } from 'react-native'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))
jest.mock('../lib/auth', () => ({ useRequireModulo: () => null }))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  Redirect: ({ href }: { href: string }) => `Redirect:${href}`,
}))

const mockCaja = jest.fn()
const mockAbrir = jest.fn()
const mockReabrir = jest.fn()
jest.mock('../lib/caja', () => ({
  obtenerCajaHoy: () => mockCaja(),
  obtenerBasePredeterminada: () => Promise.resolve(150000),
  abrirCaja: (...a: unknown[]) => mockAbrir(...a),
  reabrirCaja: () => mockReabrir(),
}))

import CajaRaw from '../app/(app)/caja/index'
import { TemaProvider } from './tema'
import { ToastProvider } from '../components/ui'

async function montar() {
  let arbol!: renderer.ReactTestRenderer
  await act(async () => {
    arbol = renderer.create(<TemaProvider><ToastProvider><CajaRaw /></ToastProvider></TemaProvider>)
  })
  return arbol
}

const boton = (arbol: renderer.ReactTestRenderer, titulo: string) =>
  arbol.root.findAll((n: renderer.ReactTestInstance) => n.props.titulo === titulo && !!n.props.onPress)[0]

beforeEach(() => {
  jest.clearAllMocks()
  mockAbrir.mockResolvedValue(undefined)
  mockReabrir.mockResolvedValue(undefined)
})

describe('Caja del día: abrir', () => {
  it('la base se ve con punto de miles y al abrir vuelve al Menú (sin mostrar el cierre)', async () => {
    mockCaja.mockResolvedValue(null)
    const arbol = await montar()
    const base = arbol.root.findAllByType(TextInput)[0]
    expect(base.props.value).toBe('150.000')
    act(() => { base.props.onChangeText('200.0000') })
    expect(arbol.root.findAllByType(TextInput)[0].props.value).toBe('2.000.000')
    await act(async () => { boton(arbol, 'Abrir Caja del Día').props.onPress() })
    expect(mockAbrir).toHaveBeenCalledWith(2000000)
    expect(mockReplace).toHaveBeenCalledWith('/')
    expect(mockCaja).toHaveBeenCalledTimes(1)
  })

  it('con la caja cerrada, "Abrir caja de nuevo" la reabre y vuelve al Menú', async () => {
    mockCaja.mockResolvedValue({ estado: 'cerrada', total_general: 0, total_ventas: 0, total_efectivo: 0, total_nequi: 0, total_bre_b: 0, total_otro: 0 })
    const arbol = await montar()
    await act(async () => { boton(arbol, 'Abrir caja de nuevo').props.onPress() })
    expect(mockReabrir).toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/')
  })
})
