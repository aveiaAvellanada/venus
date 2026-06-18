import { supabase } from './supabase'

export type ResumenDia = {
  total_ventas: number
  total_general: number
  total_efectivo: number
  total_nequi: number
  total_daviplata: number
}

export type ProductoStockBajo = {
  id: string
  descripcion: string
  talla: string | null
  stock_actual: number
  stock_minimo: number
}

export type ProveedorPorVencer = {
  proveedor: string
  fecha_vencimiento: string
  saldo: number
  vencida: boolean
}
export type EmpleadoSinActividad = { id: string; nombre: string }
export type DashboardDueno = {
  proveedores_por_vencer: ProveedorPorVencer[]
  empleados_sin_actividad: EmpleadoSinActividad[]
}

export async function obtenerResumenDia(fecha: string): Promise<ResumenDia> {
  const { data, error } = await supabase.rpc('obtener_resumen_dia', { p_fecha: fecha })
  if (error) throw error
  return data as unknown as ResumenDia
}

// Inventario pequeño: traemos los activos y filtramos stock_actual <= stock_minimo en cliente
// (PostgREST no compara dos columnas entre sí).
export async function listarStockBajo(): Promise<ProductoStockBajo[]> {
  const { data, error } = await supabase
    .from('productos_calzado')
    .select('id, descripcion, talla, stock_actual, stock_minimo')
    .eq('activo', true)
  if (error) throw error
  return (data ?? []).filter((p) => p.stock_actual <= p.stock_minimo)
}

export async function obtenerDashboardDueno(diasAlerta = 7): Promise<DashboardDueno> {
  const { data, error } = await supabase.rpc('obtener_dashboard_dueno', { p_dias_alerta: diasAlerta })
  if (error) throw error
  return data as unknown as DashboardDueno
}

export type TopProducto = { producto: string; unidades: number; monto: number }
export type ProductoSinMovimiento = { id: string; producto: string }
export type DiaTop = { fecha: string; monto: number }
export type ReportePeriodo = {
  total_vendido: number
  total_anterior: number
  num_ventas: number
  efectivo: number
  nequi: number
  daviplata: number
  dia_top: DiaTop | null
  top_productos: TopProducto[]
  sin_movimiento: ProductoSinMovimiento[]
}

export async function obtenerReportePeriodo(desde: string, hasta: string): Promise<ReportePeriodo> {
  const { data, error } = await supabase.rpc('obtener_reporte_periodo', { p_desde: desde, p_hasta: hasta })
  if (error) throw error
  return data as unknown as ReportePeriodo
}

export function compararConAyer(
  hoy: number,
  ayer: number
): { pct: number; direccion: 'sube' | 'baja' | 'igual'; sinBase: boolean } {
  if (ayer === 0) {
    if (hoy > 0) return { pct: 100, direccion: 'sube', sinBase: true }
    return { pct: 0, direccion: 'igual', sinBase: true }
  }
  const cambio = ((hoy - ayer) / ayer) * 100
  const pct = Math.round(Math.abs(cambio))
  if (cambio > 0) return { pct, direccion: 'sube', sinBase: false }
  if (cambio < 0) return { pct, direccion: 'baja', sinBase: false }
  return { pct: 0, direccion: 'igual', sinBase: false }
}
