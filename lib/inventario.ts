import { supabase } from './supabase'
import type { Database } from './database.types'

export type ProductoCalzado = Database['public']['Tables']['productos_calzado']['Row']
export type InsertCalzado = Database['public']['Tables']['productos_calzado']['Insert']
export type ProductoVarios = Database['public']['Tables']['productos_varios']['Row']
export type InsertVarios = Database['public']['Tables']['productos_varios']['Insert']

export async function listarCalzado(filtros?: {
  categoria?: string
  busqueda?: string
  estado?: 'disponible' | 'agotado'
}): Promise<ProductoCalzado[]> {
  let query = supabase.from('productos_calzado').select('*').order('created_at', { ascending: false })
  
  if (filtros?.categoria) {
    query = query.eq('categoria', filtros.categoria)
  }
  
  if (filtros?.busqueda) {
    query = query.or(`descripcion.ilike.%${filtros.busqueda}%,referencia.ilike.%${filtros.busqueda}%,talla.ilike.%${filtros.busqueda}%,color.ilike.%${filtros.busqueda}%`)
  }
  
  if (filtros?.estado === 'disponible') {
    query = query.gt('stock_actual', 0)
  } else if (filtros?.estado === 'agotado') {
    query = query.lte('stock_actual', 0)
  }
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function guardarCalzado(datos: {
  id?: string | null
  categoria: string
  descripcion: string
  referencia?: string | null
  talla?: string | null
  color?: string | null
  precio_minimo: number
  precio_maximo: number
  costo_compra?: number | null
  stock_actual: number
  stock_minimo: number
  proveedor_id?: string | null
  foto_url?: string | null
  activo?: boolean
}): Promise<string> {
  const { data, error } = await supabase.rpc('guardar_producto_calzado', {
    p_id: datos.id || (null as any),
    p_categoria: datos.categoria,
    p_descripcion: datos.descripcion,
    p_referencia: datos.referencia || (null as any),
    p_talla: datos.talla || (null as any),
    p_color: datos.color || (null as any),
    p_precio_minimo: datos.precio_minimo,
    p_precio_maximo: datos.precio_maximo,
    p_costo_compra: datos.costo_compra || (null as any),
    p_stock_actual: datos.stock_actual,
    p_stock_minimo: datos.stock_minimo,
    p_proveedor_id: datos.proveedor_id || (null as any),
    p_foto_url: datos.foto_url || (null as any),
    p_activo: datos.activo !== undefined ? datos.activo : true,
  })
  
  if (error) throw error
  return data
}

export async function listarVarios(busqueda?: string): Promise<ProductoVarios[]> {
  let query = supabase.from('productos_varios').select('*').order('created_at', { ascending: false })
  
  if (busqueda) {
    query = query.ilike('nombre', `%${busqueda}%`)
  }
  
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function guardarVarios(datos: InsertVarios & { id?: string }): Promise<ProductoVarios> {
  if (datos.id) {
    const { data, error } = await supabase
      .from('productos_varios')
      .update(datos)
      .eq('id', datos.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('productos_varios')
      .insert(datos)
      .select()
      .single()
    if (error) throw error
    return data
  }
}
