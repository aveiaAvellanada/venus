import type { Costo, ProductoCalzado } from './inventario'

// Conteo físico (fase 2, A4): lo contado en la tienda contra el stock del
// sistema. Esto es la parte pura: el borrador, las diferencias, lo que falta
// corregir y lo que se manda a registrar_conteo. La base aplica las mismas
// reglas; esto solo avisa antes.

export type Motivo = 'error' | 'perdida' | 'dano' | 'otro'

export const MOTIVOS: { valor: Motivo; titulo: string; soloFaltante: boolean }[] = [
  { valor: 'error', titulo: 'Error de registro', soloFaltante: false },
  { valor: 'perdida', titulo: 'Pérdida o robo', soloFaltante: true },
  { valor: 'dano', titulo: 'Daño o defecto', soloFaltante: true },
  { valor: 'otro', titulo: 'Otro (con nota)', soloFaltante: false },
]

export const tituloMotivo = (m: string | null): string => MOTIVOS.find((x) => x.valor === m)?.titulo ?? '—'

// Una talla contada. `sistema` es el stock que mostraba la pantalla cuando se
// contó: si luego hay una venta, la base lo nota y pide volver a contarla.
export interface Contado {
  contado: string
  sistema: number
  motivo: Motivo | ''
  nota: string
  revisar?: boolean
}

export interface BorradorConteo {
  clave: string
  categoria: string
  marca: string
  nota: string
  contados: Record<string, Contado>
}

export function borradorVacio(clave: string): BorradorConteo {
  return { clave, categoria: '', marca: '', nota: '', contados: {} }
}

// Qué se va a contar: las tallas activas de la categoría y la marca elegidas.
export function enAlcance(p: ProductoCalzado, categoria: string, marca: string): boolean {
  return p.activo && (!categoria || p.categoria === categoria) && (!marca || (p.marca ?? '') === marca)
}

export function textoAlcance(categoria: string, marca: string): string {
  if (!categoria && !marca) return 'Todo el inventario'
  return [categoria, marca && `marca ${marca}`].filter(Boolean).join(' · ')
}

// "3" → 3; vacío, negativo o con decimales → null.
export function cantidad(texto: string): number | null {
  const limpio = texto.trim()
  if (!/^\d+$/.test(limpio)) return null
  return Number(limpio)
}

// Escribir en una talla: guarda lo contado y el stock que se veía; borrar el
// campo la saca del conteo. Volver a escribir quita el aviso de "revisar".
export function contar(b: BorradorConteo, p: ProductoCalzado, texto: string): BorradorConteo {
  const contados = { ...b.contados }
  if (texto.trim() === '') {
    delete contados[p.id]
    return { ...b, contados }
  }
  const antes = contados[p.id]
  const sistema = antes?.sistema ?? p.stock_actual
  const n = cantidad(texto)
  const motivo = n === sistema ? '' : antes?.motivo ?? ''
  contados[p.id] = { contado: texto, sistema, motivo, nota: antes?.nota ?? '' }
  return { ...b, contados }
}

export function cambiarMotivo(b: BorradorConteo, id: string, cambios: Partial<Pick<Contado, 'motivo' | 'nota'>>): BorradorConteo {
  const actual = b.contados[id]
  if (!actual) return b
  return { ...b, contados: { ...b.contados, [id]: { ...actual, ...cambios } } }
}

export interface Linea {
  producto: ProductoCalzado
  texto: string
  contado: number | null
  sistema: number
  diferencia: number | null
  motivo: Motivo | ''
  nota: string
  revisar: boolean
}

export function lineas(b: BorradorConteo, productos: ProductoCalzado[]): Linea[] {
  const porId = new Map(productos.map((p) => [p.id, p]))
  return Object.entries(b.contados).flatMap(([id, c]) => {
    const producto = porId.get(id)
    if (!producto) return []
    const contado = cantidad(c.contado)
    return [{
      producto, texto: c.contado, contado, sistema: c.sistema,
      diferencia: contado === null ? null : contado - c.sistema,
      motivo: c.motivo, nota: c.nota, revisar: !!c.revisar,
    }]
  })
}

export const nombreTalla = (p: ProductoCalzado): string =>
  [p.referencia || p.descripcion, p.color, `talla ${p.talla ?? 'única'}`].filter(Boolean).join(' ')

export interface ResumenConteo {
  contadas: number
  conDiferencia: number
  sobrantes: number
  faltantes: number
  sinContar: number
  revisar: number
}

export function resumen(ls: Linea[], enElAlcance: ProductoCalzado[]): ResumenConteo {
  const contadas = new Set(ls.map((l) => l.producto.id))
  const r: ResumenConteo = {
    contadas: ls.length, conDiferencia: 0, sobrantes: 0, faltantes: 0, revisar: 0,
    sinContar: enElAlcance.filter((p) => !contadas.has(p.id)).length,
  }
  for (const l of ls) {
    if (l.revisar) r.revisar += 1
    if (!l.diferencia) continue
    r.conDiferencia += 1
    if (l.diferencia > 0) r.sobrantes += l.diferencia
    else r.faltantes -= l.diferencia
  }
  return r
}

export function erroresConteo(ls: Linea[]): string[] {
  const errores: string[] = []
  for (const l of ls) {
    const nombre = nombreTalla(l.producto)
    if (l.contado === null) {
      errores.push(`${nombre}: lo contado debe ser un número entero, 0 o más.`)
      continue
    }
    if (l.revisar) errores.push(`${nombre}: el stock cambió mientras contabas; vuelve a contarla.`)
    if (!l.diferencia) continue
    if (!l.motivo) errores.push(`${nombre}: elige el motivo de la diferencia.`)
    else if (l.diferencia > 0 && MOTIVOS.find((m) => m.valor === l.motivo)?.soloFaltante) {
      errores.push(`${nombre}: sobran pares; pérdida o daño solo explican faltantes.`)
    } else if (l.motivo === 'otro' && !l.nota.trim()) {
      errores.push(`${nombre}: con el motivo "Otro" escribe una nota.`)
    }
  }
  return errores
}

// Un motivo para todas las diferencias que aún no tienen (pérdida y daño solo
// se ponen en los faltantes).
export function motivoParaTodas(b: BorradorConteo, ls: Linea[], motivo: Motivo): BorradorConteo {
  const soloFaltante = MOTIVOS.find((m) => m.valor === motivo)?.soloFaltante
  let nuevo = b
  for (const l of ls) {
    if (!l.diferencia || l.motivo) continue
    if (soloFaltante && l.diferencia > 0) continue
    nuevo = cambiarMotivo(nuevo, l.producto.id, { motivo })
  }
  return nuevo
}

// La base encontró tallas cuyo stock se movió mientras se contaba: se toma el
// stock de ahora y se marcan para volver a contarlas.
export interface Cambiado {
  producto_id: string
  sistema_antes: number
  sistema_ahora: number
}

export function aplicarCambiados(b: BorradorConteo, cambiados: Cambiado[]): BorradorConteo {
  const contados = { ...b.contados }
  for (const c of cambiados) {
    const actual = contados[c.producto_id]
    if (actual) contados[c.producto_id] = { ...actual, sistema: c.sistema_ahora, revisar: true }
  }
  return { ...b, contados }
}

export function quitarRevisar(b: BorradorConteo): BorradorConteo {
  const contados: Record<string, Contado> = {}
  for (const [id, c] of Object.entries(b.contados)) contados[id] = { ...c, revisar: false }
  return { ...b, contados }
}

// Valor a último costo de lo que sobra y lo que falta (solo con permiso `costos`).
export function valorDiferencias(ls: Linea[], costos: Map<string, Costo> | undefined): { sobrante: number; faltante: number; sinCosto: number } | null {
  if (!costos) return null
  const v = { sobrante: 0, faltante: 0, sinCosto: 0 }
  for (const l of ls) {
    if (!l.diferencia) continue
    const costo = costos.get(l.producto.id)?.ultimo
    if (costo === undefined) v.sinCosto += 1
    else if (l.diferencia > 0) v.sobrante += l.diferencia * costo
    else v.faltante -= l.diferencia * costo
  }
  return v
}

// Lo que recibe registrar_conteo. `alcance` es el texto que se muestra
// ("Tennis · marca Bosi"), con el nombre de la categoría como se ve en pantalla.
export function payloadConteo(b: BorradorConteo, ls: Linea[], alcance: string) {
  return {
    alcance,
    nota: b.nota.trim() || null,
    items: ls.map((l) => ({
      producto_id: l.producto.id,
      sistema: l.sistema,
      contado: l.contado,
      motivo: l.diferencia ? l.motivo || null : null,
      nota: l.diferencia ? l.nota.trim() || null : null,
    })),
  }
}
