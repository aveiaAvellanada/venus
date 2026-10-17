import type { ProductoCalzado } from './inventario'

// Parte D del rediseño: cada fila de productos_calzado es una variante
// (talla+color); aquí se agrupan EN EL CLIENTE por referencia (Opción A,
// sin tocar la base de datos ni el resto del código).

export interface ModeloCalzado {
  clave: string
  referencia: string | null
  nombre: string
  marca: string | null
  categoria: string
  foto: string | null
  colores: string[]
  precioMin: number
  precioMax: number
  agotado: boolean
  activo: boolean
  variantes: ProductoCalzado[]
}

// El máximo es opcional: sin él, el precio de vitrina es el mínimo.
export const maximoVitrina = (v: Pick<ProductoCalzado, 'precio_minimo' | 'precio_maximo'>): number =>
  Number(v.precio_maximo ?? v.precio_minimo)

const tallaNumerica = (talla: string | null) => {
  const n = parseFloat(talla ?? '')
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n
}

export function agruparPorReferencia(
  filas: ProductoCalzado[],
  opciones?: { incluirInactivos?: boolean }
): ModeloCalzado[] {
  const incluirInactivos = opciones?.incluirInactivos ?? false
  const grupos = new Map<string, ProductoCalzado[]>()
  for (const f of filas) {
    if (!incluirInactivos && !f.activo) continue
    const ref = (f.referencia ?? '').trim().toLowerCase()
    const clave = ref !== '' ? ref : `desc:${f.descripcion.trim().toLowerCase()}`
    const grupo = grupos.get(clave)
    if (grupo) grupo.push(f)
    else grupos.set(clave, [f])
  }

  return [...grupos.values()].map((variantes) => {
    const ordenadas = [...variantes].sort((a, b) => tallaNumerica(a.talla) - tallaNumerica(b.talla))
    const primera = ordenadas[0]
    const colores: string[] = []
    for (const v of variantes) {
      const c = v.color?.trim()
      if (c && !colores.includes(c)) colores.push(c)
    }
    const ref = (primera.referencia ?? '').trim()
    return {
      clave: ref !== '' ? ref : primera.descripcion.trim(),
      referencia: ref !== '' ? ref : null,
      nombre: primera.descripcion,
      marca: primera.marca,
      categoria: primera.categoria,
      foto: variantes.find((v) => v.foto_url)?.foto_url ?? null,
      colores,
      precioMin: Math.min(...variantes.map((v) => Number(v.precio_minimo))),
      precioMax: Math.max(...variantes.map(maximoVitrina)),
      agotado: variantes.every((v) => Number(v.stock_actual) <= 0),
      activo: variantes.some((v) => v.activo),
      variantes: ordenadas,
    }
  })
}

export function filtrarModelos(modelos: ModeloCalzado[], busqueda: string): ModeloCalzado[] {
  const q = busqueda.trim().toLowerCase()
  if (!q) return modelos
  return modelos.filter((m) =>
    [m.nombre, m.marca ?? '', m.referencia ?? ''].some((campo) => campo.toLowerCase().includes(q))
  )
}

// Rediseño de Productos (docs/rediseno-productos/README.md §2–§5).
// Cada color de un modelo es su propia tarjeta; '' = variantes sin color.

const claveColor = (color: string | null) => (color ?? '').trim()

export function variantesDeColor(modelo: ModeloCalzado, color: string): ProductoCalzado[] {
  return modelo.variantes.filter((v) => claveColor(v.color) === color)
}

// Colores del modelo en orden de aparición, incluyendo '' si hay variantes sin color.
export function coloresDeModelo(modelo: ModeloCalzado): string[] {
  const claves: string[] = []
  for (const v of modelo.variantes) {
    const c = claveColor(v.color)
    if (!claves.includes(c)) claves.push(c)
  }
  const conColor = modelo.colores.filter((c) => claves.includes(c))
  return claves.includes('') ? [...conColor, ''] : conColor
}

export interface ResumenColor {
  color: string
  foto: string | null
  precioMin: number
  precioMax: number
  agotado: boolean
}

export function resumenColor(modelo: ModeloCalzado, color: string): ResumenColor {
  const vs = variantesDeColor(modelo, color)
  return {
    color,
    foto: vs.find((v) => v.foto_url)?.foto_url ?? null,
    precioMin: Math.min(...vs.map((v) => Number(v.precio_minimo))),
    precioMax: Math.max(...vs.map(maximoVitrina)),
    agotado: vs.every((v) => Number(v.stock_actual) <= 0),
  }
}

// Color que abre el detalle cuando no viene preseleccionado: el primero con stock.
export function colorInicial(modelo: ModeloCalzado): string {
  const colores = coloresDeModelo(modelo)
  return colores.find((c) => !resumenColor(modelo, c).agotado) ?? colores[0] ?? ''
}

export interface TarjetaProducto extends ResumenColor {
  clave: string
  modelo: ModeloCalzado
  numColores: number
}

export function tarjetasPorColor(modelos: ModeloCalzado[]): TarjetaProducto[] {
  return modelos.flatMap((modelo) => {
    const colores = coloresDeModelo(modelo)
    return colores.map((color) => ({
      ...resumenColor(modelo, color),
      clave: `${modelo.clave}|${color}`,
      modelo,
      numColores: modelo.colores.length || 1,
    }))
  })
}

// Grid responsivo por ancho del contenedor (no media queries).
export function columnasGrid(ancho: number): number {
  if (ancho >= 1400) return 6
  if (ancho >= 1100) return 5
  if (ancho >= 820) return 4
  if (ancho >= 560) return 3
  return 2
}

// Tallas en grilla compacta: auto-fill con celdas de mínimo 52 px.
export function columnasTallas(ancho: number, minimo = 52, espacio = 6): number {
  return Math.max(1, Math.floor((ancho + espacio) / (minimo + espacio)))
}

export interface FiltrosProductos {
  categorias: string[]
  marcas: string[]
  precioMax: number | null
  verDescontinuados: boolean
}

export const FILTROS_VACIOS: FiltrosProductos = {
  categorias: [],
  marcas: [],
  precioMax: null,
  verDescontinuados: false,
}

export function filtroActivo(f: FiltrosProductos): boolean {
  return f.categorias.length > 0 || f.marcas.length > 0 || f.precioMax != null || f.verDescontinuados
}

// Modelos que pasan búsqueda, estado, categoría y marca (el precio se aplica por tarjeta).
export function modelosFiltrados(
  modelos: ModeloCalzado[],
  busqueda: string,
  f: FiltrosProductos
): ModeloCalzado[] {
  return filtrarModelos(modelos, busqueda).filter(
    (m) =>
      (f.verDescontinuados || m.activo) &&
      (f.categorias.length === 0 || f.categorias.includes(m.categoria)) &&
      (f.marcas.length === 0 || (m.marca != null && f.marcas.includes(m.marca)))
  )
}

export function tarjetasFiltradas(
  modelos: ModeloCalzado[],
  busqueda: string,
  f: FiltrosProductos
): TarjetaProducto[] {
  return tarjetasPorColor(modelosFiltrados(modelos, busqueda, f)).filter(
    (t) => f.precioMax == null || t.precioMin <= f.precioMax
  )
}

// Conteo [n] de cada opción del panel de filtros: modelos visibles según el estado elegido.
export function contarModelos(
  modelos: ModeloCalzado[],
  verDescontinuados: boolean,
  predicado: (m: ModeloCalzado) => boolean
): number {
  return modelos.filter((m) => (verDescontinuados || m.activo) && predicado(m)).length
}

// "2 cubetas", "1 libra", "0,5 libras", "3 unidades".
export function cantidadConUnidad(cantidad: number, unidad: string): string {
  const u = unidad.trim()
  const n = cantidad.toLocaleString('es-CO', { maximumFractionDigits: 2 })
  if (cantidad === 1 || u === '' || u.length <= 3) return `${n} ${u}`.trim()
  const plural = /[aeiouáéó]$/i.test(u) ? `${u}s` : /[sx]$/i.test(u) ? u : `${u}es`
  return `${n} ${plural}`
}

const COLORES: Record<string, string> = {
  negro: '#1C1C1E',
  blanco: '#FFFFFF',
  gris: '#9CA3AF',
  azul: '#2563EB',
  rojo: '#DC2626',
  verde: '#16A34A',
  amarillo: '#EAB308',
  café: '#92400E',
  cafe: '#92400E',
  marrón: '#92400E',
  marron: '#92400E',
  rosado: '#EC4899',
  rosa: '#EC4899',
  morado: '#8B5CF6',
  naranja: '#F97316',
  beige: '#D6C7A1',
  dorado: '#EAB308',
  plateado: '#CBD5E1',
}

export function colorAHex(nombre: string): string {
  return COLORES[nombre.trim().toLowerCase()] ?? '#9CA3AF'
}
