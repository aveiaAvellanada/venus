import { supabase } from './supabase'

export async function obtenerCajaHoy() {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) // format: YYYY-MM-DD
  const { data, error } = await supabase
    .from('cierres_caja')
    .select('*')
    .eq('fecha', hoy)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function abrirCaja() {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const { data, error } = await supabase
    .from('cierres_caja')
    .insert({
      fecha: hoy,
      estado: 'abierta',
      modo: 'manual',
      apertura_at: new Date().toISOString(),
      total_ventas: 0,
      total_general: 0,
      total_efectivo: 0,
      total_nequi: 0,
      total_daviplata: 0,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function reabrirCaja() {
  const caja = await obtenerCajaHoy()
  if (!caja) throw new Error('No hay caja de hoy para reabrir.')
  if (caja.estado === 'abierta') return caja

  const { data, error } = await supabase
    .from('cierres_caja')
    .update({
      estado: 'abierta',
      cierre_at: null,
      efectivo_contado: null,
      diferencia: null,
      diferencia_nota: null,
    })
    .eq('id', caja.id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function obtenerResumenEnVivo() {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
  const { data, error } = await supabase.rpc('obtener_resumen_dia', { p_fecha: hoy })
  if (error) throw error
  
  // Dependiendo de cómo lo emita Postgres (json o record), forzamos la estructura
  const resumen = data as any
  return {
    total_ventas: Number(resumen?.total_ventas || 0),
    total_general: Number(resumen?.total_general || 0),
    total_efectivo: Number(resumen?.total_efectivo || 0),
    total_nequi: Number(resumen?.total_nequi || 0),
    total_daviplata: Number(resumen?.total_daviplata || 0)
  }
}

export async function cerrarCaja(params: { efectivo_contado: number, diferencia: number, nota: string | null }) {
  const caja = await obtenerCajaHoy()
  if (!caja) throw new Error('No hay caja abierta para cerrar hoy.')
  if (caja.estado === 'cerrada') throw new Error('La caja de hoy ya se cerró.')
  
  const resumen = await obtenerResumenEnVivo()
  
  const { data, error } = await supabase
    .from('cierres_caja')
    .update({
      estado: 'cerrada',
      cierre_at: new Date().toISOString(),
      total_ventas: resumen.total_ventas,
      total_general: resumen.total_general,
      total_efectivo: resumen.total_efectivo,
      total_nequi: resumen.total_nequi,
      total_daviplata: resumen.total_daviplata,
      efectivo_contado: params.efectivo_contado,
      diferencia: params.diferencia,
      diferencia_nota: params.nota || null,
    })
    .eq('id', caja.id)
    .select()
    .single()
    
  if (error) throw error
  return data
}
