import { supabase } from './supabase'

export type Periodo = 'hoy' | 'semana' | 'mes' | 'anio'
export type Granularidad = 'dia' | 'semana' | 'mes'

export interface RangoPeriodo {
  desde: string
  hasta: string
  granularidad: Granularidad
}

export interface VentasBucket {
  inicio: string
  total: number
  num_ventas: number
}

export interface GastoPeriodo {
  tipo: 'fijo' | 'variable'
  nombre: string
  detalle: string | null
  monto: number
  fecha: string
}

export interface GastosPeriodo {
  total: number
  gastos: GastoPeriodo[]
}

// "Hoy" del negocio = fecha en America/Bogota (igual que lib/caja.ts).
function fechaBogota(momento: Date): string {
  return momento.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
}

// Suma días/meses sobre una fecha YYYY-MM-DD sin depender de la zona local:
// se opera a mediodía UTC para que nunca cambie de día por desfase horario.
function desplazar(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function inicioDeMesHaceMeses(fecha: string, meses: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - meses)
  return d.toISOString().slice(0, 10)
}

export function rangoParaPeriodo(periodo: Periodo, ahora: Date = new Date()): RangoPeriodo {
  const hoy = fechaBogota(ahora)
  switch (periodo) {
    case 'hoy':
      return { desde: hoy, hasta: hoy, granularidad: 'dia' }
    case 'semana':
      return { desde: desplazar(hoy, -6), hasta: hoy, granularidad: 'dia' }
    case 'mes':
      return { desde: desplazar(hoy, -29), hasta: hoy, granularidad: 'dia' }
    case 'anio':
      return { desde: inicioDeMesHaceMeses(hoy, 11), hasta: hoy, granularidad: 'mes' }
  }
}

// Etiqueta corta para el eje del gráfico (§6.14). Zona-segura: mediodía UTC.
export function etiquetaBucket(inicio: string, granularidad: Granularidad): string {
  const d = new Date(`${inicio}T12:00:00Z`)
  const opciones: Intl.DateTimeFormatOptions =
    granularidad === 'dia'
      ? { weekday: 'short', timeZone: 'UTC' }
      : granularidad === 'semana'
        ? { day: 'numeric', month: 'short', timeZone: 'UTC' }
        : { month: 'short', timeZone: 'UTC' }
  return d.toLocaleDateString('es-CO', opciones).replace(/\./g, '').replace(' de ', ' ').toLowerCase()
}

export async function obtenerVentasPorSubperiodo(
  desde: string,
  hasta: string,
  granularidad: Granularidad
): Promise<VentasBucket[]> {
  const { data, error } = await supabase.rpc('obtener_ventas_por_subperiodo', {
    p_desde: desde,
    p_hasta: hasta,
    p_granularidad: granularidad,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as VentasBucket[]
}

export async function obtenerGastosPeriodo(desde: string, hasta: string): Promise<GastosPeriodo> {
  const { data, error } = await supabase.rpc('obtener_gastos_periodo', {
    p_desde: desde,
    p_hasta: hasta,
  })
  if (error) throw new Error(error.message)
  return (data ?? { total: 0, gastos: [] }) as unknown as GastosPeriodo
}
