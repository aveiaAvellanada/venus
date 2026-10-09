import { ZONA_HORARIA_NEGOCIO } from '@shared/fechas'

// Lo propio de cada negocio sale de la configuración, no del código: así el
// mismo panel sirve para otra tienda con sus propias variables (fase 5:
// desde la tabla de configuración del negocio).
export const NEGOCIO = {
  nombre: import.meta.env.VITE_NEGOCIO_NOMBRE || 'Mi negocio',
  zonaHoraria: import.meta.env.VITE_NEGOCIO_ZONA_HORARIA || ZONA_HORARIA_NEGOCIO,
}
