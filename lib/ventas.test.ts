const mockRpc = jest.fn()
// supabase.rpc(...).abortSignal(señal) → la respuesta de mockRpc.
jest.mock('./supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => ({ abortSignal: () => mockRpc(...args) }) },
}))

import { registrarVenta, type RegistrarVentaInput } from './ventas'
import { SinConexionError } from './conexion'

const VENTA: RegistrarVentaInput = {
  items: [{
    producto: { tipo: 'calzado', id: 'z1', titulo: 'Bota', detalle: '', precio: 100000, stock: 3 },
    cantidad: 1, precio: 90000, subtotal: 90000,
  }],
  pagos: [{ metodo: 'efectivo', monto: 90000 }],
  efectivoRecibido: 100000,
}

beforeEach(() => mockRpc.mockReset())

describe('registrarVenta', () => {
  it('manda la clave del intento al servidor', async () => {
    mockRpc.mockResolvedValue({ data: { venta_id: 'v1', numero: 7, repetida: false }, error: null })
    await expect(registrarVenta(VENTA, 'clave-1')).resolves.toEqual({ numero: 7, repetida: false, avisos: [] })
    expect(mockRpc).toHaveBeenCalledWith('registrar_venta', expect.objectContaining({
      p_clave_idempotencia: 'clave-1',
    }))
    expect(mockRpc.mock.calls[0][1].p_vendida_en).toBeUndefined()
  })

  it('una venta hecha sin conexión manda su hora y devuelve los avisos', async () => {
    mockRpc.mockResolvedValue({ data: { venta_id: 'v1', numero: 9, repetida: false, avisos: ['Faltaba stock de Bota'] }, error: null })
    await expect(registrarVenta(VENTA, 'clave-4', { vendidaEn: '2026-10-29T15:00:00.000Z' }))
      .resolves.toEqual({ numero: 9, repetida: false, avisos: ['Faltaba stock de Bota'] })
    expect(mockRpc.mock.calls[0][1].p_vendida_en).toBe('2026-10-29T15:00:00.000Z')
  })

  it.each([
    ['sin señal', { data: null, error: { message: 'TypeError: Network request failed' } }],
    ['tiempo agotado', { data: null, error: { message: 'AbortError: Aborted' } }],
  ])('un fallo de red (%s) es SinConexionError y avisa que reintentar no duplica', async (_, respuesta) => {
    mockRpc.mockResolvedValue(respuesta)
    const error = await registrarVenta(VENTA, 'clave-1').catch((e) => e)
    expect(error).toBeInstanceOf(SinConexionError)
    expect(error.message).toMatch(/no se duplicará/)
  })

  it('si el pedido mismo falla (sin red) también es SinConexionError', async () => {
    mockRpc.mockRejectedValue(new TypeError('Network request failed'))
    await expect(registrarVenta(VENTA, 'clave-1')).rejects.toBeInstanceOf(SinConexionError)
  })

  it('manda la cédula o razón social del cliente (B4); sin ella va undefined', async () => {
    mockRpc.mockResolvedValue({ data: { venta_id: 'v1', numero: 8, repetida: false }, error: null })
    await registrarVenta({ ...VENTA, cliente: { nombre: 'Luz', documento: '1117123456' } }, 'clave-2')
    expect(mockRpc).toHaveBeenLastCalledWith('registrar_venta', expect.objectContaining({
      p_cliente_nombre: 'Luz',
      p_cliente_documento: '1117123456',
    }))
    await registrarVenta(VENTA, 'clave-3')
    expect(mockRpc.mock.calls[1][1].p_cliente_documento).toBeUndefined()
  })

  it('un reintento que ya se había guardado vuelve como repetida', async () => {
    mockRpc.mockResolvedValue({ data: { venta_id: 'v1', numero: 7, repetida: true }, error: null })
    await expect(registrarVenta(VENTA, 'clave-1')).resolves.toEqual({ numero: 7, repetida: true, avisos: [] })
  })

  it.each([
    ['caja cerrada', 'La caja de hoy no está abierta. Ábrela (o reábrela) para registrar ventas.', /caja está cerrada/],
    ['precio fuera del rango: deja el mensaje del servidor', 'El precio de Bota debe estar entre $80.000 y $100.000. Ajusta el carrito.', /entre \$80\.000 y \$100\.000/],
  ])('traduce el error: %s', async (_, mensaje, esperado) => {
    mockRpc.mockResolvedValue({ data: null, error: { message: mensaje } })
    await expect(registrarVenta(VENTA, 'clave-1')).rejects.toThrow(esperado)
  })
})
