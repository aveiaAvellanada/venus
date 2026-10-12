import {
  costosPorReferencia, diasHasta, estadoVencimiento, filtrarProveedores, leerPesos, resumirDeudas,
  type CompraResumen, type ItemComprado, type Proveedor,
} from './proveedores'

const HOY = '2026-10-12'
let n = 0
const compra = (o: Partial<CompraResumen>): CompraResumen => ({
  id: `c${++n}`, proveedor_id: 'p1', estado: 'completada', condicion_pago: 'credito', total: 100000,
  monto_pagado: 0, saldo_pendiente: 100000, fecha_vencimiento: null, notas: null, created_at: '2026-10-01T15:00:00Z', ...o,
})
const prov = (o: Partial<Proveedor>): Proveedor => ({
  id: 'p1', nombre: 'Calzado Andino', nit_cedula: '900123', telefono: '3151234567', ciudad: 'Neiva', notas: null, activo: true, ...o,
})

describe('vencimientos', () => {
  it('días hasta una fecha y su estado', () => {
    expect(diasHasta('2026-10-15', HOY)).toBe(3)
    expect(diasHasta('2026-10-10', HOY)).toBe(-2)
    expect(estadoVencimiento('2026-10-11', HOY)).toBe('vencida')
    expect(estadoVencimiento('2026-10-12', HOY)).toBe('pronto')
    expect(estadoVencimiento('2026-10-19', HOY)).toBe('pronto')
    expect(estadoVencimiento('2026-10-20', HOY)).toBe('al_dia')
    expect(estadoVencimiento(null, HOY)).toBe('sin_fecha')
  })
})

describe('resumirDeudas', () => {
  it('suma solo compras completadas a crédito con saldo; vencimiento más cercano y lo vencido', () => {
    const mapa = resumirDeudas([
      compra({ saldo_pendiente: 60000, fecha_vencimiento: '2026-10-30' }),
      compra({ saldo_pendiente: 40000, fecha_vencimiento: '2026-10-05' }),
      compra({ saldo_pendiente: 0, fecha_vencimiento: '2026-10-01' }),
      compra({ condicion_pago: 'contado', saldo_pendiente: 0 }),
      compra({ estado: 'cancelada', saldo_pendiente: 90000 }),
      compra({ proveedor_id: 'p2', saldo_pendiente: 15000 }),
    ], HOY)
    expect(mapa.get('p1')).toEqual({ deuda: 100000, compras: 2, proximoVencimiento: '2026-10-05', vencido: 40000 })
    expect(mapa.get('p2')).toEqual({ deuda: 15000, compras: 1, proximoVencimiento: null, vencido: 0 })
  })
})

describe('filtrarProveedores', () => {
  const lista = [
    prov({ id: 'p1', nombre: 'Calzado Andino' }),
    prov({ id: 'p2', nombre: 'Botas del Sur', ciudad: 'Florencia', nit_cedula: null }),
    prov({ id: 'p3', nombre: 'Árbol Sandalias', telefono: null }),
    prov({ id: 'p4', nombre: 'Viejo SAS', activo: false }),
  ]
  const deudas = resumirDeudas([
    compra({ proveedor_id: 'p2', saldo_pendiente: 300000, fecha_vencimiento: '2026-10-01' }),
    compra({ proveedor_id: 'p1', saldo_pendiente: 50000 }),
  ], HOY)

  it('activos ordenados por deuda y luego por nombre; inactivos aparte', () => {
    expect(filtrarProveedores(lista, deudas, { texto: '', filtro: 'activos' }).map((p) => p.id)).toEqual(['p2', 'p1', 'p3'])
    expect(filtrarProveedores(lista, deudas, { texto: '', filtro: 'inactivos' }).map((p) => p.id)).toEqual(['p4'])
  })
  it('con deuda, vencidos y búsqueda sin tildes por nombre, NIT o ciudad', () => {
    expect(filtrarProveedores(lista, deudas, { texto: '', filtro: 'con_deuda' }).map((p) => p.id)).toEqual(['p2', 'p1'])
    expect(filtrarProveedores(lista, deudas, { texto: '', filtro: 'vencidos' }).map((p) => p.id)).toEqual(['p2'])
    expect(filtrarProveedores(lista, deudas, { texto: 'arbol', filtro: 'activos' }).map((p) => p.id)).toEqual(['p3'])
    expect(filtrarProveedores(lista, deudas, { texto: 'florencia', filtro: 'activos' }).map((p) => p.id)).toEqual(['p2'])
    expect(filtrarProveedores(lista, deudas, { texto: '900123', filtro: 'activos' }).map((p) => p.id)).toEqual(['p1', 'p3'])
  })
  it('sin acceso a deudas, solo por nombre', () => {
    expect(filtrarProveedores(lista, undefined, { texto: '', filtro: 'activos' }).map((p) => p.id)).toEqual(['p3', 'p2', 'p1'])
  })
})

describe('costosPorReferencia', () => {
  const it_ = (o: Partial<ItemComprado>): ItemComprado => ({
    compra_id: 'c1', fecha: '2026-09-01', referencia: 'TR-1', descripcion: 'Tennis Running', color: 'Negro',
    talla: '38', cantidad: 2, costo_unitario: 60000, ...o,
  })
  it('último costo, el de la compra anterior y la variación; agrupa por referencia y color', () => {
    const filas = costosPorReferencia([
      it_({}), it_({ talla: '40' }),
      it_({ compra_id: 'c2', fecha: '2026-10-05', costo_unitario: 66000, talla: '39', cantidad: 3 }),
      it_({ compra_id: 'c2', fecha: '2026-10-05', color: 'Blanco', costo_unitario: 62000 }),
      it_({ compra_id: 'c3', fecha: '2026-10-08', referencia: null, descripcion: 'Chancla', color: null, costo_unitario: null }),
    ])
    expect(filas).toHaveLength(2)
    const negro = filas.find((f) => f.color === 'Negro')!
    expect(negro).toMatchObject({
      referencia: 'TR-1', tallas: ['38', '39', '40'], unidades: 7, ultimoCosto: 66000, ultimaFecha: '2026-10-05',
      costoAnterior: 60000, compras: 2,
    })
    expect(negro.variacion).toBeCloseTo(0.1)
    expect(filas.find((f) => f.color === 'Blanco')).toMatchObject({ costoAnterior: null, variacion: null, compras: 1 })
  })
})

describe('leerPesos', () => {
  it('acepta puntos de miles y el signo $', () => {
    expect(leerPesos('1.250.000')).toBe(1250000)
    expect(leerPesos('$ 40.000')).toBe(40000)
    expect(leerPesos('')).toBeNaN()
    expect(leerPesos('abc')).toBeNaN()
  })
})
