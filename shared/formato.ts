// Pesos colombianos sin decimales: $1.234.567
// Con el punto puesto a mano: no depende de que el teléfono o el navegador traiga
// los datos del idioma (es-CO).
export const pesos = (n: number): string => '$' + (Math.round(n) < 0 ? '-' : '') + conPuntosDeMiles(Math.abs(Math.round(n)))

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

// "$ 1.250.000" o "1250000" → 1250000. Vacío → NaN (para distinguir de 0).
export function leerPesos(texto: string): number {
  const limpio = texto.replace(/[$\s.]/g, '').replace(',', '.')
  return limpio === '' ? NaN : Number(limpio)
}

export const soloDigitos = (texto: string): string => texto.replace(/\D/g, '')

// Lo que se ve en un campo de pesos mientras se escribe, con punto de miles:
// "1500000" → "1.500.000". Acepta también lo que viene de la base ("45000.00",
// un decimal, se redondea) y lo ya formateado ("45.000"). Vacío → "".
// El campo guarda solo los dígitos (soloDigitos de lo escrito).
export function conPuntosDeMiles(texto: string | number | null | undefined): string {
  if (texto == null) return ''
  const t = String(texto).trim()
  if (t === '') return ''
  const yaConPuntos = /^\d{1,3}(\.\d{3})+$/.test(t)
  const conDecimales = !yaConPuntos && /^\d+[.,]\d{1,2}$/.test(t)
  const digitos = conDecimales ? String(Math.round(Number(t.replace(',', '.')))) : soloDigitos(t)
  if (digitos === '') return ''
  return digitos.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
