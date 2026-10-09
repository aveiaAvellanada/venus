import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { Text, TextInput } from 'react-native'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

const mockArqueo = jest.fn()
const mockCerrar = jest.fn()
jest.mock('../lib/caja', () => ({
  obtenerArqueoCaja: () => mockArqueo(),
  cerrarCaja: (...a: unknown[]) => mockCerrar(...a),
}))
jest.mock('../lib/reporteDiario', () => ({
  dispararReporteCorreo: jest.fn(() => Promise.resolve()),
  obtenerReporteDiario: jest.fn(() => Promise.resolve({ mensaje: 'Resumen' })),
  construirLinkWhatsapp: jest.fn(() => 'https://wa.me/?text=Resumen'),
}))

import CierreCajaRaw from '../app/(app)/caja/cierre'
import { TemaProvider } from './tema'
import { ToastProvider } from '../components/ui'

function CierreCaja() {
  return (
    <TemaProvider>
      <ToastProvider>
        <CierreCajaRaw />
      </ToastProvider>
    </TemaProvider>
  )
}

const texto = (arbol: renderer.ReactTestRenderer): string =>
  arbol.root.findAllByType(Text).map((t: renderer.ReactTestInstance) => t.props.children).flat().join(' ')

async function montar() {
  let arbol!: renderer.ReactTestRenderer
  await act(async () => {
    arbol = renderer.create(<CierreCaja />)
  })
  return arbol
}

function contar(arbol: renderer.ReactTestRenderer, valor: string) {
  const campo = arbol.root.findAll(
    (n: renderer.ReactTestInstance) => n.type === TextInput && n.props.placeholder === '0',
  )[0]
  act(() => { campo.props.onChangeText(valor) })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockArqueo.mockResolvedValue({
    base_inicial: 50000, efectivo_ventas: 90000, gastos_caja: 20000, efectivo_esperado: 120000,
  })
})

describe('Cierre de caja — arqueo', () => {
  test('muestra el efectivo esperado con base, ventas en efectivo y gastos del cajón', async () => {
    const arbol = await montar()
    const t = texto(arbol)
    expect(t).toContain('$120.000')
    expect(t).toContain('Base inicial')
    expect(t).toContain('$50.000')
    expect(t).toContain('+ $90.000')
    expect(t).toContain('Gastos pagados del cajón')
    expect(t).toContain('− $20.000')
  })

  test('contar exactamente base + ventas − gastos cuadra', async () => {
    const arbol = await montar()
    contar(arbol, '120000')
    expect(texto(arbol)).toContain('Cuadra exacto')
  })

  test('contar solo el efectivo de ventas ya no basta: falta', async () => {
    const arbol = await montar()
    contar(arbol, '90000')
    expect(texto(arbol)).toContain('Falta')
  })
})
