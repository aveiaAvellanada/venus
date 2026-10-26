import { CATEGORIAS } from './excel'

// Referencia automática (20261026120000). La referencia une todas las tallas y
// colores de un mismo zapato; si nadie la escribe, la base pone una con la
// forma CAT-MARC-NNN (p. ej. TEN-NIKE-012): categoría, primeras 4 letras de la
// marca (SM sin marca) y un consecutivo. Un zapato sin referencia se reconoce
// por su descripción y su marca, igual que en la base.

// Las mismas de private.prefijo_categoria().
export const PREFIJO_CATEGORIA: Record<string, string> = {
  Chanclas: 'CHA',
  Escolar: 'ESC',
  'Botas caucho': 'BCA',
  'Botas material': 'BMA',
  Futbol: 'FUT',
  Infantil: 'INF',
  Tennis: 'TEN',
  Clasico: 'CLA',
  Otros: 'OTR',
}

const REFERENCIA_AUTOMATICA = /^([A-Z]{3})-([A-Z0-9]{1,4})-(\d{3,})$/

// "TEN-NIKE-012" → "Tennis · NIKE · n.º 12". null si no es un código automático
// (p. ej. la referencia de un proveedor).
export function describirReferencia(referencia: string | null | undefined): string | null {
  const m = (referencia ?? '').trim().match(REFERENCIA_AUTOMATICA)
  if (!m) return null
  const valor = Object.keys(PREFIJO_CATEGORIA).find((c) => PREFIJO_CATEGORIA[c] === m[1])
  if (!valor) return null
  const categoria = CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? valor
  const marca = m[2] === 'SM' ? 'sin marca' : m[2]
  return `${categoria} · ${marca} · n.º ${Number(m[3])}`
}

export const plano = (texto: string | null | undefined): string =>
  (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

export interface ModeloConocido {
  referencia: string
  descripcion: string
  marca: string
  categoria: string
}

// Los modelos del inventario (uno por referencia), por descripción.
export function indiceModelos(modelos: Iterable<ModeloConocido>): Map<string, ModeloConocido[]> {
  const indice = new Map<string, ModeloConocido[]>()
  const vistas = new Set<string>()
  for (const m of modelos) {
    const ref = plano(m.referencia)
    if (!ref || vistas.has(ref)) continue
    vistas.add(ref)
    const clave = plano(m.descripcion)
    if (!clave) continue
    indice.set(clave, [...(indice.get(clave) ?? []), m])
  }
  return indice
}

// El zapato que ya existe con esa descripción. Si hay varios (otra marca), la
// marca escrita decide; sin marca, o si ninguna coincide, no se adivina: null.
export function modeloDeDescripcion(
  indice: Map<string, ModeloConocido[]>,
  descripcion: string,
  marca: string,
): ModeloConocido | null {
  const candidatos = indice.get(plano(descripcion)) ?? []
  if (!candidatos.length) return null
  const conMarca = plano(marca)
  if (conMarca) return candidatos.find((m) => plano(m.marca) === conMarca) ?? null
  return candidatos.length === 1 ? candidatos[0] : null
}

// La referencia de un zapato mientras se escribe (la referencia no se escribe):
// la del que ya existe con esa descripción (y marca). Si no coincide con
// ninguno, la que traía se suelta si era de otro zapato y se queda si no (una
// nueva, apartada para nombrar la foto).
export function referenciaPorDescripcion(
  indice: Map<string, ModeloConocido[]>,
  fila: FilaConReferencia,
  hermanas: FilaConReferencia[] = [],
): string {
  const m = modeloDeDescripcion(indice, fila.descripcion, fila.marca)
  if (m) return m.referencia
  const actual = plano(fila.referencia)
  const deOtro = !!actual && [...indice.values()].some((ms) => ms.some((x) => plano(x.referencia) === actual))
  const propia = deOtro ? '' : fila.referencia
  return propia.trim() ? propia : referenciaDeHermana(hermanas, fila)
}

export interface FilaConReferencia {
  id?: string
  referencia: string
  descripcion: string
  marca: string
}

// Otra fila del mismo formulario con la misma descripción y marca (otro color
// escrito aparte) que ya tiene referencia: es el mismo zapato y lleva la misma.
export function referenciaDeHermana(hermanas: FilaConReferencia[], fila: FilaConReferencia): string {
  const descripcion = plano(fila.descripcion)
  if (!descripcion) return ''
  const marca = plano(fila.marca)
  const hermana = hermanas.find((h) =>
    h !== fila && (h.id === undefined || h.id !== fila.id)
    && plano(h.descripcion) === descripcion && plano(h.marca) === marca && h.referencia.trim())
  return hermana?.referencia.trim() ?? ''
}

// Descripciones del inventario para sugerir al escribir (sin repetir).
export function descripcionesConocidas(indice: Map<string, ModeloConocido[]>): string[] {
  return [...indice.values()].map((ms) => ms[0].descripcion.trim()).sort((a, b) => a.localeCompare(b, 'es'))
}
