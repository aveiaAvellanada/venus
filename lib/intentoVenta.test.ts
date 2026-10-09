import { firmaVenta, generarClave, intentoVenta } from './intentoVenta'
import type { RegistrarVentaInput } from './ventas'

const ZAPATO = {
  tipo: 'calzado' as const, id: 'z1', titulo: 'Bota', detalle: 'Talla 38', precio: 100000, stock: 3,
  precioMin: 80000, precioMax: 100000,
}

function venta(cambios: Partial<RegistrarVentaInput> = {}): RegistrarVentaInput {
  return {
    items: [{ producto: ZAPATO, cantidad: 1, precio: 90000, subtotal: 90000 }],
    pagos: [{ metodo: 'efectivo', monto: 90000 }],
    efectivoRecibido: 100000,
    cliente: { nombre: 'Ana' },
    ...cambios,
  }
}

let n = 0
const claveFija = () => `clave-${++n}`

describe('intentoVenta', () => {
  it('sin intento previo genera una clave nueva', () => {
    expect(intentoVenta(null, venta(), claveFija).clave).toMatch(/^clave-/)
  })

  it('reintentar la misma venta reusa la clave', () => {
    const primero = intentoVenta(null, venta(), claveFija)
    expect(intentoVenta(primero, venta(), claveFija)).toBe(primero)
  })

  it.each([
    ['el precio', venta({ items: [{ producto: ZAPATO, cantidad: 1, precio: 95000, subtotal: 95000 }] })],
    ['la cantidad', venta({ items: [{ producto: ZAPATO, cantidad: 2, precio: 90000, subtotal: 180000 }] })],
    ['los pagos', venta({ pagos: [{ metodo: 'nequi', monto: 90000 }], efectivoRecibido: null })],
    ['el efectivo recibido', venta({ efectivoRecibido: 90000 })],
    ['el cliente', venta({ cliente: { nombre: 'Luis' } })],
  ])('si cambia %s es otra venta: clave nueva', (_, cambiada) => {
    const primero = intentoVenta(null, venta(), claveFija)
    const segundo = intentoVenta(primero, cambiada, claveFija)
    expect(segundo.clave).not.toBe(primero.clave)
    expect(segundo.firma).not.toBe(primero.firma)
  })

  it('la firma es estable para el mismo contenido', () => {
    expect(firmaVenta(venta())).toBe(firmaVenta(venta()))
  })
})

describe('generarClave', () => {
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it('genera UUID v4 distintos aunque no exista crypto.randomUUID (Hermes)', () => {
    const original = (globalThis as { crypto?: unknown }).crypto
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    try {
      const a = generarClave()
      const b = generarClave()
      expect(a).toMatch(uuidV4)
      expect(b).toMatch(uuidV4)
      expect(a).not.toBe(b)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true })
    }
  })
})
