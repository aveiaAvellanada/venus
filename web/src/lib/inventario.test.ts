import {
  aCsv, agrupar, compararTallas, costoDeGrupo, filtrar, margen, ordenar, totales, type ProductoCalzado,
} from './inventario'

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

  it('la foto del grupo es la de cualquiera de sus tallas; "Sin foto" muestra las activas que no tienen', () => {
    const grupos = agrupar([
      p({ talla: '38' }), p({ talla: '39', foto_url: 'https://x/catalogo/tr-1-negro.webp?v=1' }),
      p({ referencia: 'BC-1', descripcion: 'Bota' }),
      p({ referencia: 'OLD', descripcion: 'Vieja', activo: false }),
    ])
    expect(grupos.find((g) => g.referencia === 'TR-1')!.foto).toBe('https://x/catalogo/tr-1-negro.webp?v=1')
    const base = { texto: '', categoria: '', marca: '', estado: 'sin_foto' as const }
    expect(filtrar(grupos, base).map((g) => g.referencia)).toEqual(['BC-1'])
  })

  it('ordena por stock, precio, costo, margen y lo más reciente; sin costo va al final', () => {
    const a = p({ referencia: 'A-1', stock_actual: 5, precio_maximo: 100000, created_at: '2026-10-01T10:00:00Z' })
    const b = p({ referencia: 'B-1', stock_actual: 9, precio_maximo: 80000, created_at: '2026-10-20T10:00:00Z' })
    const c = p({ referencia: 'C-1', stock_actual: 1, precio_maximo: 150000, created_at: '2026-10-10T10:00:00Z' })
    const grupos = agrupar([c, a, b])
    const refs = (orden: Parameters<typeof ordenar>[1], costos?: Parameters<typeof ordenar>[2]) =>
      ordenar(grupos, orden, costos).map((g) => g.referencia)
    expect(refs({ campo: 'referencia', dir: 'asc' })).toEqual(['A-1', 'B-1', 'C-1'])
    expect(refs({ campo: 'referencia', dir: 'desc' })).toEqual(['C-1', 'B-1', 'A-1'])
    expect(refs({ campo: 'stock', dir: 'desc' })).toEqual(['B-1', 'A-1', 'C-1'])
    expect(refs({ campo: 'stock', dir: 'asc' })).toEqual(['C-1', 'A-1', 'B-1'])
    expect(refs({ campo: 'precio', dir: 'desc' })).toEqual(['C-1', 'A-1', 'B-1'])
    expect(refs({ campo: 'recientes', dir: 'desc' })).toEqual(['B-1', 'C-1', 'A-1'])
    const costos = new Map([[a.id, { ultimo: 80000, promedio: 80000 }], [b.id, { ultimo: 40000, promedio: 40000 }]])
    expect(refs({ campo: 'costo', dir: 'desc' }, costos)).toEqual(['A-1', 'B-1', 'C-1'])
    expect(refs({ campo: 'costo', dir: 'asc' }, costos)).toEqual(['B-1', 'A-1', 'C-1'])
    // Margen: B 50 %, A 20 %; C sin costo, al final en las dos direcciones.
    expect(refs({ campo: 'margen', dir: 'desc' }, costos)).toEqual(['B-1', 'A-1', 'C-1'])
    expect(refs({ campo: 'margen', dir: 'asc' }, costos)).toEqual(['A-1', 'B-1', 'C-1'])
    // No cambia la lista original.
    expect(grupos.map((g) => g.referencia)).toEqual(['A-1', 'B-1', 'C-1'])
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
