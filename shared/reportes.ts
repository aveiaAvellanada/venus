// Tipos de lo que devuelven las RPC de reportes (los usan la app y el panel web).

export type ResumenDia = {
  total_ventas: number
  total_general: number
  total_efectivo: number
  total_nequi: number
  total_bre_b: number
  total_otro: number
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

// Inventario pequeño: se traen los activos y se filtra stock_actual <= stock_minimo
// en el cliente (PostgREST no compara dos columnas entre sí).
export const conStockBajo = <T extends { stock_actual: number; stock_minimo: number }>(productos: T[]): T[] =>
  productos.filter((p) => p.stock_actual <= p.stock_minimo)
