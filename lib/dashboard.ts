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

// Mes calendario del Menú: del día 1 al último (o hasta hoy en el mes en
// curso). `atras` = cuántos meses antes del actual (0 = este mes).
export function rangoDeMes(atras: number, ahora: Date = new Date()): RangoPeriodo {
  const hoy = fechaBogota(ahora)
  const desde = inicioDeMesHaceMeses(hoy, atras)
  const d = new Date(`${desde}T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 1)
  d.setUTCDate(0)
  const ultimo = d.toISOString().slice(0, 10)
  return { desde, hasta: ultimo < hoy ? ultimo : hoy, granularidad: 'dia' }
}

// "2026-10-01" → "Octubre 2026"
export function tituloMes(fecha: string): string {
  const t = new Date(`${fecha}T12:00:00Z`)
    .toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .replace(' de ', ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// "2026-10-14" → "mar 14 oct": para el detalle de un día tocado.
export function etiquetaDia(fecha: string): string {
  return new Date(`${fecha}T12:00:00Z`)
    .toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(' de ', ' ')
    .toLowerCase()
}

// Casillas del calendario de un mes, de lunes a domingo: null = casilla vacía
// antes del día 1 o después del último, hasta completar la semana.
export function celdasDelMes(primerDia: string): (string | null)[] {
  const d = new Date(`${primerDia}T12:00:00Z`)
  const vacias = (d.getUTCDay() + 6) % 7
  const celdas: (string | null)[] = Array(vacias).fill(null)
  const mes = d.getUTCMonth()
  while (d.getUTCMonth() === mes) {
    celdas.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  while (celdas.length % 7) celdas.push(null)
  return celdas
}

// Granularidad para un rango elegido a mano: hasta 31 días → barras por día;
// más largo → barras por mes.
export function granularidadParaRango(desde: string, hasta: string): Granularidad {
  const dias =
    (new Date(`${hasta}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / 86400000
  return dias <= 31 ? 'dia' : 'mes'
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
