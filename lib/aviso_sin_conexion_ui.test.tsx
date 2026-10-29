import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { Alert, Text } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('./supabase', () => ({ supabase: {} }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('./auth', () => ({ useAuth: () => ({ perfil: { id: 'ana' } }) }))
const mockEnviar = jest.fn()
jest.mock('./ventas', () => ({ registrarVenta: (...a: unknown[]) => mockEnviar(...a) }))

import { TemaProvider } from './tema'
import { VentasPendientesProvider, resumenEnvio } from './ventasPendientes-contexto'
import { AvisoSinConexion, textoAviso } from '../components/AvisoSinConexion'
import { guardarPendiente, leerPendientes } from './ventasPendientes'

declare const global: { __red?: { isConnected: boolean; isInternetReachable?: boolean } }

const pendiente = (clave: string) => ({
  clave, usuarioId: 'ana', vendidaEn: '2026-10-29T15:00:00.000Z',
  input: { items: [], pagos: [], efectivoRecibido: null },
})

async function montar() {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider><VentasPendientesProvider><AvisoSinConexion /></VentasPendientesProvider></TemaProvider>,
    )
  })
  for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)) })
  return arbol
}
const texto = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root.findAllByType(Text).map((t: renderer.ReactTestInstance) => String(t.props.children)).join(' | ')

beforeEach(async () => {
  await AsyncStorage.clear()
  jest.clearAllMocks()
  delete global.__red
})

describe('aviso de arriba', () => {
  it('dice lo que pasa', () => {
    expect(textoAviso(false, false, 0, 0)).toBeNull()
    expect(textoAviso(true, false, 0, 0)).toBe('Sin conexión')
    expect(textoAviso(true, false, 2, 0)).toBe('Sin conexión · 2 ventas por mandar')
    expect(textoAviso(false, false, 1, 1)).toBe('1 venta por mandar · 1 venta con error')
    expect(textoAviso(false, true, 3, 0)).toBe('Mandando ventas…')
  })

  it('el resumen del envío junta lo mandado, lo rechazado y los avisos', () => {
    expect(resumenEnvio({ enviadas: 0, rechazadas: 0, avisos: [], sinConexion: true })).toBeNull()
    expect(resumenEnvio({ enviadas: 2, rechazadas: 0, avisos: ['Venta #7: Faltaba stock'], sinConexion: false })).toEqual({
      titulo: 'Ventas enviadas',
      mensaje: 'Se mandaron 2 ventas hechas sin conexión.\n\nVenta #7: Faltaba stock',
    })
    expect(resumenEnvio({ enviadas: 0, rechazadas: 1, avisos: [], sinConexion: false })?.mensaje).toMatch(/revísala en Movimientos/)
  })

  it('sin conexión muestra cuántas faltan y no intenta mandarlas', async () => {
    global.__red = { isConnected: false }
    await guardarPendiente(pendiente('k1'))
    const arbol = await montar()
    expect(texto(arbol)).toContain('Sin conexión · 1 venta por mandar')
    expect(mockEnviar).not.toHaveBeenCalled()
    act(() => arbol.unmount())
  })

  it('con conexión las manda solas y avisa lo que dijo la base', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockEnviar.mockResolvedValue({ numero: 7, repetida: false, avisos: ['La caja del 28/10/2026 ya estaba cerrada'] })
    await guardarPendiente(pendiente('k1'))
    const arbol = await montar()
    expect(mockEnviar).toHaveBeenCalledWith(expect.anything(), 'k1', { vendidaEn: '2026-10-29T15:00:00.000Z' })
    expect(await leerPendientes()).toEqual([])
    expect(alerta).toHaveBeenCalledWith('Ventas enviadas', expect.stringContaining('Venta #7: La caja del 28/10/2026 ya estaba cerrada'))
    expect(arbol.toJSON()).toBeNull()
    act(() => arbol.unmount())
    alerta.mockRestore()
  })
})
