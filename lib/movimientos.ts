import { supabase } from './supabase'

// Capa de datos del hub Movimientos (rediseño §7.3). Selects directos:
// la RLS ya limita lo que ve cada rol (el empleado solo ve lo de hoy).

export type TipoBadgeMovimiento = 'exito' | 'peligro' | 'advertencia' | 'neutro'

export interface VentaListado {
  id: string
  numero: number
  total: number
  estado: string
  hora: string
  metodos: string[]
}

export interface VentaDetalle {
  id: string
  numero: number
  total: number
  estado: string
  fecha: string
  hora: string
  vendedor: string | null
  cliente: { nombre: string; apellido: string | null; telefono: string | null } | null
  nota: string | null
  efectivo_recibido: number
  cambio: number
  saldo_pendiente: number
  corregida: boolean
  correccion_motivo: string | null
  items: {
    descripcion: string
    talla: string | null
    color: string | null
    cantidad: number
    precio_unitario: number
    subtotal: number
  }[]
  pagos: { metodo: string; monto: number }[]
}

export interface DevolucionListado {
  id: string
  venta_id: string
  numero_venta: number
  tipo: string
  monto_devuelto: number
  monto_cobrado: number
  hora: string
  fecha: string
}

export interface DevolucionDetalle extends DevolucionListado {
  motivo: string | null
  metodo_reembolso: string | null
  metodo_cobro: string | null
  items: { descripcion: string; talla: string | null; color: string | null; cantidad: number }[]
}

// Bogotá es UTC-5 fijo (sin horario de verano).
const inicioBogota = (fecha: string) => `${fecha}T00:00:00-05:00`
const finBogota = (fecha: string) => `${fecha}T23:59:59.999-05:00`

export const horaCorta = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  })

export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  })

const BADGES_ESTADO: Record<string, { texto: string; tipo: TipoBadgeMovimiento }> = {
  completada: { texto: 'COMPLETADA', tipo: 'exito' },
  devuelta_parcial: { texto: 'DEV. PARCIAL', tipo: 'advertencia' },
  devuelta_total: { texto: 'DEVUELTA', tipo: 'peligro' },
  cambiada_parcial: { texto: 'CAMBIO', tipo: 'neutro' },
  cambiada_total: { texto: 'CAMBIO', tipo: 'neutro' },
  cancelada: { texto: 'CANCELADA', tipo: 'peligro' },
  separada: { texto: 'SEPARADA', tipo: 'advertencia' },
}

export function badgeEstadoVenta(estado: string): { texto: string; tipo: TipoBadgeMovimiento } {
  return BADGES_ESTADO[estado] ?? { texto: estado.toUpperCase(), tipo: 'neutro' }
}

const BADGES_TIPO_DEV: Record<string, { texto: string; tipo: TipoBadgeMovimiento }> = {
  total: { texto: 'TOTAL', tipo: 'peligro' },
  parcial: { texto: 'PARCIAL', tipo: 'advertencia' },
  cambio: { texto: 'CAMBIO', tipo: 'neutro' },
}

export function badgeTipoDevolucion(tipo: string): { texto: string; tipo: TipoBadgeMovimiento } {
  return BADGES_TIPO_DEV[tipo] ?? { texto: tipo.toUpperCase(), tipo: 'neutro' }
}

export async function listarVentasPeriodo(desde: string, hasta: string): Promise<VentaListado[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select('id, numero, total, estado, created_at, metodos_pago_venta(metodo)')
    .gte('created_at', inicioBogota(desde))
    .lte('created_at', finBogota(hasta))
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((v) => ({
    id: v.id,
    numero: v.numero,
    total: Number(v.total),
    estado: v.estado,
    hora: horaCorta(v.created_at),
    metodos: (v.metodos_pago_venta ?? []).map((m) => m.metodo),
  }))
}

export async function obtenerVentaDetalle(id: string): Promise<VentaDetalle | null> {
  const { data, error } = await supabase
    .from('ventas')
    .select(
      '*, venta_items(descripcion_snapshot, talla, color, cantidad, precio_unitario, subtotal), metodos_pago_venta(metodo, monto), vendedor:users!ventas_vendedor_id_fkey(nombre)'
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const v = data as any
  return {
    id: v.id,
    numero: v.numero,
    total: Number(v.total),
    estado: v.estado,
    fecha: fechaCorta(v.created_at),
    hora: horaCorta(v.created_at),
    vendedor: v.vendedor?.nombre ?? null,
    cliente: v.cliente_nombre
      ? { nombre: v.cliente_nombre, apellido: v.cliente_apellido, telefono: v.cliente_telefono }
      : null,
    nota: v.nota,
    efectivo_recibido: Number(v.efectivo_recibido ?? 0),
    cambio: Number(v.cambio ?? 0),
    saldo_pendiente: Number(v.saldo_pendiente ?? 0),
    corregida: !!v.corregida,
    correccion_motivo: v.correccion_motivo,
    items: (v.venta_items ?? []).map((i: any) => ({
      descripcion: i.descripcion_snapshot,
      talla: i.talla,
      color: i.color,
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
      subtotal: Number(i.subtotal),
    })),
    pagos: (v.metodos_pago_venta ?? []).map((p: any) => ({ metodo: p.metodo, monto: Number(p.monto) })),
  }
}

export async function listarDevoluciones(desde: string, hasta: string): Promise<DevolucionListado[]> {
  const { data, error } = await supabase
    .from('devoluciones')
    .select('id, venta_id, tipo_devolucion, monto_devuelto, monto_cobrado, created_at, venta:ventas(numero)')
    .gte('created_at', inicioBogota(desde))
    .lte('created_at', finBogota(hasta))
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((d) => {
    const fila = d as any
    return {
      id: fila.id,
      venta_id: fila.venta_id,
      numero_venta: fila.venta?.numero ?? 0,
      tipo: fila.tipo_devolucion,
      monto_devuelto: Number(fila.monto_devuelto ?? 0),
      monto_cobrado: Number(fila.monto_cobrado ?? 0),
      hora: horaCorta(fila.created_at),
      fecha: fechaCorta(fila.created_at),
    }
  })
}

export async function obtenerDevolucionDetalle(id: string): Promise<DevolucionDetalle | null> {
  const { data, error } = await supabase
    .from('devoluciones')
    .select(
      '*, venta:ventas(numero), devolucion_items(cantidad, venta_item:venta_items(descripcion_snapshot, talla, color))'
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const d = data as any
  return {
    id: d.id,
    venta_id: d.venta_id,
    numero_venta: d.venta?.numero ?? 0,
    tipo: d.tipo_devolucion,
    monto_devuelto: Number(d.monto_devuelto ?? 0),
    monto_cobrado: Number(d.monto_cobrado ?? 0),
    hora: horaCorta(d.created_at),
    fecha: fechaCorta(d.created_at),
    motivo: d.motivo,
    metodo_reembolso: d.metodo_reembolso,
    metodo_cobro: d.metodo_cobro,
    items: (d.devolucion_items ?? []).map((i: any) => ({
      descripcion: i.venta_item?.descripcion_snapshot ?? '',
      talla: i.venta_item?.talla ?? null,
      color: i.venta_item?.color ?? null,
      cantidad: Number(i.cantidad),
    })),
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
