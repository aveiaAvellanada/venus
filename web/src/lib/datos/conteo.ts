import type { Json } from '@shared/database.types'
import type { Cambiado } from '../conteo'
import { supabase } from '../supabase'

// Conteo físico del panel web (fase 2, A4). Se confirma con la RPC
// registrar_conteo (todo o nada: conteo, tallas y stock); las listas leen
// conteos_inventario y conteo_items con RLS (`inventario`).

export interface ConteoListado {
  id: string
  alcance: string
  nota: string | null
  tallas_contadas: number
  tallas_ajustadas: number
  unidades_sobrantes: number
  unidades_faltantes: number
  created_at: string
  autor: string | null
}

const COLUMNAS = 'id, alcance, nota, tallas_contadas, tallas_ajustadas, unidades_sobrantes, unidades_faltantes, created_at, autor:users!conteos_inventario_created_by_fkey(nombre)'

type FilaConteo = Omit<ConteoListado, 'autor'> & { autor: { nombre: string } | null }
const aListado = (c: FilaConteo): ConteoListado => ({ ...c, autor: c.autor?.nombre ?? null })

export async function listarConteos(): Promise<ConteoListado[]> {
  const { data, error } = await supabase
    .from('conteos_inventario')
    .select(COLUMNAS)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data as unknown as FilaConteo[]).map(aListado)
}

export interface ItemDeConteo {
  id: string
  producto_id: string
  sistema: number
  contado: number
  diferencia: number
  motivo: string | null
  nota: string | null
  producto: {
    referencia: string | null
    descripcion: string
    marca: string | null
    color: string | null
    talla: string | null
    categoria: string
  } | null
}

export interface ConteoDetalle extends ConteoListado {
  items: ItemDeConteo[]
}

export async function obtenerConteo(id: string): Promise<ConteoDetalle | null> {
  const { data, error } = await supabase
    .from('conteos_inventario')
    .select(`${COLUMNAS}, conteo_items(id, producto_id, sistema, contado, diferencia, motivo, nota, producto:productos_calzado(referencia, descripcion, marca, color, talla, categoria))`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const c = data as unknown as FilaConteo & { conteo_items: ItemDeConteo[] }
  return { ...aListado(c), items: c.conteo_items.map((i) => ({ ...i, diferencia: i.contado - i.sistema })) }
}

export type ResultadoConteo =
  | { aplicado: true; repetido: boolean; conteo_id: string; tallas_ajustadas?: number }
  | { aplicado: false; cambiados: Cambiado[] }

// `clave` identifica el intento: si la red se cae después de guardar,
// reintentar con la misma clave devuelve el mismo conteo sin ajustar dos veces.
export async function registrarConteo(conteo: unknown, clave: string): Promise<ResultadoConteo> {
  const { data, error } = await supabase.rpc('registrar_conteo', {
    p_conteo: conteo as Json,
    p_clave_idempotencia: clave,
  })
  if (error) throw new Error(error.message)
  return data as unknown as ResultadoConteo
}
