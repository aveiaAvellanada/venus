import { rutaFoto, rutaMiniatura } from '@shared/fotos'
import type { FotosProcesadas } from '../imagen'
import { supabase } from '../supabase'

const BUCKET = 'productos'
// Un año: cada teléfono la baja una sola vez. Cambiarla cambia el ?v= de la URL.
const CACHE = '31536000'

// Sube la foto de una referencia y color con su nombre fijo (reemplaza la que
// hubiera) y su miniatura. Devuelve la URL pública de la grande, con versión.
export async function subirFotoCatalogo(nombre: string, fotos: FotosProcesadas): Promise<string> {
  const tipo = fotos.extension === 'webp' ? 'image/webp' : 'image/jpeg'
  const opciones = { upsert: true, cacheControl: CACHE, contentType: tipo }
  const [grande, mini] = await Promise.all([
    supabase.storage.from(BUCKET).upload(rutaFoto(nombre, fotos.extension), fotos.grande, opciones),
    supabase.storage.from(BUCKET).upload(rutaMiniatura(nombre, fotos.extension), fotos.mini, opciones),
  ])
  const error = grande.error ?? mini.error
  if (error) throw new Error(error.message)
  const url = supabase.storage.from(BUCKET).getPublicUrl(rutaFoto(nombre, fotos.extension)).data.publicUrl
  return `${url}?v=${Date.now()}`
}
