process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'

jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))

import { supabase } from './supabase'
import {
  listarVentasPeriodo,
  obtenerVentaDetalle,
  listarDevoluciones,
  obtenerDevolucionDetalle,
  badgeEstadoVenta,
  badgeTipoDevolucion,
  horaCorta,
} from './movimientos'

const from = supabase.from as jest.Mock

// Builder encadenable: todos los métodos retornan el builder y await resuelve `resultado`.
function crearBuilder(resultado: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'gte', 'lte', 'eq', 'order', 'maybeSingle', 'in']) {
    b[m] = jest.fn(() => b)
  }
  ;(b as { then?: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(res, rej)
  return b as Record<string, jest.Mock> & PromiseLike<unknown>
}

describe('badges puros', () => {
  it('badgeEstadoVenta mapea estados a texto/tipo', () => {
    expect(badgeEstadoVenta('completada')).toEqual({ texto: 'COMPLETADA', tipo: 'exito' })
    expect(badgeEstadoVenta('cancelada')).toEqual({ texto: 'CANCELADA', tipo: 'peligro' })
    expect(badgeEstadoVenta('devuelta_parcial')).toEqual({ texto: 'DEV. PARCIAL', tipo: 'advertencia' })
    expect(badgeEstadoVenta('cambiada_total')).toEqual({ texto: 'CAMBIO', tipo: 'neutro' })
  })

  it('badgeTipoDevolucion mapea tipos', () => {
    expect(badgeTipoDevolucion('total')).toEqual({ texto: 'TOTAL', tipo: 'peligro' })
    expect(badgeTipoDevolucion('parcial')).toEqual({ texto: 'PARCIAL', tipo: 'advertencia' })
    expect(badgeTipoDevolucion('cambio')).toEqual({ texto: 'CAMBIO', tipo: 'neutro' })
  })

  it('horaCorta usa hora de Bogotá', () => {
    expect(horaCorta('2026-07-15T19:14:00.000Z')).toMatch(/2:14/)
  })
})

describe('listarVentasPeriodo', () => {
  it('filtra por rango Bogotá y mapea métodos', async () => {
    const builder = crearBuilder({
      data: [
        {
          id: 'v1',
          numero: 102,
          total: 195000,
          estado: 'completada',
          created_at: '2026-07-15T19:14:00.000Z',
          metodos_pago_venta: [{ metodo: 'efectivo' }, { metodo: 'nequi' }],
        },
      ],
      error: null,
    })
    from.mockReturnValue(builder)

    const res = await listarVentasPeriodo('2026-07-09', '2026-07-15')

    expect(from).toHaveBeenCalledWith('ventas')
    expect(builder.gte).toHaveBeenCalledWith('created_at', '2026-07-09T00:00:00-05:00')
    expect(builder.lte).toHaveBeenCalledWith('created_at', '2026-07-15T23:59:59.999-05:00')
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ id: 'v1', numero: 102, total: 195000, estado: 'completada' })
    expect(res[0].metodos).toEqual(['efectivo', 'nequi'])
  })
})

describe('obtenerVentaDetalle', () => {
  it('mapea items, pagos, cliente y vendedor; null si no existe', async () => {
    const fila = {
      id: 'v1',
      numero: 102,
      total: 195000,
      estado: 'completada',
      created_at: '2026-07-15T19:14:00.000Z',
      cliente_nombre: 'Ana',
      cliente_apellido: 'Torres',
      cliente_telefono: '3001234567',
      nota: 'cliente pidió factura',
      efectivo_recibido: 200000,
      cambio: 5000,
      saldo_pendiente: 0,
      corregida: false,
      correccion_motivo: null,
      venta_items: [
        {
          descripcion_snapshot: 'Nike Air Max',
          talla: '40',
          color: 'Negro',
          cantidad: 1,
          precio_unitario: 180000,
          subtotal: 180000,
        },
      ],
      metodos_pago_venta: [{ metodo: 'efectivo', monto: 195000 }],
      vendedor: { nombre: 'Camilo Artunduaga' },
    }
    from.mockReturnValue(crearBuilder({ data: fila, error: null }))

    const detalle = await obtenerVentaDetalle('v1')
    expect(detalle).not.toBeNull()
    expect(detalle!.cliente).toEqual({ nombre: 'Ana', apellido: 'Torres', telefono: '3001234567' })
    expect(detalle!.vendedor).toBe('Camilo Artunduaga')
    expect(detalle!.items[0]).toMatchObject({ descripcion: 'Nike Air Max', talla: '40', color: 'Negro' })
    expect(detalle!.pagos).toEqual([{ metodo: 'efectivo', monto: 195000 }])

    from.mockReturnValue(crearBuilder({ data: null, error: null }))
    expect(await obtenerVentaDetalle('nope')).toBeNull()
  })
})

describe('listarDevoluciones', () => {
  it('mapea número de la venta original y montos', async () => {
    const builder = crearBuilder({
      data: [
        {
          id: 'd1',
          tipo_devolucion: 'parcial',
          monto_devuelto: 85000,
          monto_cobrado: 0,
          created_at: '2026-07-15T19:40:00.000Z',
          venta: { numero: 102 },
          venta_id: 'v1',
        },
      ],
      error: null,
    })
    from.mockReturnValue(builder)

    const res = await listarDevoluciones('2026-07-15', '2026-07-15')
    expect(from).toHaveBeenCalledWith('devoluciones')
    expect(builder.gte).toHaveBeenCalledWith('created_at', '2026-07-15T00:00:00-05:00')
    expect(res[0]).toMatchObject({ id: 'd1', numero_venta: 102, tipo: 'parcial', monto_devuelto: 85000 })
  })
})

describe('obtenerDevolucionDetalle', () => {
  it('mapea items con snapshot de la venta', async () => {
    const fila = {
      id: 'd1',
      tipo_devolucion: 'cambio',
      monto_devuelto: 0,
      monto_cobrado: 12000,
      motivo: 'talla equivocada',
      metodo_reembolso: null,
      metodo_cobro: 'efectivo',
      created_at: '2026-07-15T19:40:00.000Z',
      venta_id: 'v1',
      venta: { numero: 98 },
      devolucion_items: [
        {
          cantidad: 1,
          venta_item: { descripcion_snapshot: 'Adidas VL Court', talla: '39', color: 'Blanco' },
        },
      ],
    }
    from.mockReturnValue(crearBuilder({ data: fila, error: null }))

    const det = await obtenerDevolucionDetalle('d1')
    expect(det!.numero_venta).toBe(98)
    expect(det!.metodo_cobro).toBe('efectivo')
    expect(det!.items[0]).toEqual({ descripcion: 'Adidas VL Court', talla: '39', color: 'Blanco', cantidad: 1 })
  })
})
