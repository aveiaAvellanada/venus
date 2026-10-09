// "Hoy" del negocio es la fecha en la zona horaria de la tienda, no la del
// computador o teléfono que consulta (un computador en UTC ya va en "mañana"
// desde las 7 p. m. de Colombia). Para replicar en otro negocio se cambia la zona.
export const ZONA_HORARIA_NEGOCIO = 'America/Bogota'

export function hoyEn(ahora: Date = new Date(), zona: string = ZONA_HORARIA_NEGOCIO): string {
  return ahora.toLocaleDateString('en-CA', { timeZone: zona })
}

// Suma días a una fecha YYYY-MM-DD. Se opera a mediodía UTC para que el
// resultado nunca cambie de día por desfase horario.
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

// "viernes, 9 de octubre"
export function fechaLarga(fecha: string): string {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  })
}
