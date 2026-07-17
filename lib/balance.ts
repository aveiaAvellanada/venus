import { supabase } from './supabase'

export type Balance = {
  ingresos: {
    efectivo: number; nequi: number; bre_b: number; otro: number
    reembolsos: number; cobros_cambios: number; total_neto: number
  }
  egresos: {
    gastos_fijos: number; gastos_variables: number
    pagos_proveedores: number; sueldos: number; total: number
  }
  balance: number
}

export async function obtenerBalance(desde: string, hasta: string): Promise<Balance> {
  const { data, error } = await supabase.rpc('obtener_balance', { p_desde: desde, p_hasta: hasta })
  if (error) throw error
  return data as unknown as Balance
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function proyeccionMes(balanceAcumulado: number, diaActual: number, diasDelMes: number): number {
  if (diaActual <= 0) return 0
  return Math.round((balanceAcumulado / diaActual) * diasDelMes)
}

export function rangoPeriodo(
  tipo: 'semana' | 'mes' | 'anio' | 'rango',
  refDate: Date,
  rangoCustom?: { desde: string; hasta: string }
): { desde: string; hasta: string } {
  if (tipo === 'rango') {
    if (!rangoCustom) throw new Error('rangoPeriodo: se requiere rangoCustom para el tipo "rango".')
    return rangoCustom
  }
  if (tipo === 'mes') {
    const desde = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
    const hasta = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)
    return { desde: toISO(desde), hasta: toISO(hasta) }
  }
  if (tipo === 'anio') {
    const desde = new Date(refDate.getFullYear(), 0, 1)
    const hasta = new Date(refDate.getFullYear(), 11, 31)
    return { desde: toISO(desde), hasta: toISO(hasta) }
  }
  // semana: lunes (1) a domingo (0→7)
  const dow = refDate.getDay() === 0 ? 7 : refDate.getDay()
  const lunes = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - (dow - 1))
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6)
  return { desde: toISO(lunes), hasta: toISO(domingo) }
}
