import type { CompraResumen, ItemComprado, Pago, Proveedor } from '../proveedores'
import { supabase } from '../supabase'

// Proveedores del panel web (fase 1, A8). La base decide quién ve qué: compras
// con total y saldo piden `costos` o `deudas`, los pagos piden `deudas` y los
// costos de cada ítem piden `costos`; cuentas y documentos piden `proveedores`.

const COLUMNAS_PROVEEDOR = 'id, nombre, nit_cedula, telefono, ciudad, notas, activo'
const COLUMNAS_COMPRA = 'id, proveedor_id, estado, condicion_pago, total, monto_pagado, saldo_pendiente, fecha_vencimiento, notas, created_at'

const aNumero = (c: CompraResumen): CompraResumen => ({
  ...c,
  total: c.total == null ? null : Number(c.total),
  monto_pagado: Number(c.monto_pagado),
  saldo_pendiente: Number(c.saldo_pendiente),
})

export async function listarProveedores(): Promise<Proveedor[]> {
  const { data, error } = await supabase.from('proveedores').select(COLUMNAS_PROVEEDOR).order('nombre')
  if (error) throw new Error(error.message)
  return data
}

// Compras con saldo de todos los proveedores (para la deuda de la lista).
export async function comprasConSaldo(): Promise<CompraResumen[]> {
  const { data, error } = await supabase
    .from('compras')
    .select(COLUMNAS_COMPRA)
    .eq('estado', 'completada')
    .eq('condicion_pago', 'credito')
    .gt('saldo_pendiente', 0)
  if (error) throw new Error(error.message)
  return data.map(aNumero)
}

export async function obtenerProveedor(id: string): Promise<Proveedor | null> {
  const { data, error } = await supabase.from('proveedores').select(COLUMNAS_PROVEEDOR).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export type DatosProveedor = Omit<Proveedor, 'id'>

export async function guardarProveedor(id: string | null, datos: DatosProveedor): Promise<Proveedor> {
  if (!datos.nombre.trim()) throw new Error('El nombre del proveedor es obligatorio.')
  const consulta = id
    ? supabase.from('proveedores').update(datos).eq('id', id)
    : supabase.from('proveedores').insert(datos)
  const { data, error } = await consulta.select(COLUMNAS_PROVEEDOR).single()
  if (error) throw new Error(error.message)
  return data
}

export async function comprasDelProveedor(proveedorId: string): Promise<CompraResumen[]> {
  const { data, error } = await supabase
    .from('compras')
    .select(COLUMNAS_COMPRA)
    .eq('proveedor_id', proveedorId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(aNumero)
}

export async function pagosDelProveedor(compraIds: string[]): Promise<Pago[]> {
  if (!compraIds.length) return []
  const { data, error } = await supabase
    .from('compra_pagos')
    .select('id, compra_id, monto, fecha, notas')
    .in('compra_id', compraIds)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map((p) => ({ ...p, monto: Number(p.monto) }))
}

export async function itemsDelProveedor(compras: CompraResumen[]): Promise<ItemComprado[]> {
  const vigentes = compras.filter((c) => c.estado !== 'cancelada')
  if (!vigentes.length) return []
  const fechas = new Map(vigentes.map((c) => [c.id, c.created_at.slice(0, 10)]))
  const { data, error } = await supabase
    .from('compra_items')
    .select('compra_id, referencia, descripcion, color, talla, cantidad, costo_unitario')
    .in('compra_id', vigentes.map((c) => c.id))
  if (error) throw new Error(error.message)
  return data.map((i) => ({
    ...i,
    fecha: fechas.get(i.compra_id) ?? '',
    cantidad: Number(i.cantidad),
    costo_unitario: i.costo_unitario == null ? null : Number(i.costo_unitario),
  }))
}

export async function registrarPago(datos: { compraId: string; monto: number; fecha: string; notas: string }): Promise<number> {
  const { data, error } = await supabase.rpc('registrar_pago_proveedor', {
    p_compra_id: datos.compraId,
    p_monto: datos.monto,
    p_fecha: datos.fecha,
    p_notas: datos.notas.trim() || undefined,
  })
  if (error) throw new Error(error.message)
  return Number((data as { saldo_pendiente: number }).saldo_pendiente)
}

// ===== Cuentas bancarias =====

export const TIPOS_CUENTA = ['ahorros', 'corriente', 'nequi', 'daviplata'] as const
export type TipoCuenta = (typeof TIPOS_CUENTA)[number]

export interface CuentaBancaria {
  id: string
  banco: string
  tipo_cuenta: string
  numero_cuenta: string
  titular: string | null
}

export async function cuentasDelProveedor(proveedorId: string): Promise<CuentaBancaria[]> {
  const { data, error } = await supabase
    .from('proveedor_cuentas_bancarias')
    .select('id, banco, tipo_cuenta, numero_cuenta, titular')
    .eq('proveedor_id', proveedorId)
    .order('created_at')
  if (error) throw new Error(error.message)
  return data
}

export async function guardarCuenta(
  proveedorId: string,
  id: string | null,
  datos: { banco: string; tipo_cuenta: TipoCuenta; numero_cuenta: string; titular: string | null },
): Promise<void> {
  if (!datos.banco.trim() || !datos.numero_cuenta.trim()) throw new Error('El banco y el número de cuenta son obligatorios.')
  const { error } = id
    ? await supabase.from('proveedor_cuentas_bancarias').update(datos).eq('id', id)
    : await supabase.from('proveedor_cuentas_bancarias').insert({ ...datos, proveedor_id: proveedorId })
  if (error) throw new Error(error.message)
}

export async function eliminarCuenta(id: string): Promise<void> {
  const { error } = await supabase.from('proveedor_cuentas_bancarias').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ===== Documentos (bucket privado `proveedores`) =====

export const BUCKET_DOCUMENTOS = 'proveedores'

export interface Documento {
  id: string
  tipo: 'pdf' | 'imagen'
  url: string
  nombre_archivo: string | null
  created_at: string
}

export async function documentosDelProveedor(proveedorId: string): Promise<Documento[]> {
  const { data, error } = await supabase
    .from('compra_documentos')
    .select('id, tipo, url, nombre_archivo, created_at')
    .eq('proveedor_id', proveedorId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Documento[]
}

export async function subirDocumento(proveedorId: string, archivo: Blob, nombre: string, tipo: 'pdf' | 'imagen'): Promise<void> {
  const extension = tipo === 'pdf' ? 'pdf' : 'jpg'
  const ruta = `${proveedorId}/${crypto.randomUUID()}.${extension}`
  const subida = await supabase.storage.from(BUCKET_DOCUMENTOS).upload(ruta, archivo, {
    contentType: tipo === 'pdf' ? 'application/pdf' : 'image/jpeg',
  })
  if (subida.error) throw new Error(subida.error.message)
  const { error } = await supabase
    .from('compra_documentos')
    .insert({ proveedor_id: proveedorId, tipo, url: ruta, nombre_archivo: nombre })
  if (error) {
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove([ruta])
    throw new Error(error.message)
  }
}

// Enlace temporal (10 minutos) para abrir un documento del bucket privado.
export async function enlaceDocumento(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(ruta, 600)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function eliminarDocumento(doc: Documento): Promise<void> {
  const { error } = await supabase.from('compra_documentos').delete().eq('id', doc.id)
  if (error) throw new Error(error.message)
  await supabase.storage.from(BUCKET_DOCUMENTOS).remove([doc.url])
}
