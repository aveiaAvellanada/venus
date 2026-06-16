import { supabase } from './supabase'
import type { Database } from './database.types'

export type Proveedor = Database['public']['Tables']['proveedores']['Row']
export type InsertProveedor = Database['public']['Tables']['proveedores']['Insert']
export type UpdateProveedor = Database['public']['Tables']['proveedores']['Update']

export type CuentaBancaria = Database['public']['Tables']['proveedor_cuentas_bancarias']['Row']
export type InsertCuentaBancaria = Database['public']['Tables']['proveedor_cuentas_bancarias']['Insert']
export type UpdateCuentaBancaria = Database['public']['Tables']['proveedor_cuentas_bancarias']['Update']

export type Compra = Database['public']['Tables']['compras']['Row']
export type CompraItem = Database['public']['Tables']['compra_items']['Row']

export type CompraPago = Database['public']['Tables']['compra_pagos']['Row']
export type InsertCompraPago = Database['public']['Tables']['compra_pagos']['Insert']

// ----------------------------------------------------
// 1. Providers CRUD & WhatsApp
// ----------------------------------------------------

export async function listarProveedores(filtros?: { buscar?: string; activo?: boolean }): Promise<Proveedor[]> {
  let query = supabase.from('proveedores').select('*').order('nombre', { ascending: true })

  if (filtros?.activo !== undefined) {
    query = query.eq('activo', filtros.activo)
  }

  if (filtros?.buscar) {
    const term = `%${filtros.buscar}%`
    query = query.or(`nombre.ilike.${term},nit_cedula.ilike.${term}`)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function crearProveedor(datos: InsertProveedor): Promise<Proveedor> {
  if (!datos.nombre || datos.nombre.trim() === '') {
    throw new Error('El nombre del proveedor es obligatorio.')
  }
  
  const { data, error } = await supabase
    .from('proveedores')
    .insert(datos)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function actualizarProveedor(id: string, datos: UpdateProveedor): Promise<Proveedor> {
  if (datos.nombre !== undefined && (datos.nombre === null || datos.nombre.trim() === '')) {
    throw new Error('El nombre del proveedor es obligatorio.')
  }
  const { data, error } = await supabase
    .from('proveedores')
    .update(datos)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function obtenerProveedorPorId(id: string): Promise<Proveedor | null> {
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

export function obtenerWhatsAppLink(telefono: string | null, mensaje?: string): string {
  if (!telefono) return ''
  const cleanPhone = telefono.replace(/\D/g, '')
  if (!cleanPhone) return ''
  const formattedPhone = cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone
  const encodedText = mensaje ? encodeURIComponent(mensaje) : ''
  return `https://wa.me/${formattedPhone}${encodedText ? `?text=${encodedText}` : ''}`
}

// ----------------------------------------------------
// 2. Bank Accounts CRUD
// ----------------------------------------------------

export async function listarCuentasBancarias(proveedorId: string): Promise<CuentaBancaria[]> {
  const { data, error } = await supabase
    .from('proveedor_cuentas_bancarias')
    .select('*')
    .eq('proveedor_id', proveedorId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function crearCuentaBancaria(datos: InsertCuentaBancaria): Promise<CuentaBancaria> {
  if (!datos.banco || !datos.numero_cuenta || !datos.tipo_cuenta) {
    throw new Error('El banco, tipo y número de cuenta son obligatorios.')
  }

  const { data, error } = await supabase
    .from('proveedor_cuentas_bancarias')
    .insert(datos)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function actualizarCuentaBancaria(id: string, datos: UpdateCuentaBancaria): Promise<CuentaBancaria> {
  const { data, error } = await supabase
    .from('proveedor_cuentas_bancarias')
    .update(datos)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function eliminarCuentaBancaria(id: string): Promise<void> {
  const { error } = await supabase
    .from('proveedor_cuentas_bancarias')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ----------------------------------------------------
// 3. Purchase & Physical Arrivals Flow
// ----------------------------------------------------

export interface ItemArrivalInput {
  descripcion: string
  cantidad: number
  producto_calzado_id?: string | null
  color?: string | null
  talla?: string | null
  referencia?: string | null
}

export async function registrarLlegadaFisica(datos: {
  proveedor_id: string
  registrada_por: string
  items: ItemArrivalInput[]
}): Promise<Compra> {
  if (!datos.items || datos.items.length === 0) {
    throw new Error('Debe registrar al menos un producto.')
  }
  for (const item of datos.items) {
    if (item.cantidad <= 0) {
      throw new Error('La cantidad de los productos debe ser mayor a cero.')
    }
  }

  const { data: compra, error: compraError } = await supabase
    .from('compras')
    .insert({
      proveedor_id: datos.proveedor_id,
      estado: 'pendiente_revision',
      registrada_por: datos.registrada_por,
      revisada_por: null,
      total: null,
      monto_pagado: 0,
      saldo_pendiente: 0,
      condicion_pago: null,
      created_by: datos.registrada_por
    })
    .select()
    .single()

  if (compraError) throw compraError

  const itemsToInsert = datos.items.map(item => ({
    compra_id: compra.id,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    producto_calzado_id: item.producto_calzado_id || null,
    color: item.color || null,
    talla: item.talla || null,
    referencia: item.referencia || null,
    costo_unitario: null,
    subtotal: null,
    created_by: datos.registrada_por
  }))

  const { error: itemsError } = await supabase
    .from('compra_items')
    .insert(itemsToInsert as any)

  if (itemsError) {
    await supabase.from('compras').delete().eq('id', compra.id)
    throw itemsError
  }

  return compra
}

export async function completarInformacionFinanciera(datos: {
  compra_id: string
  revisada_por: string
  condicion_pago: 'contado' | 'credito'
  fecha_vencimiento?: string | null
  notas?: string | null
  itemsCostos: Array<{ item_id: string; costo_unitario: number }>
}): Promise<Compra> {
  const { data: compra, error: fetchError } = await supabase
    .from('compras')
    .select('*')
    .eq('id', datos.compra_id)
    .single()

  if (fetchError) throw fetchError
  if (compra.estado !== 'pendiente_revision') {
    throw new Error('La compra no está pendiente de revisión.')
  }

  const { data: items, error: fetchItemsError } = await supabase
    .from('compra_items')
    .select('*')
    .eq('compra_id', datos.compra_id)

  if (fetchItemsError) throw fetchItemsError

  const missingCost = items.some(i => !datos.itemsCostos.find(c => c.item_id === i.id))
  if (missingCost) {
    throw new Error('Debe proveer el costo unitario para todos los items de la compra.')
  }

  let totalCompra = 0
  for (const costItem of datos.itemsCostos) {
    if (costItem.costo_unitario < 0) {
      throw new Error('El costo unitario no puede ser negativo.')
    }
    const item = items.find(i => i.id === costItem.item_id)
    if (!item) throw new Error(`Item con ID ${costItem.item_id} no pertenece a esta compra.`)
    
    const subtotal = item.cantidad * costItem.costo_unitario
    totalCompra += subtotal

    const { error: updateItemError } = await supabase
      .from('compra_items')
      .update({
        costo_unitario: costItem.costo_unitario,
        subtotal: subtotal,
        updated_by: datos.revisada_por
      })
      .eq('id', item.id)

    if (updateItemError) throw updateItemError
  }

  const cond = datos.condicion_pago
  const total = totalCompra
  const montoPagado = cond === 'contado' ? total : 0
  const saldoPendiente = cond === 'credito' ? total : 0

  const { data: updatedCompra, error: updateError } = await supabase
    .from('compras')
    .update({
      estado: 'completada',
      revisada_por: datos.revisada_por,
      condicion_pago: cond,
      fecha_vencimiento: datos.fecha_vencimiento || null,
      notas: datos.notas || null,
      total: total,
      monto_pagado: montoPagado,
      saldo_pendiente: saldoPendiente,
      updated_by: datos.revisada_por
    })
    .eq('id', datos.compra_id)
    .select()
    .single()

  if (updateError) throw updateError

  return updatedCompra
}

export interface DirectPurchaseItemInput {
  descripcion: string
  cantidad: number
  costo_unitario: number
  producto_calzado_id?: string | null
  color?: string | null
  talla?: string | null
  referencia?: string | null
}

export async function registrarCompraDirecta(datos: {
  proveedor_id: string
  registrada_por: string
  condicion_pago: 'contado' | 'credito'
  fecha_vencimiento?: string | null
  notas?: string | null
  items: DirectPurchaseItemInput[]
}): Promise<Compra> {
  if (!datos.items || datos.items.length === 0) {
    throw new Error('Debe registrar al menos un producto.')
  }

  let totalCompra = 0
  for (const item of datos.items) {
    if (item.cantidad <= 0) {
      throw new Error('La cantidad de los productos debe ser mayor a cero.')
    }
    if (item.costo_unitario < 0) {
      throw new Error('El costo unitario no puede ser negativo.')
    }
    totalCompra += item.cantidad * item.costo_unitario
  }

  const cond = datos.condicion_pago
  const montoPagado = cond === 'contado' ? totalCompra : 0
  const saldoPendiente = cond === 'credito' ? totalCompra : 0

  const { data: compra, error: compraError } = await supabase
    .from('compras')
    .insert({
      proveedor_id: datos.proveedor_id,
      estado: 'completada',
      registrada_por: datos.registrada_por,
      revisada_por: datos.registrada_por,
      condicion_pago: cond,
      fecha_vencimiento: datos.fecha_vencimiento || null,
      notas: datos.notas || null,
      total: totalCompra,
      monto_pagado: montoPagado,
      saldo_pendiente: saldoPendiente,
      created_by: datos.registrada_por
    })
    .select()
    .single()

  if (compraError) throw compraError

  const itemsToInsert = datos.items.map(item => ({
    compra_id: compra.id,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    costo_unitario: item.costo_unitario,
    subtotal: item.cantidad * item.costo_unitario,
    producto_calzado_id: item.producto_calzado_id || null,
    color: item.color || null,
    talla: item.talla || null,
    referencia: item.referencia || null,
    created_by: datos.registrada_por
  }))

  const { error: itemsError } = await supabase
    .from('compra_items')
    .insert(itemsToInsert as any)

  if (itemsError) {
    await supabase.from('compras').delete().eq('id', compra.id)
    throw itemsError
  }

  return compra
}

export async function obtenerCompraPorId(id: string): Promise<(Compra & { items?: CompraItem[] }) | null> {
  const { data: compra, error: compraError } = await supabase
    .from('compras')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (compraError) throw compraError
  if (!compra) return null

  const { data: items, error: itemsError } = await supabase
    .from('compra_items')
    .select('*')
    .eq('compra_id', id)

  if (itemsError) throw itemsError

  return {
    ...compra,
    items: items || []
  }
}

export async function listarCompras(filtros?: { proveedor_id?: string; estado?: string }): Promise<Compra[]> {
  let query = supabase.from('compras').select('*').order('created_at', { ascending: false })

  if (filtros?.proveedor_id) {
    query = query.eq('proveedor_id', filtros.proveedor_id)
  }
  if (filtros?.estado) {
    query = query.eq('estado', filtros.estado)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

// ----------------------------------------------------
// 4. Debt & Payments Control
// ----------------------------------------------------

export async function registrarPagoProveedor(datos: {
  compra_id: string
  registrado_por: string
  monto: number
  notas?: string | null
}): Promise<CompraPago> {
  if (datos.monto <= 0) {
    throw new Error('El monto del pago debe ser mayor a cero.')
  }

  const { data: compra, error: fetchError } = await supabase
    .from('compras')
    .select('*')
    .eq('id', datos.compra_id)
    .single()

  if (fetchError) throw fetchError
  if (compra.estado !== 'completada') {
    throw new Error('Solo se pueden registrar pagos a compras completadas.')
  }
  if (compra.condicion_pago !== 'credito') {
    throw new Error('Solo se pueden registrar pagos a compras a crédito.')
  }
  if (datos.monto > compra.saldo_pendiente) {
    throw new Error('El monto del pago supera el saldo pendiente de la compra.')
  }

  const nuevoPago: InsertCompraPago = {
    compra_id: datos.compra_id,
    monto: datos.monto,
    fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
    registrado_por: datos.registrado_por,
    notas: datos.notas || null,
    created_by: datos.registrado_por
  }

  const { data: pago, error: insertError } = await supabase
    .from('compra_pagos')
    .insert(nuevoPago)
    .select()
    .single()

  if (insertError) throw insertError

  return pago
}

export async function obtenerDeudaProveedor(proveedorId: string): Promise<number> {
  // La deuda con proveedores es información financiera reservada al dueño.
  // La RPC `obtener_deuda_proveedor` está gateada a private.is_owner() y es la
  // ÚNICA vía permitida: si falla (p.ej. la invoca un no-dueño), propagamos el
  // error. NO se hace fallback a una query directa sobre `compras`, porque la
  // RLS de compras deja leer saldo_pendiente a is_staff_admin (incluida Sandra),
  // lo que filtraría la deuda saltándose el gate. La UI debe mostrar la deuda
  // solo al dueño.
  const { data, error } = await supabase.rpc('obtener_deuda_proveedor', { p_id: proveedorId })
  if (error) throw error
  return Number(data ?? 0)
}

export async function listarPagosCompra(compraId: string): Promise<CompraPago[]> {
  const { data, error } = await supabase
    .from('compra_pagos')
    .select('*')
    .eq('compra_id', compraId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function listarPagosProveedor(proveedorId: string): Promise<CompraPago[]> {
  const { data: purchases, error: purchaseError } = await supabase
    .from('compras')
    .select('id')
    .eq('proveedor_id', proveedorId)

  if (purchaseError) throw purchaseError
  if (!purchases || purchases.length === 0) return []

  const purchaseIds = purchases.map(p => p.id)

  const { data: pagos, error: pagosError } = await supabase
    .from('compra_pagos')
    .select('*')
    .in('compra_id', purchaseIds)
    .order('created_at', { ascending: false })

  if (pagosError) throw pagosError
  return pagos || []
}

export async function cancelarCompra(compraId: string, canceladaPor: string): Promise<Compra> {
  const { data: compra, error: fetchError } = await supabase
    .from('compras')
    .select('*')
    .eq('id', compraId)
    .single()

  if (fetchError) throw fetchError
  if (compra.estado === 'cancelada') {
    throw new Error('La compra ya está cancelada.')
  }

  const oldEstado = compra.estado

  const { data: updatedCompra, error: updateError } = await supabase
    .from('compras')
    .update({
      estado: 'cancelada',
      saldo_pendiente: 0,
      updated_by: canceladaPor
    })
    .eq('id', compraId)
    .select()
    .single()

  if (updateError) throw updateError

  return updatedCompra
}
