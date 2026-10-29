import type { Tramo } from '@shared/tramos'
import type { TallaPrecio } from '../precios'
import { supabase } from '../supabase'

const COLUMNAS = 'id, referencia, descripcion, marca, color, categoria, talla, precio_minimo, precio_maximo, stock_actual, activo, foto_url, garantia_dias'
const PAGINA = 1000

export async function listarTallasPrecios(): Promise<TallaPrecio[]> {
  const todas: TallaPrecio[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from('productos_calzado')
      .select(COLUMNAS)
      .eq('activo', true)
      .order('id')
      .range(desde, desde + PAGINA - 1)
    if (error) throw error
    todas.push(...(data as TallaPrecio[]))
    if (!data || data.length < PAGINA) return todas
  }
}

// Los rangos guardados de todas las referencias, por referencia_clave.
export async function listarTodosLosTramos(): Promise<Map<string, Tramo[]>> {
  const { data, error } = await supabase
    .from('calzado_tramos_precio')
    .select('referencia_clave, talla_desde, talla_hasta, precio_minimo, precio_maximo')
    .order('talla_desde')
  if (error) throw error
  const mapa = new Map<string, Tramo[]>()
  for (const r of data ?? []) {
    const t: Tramo = {
      tallaDesde: Number(r.talla_desde),
      tallaHasta: Number(r.talla_hasta),
      precioMinimo: Number(r.precio_minimo),
      precioMaximo: r.precio_maximo != null ? Number(r.precio_maximo) : null,
    }
    mapa.set(r.referencia_clave, [...(mapa.get(r.referencia_clave) ?? []), t])
  }
  return mapa
}

// Precios por rango de tallas (todos los colores) y garantía de una referencia.
// La base valida, aplica a cada talla y deja historial.
export async function guardarPreciosReferencia(
  referencia: string,
  tramos: Tramo[],
  garantia: number | null,
): Promise<{ actualizados: number; sin_tramo: number }> {
  const { data, error } = await supabase.rpc('guardar_tramos_precio', {
    p_referencia: referencia,
    p_tramos: tramos.map((t) => ({
      talla_desde: t.tallaDesde,
      talla_hasta: t.tallaHasta,
      precio_minimo: t.precioMinimo,
      precio_maximo: t.precioMaximo,
    })),
  })
  if (error) throw new Error(error.message)
  const { error: errorGarantia } = await supabase.rpc('fijar_garantia_referencia', {
    p_referencia: referencia,
    p_dias: garantia as unknown as number,
  })
  if (errorGarantia) throw new Error(errorGarantia.message)
  return data as { actualizados: number; sin_tramo: number }
}
