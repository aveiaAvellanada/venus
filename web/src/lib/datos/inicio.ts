import { conStockBajo, type DashboardDueno, type ProductoStockBajo, type ResumenDia } from '@shared/reportes'
import { supabase } from '../supabase'

export async function resumenDelDia(fecha: string): Promise<ResumenDia> {
  const { data, error } = await supabase.rpc('obtener_resumen_dia', { p_fecha: fecha })
  if (error) throw error
  return data as unknown as ResumenDia
}

export async function alertasDelDueno(diasAlerta = 7): Promise<DashboardDueno> {
  const { data, error } = await supabase.rpc('obtener_dashboard_dueno', { p_dias_alerta: diasAlerta })
  if (error) throw error
  return data as unknown as DashboardDueno
}

export async function productosConStockBajo(): Promise<ProductoStockBajo[]> {
  const { data, error } = await supabase
    .from('productos_calzado')
    .select('id, descripcion, talla, stock_actual, stock_minimo')
    .eq('activo', true)
  if (error) throw error
  return conStockBajo(data ?? []).sort((a, b) => a.stock_actual - b.stock_actual)
}

export interface CajaDelDia {
  estado: string
  apertura_at: string | null
  cierre_at: string | null
  base_inicial: number
  diferencia: number | null
}

export async function cajaDelDia(fecha: string): Promise<CajaDelDia | null> {
  const { data, error } = await supabase
    .from('cierres_caja')
    .select('estado, apertura_at, cierre_at, base_inicial, diferencia')
    .eq('fecha', fecha)
    .maybeSingle()
  if (error) throw error
  return data
}
