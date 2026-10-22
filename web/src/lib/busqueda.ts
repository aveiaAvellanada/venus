import { pesos } from '@shared/formato'
import { supabase } from './supabase'

export interface ProductoEncontrado {
  id: string
  tipo: 'calzado' | 'granja'
  titulo: string
  detalle: string
  stock: number | null
  precio: string
}

// PostgREST arma el filtro con comas, paréntesis y comillas; los comodines
// son % y *. Se quitan para que lo que escriba la persona no rompa la consulta.
export function limpiarTermino(texto: string): string {
  return texto.replace(/[,()"'\\%*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
}

export function filtroCalzado(termino: string): string {
  const patron = `%${termino}%`
  return ['descripcion', 'referencia', 'marca', 'color', 'categoria']
    .map((columna) => `${columna}.ilike.${patron}`)
    .join(',')
}

export async function buscarProductos(texto: string): Promise<ProductoEncontrado[]> {
  const termino = limpiarTermino(texto)
  if (termino.length < 2) return []

  const [calzado, granja] = await Promise.all([
    supabase
      .from('productos_calzado')
      .select('id, descripcion, referencia, marca, color, talla, categoria, stock_actual, precio_minimo, precio_maximo')
      .or(filtroCalzado(termino))
      .eq('activo', true)
      .order('descripcion')
      .order('talla')
      .limit(15),
    supabase
      .from('productos_varios')
      .select('id, nombre, unidad_medida')
      .ilike('nombre', `%${termino}%`)
      .eq('activo', true)
      .order('nombre')
      .limit(5),
  ])
  if (calzado.error) throw calzado.error
  if (granja.error) throw granja.error

  return [
    ...(calzado.data ?? []).map((p) => ({
      id: p.id,
      tipo: 'calzado' as const,
      titulo: p.descripcion,
      detalle: [p.referencia, p.marca, p.color, p.talla && `talla ${p.talla}`].filter(Boolean).join(' · '),
      stock: p.stock_actual,
      precio: p.precio_maximo == null || p.precio_minimo === p.precio_maximo
        ? pesos(p.precio_minimo)
        : `${pesos(p.precio_minimo)} – ${pesos(p.precio_maximo)}`,
    })),
    ...(granja.data ?? []).map((p) => ({
      id: p.id,
      tipo: 'granja' as const,
      titulo: p.nombre,
      detalle: `Granja · por ${p.unidad_medida}`,
      stock: null,
      precio: 'Precio al vender',
    })),
  ]
}

export interface ProveedorEncontrado {
  id: string
  nombre: string
  detalle: string
}

export async function buscarProveedores(texto: string): Promise<ProveedorEncontrado[]> {
  const termino = limpiarTermino(texto)
  if (termino.length < 2) return []
  const patron = `%${termino}%`
  const { data, error } = await supabase
    .from('proveedores')
    .select('id, nombre, nit_cedula, ciudad')
    .or(['nombre', 'nit_cedula', 'ciudad'].map((c) => `${c}.ilike.${patron}`).join(','))
    .order('nombre')
    .limit(5)
  if (error) throw error
  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    detalle: ['Proveedor', p.nit_cedula && `NIT/CC ${p.nit_cedula}`, p.ciudad].filter(Boolean).join(' · '),
  }))
}
