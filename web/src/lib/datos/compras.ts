import type { Json } from '@shared/database.types'
import { payloadFactura, type Factura } from '../compras'
import { supabase } from '../supabase'

// Compras del panel web (fase 1, A1). La factura completa se guarda con la RPC
// registrar_compra (una transacción: compra, ítems, productos nuevos, precios y
// stock); las listas leen compras con RLS (`costos` o `deudas`).

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
  created_at: string
}

const COLUMNAS = 'id, proveedor_id, estado, condicion_pago, total, saldo_pendiente, fecha_vencimiento, numero_factura, fecha_factura, created_at, proveedores(nombre)'

type FilaCompra = Omit<CompraListado, 'proveedor'> & { proveedores: { nombre: string } | null }
const aListado = (c: FilaCompra): CompraListado => ({
  id: c.id,
  proveedor_id: c.proveedor_id,
  proveedor: c.proveedores?.nombre ?? '—',
  estado: c.estado,
  condicion_pago: c.condicion_pago,
  total: c.total == null ? null : Number(c.total),
  saldo_pendiente: Number(c.saldo_pendiente),
  fecha_vencimiento: c.fecha_vencimiento,
  numero_factura: c.numero_factura,
  fecha_factura: c.fecha_factura,
  created_at: c.created_at,
})

export async function listarCompras(): Promise<CompraListado[]> {
  const { data, error } = await supabase
    .from('compras')
    .select(COLUMNAS)
    .order('created_at', { ascending: false })
    .limit(1000)
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

export interface CompraDetalle extends CompraListado {
  monto_pagado: number
  notas: string | null
  items: ItemDeCompra[]
}

export async function obtenerCompra(id: string): Promise<CompraDetalle | null> {
  const { data, error } = await supabase
    .from('compras')
    .select(`${COLUMNAS}, monto_pagado, notas, compra_items(id, producto_calzado_id, referencia, descripcion, color, talla, cantidad, costo_unitario, subtotal)`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const c = data as unknown as FilaCompra & { monto_pagado: number; notas: string | null; compra_items: ItemDeCompra[] }
  return {
    ...aListado(c),
    monto_pagado: Number(c.monto_pagado),
    notas: c.notas,
    items: c.compra_items.map((i) => ({
      ...i,
      cantidad: Number(i.cantidad),
      costo_unitario: i.costo_unitario == null ? null : Number(i.costo_unitario),
      subtotal: i.subtotal == null ? null : Number(i.subtotal),
    })),
  }
}

export interface ResultadoCompra {
  compra_id: string
  repetida: boolean
  total?: number
  unidades?: number
  productos_nuevos?: number
  precios_cambiados?: number
}

// `clave` identifica el intento: si la red se cae después de guardar,
// reintentar con la misma clave devuelve la misma compra sin duplicar stock.
export async function registrarCompra(factura: Factura, clave: string): Promise<ResultadoCompra> {
  const { data, error } = await supabase.rpc('registrar_compra', {
    p_compra: payloadFactura(factura) as unknown as Json,
    p_clave_idempotencia: clave,
  })
  if (error) throw new Error(error.message)
  return data as unknown as ResultadoCompra
}
