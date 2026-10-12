import { compararTallas } from './inventario'

// Lógica pura de Proveedores (panel web, fase 1, A8). El acceso a datos está en
// lib/datos/proveedores.ts; aquí solo cálculos, para probarlos sin la base.

export interface Proveedor {
  id: string
  nombre: string
  nit_cedula: string | null
  telefono: string | null
  ciudad: string | null
  notas: string | null
  activo: boolean
}

export interface CompraResumen {
  id: string
  proveedor_id: string
  estado: string
  condicion_pago: string | null
  total: number | null
  monto_pagado: number
  saldo_pendiente: number
  fecha_vencimiento: string | null
  notas: string | null
  created_at: string
}

export interface Pago {
  id: string
  compra_id: string
  monto: number
  fecha: string
  notas: string | null
}

export interface ItemComprado {
  compra_id: string
  fecha: string
  referencia: string | null
  descripcion: string
  color: string | null
  talla: string | null
  cantidad: number
  costo_unitario: number | null
}

// Una compra con saldo es deuda: completada, a crédito y sin pagar del todo.
export const esDeuda = (c: CompraResumen): boolean =>
  c.estado === 'completada' && c.condicion_pago === 'credito' && Number(c.saldo_pendiente) > 0

export type EstadoVencimiento = 'vencida' | 'pronto' | 'al_dia' | 'sin_fecha'

// Días desde `hoy` hasta `fecha` (negativo = ya pasó). Ambas YYYY-MM-DD.
export function diasHasta(fecha: string, hoy: string): number {
  return Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86_400_000)
}

export function estadoVencimiento(fecha: string | null, hoy: string, diasAviso = 7): EstadoVencimiento {
  if (!fecha) return 'sin_fecha'
  const dias = diasHasta(fecha, hoy)
  if (dias < 0) return 'vencida'
  if (dias <= diasAviso) return 'pronto'
  return 'al_dia'
}

export interface ResumenDeuda {
  deuda: number
  compras: number
  proximoVencimiento: string | null
  vencido: number
}

// Por proveedor: cuánto se le debe, cuántas compras con saldo, el vencimiento más
// cercano (contando los ya vencidos) y cuánto de la deuda ya está vencido.
export function resumirDeudas(compras: CompraResumen[], hoy: string): Map<string, ResumenDeuda> {
  const mapa = new Map<string, ResumenDeuda>()
  for (const c of compras) {
    if (!esDeuda(c)) continue
    const r = mapa.get(c.proveedor_id) ?? { deuda: 0, compras: 0, proximoVencimiento: null, vencido: 0 }
    const saldo = Number(c.saldo_pendiente)
    r.deuda += saldo
    r.compras += 1
    if (c.fecha_vencimiento) {
      if (!r.proximoVencimiento || c.fecha_vencimiento < r.proximoVencimiento) r.proximoVencimiento = c.fecha_vencimiento
      if (diasHasta(c.fecha_vencimiento, hoy) < 0) r.vencido += saldo
    }
    mapa.set(c.proveedor_id, r)
  }
  return mapa
}

// Sin tildes ni mayúsculas, para buscar.
const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export type FiltroProveedores = 'activos' | 'con_deuda' | 'vencidos' | 'inactivos'

export function filtrarProveedores(
  proveedores: Proveedor[],
  deudas: Map<string, ResumenDeuda> | undefined,
  { texto, filtro }: { texto: string; filtro: FiltroProveedores },
): Proveedor[] {
  const buscado = plano(texto.trim())
  return proveedores
    .filter((p) => {
      if (filtro === 'inactivos') return !p.activo
      if (!p.activo) return false
      const d = deudas?.get(p.id)
      if (filtro === 'con_deuda') return !!d
      if (filtro === 'vencidos') return !!d && d.vencido > 0
      return true
    })
    .filter((p) =>
      !buscado ||
      [p.nombre, p.nit_cedula, p.ciudad, p.telefono].some((campo) => campo && plano(campo).includes(buscado)),
    )
    .sort((a, b) => {
      // Primero a quien más se le debe (si hay deudas a la vista), luego por nombre.
      const deudaA = deudas?.get(a.id)?.deuda ?? 0
      const deudaB = deudas?.get(b.id)?.deuda ?? 0
      return deudaB - deudaA || a.nombre.localeCompare(b.nombre, 'es')
    })
}

export interface CostoReferencia {
  clave: string
  referencia: string | null
  descripcion: string
  color: string | null
  tallas: string[]
  unidades: number
  ultimoCosto: number
  ultimaFecha: string
  costoAnterior: number | null
  // Cambio del último costo frente al de la compra anterior (0.1 = +10 %).
  variacion: number | null
  compras: number
}

// Historial de costos por referencia y color: el último costo pagado, el de la
// compra anterior y cuánto cambió. Sin costo (llegadas sin revisar) no cuenta.
export function costosPorReferencia(items: ItemComprado[]): CostoReferencia[] {
  const grupos = new Map<string, ItemComprado[]>()
  for (const it of items) {
    if (it.costo_unitario == null) continue
    const clave = `${(it.referencia ?? it.descripcion).trim().toLowerCase()}|${(it.color ?? '').trim().toLowerCase()}`
    grupos.set(clave, [...(grupos.get(clave) ?? []), it])
  }
  return [...grupos.entries()]
    .map(([clave, lista]) => {
      // Por compra (la más reciente primero): el costo de esa compra es el mayor de sus tallas.
      const porCompra = new Map<string, { fecha: string; costo: number }>()
      for (const it of lista) {
        const previo = porCompra.get(it.compra_id)
        const costo = Number(it.costo_unitario)
        if (!previo || costo > previo.costo) porCompra.set(it.compra_id, { fecha: it.fecha, costo })
      }
      const historia = [...porCompra.values()].sort((a, b) => b.fecha.localeCompare(a.fecha))
      const [ultima, anterior] = historia
      const primero = lista[0]
      return {
        clave,
        referencia: primero.referencia,
        descripcion: primero.descripcion,
        color: primero.color,
        tallas: [...new Set(lista.map((i) => i.talla).filter((t): t is string => !!t))].sort(compararTallas),
        unidades: lista.reduce((s, i) => s + Number(i.cantidad), 0),
        ultimoCosto: ultima.costo,
        ultimaFecha: ultima.fecha,
        costoAnterior: anterior?.costo ?? null,
        variacion: anterior && anterior.costo > 0 ? (ultima.costo - anterior.costo) / anterior.costo : null,
        compras: historia.length,
      }
    })
    .sort((a, b) => b.ultimaFecha.localeCompare(a.ultimaFecha))
}

// Monto escrito con puntos de miles ("1.250.000") → número; vacío o inválido → NaN.
export function leerPesos(texto: string): number {
  const limpio = texto.replace(/[$\s.]/g, '').replace(',', '.')
  return limpio === '' ? NaN : Number(limpio)
}
