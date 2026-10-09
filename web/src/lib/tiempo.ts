// Hora del día en la zona del negocio (0–23), no la del computador.
export function horaEn(ahora: Date, zona: string): number {
  return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: zona }).format(ahora))
}

export function saludo(hora: number): string {
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// "8:02 a. m."
export function horaCorta(momento: string, zona: string): string {
  return new Date(momento).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: zona })
}
