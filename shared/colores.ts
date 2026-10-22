// Colores de calzado, comunes a la app y al panel web. Un zapato tiene hasta
// dos colores y se guardan como "Rojo y blanco".

const COLORES: Record<string, string> = {
  negro: '#1C1C1E',
  blanco: '#FFFFFF',
  gris: '#9CA3AF',
  azul: '#2563EB',
  rojo: '#DC2626',
  verde: '#16A34A',
  amarillo: '#EAB308',
  café: '#92400E',
  cafe: '#92400E',
  marrón: '#92400E',
  marron: '#92400E',
  rosado: '#EC4899',
  rosa: '#EC4899',
  morado: '#8B5CF6',
  naranja: '#F97316',
  beige: '#D6C7A1',
  dorado: '#EAB308',
  plateado: '#CBD5E1',
}

// Los que se sugieren al escribir un color (sin repetir sinónimos).
export const COLORES_BASE: string[] = [
  'Negro', 'Blanco', 'Gris', 'Azul', 'Rojo', 'Verde', 'Amarillo', 'Café',
  'Rosado', 'Morado', 'Naranja', 'Beige', 'Dorado', 'Plateado',
]

export function colorAHex(nombre: string): string {
  const n = nombre.trim().toLowerCase()
  // "Azul rey" → azul: el primer término suele ser el color base.
  return COLORES[n] ?? COLORES[n.split(/\s+/)[0]] ?? '#9CA3AF'
}

export const MAX_COLORES = 2

// Al leer se aceptan también "rojo/blanco", "rojo, blanco" o "rojo + blanco".
export function coloresDeNombre(nombre: string | null | undefined): string[] {
  return (nombre ?? '')
    .split(/\s+y\s+|\s*[/,+]\s*/i)
    .map((c) => c.trim())
    .filter(Boolean)
}

// "rojo/blanco" → "Rojo y blanco". Vacío → null.
export function nombreColores(nombre: string | null | undefined): string | null {
  const colores = coloresDeNombre(nombre)
  if (colores.length === 0) return null
  return colores
    .map((c, i) => (i === 0 ? c.charAt(0).toUpperCase() : c.charAt(0).toLowerCase()) + c.slice(1))
    .join(' y ')
}

// Colores del círculo: uno o dos (cada mitad un color).
export function hexesDeColor(nombre: string): string[] {
  return coloresDeNombre(nombre).slice(0, MAX_COLORES).map(colorAHex)
}

export const MENSAJE_MAX_COLORES = 'Un zapato tiene máximo dos colores (ej. "Rojo y blanco").'
