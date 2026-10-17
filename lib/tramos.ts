import { supabase } from './supabase'

// Precios por rango de tallas de una referencia (igual para todos los colores).
// El mínimo es obligatorio; el máximo, opcional. Las reglas de validar() son las
// mismas de public.guardar_tramos_precio: la base manda, esto solo avisa antes.

export interface Tramo {
  tallaDesde: number
  tallaHasta: number
  precioMinimo: number
  precioMaximo: number | null
}

// Lo que se escribe en la pantalla (texto) antes de convertirlo a Tramo.
export interface TramoBorrador {
  desde: string
  hasta: string
  minimo: string
  maximo: string
}

export const claveReferencia = (ref: string | null | undefined): string | null => {
  const c = (ref ?? '').trim().toLowerCase()
  return c === '' ? null : c
}

// "38" o "38,5" → 38 / 38.5; cualquier otra talla ("Única") → null.
export function tallaNumerica(talla: string | null | undefined): number | null {
  const t = (talla ?? '').trim()
  return /^[0-9]+([.,][0-9]+)?$/.test(t) ? Number(t.replace(',', '.')) : null
}

const aNumero = (t: string): number | null => {
  const limpio = t.replace(/[^0-9.,]/g, '').replace(',', '.')
  if (limpio === '') return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

export function tramoDesdeBorrador(b: TramoBorrador): Tramo | null {
  const desde = aNumero(b.desde)
  const hasta = aNumero(b.hasta)
  const minimo = aNumero(b.minimo)
  if (desde == null || hasta == null || minimo == null) return null
  return { tallaDesde: desde, tallaHasta: hasta, precioMinimo: minimo, precioMaximo: aNumero(b.maximo) }
}

export const borradorDesdeTramo = (t: Tramo): TramoBorrador => ({
  desde: String(t.tallaDesde),
  hasta: String(t.tallaHasta),
  minimo: String(t.precioMinimo),
  maximo: t.precioMaximo != null ? String(t.precioMaximo) : '',
})

export const borradorVacio = (): TramoBorrador => ({ desde: '', hasta: '', minimo: '', maximo: '' })

// Devuelve el mensaje del primer problema, o null si los tramos son válidos.
export function validarTramos(borradores: TramoBorrador[]): string | null {
  const tramos: Tramo[] = []
  for (let i = 0; i < borradores.length; i++) {
    const t = tramoDesdeBorrador(borradores[i])
    if (!t) return `Tramo ${i + 1}: llena talla desde, talla hasta y precio mínimo.`
    if (t.tallaDesde > t.tallaHasta) return `Tramo ${i + 1}: la talla inicial es mayor que la final.`
    if (t.precioMinimo <= 0) return `Tramo ${i + 1}: el precio mínimo debe ser mayor que cero.`
    if (t.precioMaximo != null && t.precioMaximo < t.precioMinimo) {
      return `Tramo ${i + 1}: el máximo es menor que el mínimo.`
    }
    tramos.push(t)
  }
  const ordenados = [...tramos].sort((a, b) => a.tallaDesde - b.tallaDesde)
  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i].tallaDesde <= ordenados[i - 1].tallaHasta) {
      return `Los tramos se cruzan en la talla ${ordenados[i].tallaDesde}.`
    }
  }
  return null
}

// Tramo que cubre una talla (null si la talla no es numérica o ningún tramo la cubre).
export function tramoDeTalla(tramos: Tramo[], talla: string | null | undefined): Tramo | null {
  const n = tallaNumerica(talla)
  if (n == null) return null
  return tramos.find((t) => n >= t.tallaDesde && n <= t.tallaHasta) ?? null
}

// ── Acceso a datos ────────────────────────────────────────────────────────────

export async function listarTramos(referencia: string): Promise<Tramo[]> {
  const clave = claveReferencia(referencia)
  if (!clave) return []
  const { data, error } = await supabase
    .from('calzado_tramos_precio')
    .select('talla_desde, talla_hasta, precio_minimo, precio_maximo')
    .eq('referencia_clave', clave)
    .order('talla_desde', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    tallaDesde: Number(r.talla_desde),
    tallaHasta: Number(r.talla_hasta),
    precioMinimo: Number(r.precio_minimo),
    precioMaximo: r.precio_maximo != null ? Number(r.precio_maximo) : null,
  }))
}

export async function guardarTramos(
  referencia: string,
  tramos: Tramo[],
): Promise<{ tramos: number; actualizados: number; sin_tramo: number }> {
  const { data, error } = await supabase.rpc('guardar_tramos_precio', {
    p_referencia: referencia,
    p_tramos: tramos.map((t) => ({
      talla_desde: t.tallaDesde,
      talla_hasta: t.tallaHasta,
      precio_minimo: t.precioMinimo,
      precio_maximo: t.precioMaximo,
    })),
  })
  if (error) throw error
  return data as { tramos: number; actualizados: number; sin_tramo: number }
}

// Garantía en días para TODA la referencia (null la quita).
export async function fijarGarantiaReferencia(referencia: string, dias: number | null): Promise<number> {
  const { data, error } = await supabase.rpc('fijar_garantia_referencia', {
    p_referencia: referencia,
    p_dias: dias as unknown as number,
  })
  if (error) throw error
  return data as number
}

// ── Garantía ──────────────────────────────────────────────────────────────────

// Fecha en que vence la garantía de un zapato vendido en `fechaVenta`.
export function vencimientoGarantia(fechaVenta: string | Date, dias: number): Date {
  const f = new Date(fechaVenta)
  f.setDate(f.getDate() + dias)
  return f
}

// true = garantía vigente, false = vencida, null = el zapato no tiene garantía.
export function garantiaVigente(
  fechaVenta: string | Date,
  dias: number | null | undefined,
  hoy: Date = new Date(),
): boolean | null {
  if (dias == null) return null
  return hoy.getTime() <= vencimientoGarantia(fechaVenta, dias).getTime()
}
