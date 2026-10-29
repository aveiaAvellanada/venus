import { hojaDePrecios, rangosIniciales, contarModelos, type TallaPrecio } from './precios'
import { altoBloque, crearPdfPrecios, paginar } from './pdfPrecios'

let n = 0
const talla = (extra: Partial<TallaPrecio>): TallaPrecio => ({
  id: `t${n++}`, referencia: 'ESC-DAMP-001', descripcion: 'Damper diana', marca: 'Damper', color: 'Rojo',
  categoria: 'Escolar', talla: '28', precio_minimo: 1, precio_maximo: null, stock_actual: 1, activo: true,
  foto_url: null, garantia_dias: null, ...extra,
})

const INVENTARIO: TallaPrecio[] = [
  talla({ talla: '30', stock_actual: 3 }),
  talla({ talla: '28', stock_actual: 1 }),
  talla({ talla: '29', stock_actual: 0 }),
  talla({ color: 'Negro', talla: '31', stock_actual: 2, foto_url: 'https://x/catalogo/esc-damp-001-negro.webp?v=1' }),
  talla({ referencia: 'TEN-NIKE-002', descripcion: 'Air', marca: 'Nike', categoria: 'Tennis', color: 'Blanco', talla: '40', precio_minimo: 120000, precio_maximo: 150000 }),
  talla({ referencia: 'CHA-RIDE-001', descripcion: 'Playa', marca: 'Rider', categoria: 'Chanclas', color: 'Azul', talla: '38', garantia_dias: 30 }),
  talla({ referencia: 'CHA-RIDE-009', descripcion: 'Vieja', categoria: 'Chanclas', activo: false }),
]

describe('hoja de precios', () => {
  it('agrupa por categoría (en su orden) y referencia, con los pares de cada color por talla', () => {
    const cats = hojaDePrecios(INVENTARIO, new Map())
    expect(cats.map((c) => c.etiqueta)).toEqual(['Chanclas', 'Escolar', 'Tennis'])
    const damper = cats[1].modelos[0]
    expect(damper.tallas).toEqual(['28', '29', '30', '31'])
    expect(damper.colores.map((c) => [c.color, c.pares, c.total])).toEqual([
      ['Negro', { 31: 2 }, 2],
      ['Rojo', { 28: 1, 29: 0, 30: 3 }, 4],
    ])
    expect(damper).toMatchObject({ total: 6, sinPrecio: true, precioActual: null, foto: 'https://x/catalogo/esc-damp-001-negro.webp?v=1' })
    // Lo desactivado no sale.
    expect(cats[0].modelos.map((m) => m.referencia)).toEqual(['CHA-RIDE-001'])
    expect(cats[0].modelos[0].garantia).toBe(30)
    expect(cats[2].modelos[0].precioActual).toEqual({ min: 120000, max: 150000 })
    expect(contarModelos(cats)).toBe(3)
  })

  it('filtra por categoría, por los que siguen en $1 y por texto', () => {
    expect(contarModelos(hojaDePrecios(INVENTARIO, new Map(), { categoria: 'Escolar', soloSinPrecio: false, texto: '' }))).toBe(1)
    expect(hojaDePrecios(INVENTARIO, new Map(), { categoria: '', soloSinPrecio: true, texto: '' }).map((c) => c.categoria)).toEqual(['Chanclas', 'Escolar'])
    expect(contarModelos(hojaDePrecios(INVENTARIO, new Map(), { categoria: '', soloSinPrecio: false, texto: 'negro' }))).toBe(1)
  })

  it('usa los rangos guardados y avisa las tallas que ninguno cubre', () => {
    const tramos = new Map([['esc-damp-001', [{ tallaDesde: 28, tallaHasta: 29, precioMinimo: 40000, precioMaximo: 50000 }]]])
    const damper = hojaDePrecios(INVENTARIO, tramos)[1].modelos[0]
    expect(damper.tallasSinRango).toEqual(['30', '31'])
    expect(rangosIniciales(damper)).toEqual([{ desde: '28', hasta: '29', minimo: '40000', maximo: '50000' }])
    const nike = hojaDePrecios(INVENTARIO, new Map())[2].modelos[0]
    expect(rangosIniciales(nike)).toEqual([{ desde: '40', hasta: '40', minimo: '', maximo: '' }])
  })
})

describe('PDF de la hoja de precios', () => {
  it('las categorías siguen en la misma página con su título y una referencia nunca se parte', () => {
    const muchas = Array.from({ length: 30 }, (_, i) =>
      talla({ referencia: `ESC-X-${String(i).padStart(3, '0')}`, descripcion: `Modelo ${i}` }))
    const cats = hojaDePrecios([...muchas, ...INVENTARIO], new Map())
    const paginas = paginar(cats)
    const modelos = (p: (typeof paginas)[number]) => p.renglones.flatMap((r) => (r.tipo === 'modelo' ? [r.modelo] : []))
    // Chanclas (1 referencia) y Escolar comparten la primera página.
    expect(paginas[0].categorias).toEqual(['Chanclas', 'Escolar'])
    expect(paginas[0].renglones.slice(0, 3).map((r) => (r.tipo === 'categoria' ? r.etiqueta : r.modelo.referencia)))
      .toEqual(['Chanclas', 'CHA-RIDE-001', 'Escolar'])
    // Todo sale una sola vez y en orden.
    expect(paginas.flatMap(modelos)).toHaveLength(33)
    // Al seguir una categoría en otra página, se repite su título.
    expect(paginas[1].renglones[0]).toEqual({ tipo: 'categoria', etiqueta: 'Escolar (sigue)' })
    for (const p of paginas) {
      const alto = p.renglones.reduce((s, r) => s + (r.tipo === 'modelo' ? altoBloque(r.modelo) : 9), 0)
      expect(alto).toBeLessThanOrEqual(279.4 - 12 - 19 - 6 - 12)
      expect(p.renglones[p.renglones.length - 1].tipo).toBe('modelo')
    }
  })

  it('genera el PDF (lo poco cabe en una página)', async () => {
    const cats = hojaDePrecios(INVENTARIO, new Map())
    const doc = await crearPdfPrecios(cats, { conFotos: false, fecha: new Date(2026, 9, 29) })
    expect(doc.getNumberOfPages()).toBe(1)
  })
})
