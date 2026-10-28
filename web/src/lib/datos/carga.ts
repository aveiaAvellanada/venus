import type { Json } from '@shared/database.types'
import { supabase } from '../supabase'

export interface ResultadoCarga {
  creados: number
  actualizados: number
  sin_cambios: number
  // La misma carga ya se había guardado (reintento con la misma clave).
  repetida?: boolean
}

// Todo o nada: si una fila falla la base no guarda ninguna y dice cuál.
// `clave` identifica el intento: reintentarlo (se cayó la señal) no suma pares dos veces.
export async function cargarInventario(filas: unknown[], proveedorId: string | null, clave?: string): Promise<ResultadoCarga> {
  const { data, error } = await supabase.rpc('cargar_inventario', {
    p_filas: filas as unknown as Json,
    p_proveedor_id: proveedorId ?? undefined,
    p_clave_idempotencia: clave,
  })
  if (error) throw new Error(error.message)
  return data as unknown as ResultadoCarga
}
