// Las fotos se comprimen a máximo 500 KB antes de subir a Storage (CLAUDE.md).
export const MAX_FOTO = 500 * 1024
export const MAX_PDF = 5 * 1024 * 1024

// Tamaño final de una imagen para que su lado mayor no pase de `lado`.
export function medidaReducida(ancho: number, alto: number, lado: number): { ancho: number; alto: number } {
  const escala = Math.min(1, lado / Math.max(ancho, alto))
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) }
}

// JPEG de máximo 500 KB: baja la calidad y, si no alcanza, el tamaño.
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
