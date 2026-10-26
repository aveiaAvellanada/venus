import { useMemo } from 'react'
import { COLORES_BASE, coloresDeNombre, nombreColores } from '@shared/colores'
import { descripcionesConocidas, indiceModelos, referenciaPorDescripcion, type ModeloConocido } from '@shared/referencias'
import { rangosDesdeExistentes, type FilaFactura, type TallaExistente } from '../../lib/compras'
import type { ProductoCalzado } from '../../lib/inventario'
import { plano } from '../../navegacion'

// Lo que el inventario ya tiene, para Compras y la Carga inicial: cada
// referencia y color con sus tallas, y las marcas y colores ya usados.

export interface ReferenciaConocida {
  referencia: string
  descripcion: string
  marca: string
  categoria: string
  color: string
  existentes: Record<string, TallaExistente>
}

// "rojo/blanco" reconoce la referencia guardada como "Rojo y blanco".
const claveRef = (referencia: string, color: string) => `${plano(referencia)}|${plano(nombreColores(color) ?? '')}`

export function useCatalogo(inventario: ProductoCalzado[] | undefined) {
  const conocidas = useMemo(() => {
    const mapa = new Map<string, ReferenciaConocida>()
    for (const p of inventario ?? []) {
      if (!p.referencia || !p.talla) continue
      const clave = claveRef(p.referencia, p.color ?? '')
      const r = mapa.get(clave) ?? {
        referencia: p.referencia, descripcion: p.descripcion, marca: p.marca ?? '', categoria: p.categoria,
        color: p.color ?? '', existentes: {},
      }
      r.existentes[p.talla] = {
        id: p.id, precio_minimo: Number(p.precio_minimo), precio_maximo: p.precio_maximo == null ? null : Number(p.precio_maximo),
        foto_url: p.foto_url ?? null, stock: Number(p.stock_actual),
      }
      mapa.set(clave, r)
    }
    return mapa
  }, [inventario])
  // Nadie escribe la referencia: el zapato se reconoce por su descripción (y marca).
  const modelos = useMemo(() => indiceModelos(conocidas.values()), [conocidas])
  const descripciones = useMemo(() => descripcionesConocidas(modelos), [modelos])
  // Marcas y colores ya usados en el inventario, para elegirlos o escribir uno nuevo.
  const marcas = useMemo(
    () => [...new Set((inventario ?? []).map((p) => p.marca?.trim()).filter((m): m is string => !!m))].sort((a, b) => a.localeCompare(b, 'es')),
    [inventario],
  )
  const coloresUsados = useMemo(
    () => [...new Set((inventario ?? []).map((p) => nombreColores(p.color)).filter((c): c is string => !!c))],
    [inventario],
  )
  const coloresSimples = useMemo(() => {
    const vistos = new Map<string, string>()
    for (const c of [...COLORES_BASE, ...coloresUsados.flatMap((c) => coloresDeNombre(c))]) {
      const nombre = nombreColores(c)!
      if (!vistos.has(plano(nombre))) vistos.set(plano(nombre), nombre)
    }
    return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'es'))
  }, [coloresUsados])
  // Para el primer color: los de dos colores ya usados ("Rojo y blanco") y los sueltos.
  const colores = useMemo(
    () => [...coloresUsados.filter((c) => coloresDeNombre(c).length > 1).sort((a, b) => a.localeCompare(b, 'es')), ...coloresSimples],
    [coloresUsados, coloresSimples],
  )
  return { conocidas, modelos, descripciones, marcas, colores, coloresSimples }
}

// Al escribir la descripción (y la marca) y el color de algo que ya existe: toma
// su referencia y trae categoría, las tallas existentes y sus precios (y el
// último costo). Devuelve la misma fila si no hay nada que cambiar.
export function reconocerFila(
  fila: FilaFactura,
  conocidas: Map<string, ReferenciaConocida>,
  modelos: Map<string, ModeloConocido[]>,
  costos?: Map<string, { ultimo: number }>,
  // Las otras filas: otro color del mismo zapato escrito aparte lleva su referencia.
  hermanas: FilaFactura[] = [],
): FilaFactura {
  const referencia = referenciaPorDescripcion(modelos, fila, hermanas)
  if (referencia !== fila.referencia) fila = { ...fila, referencia }
  const r = conocidas.get(claveRef(fila.referencia, fila.color))
  if (!r) return Object.keys(fila.existentes).length ? { ...fila, existentes: {} } : fila
  if (fila.existentes === r.existentes) return fila
  const sinPrecios = fila.rangos.every((x) => !x.costo && !x.minimo && !x.maximo)
  return {
    ...fila,
    referencia: r.referencia,
    color: r.color,
    descripcion: fila.descripcion || r.descripcion,
    marca: fila.marca || r.marca,
    categoria: fila.categoria || r.categoria,
    existentes: r.existentes,
    rangos: sinPrecios ? rangosDesdeExistentes(r.existentes, costos) : fila.rangos,
  }
}
