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

// Abrir, cerrar y reabrir van por RPC: la app ya no escribe cierres_caja
// directo (RLS). El servidor calcula totales y diferencia y deja auditoría.
export async function abrirCaja() {
  const { data, error } = await supabase.rpc('abrir_caja')
  if (error) throw error
  return data
}

export async function reabrirCaja() {
  const { data, error } = await supabase.rpc('reabrir_caja')
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
    total_bre_b: Number(resumen?.total_bre_b || 0),
    total_otro: Number(resumen?.total_otro || 0)
  }
}

// efectivo_contado = null solo se acepta con el modo de cierre "sin diferencia".
export async function cerrarCaja(params: { efectivo_contado: number | null; nota: string | null }) {
  const { data, error } = await supabase.rpc('cerrar_caja', {
    p_efectivo_contado: params.efectivo_contado ?? undefined,
    p_nota: params.nota ?? undefined,
  })
  if (error) throw error
  return data
}

export async function cerrarCajaSinDiferencia() {
  return cerrarCaja({ efectivo_contado: null, nota: null })
}

export async function obtenerModoCierre(): Promise<'con_diferencia' | 'sin_diferencia'> {
  // Vía RPC SECURITY DEFINER: caja_config es de lectura solo-dueño por RLS, pero
  // todos los roles cierran caja y necesitan el modo configurado.
  const { data, error } = await supabase.rpc('obtener_modo_cierre')
  if (error) throw error
  return (data ?? 'con_diferencia') as 'con_diferencia' | 'sin_diferencia'
}
