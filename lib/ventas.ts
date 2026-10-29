import { supabase } from './supabase'
import { type ItemCarrito, type PagoInput } from './carrito'
import { SinConexionError, conTiempoLimite, esErrorDeRed } from './conexion'

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

export interface RegistrarVentaInput {
  items: ItemCarrito[]
  pagos: PagoInput[]
  efectivoRecibido: number | null
  // documento: cédula o NIT (texto libre, opcional).
  cliente?: { nombre?: string; apellido?: string; telefono?: string; documento?: string }
}

// `clave` identifica el intento (ver lib/intentoVenta.ts): reintentar con la
// misma clave devuelve la venta ya guardada (repetida = true) sin duplicarla.
// `vendidaEn`: la venta se hizo sin conexión a esa hora (ISO) y llega después
// (lib/ventasPendientes.ts); el servidor la cuenta en ese día y devuelve avisos
// (faltaba stock, la caja de ese día ya estaba cerrada…).
// Un fallo de red lanza SinConexionError: la venta puede o no haberse guardado.
export async function registrarVenta(
  input: RegistrarVentaInput,
  clave?: string,
  opciones: { vendidaEn?: string; tiempoLimiteMs?: number } = {},
): Promise<{ numero: number; repetida: boolean; avisos: string[] }> {
  let data: unknown
  let error: { message: string } | null
  try {
    ;({ data, error } = await conTiempoLimite((senal) => supabase.rpc('registrar_venta', {
      p_items: input.items.map(i => ({
        tipo: i.producto.tipo,
        producto_id: i.producto.id,
        cantidad: i.cantidad,
        precio: i.precio,
      })),
      p_pagos: input.pagos.map(p => ({ metodo: p.metodo, monto: p.monto })),
      p_efectivo_recibido: input.efectivoRecibido ?? undefined,
      p_cliente_nombre: input.cliente?.nombre ?? undefined,
      p_cliente_apellido: input.cliente?.apellido ?? undefined,
      p_cliente_telefono: input.cliente?.telefono ?? undefined,
      p_cliente_documento: input.cliente?.documento ?? undefined,
      p_clave_idempotencia: clave,
      p_vendida_en: opciones.vendidaEn,
    }).abortSignal(senal), opciones.tiempoLimiteMs ?? 15000))
  } catch (e) {
    error = { message: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }
  }
  if (error) {
    if (esErrorDeRed(error)) throw new SinConexionError(MENSAJE_SIN_CONEXION)
    throw new Error(traducirError(error.message))
  }
  const res = data as { numero: number; repetida?: boolean; avisos?: string[] }
  return { numero: res.numero, repetida: res.repetida === true, avisos: res.avisos ?? [] }
}

// No sabemos si la venta alcanzó a guardarse; reintentar es seguro (misma clave).
const MENSAJE_SIN_CONEXION =
  'Sin conexión: no sabemos si la venta se guardó. Confirma de nuevo sin cambiar nada; si ya se guardó, no se duplicará.'

function traducirError(msg: string): string {
  if (msg.includes('Stock insuficiente')) {
    const prod = msg.split('Stock insuficiente para ')[1] ?? 'un producto'
    return `Ya no hay suficiente stock de ${prod}. Actualiza el carrito.`
  }
  if (msg.includes('pagos no suman')) return 'Los pagos no suman el total.'
  if (msg.includes('efectivo recibido')) return 'El efectivo recibido es menor al pago en efectivo.'
  if (msg.includes('Precio inválido')) return 'El precio debe ser mayor a cero.'
  // Rango de regateo: el servidor ya lo explica ("El precio de X debe estar entre ...").
  if (msg.includes('debe estar entre')) return msg
  if (msg.includes('caja de hoy no está abierta')) return 'La caja está cerrada. Ábrela para vender.'
  if (msg.includes('hora de la venta hecha sin conexión')) return 'La fecha y la hora del teléfono no son válidas: revísalas.'
  if (msg.includes('permiso')) return 'No tienes permiso para vender.'
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
