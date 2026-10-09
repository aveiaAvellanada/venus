const mockRpc = jest.fn()
jest.mock('./supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}))

import { registrarVenta, type RegistrarVentaInput } from './ventas'

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
    await expect(registrarVenta(VENTA, 'clave-1')).resolves.toEqual({ numero: 7, repetida: false })
    expect(mockRpc).toHaveBeenCalledWith('registrar_venta', expect.objectContaining({
      p_clave_idempotencia: 'clave-1',
    }))
  })

  it('un reintento que ya se había guardado vuelve como repetida', async () => {
    mockRpc.mockResolvedValue({ data: { venta_id: 'v1', numero: 7, repetida: true }, error: null })
    await expect(registrarVenta(VENTA, 'clave-1')).resolves.toEqual({ numero: 7, repetida: true })
  })

  it.each([
    ['sin señal: avisa que reintentar no duplica', 'TypeError: Network request failed', /no se duplicará/],
    ['caja cerrada', 'La caja de hoy no está abierta. Ábrela (o reábrela) para registrar ventas.', /caja está cerrada/],
    ['precio fuera del rango: deja el mensaje del servidor', 'El precio de Bota debe estar entre $80.000 y $100.000. Ajusta el carrito.', /entre \$80\.000 y \$100\.000/],
  ])('traduce el error: %s', async (_, mensaje, esperado) => {
    mockRpc.mockResolvedValue({ data: null, error: { message: mensaje } })
    await expect(registrarVenta(VENTA, 'clave-1')).rejects.toThrow(esperado)
  })
})
