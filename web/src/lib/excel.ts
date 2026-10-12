// Leer y escribir Excel en el navegador. `xlsx` pesa: se carga solo cuando se usa.

type Celda = string | number | null

// Filas de la primera hoja como objetos por encabezado (igual que la app).
// Cada fila trae `__rowNum__` (no enumerable) con su número real en el Excel.
export async function leerArchivoExcel(archivo: Blob): Promise<Record<string, unknown>[]> {
  const XLSX = await import('xlsx')
  const libro = XLSX.read(new Uint8Array(await archivo.arrayBuffer()), { type: 'array' })
  const hoja = libro.Sheets[libro.SheetNames[0]]
  if (!hoja) throw new Error('El archivo no tiene hojas.')
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja)
}

export async function descargarExcel(nombre: string, hojas: { nombre: string; filas: Celda[][]; anchos?: number[] }[]): Promise<void> {
  const XLSX = await import('xlsx')
  const libro = XLSX.utils.book_new()
  for (const h of hojas) {
    const hoja = XLSX.utils.aoa_to_sheet(h.filas)
    if (h.anchos) hoja['!cols'] = h.anchos.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(libro, hoja, h.nombre)
  }
  XLSX.writeFile(libro, nombre)
}
