import { supabase } from './supabase'

export function construirLinkWhatsapp(telefono: string | null, mensaje: string): string {
  const base = telefono ? `https://wa.me/${telefono}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(mensaje)}`
}

export type ReporteDiario = {
  fecha: string
  total_vendido: number
  num_ventas: number
  efectivo: number
  nequi: number
  daviplata: number
  mas_vendido: string | null
  stock_bajo: string[]
  caja_cuadro: boolean | null
  diferencia: number | null
  mensaje: string
}

export type ReporteConfig = {
  whatsapp_on: boolean
  correo_on: boolean
  correo_destino: string | null
  hora_envio: string | null
}

export async function obtenerReporteDiario(fecha: string): Promise<ReporteDiario> {
  const { data, error } = await supabase.rpc('obtener_reporte_diario', { p_fecha: fecha })
  if (error) throw error
  return data as unknown as ReporteDiario
}

export async function obtenerReporteConfig(): Promise<ReporteConfig | null> {
  const { data, error } = await supabase
    .from('reporte_config')
    .select('whatsapp_on, correo_on, correo_destino, hora_envio')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function guardarReporteConfig(cfg: {
  whatsapp_on: boolean
  correo_on: boolean
  correo_destino: string | null
}): Promise<void> {
  const { data: row, error: selErr } = await supabase.from('reporte_config').select('id').limit(1).single()
  if (selErr) throw selErr
  const { error } = await supabase.from('reporte_config').update(cfg).eq('id', row.id)
  if (error) throw error
}

export async function dispararReporteCorreo(fecha: string): Promise<void> {
  const { error } = await supabase.functions.invoke('enviar-reporte-diario', { body: { fecha } })
  if (error) throw error
}
