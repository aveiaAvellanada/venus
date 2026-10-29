import { supabase } from './supabase'
import { claveReferencia, type Tramo } from '../shared/tramos'

// Lo puro (tipos, validación, garantía) está en shared/tramos.ts, común con el panel.
export * from '../shared/tramos'

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
