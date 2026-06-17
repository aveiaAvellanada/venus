export type TipoDevolucion = 'total' | 'parcial' | 'cambio'
export type MetodoDinero = 'efectivo' | 'nequi' | 'daviplata'

export function calcularDiferenciaCambio(
  precioOriginal: number, precioReemplazo: number, cantidad: number
): number {
  return Math.round((precioReemplazo - precioOriginal) * cantidad)
}

export function netearDevolucion(
  tipo: TipoDevolucion,
  items: { diferencia: number; subtotal: number }[]
): { monto_devuelto: number; monto_cobrado: number } {
  if (tipo === 'cambio') {
    const diff = items.reduce((s, i) => s + i.diferencia, 0)
    if (diff > 0) return { monto_devuelto: 0, monto_cobrado: diff }
    if (diff < 0) return { monto_devuelto: -diff, monto_cobrado: 0 }
    return { monto_devuelto: 0, monto_cobrado: 0 }
  }
  const total = items.reduce((s, i) => s + i.subtotal, 0)
  return { monto_devuelto: total, monto_cobrado: 0 }
}

export function validarCantidades(
  items: { venta_item_id: string; cantidad: number }[],
  vendido: Record<string, number>,
  yaDevuelto: Record<string, number>
): string[] {
  const errores: string[] = []
  for (const it of items) {
    if (it.cantidad <= 0) { errores.push('La cantidad debe ser mayor a 0'); continue }
    const disponible = (vendido[it.venta_item_id] ?? 0) - (yaDevuelto[it.venta_item_id] ?? 0)
    if (it.cantidad > disponible) errores.push('La cantidad a devolver de un producto supera lo disponible')
  }
  return errores
}
