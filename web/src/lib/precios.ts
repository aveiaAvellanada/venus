import { CATEGORIAS } from '@shared/excel'
import { claveReferencia, tallaNumerica, tramoDeTalla, type Tramo } from '@shared/tramos'
import { plano } from '../navegacion'
import { compararTallas } from './inventario'

// Hoja de precios (2026-10-29): todo el calzado por categoría y referencia, con
// lo que hay de cada color en cada talla, para imprimirlo y que se escriban a
// mano los precios por rango de tallas; después se pasan en la pantalla de
// Precios. Los precios de $1 son provisionales (de la carga inicial).

export const PRECIO_PROVISIONAL = 1

export interface TallaPrecio {
  id: string
  referencia: string | null
  descripcion: string
  marca: string | null
  color: string | null
  categoria: string
  talla: string | null
  precio_minimo: number
  precio_maximo: number | null
  stock_actual: number
  activo: boolean
  foto_url: string | null
  garantia_dias: number | null
}

export interface ColorModelo {
  color: string
  foto: string | null
  // Pares por talla (solo las que existen en ese color).
  pares: Record<string, number>
  total: number
}

export interface ModeloPrecios {
  // Clave para guardar (la referencia; los precios por talla van por referencia).
  clave: string
  referencia: string | null
  descripcion: string
  marca: string | null
  categoria: string
  foto: string | null
  // Todas las tallas del modelo, de menor a mayor.
  tallas: string[]
  colores: ColorModelo[]
  total: number
  // Todas sus tallas siguen en el precio provisional.
  sinPrecio: boolean
  // Rango de precios actual (null si sigue en $1).
  precioActual: { min: number; max: number } | null
  tramos: Tramo[]
  garantia: number | null
  // Tallas que ningún rango guardado cubre.
  tallasSinRango: string[]
}

export interface CategoriaPrecios {
  categoria: string
  etiqueta: string
  modelos: ModeloPrecios[]
}

export interface FiltrosPrecios {
  categoria: string
  soloSinPrecio: boolean
  texto: string
}

export const FILTROS_PRECIOS: FiltrosPrecios = { categoria: '', soloSinPrecio: false, texto: '' }

export const etiquetaCategoria = (valor: string): string =>
  CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? valor

const ordenCategoria = (valor: string): number => {
  const i = CATEGORIAS.findIndex((c) => c.valor === valor)
  return i < 0 ? CATEGORIAS.length : i
}

const claveModelo = (t: TallaPrecio): string =>
  claveReferencia(t.referencia) ?? `sin-ref|${plano(t.descripcion)}|${plano(t.marca ?? '')}`

export function hojaDePrecios(
  productos: TallaPrecio[],
  tramosPorReferencia: Map<string, Tramo[]>,
  filtros: FiltrosPrecios = FILTROS_PRECIOS,
): CategoriaPrecios[] {
  const porModelo = new Map<string, TallaPrecio[]>()
  for (const p of productos) {
    if (!p.activo) continue
    const clave = claveModelo(p)
    porModelo.set(clave, [...(porModelo.get(clave) ?? []), p])
  }

  const modelos: ModeloPrecios[] = []
  for (const [clave, tallasModelo] of porModelo) {
    const primera = tallasModelo[0]
    const porColor = new Map<string, TallaPrecio[]>()
    for (const t of tallasModelo) {
      const color = t.color?.trim() || 'Sin color'
      porColor.set(color, [...(porColor.get(color) ?? []), t])
    }
    const colores: ColorModelo[] = [...porColor.entries()]
      .map(([color, ts]) => ({
        color,
        foto: ts.find((t) => t.foto_url)?.foto_url ?? null,
        pares: Object.fromEntries(ts.map((t) => [t.talla?.trim() || 'Única', t.stock_actual])),
        total: ts.reduce((s, t) => s + t.stock_actual, 0),
      }))
      .sort((a, b) => a.color.localeCompare(b.color, 'es'))
    const tallas = [...new Set(tallasModelo.map((t) => t.talla?.trim() || 'Única'))].sort(compararTallas)
    const conPrecio = tallasModelo.filter((t) => Number(t.precio_minimo) > PRECIO_PROVISIONAL)
    const tramos = primera.referencia ? tramosPorReferencia.get(claveReferencia(primera.referencia)!) ?? [] : []
    modelos.push({
      clave,
      referencia: primera.referencia?.trim() || null,
      descripcion: primera.descripcion,
      marca: primera.marca,
      categoria: primera.categoria,
      foto: colores.find((c) => c.foto)?.foto ?? null,
      tallas,
      colores,
      total: colores.reduce((s, c) => s + c.total, 0),
      sinPrecio: conPrecio.length === 0,
      precioActual: conPrecio.length
        ? {
            min: Math.min(...conPrecio.map((t) => Number(t.precio_minimo))),
            max: Math.max(...conPrecio.map((t) => Number(t.precio_maximo ?? t.precio_minimo))),
          }
        : null,
      tramos,
      garantia: tallasModelo.find((t) => t.garantia_dias != null)?.garantia_dias ?? null,
      tallasSinRango: tallas.filter((t) => tallaNumerica(t) != null && !tramoDeTalla(tramos, t)),
    })
  }

  const texto = plano(filtros.texto)
  const visibles = modelos.filter((m) =>
    (!filtros.categoria || m.categoria === filtros.categoria)
    && (!filtros.soloSinPrecio || m.sinPrecio)
    && (!texto || [m.referencia ?? '', m.descripcion, m.marca ?? '', ...m.colores.map((c) => c.color)].some((x) => plano(x).includes(texto))))

  const categorias = new Map<string, ModeloPrecios[]>()
  for (const m of visibles) categorias.set(m.categoria, [...(categorias.get(m.categoria) ?? []), m])
  return [...categorias.entries()]
    .sort((a, b) => ordenCategoria(a[0]) - ordenCategoria(b[0]))
    .map(([categoria, ms]) => ({
      categoria,
      etiqueta: etiquetaCategoria(categoria),
      modelos: ms.sort((a, b) => (a.referencia ?? a.descripcion).localeCompare(b.referencia ?? b.descripcion, 'es')),
    }))
}

// Para empezar a escribir precios: los rangos guardados o uno que cubre todas
// sus tallas numéricas.
export function rangosIniciales(m: ModeloPrecios): { desde: string; hasta: string; minimo: string; maximo: string }[] {
  if (m.tramos.length) {
    return m.tramos.map((t) => ({
      desde: String(t.tallaDesde), hasta: String(t.tallaHasta),
      minimo: String(t.precioMinimo), maximo: t.precioMaximo != null ? String(t.precioMaximo) : '',
    }))
  }
  const numeros = m.tallas.map(tallaNumerica).filter((n): n is number => n != null)
  if (!numeros.length) return [{ desde: '', hasta: '', minimo: '', maximo: '' }]
  return [{ desde: String(Math.min(...numeros)), hasta: String(Math.max(...numeros)), minimo: '', maximo: '' }]
}

export const contarModelos = (cats: CategoriaPrecios[]): number => cats.reduce((s, c) => s + c.modelos.length, 0)
