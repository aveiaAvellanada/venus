// Pesos colombianos sin decimales: $1.234.567
export const pesos = (n: number): string => '$' + Math.round(n).toLocaleString('es-CO')

// Cambio relativo entre dos montos (0.25 = +25 %). Sin base para comparar → null.
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null
  return (actual - anterior) / anterior
}

// "+25 %" / "−8 %" (signo menos tipográfico).
export function porcentaje(v: number): string {
  const n = Math.round(Math.abs(v) * 100)
  return `${v < 0 ? '−' : '+'}${n} %`
}
