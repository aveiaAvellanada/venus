import { supabase } from './supabase'

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

// ── Acceso a datos ────────────────────────────────────────────────────────────

export type VentaItemParaDevolucion = {
  venta_item_id: string
  tipo_producto: 'calzado' | 'varios'
  descripcion: string
  talla: string | null
  color: string | null
  cantidad_vendida: number
  cantidad_ya_devuelta: number
  precio_unitario: number
}

export type VentaParaDevolucion = {
  venta_id: string
  numero: number
  fecha: string
  cliente_nombre: string | null
  estado: string
  items: VentaItemParaDevolucion[]
}

export type ItemDevolucionInput = {
  venta_item_id: string
  cantidad: number
  cambio_talla_color_id?: string
  precio_reemplazo?: number
}

export type RegistrarDevolucionInput = {
  venta_id: string
  motivo: string
  tipo_devolucion: TipoDevolucion
  metodo_reembolso?: MetodoDinero
  metodo_cobro?: MetodoDinero
  monto_devuelto: number
  monto_cobrado: number
  items: ItemDevolucionInput[]
}

// Busca una venta por número con sus items y la cantidad ya devuelta por item.
// Usa dos consultas separadas (devoluciones → devolucion_items) en lugar del
// embed PostgREST devoluciones!inner para evitar problemas de tipado con los
// tipos generados.
export async function buscarVentaParaDevolucion(numero: number): Promise<VentaParaDevolucion | null> {
  const { data: venta, error } = await supabase
    .from('ventas')
    .select('id, numero, created_at, cliente_nombre, estado')
    .eq('numero', numero)
    .maybeSingle()
  if (error) throw error
  if (!venta) return null

  const { data: items, error: e2 } = await supabase
    .from('venta_items')
    .select('id, tipo_producto, descripcion_snapshot, talla, color, cantidad, precio_unitario')
    .eq('venta_id', venta.id)
  if (e2) throw e2

  // Dos consultas para calcular cantidades ya devueltas por item
  const { data: devIds, error: e3 } = await supabase
    .from('devoluciones')
    .select('id')
    .eq('venta_id', venta.id)
  if (e3) throw e3

  const yaDevuelto: Record<string, number> = {}
  if (devIds && devIds.length > 0) {
    const ids = devIds.map((d) => d.id)
    const { data: devItems, error: e4 } = await supabase
      .from('devolucion_items')
      .select('venta_item_id, cantidad')
      .in('devolucion_id', ids)
    if (e4) throw e4
    for (const d of devItems ?? []) {
      yaDevuelto[d.venta_item_id] = (yaDevuelto[d.venta_item_id] ?? 0) + Number(d.cantidad)
    }
  }

  return {
    venta_id: venta.id,
    numero: venta.numero,
    fecha: venta.created_at,
    cliente_nombre: venta.cliente_nombre,
    estado: venta.estado,
    items: (items ?? []).map((i) => ({
      venta_item_id: i.id,
      tipo_producto: i.tipo_producto as 'calzado' | 'varios',
      descripcion: i.descripcion_snapshot,
      talla: i.talla,
      color: i.color,
      cantidad_vendida: Number(i.cantidad),
      cantidad_ya_devuelta: yaDevuelto[i.id] ?? 0,
      precio_unitario: Number(i.precio_unitario),
    })),
  }
}

export async function registrarDevolucion(input: RegistrarDevolucionInput): Promise<{ devolucion_id: string }> {
  // p_metodo_reembolso / p_metodo_cobro son nullable en el RPC pero los tipos
  // generados los declaran como string. Se pasa cadena vacía y el RPC los
  // recibe como texto vacío; el comportamiento es equivalente a null porque
  // los checks del RPC usan `is null` sobre el valor — para garantizar que
  // Postgres los reciba como NULL enviamos null y lo afirmamos como string.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metodoReembolso = (input.metodo_reembolso ?? null) as unknown as string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metodoCobro = (input.metodo_cobro ?? null) as unknown as string
  const { data, error } = await supabase.rpc('registrar_devolucion', {
    p_venta_id: input.venta_id,
    p_motivo: input.motivo,
    p_tipo_devolucion: input.tipo_devolucion,
    p_metodo_reembolso: metodoReembolso,
    p_metodo_cobro: metodoCobro,
    p_monto_devuelto: input.monto_devuelto,
    p_monto_cobrado: input.monto_cobrado,
    p_items: input.items,
  })
  if (error) throw error
  return data as { devolucion_id: string }
}
