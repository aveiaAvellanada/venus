import { plano } from '../navegacion'

// En la base cada talla es una fila de productos_calzado; en pantalla se
// trabaja por referencia (mismo modelo y color) con sus tallas adentro.
export interface ProductoCalzado {
  id: string
  referencia: string | null
  descripcion: string
  marca: string | null
  color: string | null
  categoria: string
  talla: string | null
  precio_minimo: number
  precio_maximo: number
  stock_actual: number
  stock_minimo: number
  activo: boolean
  proveedor_id: string | null
}

export interface Costo {
  ultimo: number
  promedio: number
}

export interface GrupoReferencia {
  clave: string
  referencia: string | null
  descripcion: string
  marca: string | null
  color: string | null
  categoria: string
  tallas: ProductoCalzado[]
  stock: number
  precioMin: number
  precioMax: number
  agotado: boolean
  bajoMinimo: boolean
  activo: boolean
}

// 34 < 35 < 35.5 < "S" < "Única"
export function compararTallas(a: string | null, b: string | null): number {
  const na = Number(a?.replace(',', '.'))
  const nb = Number(b?.replace(',', '.'))
  if (!Number.isNaN(na) && !Number.isNaN(nb) && a && b) return na - nb
  if (a && !Number.isNaN(na)) return -1
  if (b && !Number.isNaN(nb)) return 1
  return (a ?? '').localeCompare(b ?? '', 'es')
}

export function agrupar(productos: ProductoCalzado[]): GrupoReferencia[] {
  const grupos = new Map<string, ProductoCalzado[]>()
  for (const p of productos) {
    const clave = [plano(p.referencia || p.descripcion), plano(p.color ?? ''), plano(p.marca ?? '')].join('|')
    const lista = grupos.get(clave)
    if (lista) lista.push(p)
    else grupos.set(clave, [p])
  }
  return [...grupos.entries()]
    .map(([clave, lista]) => {
      const tallas = [...lista].sort((a, b) => compararTallas(a.talla, b.talla))
      const activas = tallas.filter((t) => t.activo)
      const base = activas.length ? activas : tallas
      return {
        clave,
        referencia: tallas[0].referencia,
        descripcion: tallas[0].descripcion,
        marca: tallas[0].marca,
        color: tallas[0].color,
        categoria: tallas[0].categoria,
        tallas,
        stock: activas.reduce((s, t) => s + t.stock_actual, 0),
        precioMin: Math.min(...base.map((t) => Number(t.precio_minimo))),
        precioMax: Math.max(...base.map((t) => Number(t.precio_maximo))),
        agotado: activas.length > 0 && activas.every((t) => t.stock_actual === 0),
        bajoMinimo: activas.some((t) => t.stock_actual <= t.stock_minimo),
        activo: activas.length > 0,
      }
    })
    .sort((a, b) => (a.referencia ?? a.descripcion).localeCompare(b.referencia ?? b.descripcion, 'es'))
}

export type EstadoInventario = 'activos' | 'bajo_minimo' | 'agotados' | 'inactivos'

export interface Filtros {
  texto: string
  categoria: string
  marca: string
  estado: EstadoInventario
}

export function filtrar(grupos: GrupoReferencia[], f: Filtros): GrupoReferencia[] {
  const palabras = plano(f.texto).split(' ').filter(Boolean)
  return grupos.filter((g) => {
    if (f.categoria && g.categoria !== f.categoria) return false
    if (f.marca && (g.marca ?? '') !== f.marca) return false
    if (f.estado === 'inactivos' ? g.activo : !g.activo) return false
    if (f.estado === 'bajo_minimo' && !g.bajoMinimo) return false
    if (f.estado === 'agotados' && !g.agotado) return false
    if (palabras.length) {
      const texto = plano([g.referencia, g.descripcion, g.marca, g.color, g.categoria].filter(Boolean).join(' '))
      if (!palabras.every((p) => texto.includes(p))) return false
    }
    return true
  })
}

// Margen sobre el precio de venta: (precio − costo) / precio.
export function margen(precio: number, costo: number | undefined): number | null {
  if (costo === undefined || !precio) return null
  return (precio - costo) / precio
}

export function costoDeGrupo(g: GrupoReferencia, costos: Map<string, Costo> | undefined): number | undefined {
  if (!costos) return undefined
  const conocidos = g.tallas.map((t) => costos.get(t.id)?.ultimo).filter((c): c is number => c !== undefined)
  return conocidos.length ? Math.max(...conocidos) : undefined
}

export interface Totales {
  referencias: number
  unidades: number
  valorPrecio: number
  valorCosto: number
  sinCosto: number
}

// Valor a precio máximo y a último costo de lo que hay en stock (solo tallas activas).
export function totales(grupos: GrupoReferencia[], costos?: Map<string, Costo>): Totales {
  const t: Totales = { referencias: grupos.length, unidades: 0, valorPrecio: 0, valorCosto: 0, sinCosto: 0 }
  for (const g of grupos) {
    for (const p of g.tallas) {
      if (!p.activo) continue
      t.unidades += p.stock_actual
      t.valorPrecio += p.stock_actual * Number(p.precio_maximo)
      const costo = costos?.get(p.id)?.ultimo
      if (costo === undefined) {
        if (p.stock_actual > 0) t.sinCosto += 1
      } else {
        t.valorCosto += p.stock_actual * costo
      }
    }
  }
  return t
}

// CSV para Excel en español: separador ";", BOM y una fila por talla.
export function aCsv(grupos: GrupoReferencia[], costos?: Map<string, Costo>): string {
  const celda = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const columnas = ['Referencia', 'Descripción', 'Marca', 'Color', 'Categoría', 'Talla', 'Stock', 'Stock mínimo',
    'Precio mínimo', 'Precio máximo', ...(costos ? ['Último costo'] : []), 'Activo']
  const filas = grupos.flatMap((g) => g.tallas.map((p) => [
    p.referencia, p.descripcion, p.marca, p.color, p.categoria, p.talla, p.stock_actual, p.stock_minimo,
    p.precio_minimo, p.precio_maximo, ...(costos ? [costos.get(p.id)?.ultimo ?? ''] : []), p.activo ? 'Sí' : 'No',
  ]))
  return '﻿' + [columnas, ...filas].map((f) => f.map(celda).join(';')).join('\r\n')
}
