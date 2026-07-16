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
  variantes: ProductoCalzado[]
}

const tallaNumerica = (talla: string | null) => {
  const n = parseFloat(talla ?? '')
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n
}

export function agruparPorReferencia(filas: ProductoCalzado[]): ModeloCalzado[] {
  const grupos = new Map<string, ProductoCalzado[]>()
  for (const f of filas) {
    if (!f.activo) continue
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
      precioMax: Math.max(...variantes.map((v) => Number(v.precio_maximo))),
      agotado: variantes.every((v) => Number(v.stock_actual) <= 0),
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
