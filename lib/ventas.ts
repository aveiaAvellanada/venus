import { supabase } from './supabase'
import type { ItemCarrito, PagoInput, ProductoVendible } from './carrito'

export interface VentaResumen {
  id: string
  numero: number
  total: number
  hora: string
  metodos: string
}

// Medianoche de hoy en Bogotá (UTC-5, sin horario de verano) como ISO UTC.
function inicioDeHoyBogota(): string {
  const offsetMs = 5 * 60 * 60 * 1000
  const bog = new Date(Date.now() - offsetMs)
  const medianoche = Date.UTC(bog.getUTCFullYear(), bog.getUTCMonth(), bog.getUTCDate())
  return new Date(medianoche + offsetMs).toISOString()
}

export async function buscarProductos(q: string): Promise<ProductoVendible[]> {
  const termino = q.trim()
  const like = `%${termino}%`

  let calzadoQ = supabase
    .from('productos_calzado')
    .select('id, descripcion, referencia, talla, color, precio_venta, stock_actual')
    .eq('activo', true)
    .gt('stock_actual', 0)
    .limit(10)
  if (termino) {
    calzadoQ = calzadoQ.or(
      `descripcion.ilike.${like},referencia.ilike.${like},talla.ilike.${like},color.ilike.${like}`,
    )
  }

  let variosQ = supabase
    .from('productos_varios')
    .select('id, nombre, unidad_medida, precio_venta, stock_actual')
    .eq('activo', true)
    .gt('stock_actual', 0)
    .limit(10)
  if (termino) variosQ = variosQ.ilike('nombre', like)

  const [calzado, varios] = await Promise.all([calzadoQ, variosQ])
  if (calzado.error) throw calzado.error
  if (varios.error) throw varios.error

  const deCalzado: ProductoVendible[] = (calzado.data ?? []).map(c => ({
    tipo: 'calzado',
    id: c.id,
    titulo: c.descripcion,
    detalle: [c.talla ? `Talla ${c.talla}` : null, c.color].filter(Boolean).join(' · '),
    precio: Number(c.precio_venta),
    stock: Number(c.stock_actual),
  }))
  const deVarios: ProductoVendible[] = (varios.data ?? []).map(v => ({
    tipo: 'varios',
    id: v.id,
    titulo: v.nombre,
    detalle: `por ${v.unidad_medida}`,
    precio: Number(v.precio_venta),
    stock: Number(v.stock_actual),
    unidad: v.unidad_medida,
  }))
  return [...deCalzado, ...deVarios].slice(0, 20)
}

export interface RegistrarVentaInput {
  items: ItemCarrito[]
  pagos: PagoInput[]
  efectivoRecibido: number | null
  cliente?: { nombre?: string; apellido?: string; telefono?: string }
}

export async function registrarVenta(input: RegistrarVentaInput): Promise<{ numero: number }> {
  const { data, error } = await supabase.rpc('registrar_venta', {
    p_items: input.items.map(i => ({
      tipo: i.producto.tipo,
      producto_id: i.producto.id,
      cantidad: i.cantidad,
    })),
    p_pagos: input.pagos.map(p => ({ metodo: p.metodo, monto: p.monto })),
    p_efectivo_recibido: input.efectivoRecibido ?? undefined,
    p_cliente_nombre: input.cliente?.nombre ?? undefined,
    p_cliente_apellido: input.cliente?.apellido ?? undefined,
    p_cliente_telefono: input.cliente?.telefono ?? undefined,
  })
  if (error) throw new Error(traducirError(error.message))
  const res = data as { numero: number }
  return { numero: res.numero }
}

function traducirError(msg: string): string {
  if (msg.includes('Stock insuficiente')) {
    const prod = msg.split('Stock insuficiente para ')[1] ?? 'un producto'
    return `Ya no hay suficiente stock de ${prod}. Actualiza el carrito.`
  }
  if (msg.includes('pagos no suman')) return 'Los pagos no suman el total.'
  if (msg.includes('efectivo recibido')) return 'El efectivo recibido es menor al pago en efectivo.'
  if (/network|fetch|failed to fetch|timeout|conexión|conexion/i.test(msg)) {
    return 'Sin conexión. La venta no se guardó. Intenta de nuevo.'
  }
  return 'No se pudo registrar la venta. Intenta de nuevo.'
}

export async function resumenHoy(): Promise<{ cantidad: number; total: number }> {
  const { data, error } = await supabase
    .from('ventas')
    .select('total')
    .eq('estado', 'completada')
    .gte('created_at', inicioDeHoyBogota())
  if (error) throw error
  const filas = data ?? []
  return { cantidad: filas.length, total: filas.reduce((s, v) => s + Number(v.total), 0) }
}

export async function listarVentasHoy(): Promise<VentaResumen[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select('id, numero, total, created_at, metodos_pago_venta(metodo)')
    .eq('estado', 'completada')
    .gte('created_at', inicioDeHoyBogota())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(v => ({
    id: v.id,
    numero: v.numero,
    total: Number(v.total),
    hora: new Date(v.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    metodos: (v.metodos_pago_venta ?? []).map(m => m.metodo).join(', '),
  }))
}
