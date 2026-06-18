// Utilidades para construir filtros de búsqueda de PostgREST de forma segura.
//
// Dentro de `.or()`, PostgREST usa la coma como separador de condiciones y los
// paréntesis como agrupadores del árbol lógico; las comillas y el backslash
// también tienen significado. Si el término del usuario se interpola crudo, esos
// caracteres pueden romper o alterar el filtro. Como en una búsqueda de nombres
// de productos/proveedores esos caracteres no aportan, los quitamos del término
// (sanitización) y mantenemos el formato simple `col.ilike.%término%`.

function sanitizar(termino: string): string {
  return termino.replace(/[,()"\\]/g, '')
}

/**
 * Construye la cadena para `query.or(...)` que busca el mismo `termino` (ilike,
 * con comodines `%...%`) en varias `columnas`. El término se sanitiza para que
 * sea seguro ante comas, paréntesis, comillas y backslash.
 */
export function orIlike(columnas: string[], termino: string): string {
  const valor = `%${sanitizar(termino)}%`
  return columnas.map((c) => `${c}.ilike.${valor}`).join(',')
}
