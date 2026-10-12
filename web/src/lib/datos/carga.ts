import type { Json } from '@shared/database.types'
import { supabase } from '../supabase'

export interface ResultadoCarga {
  creados: number
  actualizados: number
  sin_cambios: number
}

// Todo o nada: si una fila falla la base no guarda ninguna y dice cuál.
export async function cargarInventario(filas: unknown[], proveedorId: string | null): Promise<ResultadoCarga> {
  const { data, error } = await supabase.rpc('cargar_inventario', {
    p_filas: filas as unknown as Json,
    p_proveedor_id: proveedorId ?? undefined,
  })
  if (error) throw new Error(error.message)
  return data as unknown as ResultadoCarga
}
