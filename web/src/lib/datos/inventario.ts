import type { Costo, ProductoCalzado } from '../inventario'
import { supabase } from '../supabase'

const COLUMNAS = 'id, referencia, descripcion, marca, color, categoria, talla, precio_minimo, precio_maximo, stock_actual, stock_minimo, activo, proveedor_id'
const PAGINA = 1000 // máximo de filas que entrega la API de Supabase por consulta

export async function listarCalzado(): Promise<ProductoCalzado[]> {
  const todos: ProductoCalzado[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from('productos_calzado')
      .select(COLUMNAS)
      .order('id')
      .range(desde, desde + PAGINA - 1)
    if (error) throw error
    todos.push(...(data as ProductoCalzado[]))
    if (!data || data.length < PAGINA) return todos
  }
}

export async function costosPorProducto(): Promise<Map<string, Costo>> {
  const { data, error } = await supabase.rpc('obtener_costos_productos')
  if (error) throw error
  return new Map((data ?? []).map((c) => [c.producto_id, { ultimo: Number(c.ultimo_costo), promedio: Number(c.costo_promedio) }]))
}

export type ReglaPrecio =
  | { tipo: 'porcentaje' | 'suma'; valor: number; campos: CamposPrecio; redondeo: number; motivo?: string }
  | { tipo: 'fijo'; minimo?: number; maximo?: number; campos: CamposPrecio; redondeo: number; motivo?: string }

export type CamposPrecio = 'ambos' | 'minimo' | 'maximo'

export interface FilaPrecio {
  id: string
  referencia: string | null
  descripcion: string
  talla: string | null
  color: string | null
  min_antes: number
  max_antes: number
  min_nuevo: number
  max_nuevo: number
  valido: boolean
}

export interface ResultadoPrecios {
  aplicado: boolean
  filas: FilaPrecio[]
  invalidos: number
  cambiados?: number
}

export async function cambiarPrecios(ids: string[], regla: ReglaPrecio, aplicar: boolean): Promise<ResultadoPrecios> {
  const { data, error } = await supabase.rpc('actualizar_precios_lote', {
    p_ids: ids,
    p_regla: regla,
    p_aplicar: aplicar,
  })
  if (error) throw new Error(error.message)
  return data as unknown as ResultadoPrecios
}

export async function actualizarTalla(id: string, cambios: { stock_minimo?: number; activo?: boolean }): Promise<void> {
  const { error } = await supabase.from('productos_calzado').update(cambios).eq('id', id)
  if (error) throw new Error(error.message)
}
