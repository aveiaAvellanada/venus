import { LADO_FOTO, LADO_MINIATURA } from '@shared/fotos'

// Las fotos se comprimen a máximo 500 KB antes de subir a Storage (CLAUDE.md).
export const MAX_FOTO = 500 * 1024
export const MAX_PDF = 5 * 1024 * 1024

// Tamaño final de una imagen para que su lado mayor no pase de `lado`.
export function medidaReducida(ancho: number, alto: number, lado: number): { ancho: number; alto: number } {
  const escala = Math.min(1, lado / Math.max(ancho, alto))
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) }
}

// JPEG de máximo 500 KB: baja la calidad y, si no alcanza, el tamaño.
// (Foto de la factura; las del zapato van con procesarFotoProducto.)
export async function comprimirFoto(archivo: File): Promise<Blob> {
  const imagen = await createImageBitmap(archivo)
  for (const lado of [2000, 1600, 1200, 900]) {
    const { ancho, alto } = medidaReducida(imagen.width, imagen.height, lado)
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    lienzo.getContext('2d')!.drawImage(imagen, 0, 0, ancho, alto)
    for (const calidad of [0.85, 0.75, 0.65, 0.55]) {
      const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', calidad))
      if (blob && blob.size <= MAX_FOTO) return blob
    }
  }
  throw new Error('No se pudo dejar la foto por debajo de 500 KB. Prueba con una foto más pequeña.')
}

// Cómo se recorta la foto del zapato en cuadrado: zoom (1 = el cuadrado más
// grande que cabe) y desplazamiento del centro, de -1 (un borde) a 1 (el otro).
export interface AjusteRecorte {
  zoom: number
  x: number
  y: number
}

export const AJUSTE_CENTRADO: AjusteRecorte = { zoom: 1, x: 0, y: 0 }
export const ZOOM_MAXIMO = 4

const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// El cuadrado (en píxeles de la foto original) que queda con ese ajuste.
export function recorteCuadrado(ancho: number, alto: number, ajuste: AjusteRecorte): { x: number; y: number; lado: number } {
  const zoom = entre(ajuste.zoom, 1, ZOOM_MAXIMO)
  const lado = Math.min(ancho, alto) / zoom
  const centroX = ancho / 2 + entre(ajuste.x, -1, 1) * ((ancho - lado) / 2)
  const centroY = alto / 2 + entre(ajuste.y, -1, 1) * ((alto - lado) / 2)
  return { x: centroX - lado / 2, y: centroY - lado / 2, lado }
}

// Arrastrar la vista previa `dx` píxeles mueve el centro del recorte al revés.
// `escala` = píxeles de pantalla por píxel de la foto.
export function desplazar(valor: number, dx: number, escala: number, libre: number): number {
  if (libre <= 0 || escala <= 0) return 0
  return entre(valor - dx / escala / (libre / 2), -1, 1)
}

export interface FotosProcesadas {
  grande: Blob
  mini: Blob
  extension: 'webp' | 'jpg'
}

async function cuadrado(imagen: ImageBitmap, r: { x: number; y: number; lado: number }, lado: number, tipo: string, calidad: number) {
  const lienzo = document.createElement('canvas')
  lienzo.width = lado
  lienzo.height = lado
  const ctx = lienzo.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(imagen, r.x, r.y, r.lado, r.lado, 0, 0, lado, lado)
  return new Promise<Blob | null>((ok) => lienzo.toBlob(ok, tipo, calidad))
}

// Foto del zapato: recortada en cuadrado, a 1080×1080 (o menos si la original
// es más pequeña) y su miniatura de 400×400, en WebP (JPEG si el navegador no
// sabe hacer WebP). Respeta la orientación con que la tomó el celular.
export async function procesarFotoProducto(archivo: File, ajuste: AjusteRecorte = AJUSTE_CENTRADO): Promise<FotosProcesadas> {
  const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  const r = recorteCuadrado(imagen.width, imagen.height, ajuste)
  const ladoGrande = Math.max(1, Math.round(Math.min(LADO_FOTO, r.lado)))
  const ladoMini = Math.max(1, Math.round(Math.min(LADO_MINIATURA, r.lado)))
  let tipo = 'image/webp'
  let extension: FotosProcesadas['extension'] = 'webp'
  for (const calidad of [0.82, 0.72, 0.62, 0.5]) {
    let grande = await cuadrado(imagen, r, ladoGrande, tipo, calidad)
    if (grande && grande.type !== 'image/webp' && tipo === 'image/webp') {
      tipo = 'image/jpeg'
      extension = 'jpg'
      grande = await cuadrado(imagen, r, ladoGrande, tipo, calidad)
    }
    if (grande && grande.size <= MAX_FOTO) {
      const mini = await cuadrado(imagen, r, ladoMini, tipo, Math.min(calidad, 0.75))
      if (mini) return { grande, mini, extension }
    }
  }
  throw new Error('No se pudo procesar la foto. Prueba con otra.')
}
