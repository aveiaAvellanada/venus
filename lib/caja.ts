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
// Sin base (null/undefined), el servidor usa la base predeterminada de la config.
export async function abrirCaja(baseInicial?: number | null) {
  const { data, error } = await supabase.rpc('abrir_caja', {
    p_base_inicial: baseInicial ?? undefined,
  })
  if (error) throw error
  return data
}

// Base que Andrés configuró; se propone al abrir la caja (editable).
export async function obtenerBasePredeterminada(): Promise<number> {
  const { data, error } = await supabase.rpc('obtener_base_predeterminada')
  if (error) throw error
  return Number(data ?? 0)
}

export interface ArqueoCaja {
  base_inicial: number
  efectivo_ventas: number
  gastos_caja: number
  efectivo_esperado: number
}

// Efectivo esperado = base + efectivo de ventas − gastos pagados del cajón.
// Es la misma fórmula con la que cerrar_caja calcula la diferencia.
export async function obtenerArqueoCaja(): Promise<ArqueoCaja> {
  const { data, error } = await supabase.rpc('obtener_arqueo_caja')
  if (error) throw error
  const a = (data ?? {}) as Record<string, unknown>
  return {
    base_inicial: Number(a.base_inicial ?? 0),
    efectivo_ventas: Number(a.efectivo_ventas ?? 0),
    gastos_caja: Number(a.gastos_caja ?? 0),
    efectivo_esperado: Number(a.efectivo_esperado ?? 0),
  }
}

export async function reabrirCaja() {
  const { data, error } = await supabase.rpc('reabrir_caja')
  if (error) throw error
  return data
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
