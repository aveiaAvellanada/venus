import { validarFilas } from '@shared/excel'
import { COLUMNAS, filasDeExportacion, llave, payloadCarga, revisarCarga } from './carga'
import type { ProductoCalzado } from './inventario'

const producto = (p: Partial<ProductoCalzado>): ProductoCalzado => ({
  id: 'p1', referencia: 'TA-1', descripcion: 'Tennis A', marca: 'Kalzado', color: 'Negro', categoria: 'Tennis',
  talla: '38', precio_minimo: 80000, precio_maximo: 100000, stock_actual: 2, stock_minimo: 1, activo: true, proveedor_id: null,
  ...p,
})

const fila = (f: Record<string, unknown>) => ({
  categoria: 'Tennis', descripcion: 'Tennis A', marca: 'Kalzado', referencia: 'TA-1', color: 'Negro', talla: 38,
  precio_minimo: 80000, precio_maximo: 100000, costo: 50000, stock: 2, ...f,
})

const revisar = (filas: Record<string, unknown>[], inventario: ProductoCalzado[]) =>
  revisarCarga(validarFilas(filas, { costoObligatorio: false }), inventario)

describe('llave', () => {
  it('reconoce la talla sin importar mayúsculas ni espacios', () => {
    expect(llave({ referencia: ' ta-1 ', descripcion: 'x', color: 'NEGRO', talla: '38' }))
      .toBe(llave({ referencia: 'TA-1', descripcion: 'y', color: 'negro', talla: '38 ' }))
  })

  it('sin referencia usa la descripción, y no se confunde con una referencia igual', () => {
    expect(llave({ referencia: null, descripcion: 'Chancla', color: null, talla: null }))
      .not.toBe(llave({ referencia: 'Chancla', descripcion: 'otra', color: null, talla: null }))
    expect(llave({ referencia: '', descripcion: 'Chancla', color: null, talla: null }))
      .toBe(llave({ referencia: null, descripcion: 'chancla', color: null, talla: null }))
  })
})

describe('revisarCarga', () => {
  it('separa nuevas, las que cambian y las iguales', () => {
    const r = revisar([
      fila({}),
      fila({ talla: 39, precio_minimo: 85000, precio_maximo: 105000 }),
      fila({ talla: 40, stock: 6 }),
    ], [producto({}), producto({ id: 'p2', talla: '39' })])
    expect(r.filas.map((f) => f.estado)).toEqual(['igual', 'cambia', 'nueva'])
    expect(r.filas[1].cambios).toEqual(['Precio $80.000–$100.000 → $85.000–$105.000'])
    expect([r.nuevas, r.cambian, r.iguales, r.paresNuevos]).toEqual([1, 1, 1, 6])
  })

  it('describe cambios de marca, descripción y categoría', () => {
    const r = revisar([fila({ marca: '', descripcion: 'Tennis B', categoria: 'clasico' })], [producto({})])
    expect(r.filas[0].cambios).toEqual([
      'Descripción: Tennis A → Tennis B',
      'Marca: Kalzado → sin marca',
      'Categoría: Tennis → Clásico',
    ])
  })

  it('el stock de una talla que existe no se carga: avisa cuando el archivo trae otro', () => {
    const r = revisar([fila({ stock: 99 })], [producto({})])
    expect(r.filas[0]).toMatchObject({ estado: 'igual', stockSistema: 2 })
    expect(r.stockIgnorado).toBe(1)
    expect(r.paresNuevos).toBe(0)
  })

  it('una talla repetida en el archivo es un error con la fila donde ya venía', () => {
    const r = revisar([fila({}), fila({ categoria: 'Sandalias', talla: 41 }), fila({ referencia: 'ta-1', color: 'negro' })], [])
    expect(r.filas).toHaveLength(1)
    expect(r.errores.map((e) => e.fila)).toEqual([3, 4])
    expect(r.errores[1].errores[0]).toMatch(/^Esa talla ya viene en la fila 2/)
  })

  it('prefiere la talla activa si hay una inactiva con la misma llave', () => {
    const r = revisar([fila({})], [producto({ id: 'viejo', activo: false, precio_minimo: 1 }), producto({})])
    expect(r.filas[0].estado).toBe('igual')
  })
})

describe('payloadCarga', () => {
  it('manda cada fila con su número y los nombres que espera la base', () => {
    const r = revisar([fila({ costo: undefined, talla: 40 })], [])
    expect(payloadCarga(r.filas)).toEqual([{
      fila: 2, categoria: 'Tennis', descripcion: 'Tennis A', marca: 'Kalzado', referencia: 'TA-1', talla: '40', color: 'Negro',
      precio_minimo: 80000, precio_maximo: 100000, costo: null, stock: 2,
    }])
  })
})

describe('filasDeExportacion', () => {
  it('exporta las activas con el formato de la plantilla, ordenadas, y vuelve a entrar sin cambios', () => {
    const inventario = [
      producto({ id: 'b', talla: '40' }),
      producto({ id: 'a', talla: '38', categoria: 'Clasico' }),
      producto({ id: 'x', talla: '41', activo: false }),
    ]
    const filas = filasDeExportacion(inventario, new Map([['a', { ultimo: 50000, promedio: 48000 }]]))
    expect(filas[0]).toEqual([...COLUMNAS])
    expect(filas.slice(1)).toEqual([
      ['Clásico', 'Tennis A', 'Kalzado', 'TA-1', '38', 'Negro', 80000, 100000, 50000, 2],
      ['Tennis', 'Tennis A', 'Kalzado', 'TA-1', '40', 'Negro', 80000, 100000, null, 2],
    ])

    // Ida y vuelta: lo exportado, leído como lo hace sheet_to_json, no cambia nada.
    const [encabezados, ...datos] = filas
    const objetos = datos.map((d) => Object.fromEntries(encabezados.map((h, i) => [h, d[i]]).filter(([, v]) => v != null)))
    const r = revisar(objetos, inventario)
    expect(r.errores).toEqual([])
    expect([r.nuevas, r.cambian, r.iguales]).toEqual([0, 0, 2])
  })
})
