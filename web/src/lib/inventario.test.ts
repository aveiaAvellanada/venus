import { aCsv, agrupar, compararTallas, costoDeGrupo, filtrar, margen, totales, type ProductoCalzado } from './inventario'

let n = 0
const p = (o: Partial<ProductoCalzado>): ProductoCalzado => ({
  id: `p${++n}`, referencia: 'TR-1', descripcion: 'Tennis Running', marca: 'Kalzado', color: 'Negro',
  categoria: 'Tennis', talla: '38', precio_minimo: 90000, precio_maximo: 120000, stock_actual: 3,
  stock_minimo: 1, activo: true, proveedor_id: null, ...o,
})

describe('inventario', () => {
  it('ordena tallas numéricas antes que las de texto', () => {
    expect(['40', 'Única', '34', '35.5', '35'].sort(compararTallas)).toEqual(['34', '35', '35.5', '40', 'Única'])
  })

  it('agrupa por referencia, color y marca, con las tallas en orden', () => {
    const grupos = agrupar([
      p({ talla: '40', stock_actual: 0 }), p({ talla: '38' }), p({ color: 'Blanco', talla: '39' }),
    ])
    expect(grupos).toHaveLength(2)
    const negro = grupos.find((g) => g.color === 'Negro')!
    expect(negro.tallas.map((t) => t.talla)).toEqual(['38', '40'])
    expect(negro).toMatchObject({ stock: 3, bajoMinimo: true, agotado: false, activo: true })
  })

  it('una referencia sin stock en ninguna talla activa está agotada; las inactivas no cuentan', () => {
    const [g] = agrupar([p({ stock_actual: 0 }), p({ talla: '39', stock_actual: 5, activo: false })])
    expect(g).toMatchObject({ agotado: true, stock: 0 })
  })

  it('filtra por texto sin tildes, categoría, marca y estado', () => {
    const grupos = agrupar([
      p({ referencia: 'BC-1', descripcion: 'Bota clásica', categoria: 'Clasico', marca: 'Andina', stock_actual: 0 }),
      p({}),
      p({ referencia: 'OLD', descripcion: 'Descontinuado', activo: false }),
    ])
    const base = { texto: '', categoria: '', marca: '', estado: 'activos' as const }
    expect(filtrar(grupos, base).map((g) => g.referencia)).toEqual(['BC-1', 'TR-1'])
    expect(filtrar(grupos, { ...base, texto: 'clasica andina' }).map((g) => g.referencia)).toEqual(['BC-1'])
    expect(filtrar(grupos, { ...base, estado: 'agotados' }).map((g) => g.referencia)).toEqual(['BC-1'])
    expect(filtrar(grupos, { ...base, estado: 'inactivos' }).map((g) => g.referencia)).toEqual(['OLD'])
    expect(filtrar(grupos, { ...base, marca: 'Kalzado' }).map((g) => g.referencia)).toEqual(['TR-1'])
  })

  it('margen sobre el precio de venta', () => {
    expect(margen(100000, 60000)).toBeCloseTo(0.4)
    expect(margen(100000, undefined)).toBeNull()
  })

  it('totales a precio y a costo; cuenta lo que tiene stock sin costo', () => {
    const a = p({ stock_actual: 2, precio_maximo: 100000 })
    const b = p({ talla: '39', stock_actual: 3, precio_maximo: 100000 })
    const costos = new Map([[a.id, { ultimo: 60000, promedio: 55000 }]])
    expect(totales(agrupar([a, b]), costos)).toEqual({
      referencias: 1, unidades: 5, valorPrecio: 500000, valorCosto: 120000, sinCosto: 1,
    })
    expect(costoDeGrupo(agrupar([a, b])[0], costos)).toBe(60000)
  })

  it('CSV para Excel: BOM, punto y coma, comillas cuando hace falta', () => {
    const csv = aCsv(agrupar([p({ descripcion: 'Tennis "Pro"; edición' })]))
    expect(csv.startsWith('﻿Referencia;Descripción')).toBe(true)
    expect(csv).toContain('TR-1;"Tennis ""Pro""; edición";Kalzado')
  })
})
