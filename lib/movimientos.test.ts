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
  estadoProducto,
  detalleProducto,
  etiquetaDia,
  agruparPorDia,
  analizarConsulta,
  buscarProductos,
  buscarDevoluciones,
  segmentos,
} from './movimientos'
import type { DevolucionListado, ProductoVendido, ResultadoProducto, VentaListado } from './movimientos'

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
    expect(detalle!.cliente).toEqual({ nombre: 'Ana', apellido: 'Torres', telefono: '3001234567', documento: null })
    expect(detalle!.vendedor).toBe('Camilo Artunduaga')
    expect(detalle!.items[0]).toMatchObject({ descripcion: 'Nike Air Max', talla: '40', color: 'Negro' })
    expect(detalle!.pagos).toEqual([{ metodo: 'efectivo', monto: 195000 }])

    from.mockReturnValue(crearBuilder({ data: null, error: null }))
    expect(await obtenerVentaDetalle('nope')).toBeNull()
  })

  it('cédula o razón social: se mapea, y basta sola para mostrar al cliente', async () => {
    const base = {
      id: 'v2', numero: 103, total: 50000, estado: 'completada', created_at: '2026-07-15T19:14:00.000Z',
      cliente_apellido: null, cliente_telefono: null, venta_items: [], metodos_pago_venta: [], vendedor: null,
    }
    from.mockReturnValue(crearBuilder({ data: { ...base, cliente_nombre: 'Ana', cliente_documento: '900123456-7' }, error: null }))
    expect((await obtenerVentaDetalle('v2'))!.cliente).toMatchObject({ nombre: 'Ana', documento: '900123456-7' })
    from.mockReturnValue(crearBuilder({ data: { ...base, cliente_nombre: null, cliente_documento: 'Ferretería El Sol SAS' }, error: null }))
    expect((await obtenerVentaDetalle('v2'))!.cliente).toMatchObject({ nombre: null, documento: 'Ferretería El Sol SAS' })
    from.mockReturnValue(crearBuilder({ data: { ...base, cliente_nombre: null, cliente_documento: null }, error: null }))
    expect((await obtenerVentaDetalle('v2'))!.cliente).toBeNull()
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

describe('lista por producto', () => {
  it('listarVentasPeriodo trae cada producto con lo ya devuelto y si fue cambio', async () => {
    from.mockReturnValue(crearBuilder({
      data: [{
        id: 'v1', numero: 1041, total: 150000, estado: 'devuelta_parcial', created_at: '2026-10-17T21:12:00.000Z',
        nota: null, cliente_nombre: 'María', cliente_apellido: 'Rojas', cliente_documento: '1117512345', cliente_telefono: null,
        metodos_pago_venta: [{ metodo: 'efectivo' }],
        venta_items: [
          { id: 'i1', tipo_producto: 'calzado', descripcion_snapshot: 'Escolar Croydon', talla: '34', color: 'Negro',
            cantidad: 2, precio_unitario: 60000, devolucion_items: [{ cantidad: 1, devolucion: { tipo_devolucion: 'cambio' } }] },
          { id: 'i2', tipo_producto: 'varios', descripcion_snapshot: 'Concentrado', talla: null, color: null,
            cantidad: 1, precio_unitario: 30000, devolucion_items: [] },
        ],
      }],
      error: null,
    }))
    const [v] = await listarVentasPeriodo('2026-10-17', '2026-10-17')
    expect(v.dia).toBe('2026-10-17')
    expect(v.cliente).toEqual({ nombre: 'María', apellido: 'Rojas', documento: '1117512345', telefono: null })
    expect(v.items[0]).toMatchObject({ id: 'i1', esGranja: false, cantidad: 2, precio: 60000, devuelto: 1, cambiado: true })
    expect(v.items[1]).toMatchObject({ esGranja: true, devuelto: 0, cambiado: false })
  })

  const prod = (p: Partial<ProductoVendido> = {}): ProductoVendido => ({
    id: 'i', descripcion: 'Tennis Nike', talla: '38', color: 'Blanco y negro', esGranja: false,
    cantidad: 1, precio: 185000, devuelto: 0, cambiado: false, ...p,
  })

  it('estadoProducto: precio si no pasó nada; DEVUELTO, CAMBIADO, parciales o CANCELADA', () => {
    expect(estadoProducto('completada', prod())).toBeNull()
    expect(estadoProducto('devuelta_total', prod({ devuelto: 1 }))).toEqual({ texto: 'DEVUELTO', tipo: 'peligro' })
    expect(estadoProducto('cambiada_total', prod({ devuelto: 1, cambiado: true }))).toEqual({ texto: 'CAMBIADO', tipo: 'neutro' })
    expect(estadoProducto('devuelta_parcial', prod({ cantidad: 2, devuelto: 1 }))).toEqual({ texto: 'DEV. PARCIAL', tipo: 'advertencia' })
    expect(estadoProducto('cambiada_parcial', prod({ cantidad: 2, devuelto: 1, cambiado: true }))).toEqual({ texto: 'CAMBIO PARCIAL', tipo: 'advertencia' })
    expect(estadoProducto('cancelada', prod())).toEqual({ texto: 'CANCELADA', tipo: 'peligro' })
  })

  it('detalleProducto: talla y color, o Granja', () => {
    expect(detalleProducto(prod())).toBe('T38 · Blanco y negro')
    expect(detalleProducto(prod({ esGranja: true }))).toBe('Granja')
    expect(detalleProducto(prod({ talla: null, color: 'Café' }))).toBe('Café')
  })
})

describe('agrupado por día', () => {
  // Sábado 17 de octubre de 2026: la semana empieza el lunes 12.
  const HOY = '2026-10-17'

  it('etiquetaDia: Hoy, Ayer, Antier, día de esta semana o fecha completa', () => {
    expect(etiquetaDia('2026-10-17', HOY)).toBe('Hoy')
    expect(etiquetaDia('2026-10-16', HOY)).toBe('Ayer')
    expect(etiquetaDia('2026-10-15', HOY)).toBe('Antier')
    expect(etiquetaDia('2026-10-14', HOY)).toBe('Miércoles')
    expect(etiquetaDia('2026-10-12', HOY)).toBe('Lunes')
    expect(etiquetaDia('2026-10-11', HOY)).toBe('Domingo 11 de octubre de 2026')
    expect(etiquetaDia('2026-10-08', HOY)).toBe('Jueves 8 de octubre de 2026')
  })

  it('el lunes, antier ya es de la semana pasada pero sigue diciendo Antier', () => {
    expect(etiquetaDia('2026-10-17', '2026-10-19')).toBe('Antier')
    expect(etiquetaDia('2026-10-16', '2026-10-19')).toBe('Viernes 16 de octubre de 2026')
  })

  it('agruparPorDia: del más reciente al más viejo, conservando el orden de cada día', () => {
    const xs = [{ d: '2026-10-17', n: 1 }, { d: '2026-10-15', n: 2 }, { d: '2026-10-17', n: 3 }, { d: '2026-10-16', n: 4 }]
    expect(agruparPorDia(xs, (x) => x.d)).toEqual([
      { dia: '2026-10-17', xs: [xs[0], xs[2]] },
      { dia: '2026-10-16', xs: [xs[3]] },
      { dia: '2026-10-15', xs: [xs[1]] },
    ])
  })
})

describe('buscador', () => {
  const venta = (v: Partial<VentaListado>): VentaListado => ({
    id: 'v', numero: 1041, total: 185000, estado: 'completada', hora: '4:12 p. m.', dia: '2026-10-17', metodos: [],
    nota: null, cliente: null, items: [], ...v,
  })
  const item = (id: string, descripcion: string, talla: string | null, color: string | null): ProductoVendido => ({
    id, descripcion, talla, color, esGranja: false, cantidad: 1, precio: 100000, devuelto: 0, cambiado: false,
  })
  const VENTAS = [
    venta({
      id: 'a', numero: 1041, total: 185000,
      cliente: { nombre: 'María', apellido: 'Rojas', documento: '1117512345', telefono: '3104445566' },
      items: [item('a1', 'Bota Brahma Trabajo', '41', 'Café'), item('a2', 'Tennis Nike Air', '38', 'Negro')],
    }),
    venta({ id: 'b', numero: 1035, total: 120000, nota: 'cliente pidió bolsa', items: [item('b1', 'Escolar Croydon', '34', 'Negro')] }),
  ]
  const ids = (r: ResultadoProducto[]) => r.map((x) => x.producto.id)

  it('analizarConsulta: dígitos (con #, puntos o $) o palabras sin tildes', () => {
    expect(analizarConsulta('#1041')).toEqual({ digitos: '1041', palabras: [] })
    expect(analizarConsulta('$185.000')).toEqual({ digitos: '185000', palabras: [] })
    expect(analizarConsulta('María  brahma')).toEqual({ digitos: null, palabras: ['maria', 'brahma'] })
  })

  it('por zapato y talla: todas las palabras deben coincidir', () => {
    expect(ids(buscarProductos(VENTAS, analizarConsulta('brahma 41')))).toEqual(['a1'])
    expect(ids(buscarProductos(VENTAS, analizarConsulta('negro')))).toEqual(['a2', 'b1'])
  })

  it('por cliente sin tildes: todos los productos de esa venta, con el nombre de por qué', () => {
    const r = buscarProductos(VENTAS, analizarConsulta('maria'))
    expect(ids(r)).toEqual(['a1', 'a2'])
    expect(r[0].extra).toEqual([{ texto: 'María Rojas', marcas: ['maria'] }])
  })

  it('por número de venta, monto exacto, cédula o teléfono', () => {
    expect(ids(buscarProductos(VENTAS, analizarConsulta('1035')))).toEqual(['b1'])
    expect(ids(buscarProductos(VENTAS, analizarConsulta('185.000')))).toEqual(['a1', 'a2'])
    expect(buscarProductos(VENTAS, analizarConsulta('1117512'))[0].extra[0].texto).toBe('María Rojas · CC 1117512345')
    expect(ids(buscarProductos(VENTAS, analizarConsulta('4445566')))).toEqual(['a1', 'a2'])
  })

  it('por la nota de la venta', () => {
    const r = buscarProductos(VENTAS, analizarConsulta('bolsa'))
    expect(ids(r)).toEqual(['b1'])
    expect(r[0].extra[0].texto).toBe('cliente pidió bolsa')
  })

  it('devoluciones: por motivo, número de venta o zapato; lo que coincidió va primero', () => {
    const dev = (d: Partial<DevolucionListado>): DevolucionListado => ({
      id: 'd', venta_id: 'v', numero_venta: 1035, tipo: 'parcial', monto_devuelto: 0, monto_cobrado: 0,
      hora: '', fecha: '', dia: '2026-10-17', motivo: null, cliente: null, productos: [], ...d,
    })
    const DEVS = [
      dev({ id: 'd1', numero_venta: 1035, motivo: 'Se despegó la suela', productos: [{ descripcion: 'Bota Brahma', talla: '41', color: 'Café' }] }),
      dev({ id: 'd2', numero_venta: 1020, motivo: 'Le quedó grande', productos: [{ descripcion: 'Chancla Ipanema', talla: '37', color: 'Azul' }] }),
    ]
    expect(buscarDevoluciones(DEVS, analizarConsulta('suela')).map((r) => r.devolucion.id)).toEqual(['d1'])
    expect(buscarDevoluciones(DEVS, analizarConsulta('1020')).map((r) => r.devolucion.id)).toEqual(['d2'])
    const r = buscarDevoluciones(DEVS, analizarConsulta('ipanema'))
    expect(r[0].piezas[0].texto).toBe('Chancla Ipanema 37 Azul')
  })

  it('segmentos: marca lo buscado sin importar tildes ni mayúsculas', () => {
    expect(segmentos('Tennis Nike Árbol', ['nike', 'arbol'])).toEqual([
      { texto: 'Tennis ', resaltado: false },
      { texto: 'Nike', resaltado: true },
      { texto: ' ', resaltado: false },
      { texto: 'Árbol', resaltado: true },
    ])
    expect(segmentos('Sin marcas', [])).toEqual([{ texto: 'Sin marcas', resaltado: false }])
  })
})
