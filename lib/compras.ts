import type { Json } from '../shared/database.types'
import { nombreColores } from '../shared/colores'
import {
  payloadFactura, tallasConCantidad, TALLAS, type Factura, type FilaFactura,
} from '../shared/compras'
import { comprimirBajoLimite, comprimirYSubirImagen } from './imagenes'
import { bytesDesdeUriLocal } from './storage'
import { supabase } from './supabase'

export * from '../shared/compras'

// Compras y Recibir mercancía en la app. La factura es la misma del panel web
// (shared/compras.ts) y se guarda con la misma RPC, registrar_compra (pide
// `recibir_mercancia` y `costos`). Sin `costos` se registra la llegada física
// (sin costos ni precios), que alguien con `costos` completa después.

const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
export const claveRefColor = (referencia: string | null, color: string | null) =>
  `${plano(referencia ?? '')}|${plano(nombreColores(color) ?? '')}`

// ===== Registrar =====

export interface ResultadoCompra {
  compra_id: string
  repetida: boolean
}

// `clave` identifica el intento: si se cae la señal después de guardar,
// reintentar con la misma clave devuelve la misma compra sin duplicar stock.
export async function registrarCompra(factura: Factura, clave: string): Promise<ResultadoCompra> {
  const { data, error } = await supabase.rpc('registrar_compra', {
    p_compra: payloadFactura(factura) as unknown as Json,
    p_clave_idempotencia: clave,
  })
  if (error) throw new Error(error.message)
  return data as unknown as ResultadoCompra
}

// Llegada física (sin `costos`): solo tallas que ya existen en el inventario.
export interface ItemLlegada {
  producto_calzado_id: string
  descripcion: string
  referencia: string | null
  color: string | null
  talla: string
  cantidad: number
}

export function itemsLlegada(f: Factura): ItemLlegada[] {
  return f.filas.flatMap((fila) =>
    tallasConCantidad(fila).flatMap(({ talla, cantidad }) => {
      const e = fila.existentes[talla]
      if (!e) return []
      return [{
        producto_calzado_id: e.id,
        descripcion: fila.descripcion.trim() || fila.referencia.trim(),
        referencia: fila.referencia.trim() || null,
        color: nombreColores(fila.color),
        talla,
        cantidad,
      }]
    }),
  )
}

const nombreFila = (fila: FilaFactura, i: number) =>
  [fila.referencia.trim(), nombreColores(fila.color)].filter(Boolean).join(' ') || `la referencia ${i + 1}`

// Sin `costos` no se crean productos: cada talla debe existir ya en el inventario.
export function erroresLlegada(f: Factura): string[] {
  const errores: string[] = []
  if (!f.proveedorId) errores.push('Elige el proveedor.')
  const conCantidad = f.filas.filter((fila) => tallasConCantidad(fila).length > 0)
  if (!conCantidad.length) errores.push('Escribe la cantidad de al menos una talla.')
  f.filas.forEach((fila, i) => {
    const tallas = tallasConCantidad(fila)
    if (!tallas.length) return
    if (!Object.keys(fila.existentes).length) {
      errores.push(`${nombreFila(fila, i)} no está en el inventario. Pide a quien maneja costos que la registre.`)
      return
    }
    const nuevas = tallas.filter((x) => !fila.existentes[x.talla]).map((x) => x.talla)
    if (nuevas.length) {
      errores.push(`${nombreFila(fila, i)}: la${nuevas.length === 1 ? ' talla' : 's tallas'} ${nuevas.join(', ')} no existe${nuevas.length === 1 ? '' : 'n'} en el inventario.`)
    }
  })
  return errores
}

export async function registrarLlegada(proveedorId: string, registradaPor: string, items: ItemLlegada[]): Promise<string> {
  const { data: compra, error } = await supabase
    .from('compras')
    .insert({
      proveedor_id: proveedorId,
      estado: 'pendiente_revision',
      registrada_por: registradaPor,
      total: null,
      monto_pagado: 0,
      saldo_pendiente: 0,
      condicion_pago: null,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const { error: errorItems } = await supabase.from('compra_items').insert(
    items.map((it) => ({ ...it, compra_id: compra.id, costo_unitario: null, subtotal: null })),
  )
  if (errorItems) {
    await supabase.from('compras').delete().eq('id', compra.id)
    throw new Error(errorItems.message)
  }
  return compra.id
}

// ===== Fotos y factura =====

// Foto de una referencia y color, comprimida a 500 KB en el bucket público `productos`.
export const subirFotoColor = (uri: string): Promise<string> => comprimirYSubirImagen(uri)

// Después de guardar: la foto nueva de cada referencia y color queda en todas
// sus tallas (las que ya había y las que se acaban de crear).
export async function fijarFotos(compraId: string, factura: Factura): Promise<void> {
  const conFoto = factura.filas.filter((f) => f.foto)
  if (!conFoto.length) return
  const { data, error } = await supabase
    .from('compra_items')
    .select('producto_calzado_id, referencia, color')
    .eq('compra_id', compraId)
  if (error) throw new Error(error.message)
  for (const fila of conFoto) {
    const clave = claveRefColor(fila.referencia, fila.color)
    const ids = new Set(Object.values(fila.existentes).map((e) => e.id))
    for (const item of data ?? []) {
      if (item.producto_calzado_id && claveRefColor(item.referencia, item.color) === clave) ids.add(item.producto_calzado_id)
    }
    if (!ids.size) continue
    const { error: e } = await supabase.from('productos_calzado').update({ foto_url: fila.foto }).in('id', [...ids])
    if (e) throw new Error(e.message)
  }
}

export interface Adjunto {
  uri: string
  nombre: string
  tipo: 'imagen' | 'pdf'
}

export const MAX_PDF = 5 * 1024 * 1024
const BUCKET_DOCUMENTOS = 'proveedores'

// Foto o PDF de la factura en el bucket privado de proveedores (como en el panel).
export async function subirFactura(proveedorId: string, compraId: string, adjunto: Adjunto): Promise<void> {
  const bytes = adjunto.tipo === 'pdf' ? await bytesDesdeUriLocal(adjunto.uri) : await comprimirBajoLimite(adjunto.uri)
  if (adjunto.tipo === 'pdf' && bytes.length > MAX_PDF) throw new Error('El PDF pesa más de 5 MB.')
  const ruta = `${proveedorId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${adjunto.tipo === 'pdf' ? 'pdf' : 'jpg'}`
  const subida = await supabase.storage.from(BUCKET_DOCUMENTOS).upload(ruta, bytes, {
    contentType: adjunto.tipo === 'pdf' ? 'application/pdf' : 'image/jpeg',
  })
  if (subida.error) throw new Error(subida.error.message)
  const { error } = await supabase.from('compra_documentos').insert({
    proveedor_id: proveedorId, compra_id: compraId, tipo: adjunto.tipo, url: ruta, nombre_archivo: adjunto.nombre,
  })
  if (error) {
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove([ruta])
    throw new Error(error.message)
  }
}

export async function enlaceDocumento(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(ruta, 600)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

// ===== Costos (solo con permiso `costos`) =====

export async function costosPorProducto(): Promise<Map<string, { ultimo: number }>> {
  const { data, error } = await supabase.rpc('obtener_costos_productos')
  if (error) throw new Error(error.message)
  return new Map((data ?? []).map((c) => [c.producto_id, { ultimo: Number(c.ultimo_costo) }]))
}

// ===== Listas y detalle =====

export interface CompraListado {
  id: string
  proveedor_id: string
  proveedor: string
  estado: string
  condicion_pago: string | null
  total: number | null
  saldo_pendiente: number
  fecha_vencimiento: string | null
  numero_factura: string | null
  fecha_factura: string | null
  registrada_por: string | null
  created_at: string
  pares: number
}

const COLUMNAS = 'id, proveedor_id, estado, condicion_pago, total, saldo_pendiente, fecha_vencimiento, numero_factura, fecha_factura, registrada_por, created_at, proveedores(nombre), compra_items(cantidad)'

type FilaCompra = Omit<CompraListado, 'proveedor' | 'pares'> & {
  proveedores: { nombre: string } | null
  compra_items: { cantidad: number }[] | null
}

const aListado = (c: FilaCompra): CompraListado => ({
  id: c.id,
  proveedor_id: c.proveedor_id,
  proveedor: c.proveedores?.nombre ?? 'Proveedor',
  estado: c.estado,
  condicion_pago: c.condicion_pago,
  total: c.total == null ? null : Number(c.total),
  saldo_pendiente: Number(c.saldo_pendiente),
  fecha_vencimiento: c.fecha_vencimiento,
  numero_factura: c.numero_factura,
  fecha_factura: c.fecha_factura,
  registrada_por: c.registrada_por,
  created_at: c.created_at,
  pares: (c.compra_items ?? []).reduce((s, i) => s + Number(i.cantidad), 0),
})

// La RLS decide qué ve cada quien: con `costos` o `deudas`, todas; si no, solo
// las llegadas pendientes propias (o de todos con `proveedores`).
export async function listarCompras(): Promise<CompraListado[]> {
  const { data, error } = await supabase
    .from('compras')
    .select(COLUMNAS)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data as unknown as FilaCompra[]).map(aListado)
}

export interface ItemDeCompra {
  id: string
  producto_calzado_id: string | null
  referencia: string | null
  descripcion: string
  color: string | null
  talla: string | null
  cantidad: number
  costo_unitario: number | null
  subtotal: number | null
}

export interface PagoCompra {
  id: string
  monto: number
  fecha: string
  notas: string | null
}

export interface DocumentoCompra {
  id: string
  tipo: 'pdf' | 'imagen'
  url: string
  nombre_archivo: string | null
}

export interface CompraDetalle extends CompraListado {
  monto_pagado: number
  notas: string | null
  items: ItemDeCompra[]
}

export async function obtenerCompra(id: string): Promise<CompraDetalle | null> {
  const { data, error } = await supabase
    .from('compras')
    .select(`${COLUMNAS}, monto_pagado, notas`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const c = data as unknown as FilaCompra & { monto_pagado: number; notas: string | null }
  const { data: items, error: errorItems } = await supabase
    .from('compra_items')
    .select('id, producto_calzado_id, referencia, descripcion, color, talla, cantidad, costo_unitario, subtotal')
    .eq('compra_id', id)
  if (errorItems) throw new Error(errorItems.message)
  return {
    ...aListado(c),
    monto_pagado: Number(c.monto_pagado),
    notas: c.notas,
    items: (items ?? []).map((i) => ({
      ...i,
      cantidad: Number(i.cantidad),
      costo_unitario: i.costo_unitario == null ? null : Number(i.costo_unitario),
      subtotal: i.subtotal == null ? null : Number(i.subtotal),
    })),
  }
}

// Pagos y documentos tienen su propio permiso (`deudas` / `proveedores`): si no
// alcanza, la pantalla los oculta en vez de fallar.
export async function pagosDeCompra(compraId: string): Promise<PagoCompra[]> {
  const { data, error } = await supabase
    .from('compra_pagos')
    .select('id, monto, fecha, notas')
    .eq('compra_id', compraId)
    .order('fecha', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((p) => ({ ...p, monto: Number(p.monto) }))
}

export async function documentosDeCompra(compraId: string): Promise<DocumentoCompra[]> {
  const { data, error } = await supabase
    .from('compra_documentos')
    .select('id, tipo, url, nombre_archivo')
    .eq('compra_id', compraId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as DocumentoCompra[]
}

export async function registrarPago(compraId: string, monto: number, fecha: string, notas: string): Promise<void> {
  const { error } = await supabase.rpc('registrar_pago_proveedor', {
    p_compra_id: compraId,
    p_monto: monto,
    p_fecha: fecha,
    p_notas: notas.trim() || undefined,
  })
  if (error) throw new Error(error.message)
}

// ===== Para pantalla =====

// Ítems de una compra agrupados por referencia y color, con sus tallas en orden.
export interface GrupoCompra {
  clave: string
  referencia: string | null
  descripcion: string
  color: string | null
  tallas: { talla: string; cantidad: number }[]
  pares: number
  subtotal: number | null
}

export function agruparItems(items: ItemDeCompra[]): GrupoCompra[] {
  const grupos = new Map<string, GrupoCompra>()
  for (const i of items) {
    const clave = claveRefColor(i.referencia || i.descripcion, i.color)
    const g = grupos.get(clave) ?? {
      clave, referencia: i.referencia, descripcion: i.descripcion, color: i.color, tallas: [], pares: 0, subtotal: 0,
    }
    g.tallas.push({ talla: i.talla ?? 'Única', cantidad: i.cantidad })
    g.pares += i.cantidad
    g.subtotal = g.subtotal == null || i.subtotal == null ? null : g.subtotal + i.subtotal
    grupos.set(clave, g)
  }
  const orden = (t: string) => (TALLAS.includes(t) ? Number(t) : 999)
  return [...grupos.values()].map((g) => ({ ...g, tallas: g.tallas.sort((a, b) => orden(a.talla) - orden(b.talla)) }))
}

// "38×2 · 39×1 · 40×3"
export const textoTallas = (tallas: { talla: string; cantidad: number }[]) =>
  tallas.map((t) => `${t.talla}×${t.cantidad}`).join(' · ')

export type FiltroCompras = 'todas' | 'por_pagar' | 'pendientes'

export const esPorPagar = (c: Pick<CompraListado, 'estado' | 'condicion_pago' | 'saldo_pendiente'>) =>
  c.estado === 'completada' && c.condicion_pago === 'credito' && c.saldo_pendiente > 0

export function filtrarCompras(compras: CompraListado[], filtro: FiltroCompras, texto: string): CompraListado[] {
  const buscado = plano(texto)
  return compras.filter((c) =>
    (filtro === 'todas' || (filtro === 'por_pagar' ? esPorPagar(c) : c.estado === 'pendiente_revision')) &&
    (!buscado || plano(`${c.proveedor} ${c.numero_factura ?? ''}`).includes(buscado)),
  )
}

// Días hasta el vencimiento (negativo = vencida). Fechas YYYY-MM-DD.
export const diasHasta = (fecha: string, hoy: string) =>
  Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86_400_000)
