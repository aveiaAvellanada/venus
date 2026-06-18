export function compararConAyer(
  hoy: number,
  ayer: number
): { pct: number; direccion: 'sube' | 'baja' | 'igual'; sinBase: boolean } {
  if (ayer === 0) {
    if (hoy > 0) return { pct: 100, direccion: 'sube', sinBase: true }
    return { pct: 0, direccion: 'igual', sinBase: true }
  }
  const cambio = ((hoy - ayer) / ayer) * 100
  const pct = Math.round(Math.abs(cambio))
  if (cambio > 0) return { pct, direccion: 'sube', sinBase: false }
  if (cambio < 0) return { pct, direccion: 'baja', sinBase: false }
  return { pct: 0, direccion: 'igual', sinBase: false }
}
