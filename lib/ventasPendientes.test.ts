jest.mock('./supabase', () => ({ supabase: {} }))
jest.mock('./ventas', () => ({ registrarVenta: jest.fn() }))

import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  aplicarPendientes, escucharPendientes, guardarPendiente, leerPendientes, mandarPendientes, reintentarPendiente,
  tallaYColor, ventaListadoDePendiente, type VentaPendiente,
} from './ventasPendientes'
import { SinConexionError } from './conexion'
import type { RegistrarVentaInput } from './ventas'

const venta = (clave: string, vendidaEn: string, extra: Partial<VentaPendiente> = {}): VentaPendiente => ({
  clave,
  usuarioId: 'ana',
  vendidaEn,
  input: {
    items: [
      { producto: { tipo: 'calzado', id: 'z1', titulo: 'Bota Luz', detalle: 'Brahma · Talla 38 · Verde', precio: 70000, stock: 2 }, cantidad: 2, precio: 70000, subtotal: 140000 },
      { producto: { tipo: 'varios', id: 'g1', titulo: 'Huevos', detalle: 'libra', precio: 0, stock: 999 }, cantidad: 1.5, precio: 6000, subtotal: 9000 },
    ],
    pagos: [{ metodo: 'efectivo', monto: 149000 }],
    efectivoRecibido: 150000,
  } as RegistrarVentaInput,
  ...extra,
})

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('ventas guardadas en el teléfono', () => {
  it('se guardan una vez por clave y avisan a quien escucha', async () => {
    const oyente = jest.fn()
    const quitar = escucharPendientes(oyente)
    await guardarPendiente(venta('k1', '2026-10-29T15:00:00.000Z'))
    await guardarPendiente(venta('k1', '2026-10-29T15:00:00.000Z'))
    await guardarPendiente(venta('k2', '2026-10-29T15:05:00.000Z'))
    quitar()
    expect((await leerPendientes()).map((v) => v.clave)).toEqual(['k1', 'k2'])
    expect(oyente).toHaveBeenCalledTimes(3)
  })

  it('el stock del teléfono descuenta los zapatos aún sin mandar, sin bajar de 0 (Granja no tiene stock)', () => {
    const productos = [{ id: 'z1', stock_actual: 3 }, { id: 'z2', stock_actual: 1 }]
    const pendientes = [venta('k1', 'a'), venta('k2', 'b')]
    expect(aplicarPendientes(productos, pendientes)).toEqual([{ id: 'z1', stock_actual: 0 }, { id: 'z2', stock_actual: 1 }])
    expect(aplicarPendientes(productos, [])).toBe(productos)
  })

  it('en Movimientos sale por mandar, en su día y hora, con talla y color', () => {
    const v = ventaListadoDePendiente(venta('k1', '2026-10-29T20:15:00.000Z'))
    expect(v).toMatchObject({ id: 'pendiente:k1', numero: 0, estado: 'por_mandar', total: 149000, dia: '2026-10-29', metodos: ['efectivo'] })
    expect(v.items[0]).toMatchObject({ descripcion: 'Bota Luz', talla: '38', color: 'Verde', esGranja: false, cantidad: 2 })
    expect(v.items[1]).toMatchObject({ descripcion: 'Huevos', talla: null, esGranja: true })
    expect(ventaListadoDePendiente(venta('k2', '2026-10-29T20:15:00.000Z', { error: 'No' })).estado).toBe('rechazada')
    expect(tallaYColor('Talla 36')).toEqual({ talla: '36', color: null })
  })
})

describe('mandar las ventas hechas sin conexión', () => {
  it('manda en orden las de esta persona con su clave y su hora, y junta los avisos', async () => {
    await guardarPendiente(venta('k2', '2026-10-29T15:05:00.000Z'))
    await guardarPendiente(venta('k1', '2026-10-29T15:00:00.000Z'))
    await guardarPendiente(venta('kb', '2026-10-29T15:01:00.000Z', { usuarioId: 'beto' }))
    const enviar = jest.fn()
      .mockResolvedValueOnce({ numero: 7, repetida: false, avisos: ['Faltaba stock de Bota Luz'] })
      .mockResolvedValueOnce({ numero: 8, repetida: true, avisos: [] })
    const r = await mandarPendientes('ana', enviar)
    expect(enviar.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      ['k1', { vendidaEn: '2026-10-29T15:00:00.000Z' }],
      ['k2', { vendidaEn: '2026-10-29T15:05:00.000Z' }],
    ])
    expect(r).toEqual({ enviadas: 2, avisos: ['Venta #7: Faltaba stock de Bota Luz'], rechazadas: 0, sinConexion: false })
    // La de otra persona se queda: solo ella puede mandarla.
    expect((await leerPendientes()).map((v) => v.clave)).toEqual(['kb'])
  })

  it('si se cae la red, para y deja el resto para después', async () => {
    await guardarPendiente(venta('k1', '2026-10-29T15:00:00.000Z'))
    await guardarPendiente(venta('k2', '2026-10-29T15:05:00.000Z'))
    const enviar = jest.fn().mockRejectedValue(new SinConexionError('Sin conexión'))
    const r = await mandarPendientes('ana', enviar)
    expect(enviar).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ enviadas: 0, sinConexion: true })
    expect(await leerPendientes()).toHaveLength(2)
  })

  it('un rechazo del servidor queda guardado con su error, no se reenvía solo y se puede reintentar', async () => {
    await guardarPendiente(venta('k1', '2026-10-29T15:00:00.000Z'))
    await guardarPendiente(venta('k2', '2026-10-29T15:05:00.000Z'))
    const enviar = jest.fn()
      .mockRejectedValueOnce(new Error('No tienes permiso para vender.'))
      .mockResolvedValueOnce({ numero: 9, repetida: false, avisos: [] })
    const r = await mandarPendientes('ana', enviar)
    expect(r).toMatchObject({ enviadas: 1, rechazadas: 1 })
    expect(await leerPendientes()).toEqual([expect.objectContaining({ clave: 'k1', error: 'No tienes permiso para vender.' })])
    const otraVez = jest.fn()
    await mandarPendientes('ana', otraVez)
    expect(otraVez).not.toHaveBeenCalled()
    await reintentarPendiente('k1')
    otraVez.mockResolvedValue({ numero: 10, repetida: false, avisos: [] })
    await mandarPendientes('ana', otraVez)
    expect(otraVez).toHaveBeenCalledWith(expect.anything(), 'k1', { vendidaEn: '2026-10-29T15:00:00.000Z' })
    expect(await leerPendientes()).toEqual([])
  })

  it('un envío a la vez: si ya hay uno en curso, se espera ese', async () => {
    await guardarPendiente(venta('k1', '2026-10-29T15:00:00.000Z'))
    let soltar!: (v: unknown) => void
    const enviar = jest.fn(() => new Promise((r) => { soltar = r }))
    const a = mandarPendientes('ana', enviar as never)
    const b = mandarPendientes('ana', enviar as never)
    await new Promise((r) => setTimeout(r, 0))
    soltar({ numero: 1, repetida: false, avisos: [] })
    expect(await a).toBe(await b)
    expect(enviar).toHaveBeenCalledTimes(1)
  })
})
