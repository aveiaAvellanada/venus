import { nombreColores } from './colores'

// Fotos del catálogo (las suben el panel web y la app; Granja no). Cada referencia y color
// tiene una foto con nombre fijo en el bucket público `productos`:
//   catalogo/<referencia>-<color>.webp       1080×1080, para el detalle
//   catalogo/<referencia>-<color>-mini.webp  400×400, para las listas
// Cambiar la foto es reemplazar el archivo; la URL guardada lleva ?v=<hora>
// para que los teléfonos no sigan mostrando la de antes desde su caché.

export const CARPETA_CATALOGO = 'catalogo'
export const LADO_FOTO = 1080
export const LADO_MINIATURA = 400

// "Diana Gold Ñ/2" → "diana-gold-n-2": sin tildes, minúsculas, solo letras,
// números y guiones.
export function textoParaArchivo(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

// Nombre de la foto de una referencia y color: la referencia (o la descripción
// si no tiene) y el color. null si todavía no hay con qué nombrarla.
export function nombreFoto(referencia: string, descripcion: string, color: string): string | null {
  const base = textoParaArchivo(referencia) || textoParaArchivo(descripcion)
  if (!base) return null
  const tono = textoParaArchivo(nombreColores(color) ?? '')
  return tono ? `${base}-${tono}` : base
}

export const rutaFoto = (nombre: string, extension: string) => `${CARPETA_CATALOGO}/${nombre}.${extension}`
export const rutaMiniatura = (nombre: string, extension: string) => `${CARPETA_CATALOGO}/${nombre}-mini.${extension}`

const FOTO_CATALOGO = /\/catalogo\/([^/?#]+?)\.(webp|jpg)(\?[^#]*)?$/

// Nombre con que se subió una foto del catálogo (null si es de otro lado, p. ej.
// las que subía antes la app con nombre al azar).
export function nombreDeUrlFoto(url: string | null | undefined): string | null {
  const m = url?.match(FOTO_CATALOGO)
  if (!m || m[1].endsWith('-mini')) return null
  return m[1]
}

// La miniatura de una foto del catálogo; las demás fotos no tienen y se usan tal cual.
export function urlMiniatura(url: string | null | undefined): string | null {
  if (!url) return null
  if (!nombreDeUrlFoto(url)) return url
  return url.replace(FOTO_CATALOGO, (_, nombre: string, ext: string, query?: string) => `/catalogo/${nombre}-mini.${ext}${query ?? ''}`)
}
