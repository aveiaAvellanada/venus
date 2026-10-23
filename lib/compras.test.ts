process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'

jest.mock('./supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }))
jest.mock('./imagenes', () => ({ comprimirBajoLimite: jest.fn(), comprimirYSubirImagen: jest.fn() }))
jest.mock('./storage', () => ({ bytesDesdeUriLocal: jest.fn() }))

import { supabase } from './supabase'
import {
  agruparItems, claveRefColor, erroresLlegada, estadoCompra, fechaDelNegocio, fijarFotos, filaVacia, filtrarCompras,
  itemsLlegada, registrarCompra, registrarLlegada, textoTallas, type CompraListado, type Factura, type FilaFactura,
} from './compras'

const fila = (o: Partial<FilaFactura>): FilaFactura => ({ ...filaVacia('f1'), ...o })
const factura = (filas: FilaFactura[], o: Partial<Factura> = {}): Factura => ({
  proveedorId: 'p1', numeroFactura: '', fechaFactura: '2026-10-22', condicion: 'contado', fechaVencimiento: '', notas: '', filas, ...o,
})
const existentes = {
  '38': { id: 'a38', precio_minimo: 80000, precio_maximo: 100000 },
  '39': { id: 'a39', precio_minimo: 80000, precio_maximo: 100000 },
}

describe('llegada física (sin costos)', () => {
  it('solo manda tallas que ya existen, con su producto', () => {
    const f = factura([fila({ referencia: 'TA-1', color: 'negro', descripcion: 'Tennis', existentes, cantidades: { '38': '2', '39': '1' } })])
    expect(itemsLlegada(f)).toEqual([
      { producto_calzado_id: 'a38', descripcion: 'Tennis', referencia: 'TA-1', color: 'Negro', talla: '38', cantidad: 2 },
      { producto_calzado_id: 'a39', descripcion: 'Tennis', referencia: 'TA-1', color: 'Negro', talla: '39', cantidad: 1 },
    ])
    expect(erroresLlegada(f)).toEqual([])
  })

  it('una referencia o talla que no existe es un error, igual que sin proveedor', () => {
    const f = factura([
      fila({ id: 'a', referencia: 'TA-1', color: 'Negro', existentes, cantidades: { '40': '1' } }),
      fila({ id: 'b', referencia: 'NV-9', color: 'Azul', cantidades: { '38': '2' } }),
    ], { proveedorId: '' })
    expect(erroresLlegada(f)).toEqual([
      'Elige el proveedor.',
      'TA-1 Negro: la talla 40 no existe en el inventario.',
      'NV-9 Azul no está en el inventario. Pide a quien maneja costos que la registre.',
    ])
  })

  it('sin cantidades no se puede guardar', () => {
    expect(erroresLlegada(factura([]))).toContain('Escribe la cantidad de al menos una talla.')
  })
})

describe('compra completa', () => {
  it('se guarda con registrar_compra y la clave del intento', async () => {
    ;(supabase.rpc as jest.Mock).mockResolvedValue({ data: { compra_id: 'c1', repetida: false }, error: null })
    const f = factura([fila({ referencia: 'TA-1', color: 'Negro', existentes, cantidades: { '38': '2' },
      rangos: [{ desde: '20', hasta: '45', costo: '50.000', minimo: '80.000', maximo: '100.000' }] })])
    expect(await registrarCompra(f, 'clave-1')).toEqual({ compra_id: 'c1', repetida: false })
    expect(supabase.rpc).toHaveBeenCalledWith('registrar_compra', {
      p_compra: expect.objectContaining({
        proveedor_id: 'p1', condicion_pago: 'contado',
        items: [{ producto_id: 'a38', talla: '38', cantidad: 2, costo_unitario: 50000, precio_minimo: 80000, precio_maximo: 100000 }],
      }),
      p_clave_idempotencia: 'clave-1',
    })
  })
})

describe('listas y detalle', () => {
  const c = (o: Partial<CompraListado>): CompraListado => ({
    id: 'c', proveedor_id: 'p', proveedor: 'Calzado Andino', estado: 'completada', condicion_pago: 'contado', total: 100000,
    saldo_pendiente: 0, fecha_vencimiento: null, numero_factura: 'FV-1', fecha_factura: '2026-10-20', registrada_por: 'u',
    created_at: '2026-10-20T15:00:00Z', pares: 4, ...o,
  })

  it('reconoce la misma referencia y color sin importar mayúsculas, tildes ni "rojo/blanco"', () => {
    expect(claveRefColor('ta-1', 'rojo/blanco')).toBe(claveRefColor('TA-1', 'Rojo y blanco'))
    expect(claveRefColor('TA-1', 'Café')).toBe(claveRefColor('ta-1 ', 'cafe'))
  })

  it('agrupa los ítems por referencia y color con las tallas en orden', () => {
    const grupos = agruparItems([
      { id: '1', producto_calzado_id: 'x', referencia: 'TA-1', descripcion: 'Tennis', color: 'Negro', talla: '39', cantidad: 1, costo_unitario: 50000, subtotal: 50000 },
      { id: '2', producto_calzado_id: 'y', referencia: 'TA-1', descripcion: 'Tennis', color: 'Negro', talla: '38', cantidad: 2, costo_unitario: 50000, subtotal: 100000 },
      { id: '3', producto_calzado_id: 'z', referencia: 'TA-1', descripcion: 'Tennis', color: 'Azul', talla: '40', cantidad: 1, costo_unitario: null, subtotal: null },
    ])
    expect(grupos.map((g) => [g.color, textoTallas(g.tallas), g.pares, g.subtotal])).toEqual([
      ['Negro', '38×2 · 39×1', 3, 150000],
      ['Azul', '40×1', 1, null],
    ])
  })

  it('filtra por pagar, pendientes y por texto', () => {
    const compras = [
      c({ id: '1' }),
      c({ id: '2', condicion_pago: 'credito', saldo_pendiente: 60000, proveedor: 'Botas del Sur', numero_factura: 'FV-77' }),
      c({ id: '3', estado: 'pendiente_revision', total: null, condicion_pago: null }),
    ]
    expect(filtrarCompras(compras, 'por_pagar', '').map((x) => x.id)).toEqual(['2'])
    expect(filtrarCompras(compras, 'pendientes', '').map((x) => x.id)).toEqual(['3'])
    expect(filtrarCompras(compras, 'todas', 'fv-77').map((x) => x.id)).toEqual(['2'])
    expect(filtrarCompras(compras, 'todas', 'botas sur')).toEqual([])
  })

  it('estado de cada compra para su insignia', () => {
    const hoy = '2026-10-22'
    expect(estadoCompra(c({ estado: 'pendiente_revision' }), hoy).texto).toBe('PENDIENTE DE COSTOS')
    expect(estadoCompra(c({ condicion_pago: 'credito', saldo_pendiente: 1, fecha_vencimiento: '2026-10-20' }), hoy))
      .toEqual({ texto: 'VENCIDA HACE 2 D', tipo: 'peligro' })
    expect(estadoCompra(c({ condicion_pago: 'credito', saldo_pendiente: 1, fecha_vencimiento: '2026-10-25' }), hoy).texto).toBe('VENCE EN 3 D')
    expect(estadoCompra(c({ condicion_pago: 'credito', saldo_pendiente: 0 }), hoy).texto).toBe('PAGADA')
    expect(estadoCompra(c({}), hoy).texto).toBe('CONTADO')
  })
})

// Cadena de llamadas de supabase-js que termina en una promesa con `resultado`.
function cadena(resultado: unknown) {
  const c: Record<string, unknown> = {}
  for (const m of ['insert', 'select', 'eq', 'in', 'update', 'delete']) c[m] = jest.fn(() => c)
  c.then = (ok: (v: unknown) => unknown, mal?: (e: unknown) => unknown) => Promise.resolve(resultado).then(ok, mal)
  return c
}

describe('reintentos y fotos', () => {
  const items = [{ producto_calzado_id: 'a38', descripcion: 'Tennis', referencia: 'TA-1', color: 'Negro', talla: '38', cantidad: 2 }]

  it('la llegada usa la clave como id: un reintento de algo ya guardado no inserta otra vez', async () => {
    const compras = cadena({ error: { code: '23505', message: 'duplicate key' } })
    const conteo = cadena({ count: 1, error: null })
    ;(supabase.from as jest.Mock).mockImplementation((t: string) => (t === 'compras' ? compras : conteo))
    expect(await registrarLlegada('p1', 'u1', items, 'clave-1')).toEqual({ compra_id: 'clave-1', repetida: true })
    expect((compras.insert as jest.Mock).mock.calls[0][0]).toMatchObject({ id: 'clave-1', estado: 'pendiente_revision' })
    expect(conteo.insert).not.toHaveBeenCalled()
  })

  it('si el intento anterior guardó la compra pero no sus ítems, el reintento los agrega', async () => {
    const compras = cadena({ error: { code: '23505', message: 'duplicate key' } })
    const itemsTabla = cadena({ count: 0, error: null })
    ;(supabase.from as jest.Mock).mockImplementation((t: string) => (t === 'compras' ? compras : itemsTabla))
    expect(await registrarLlegada('p1', 'u1', items, 'clave-1')).toEqual({ compra_id: 'clave-1', repetida: true })
    expect((itemsTabla.insert as jest.Mock).mock.calls[0][0]).toEqual([
      expect.objectContaining({ compra_id: 'clave-1', producto_calzado_id: 'a38', costo_unitario: null }),
    ])
  })

  it('una foto que la base no dejó guardar (sin permiso de inventario) es un error, no un éxito callado', async () => {
    const itemsTabla = cadena({ data: [{ producto_calzado_id: 'a39', referencia: 'TA-1', descripcion: 'Tennis', color: 'Negro' }], error: null })
    const productos = cadena({ data: [], error: null })
    ;(supabase.from as jest.Mock).mockImplementation((t: string) => (t === 'compra_items' ? itemsTabla : productos))
    const f = factura([fila({ referencia: 'TA-1', color: 'Negro', foto: 'https://f/1.jpg', existentes: { '38': { id: 'a38', precio_minimo: 1, precio_maximo: null } } })])
    await expect(fijarFotos('c1', f)).rejects.toThrow('No tienes permiso')
    expect((productos.in as jest.Mock).mock.calls[0][1].sort()).toEqual(['a38', 'a39'])
  })

  it('la fecha de algo guardado de noche en Colombia es la de ese día, no la de UTC', () => {
    expect(fechaDelNegocio('2026-10-23T01:00:00Z')).toBe('2026-10-22')
  })
})
