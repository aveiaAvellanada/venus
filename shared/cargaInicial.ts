import { coloresDeNombre, MAX_COLORES, MENSAJE_MAX_COLORES, nombreColores } from './colores'
import { leerPesos } from './formato'
import {
  cantidad, enRango, fotoDeFila, fotoDesactualizada, maximoDe, nombreFila, rangoDeTalla, tallasConCantidad,
  type FilaFactura,
} from './compras'

// Carga inicial (panel web): la mercancía que ya está en la tienda, sin
// proveedor ni costo, con la foto de cada referencia y color. Usa las mismas
// filas que la factura de compra (referencia y color, cantidades por talla y
// precios por rango) y se guarda con cargar_inventario: todo o nada. Una talla
// nueva nace con su stock; en una que ya existe, los pares escritos se suman a
// los que tiene (otra caja del mismo zapato) y un precio distinto se guarda.

export const tallasNuevas = (fila: FilaFactura) => tallasConCantidad(fila).filter((x) => !fila.existentes[x.talla])

export const paresNuevos = (fila: FilaFactura): number => tallasNuevas(fila).reduce((s, x) => s + x.cantidad, 0)

// Pares que se suman a tallas que ya estaban cargadas.
export const tallasASumar = (fila: FilaFactura) => tallasConCantidad(fila).filter((x) => fila.existentes[x.talla])

export const paresSumados = (fila: FilaFactura): number => tallasASumar(fila).reduce((s, x) => s + x.cantidad, 0)

// Tallas que ya existen y cuyo rango de precios escrito no es el que tienen.
export function tallasConPrecioNuevo(fila: FilaFactura): string[] {
  return Object.entries(fila.existentes)
    .filter(([talla, e]) => {
      const r = rangoDeTalla(fila, talla)
      if (!r) return false
      const minimo = leerPesos(r.minimo)
      const maximo = maximoDe(r)
      return minimo !== Number(e.precio_minimo) || maximo !== (e.precio_maximo == null ? null : Number(e.precio_maximo))
    })
    .map(([talla]) => talla)
}

const tieneExistentes = (fila: FilaFactura) => Object.keys(fila.existentes).length > 0

// Una fila se guarda si trae tallas nuevas, pares para sumar, precios nuevos
// o una foto nueva para lo que ya existe.
export const filaParaGuardar = (fila: FilaFactura): boolean =>
  tallasNuevas(fila).length > 0 || tallasASumar(fila).length > 0 || tallasConPrecioNuevo(fila).length > 0
  || (!!fila.foto && tieneExistentes(fila))

// La misma llave con que cargar_inventario reconoce una talla: referencia (o
// descripción y marca si no tiene) y color, sin importar mayúsculas ni espacios.
export function claveDeFila(fila: FilaFactura): string {
  const base = fila.referencia.trim()
    ? `r|${fila.referencia.trim().toLowerCase()}`
    : `d|${fila.descripcion.trim().toLowerCase()}|${fila.marca.trim().toLowerCase()}`
  return `${base}|${(nombreColores(fila.color) ?? '').toLowerCase()}`
}

// Errores que impiden guardar (la base vuelve a validar todo).
export function erroresCargaInicial(filas: FilaFactura[]): string[] {
  const errores: string[] = []
  if (!filas.some(filaParaGuardar)) errores.push('No hay nada que guardar: escribe pares, cambia un precio o pon una foto.')
  const vistas = new Map<string, string>()
  filas.forEach((fila, i) => {
    const nombre = nombreFila(fila, i)
    const textoMalo = Object.entries(fila.cantidades).some(([, v]) => v.trim() !== '' && cantidad(v) === 0)
    if (textoMalo) errores.push(`En ${nombre} hay cantidades que no son números enteros.`)
    if (!filaParaGuardar(fila)) return
    const clave = claveDeFila(fila)
    if (vistas.has(clave)) errores.push(`${nombre} está dos veces: deja una sola fila por referencia y color.`)
    vistas.set(clave, nombre)
    if (coloresDeNombre(fila.color).length > MAX_COLORES) errores.push(`En ${nombre}: ${MENSAJE_MAX_COLORES}`)
    if (fotoDesactualizada(fila)) errores.push(`La foto de ${nombre} quedó con el nombre de antes: vuelve a ponerla.`)
    if (!fila.descripcion.trim()) errores.push(`Falta la descripción de ${nombre}.`)
    if (!fila.categoria) errores.push(`Falta la categoría de ${nombre}.`)
    const nuevas = tallasNuevas(fila)
    // Un zapato no se crea sin foto (decisión del dueño, 2026-10-26).
    if (nuevas.length && !fotoDeFila(fila)) errores.push(`Falta la foto de ${nombre}: es obligatoria para crear un zapato.`)
    // Se revisan los precios de lo que se va a guardar: tallas nuevas, las que
    // suman pares y las que cambian de precio.
    const tocadas = [...nuevas.map((x) => x.talla), ...tallasASumar(fila).map((x) => x.talla), ...tallasConPrecioNuevo(fila)]
    for (const r of fila.rangos.filter((r) => tocadas.some((t) => enRango(r, t)))) {
      const minimo = leerPesos(r.minimo)
      const maximo = leerPesos(r.maximo)
      const tramo = r.desde === r.hasta ? `talla ${r.desde}` : `tallas ${r.desde}–${r.hasta}`
      // El máximo es opcional; si está, no puede ser menor que el mínimo.
      if (Number.isNaN(minimo) || minimo <= 0) errores.push(`Falta el precio mínimo de ${nombre} (${tramo}).`)
      else if (!Number.isNaN(maximo) && minimo > maximo) errores.push(`En ${nombre} (${tramo}) el precio mínimo pasa del máximo.`)
    }
  })
  return errores
}

const lista = (tallas: string[]) => (tallas.length === 1 ? `la talla ${tallas[0]}` : `las tallas ${tallas.slice(0, -1).join(', ')} y ${tallas[tallas.length - 1]}`)

// Avisos que no impiden guardar: lo que cambia en lo que ya estaba cargado,
// para revisarlo antes de guardar.
export function avisosCargaInicial(filas: FilaFactura[]): string[] {
  const avisos: string[] = []
  filas.forEach((fila, i) => {
    const sumar = tallasASumar(fila)
    if (sumar.length) {
      const pares = paresSumados(fila)
      avisos.push(`En ${nombreFila(fila, i)} se suman ${pares} par${pares === 1 ? '' : 'es'} a ${lista(sumar.map((x) => x.talla))}, que ya ${sumar.length === 1 ? 'estaba cargada' : 'estaban cargadas'}.`)
    }
    const precio = tallasConPrecioNuevo(fila)
    if (precio.length) avisos.push(`En ${nombreFila(fila, i)} cambia el precio de ${lista(precio)}.`)
  })
  return avisos
}

export interface ResumenCargaInicial {
  referencias: number
  tallasNuevas: number
  // Todos los pares que entran: los de tallas nuevas y los que se suman.
  pares: number
  paresSumados: number
  preciosCambiados: number
  fotos: number
}

export function resumenCargaInicial(filas: FilaFactura[]): ResumenCargaInicial {
  const guardar = filas.filter(filaParaGuardar)
  const sumados = guardar.reduce((s, f) => s + paresSumados(f), 0)
  return {
    referencias: guardar.length,
    tallasNuevas: guardar.reduce((s, f) => s + tallasNuevas(f).length, 0),
    pares: guardar.reduce((s, f) => s + paresNuevos(f), 0) + sumados,
    paresSumados: sumados,
    preciosCambiados: guardar.reduce((s, f) => s + tallasConPrecioNuevo(f).length, 0),
    fotos: guardar.filter((f) => f.foto).length,
  }
}

export interface FilaCarga {
  fila: string
  categoria: string
  descripcion: string
  marca?: string
  referencia?: string
  color?: string
  talla: string
  precio_minimo: number
  precio_maximo?: number
  stock: number
  // Solo en tallas que ya existen: pares que se suman a su stock.
  sumar?: number
  foto_url?: string
}

// Lo que recibe cargar_inventario: una entrada por talla. Las tallas nuevas
// llevan su stock y el precio de su rango. Las que ya existían van si suman
// pares (`sumar`), si cambian de precio o si hay foto nueva (para que quede en
// todas); su stock (0) no se usa.
export function filasParaCargar(filas: FilaFactura[]): FilaCarga[] {
  return filas.flatMap((fila, i) => {
    if (!filaParaGuardar(fila)) return []
    const nombre = nombreFila(fila, i)
    const comun = {
      categoria: fila.categoria,
      descripcion: fila.descripcion.trim(),
      marca: fila.marca.trim() || undefined,
      referencia: fila.referencia.trim() || undefined,
      color: nombreColores(fila.color) ?? undefined,
      foto_url: fila.foto || undefined,
    }
    const nuevas = tallasNuevas(fila).map(({ talla, cantidad: stock }): FilaCarga => {
      const r = rangoDeTalla(fila, talla)!
      const maximo = maximoDe(r)
      return { fila: `${nombre}, talla ${talla}`, ...comun, talla, precio_minimo: leerPesos(r.minimo), precio_maximo: maximo ?? undefined, stock }
    })
    const sumar = new Map(tallasASumar(fila).map((x) => [x.talla, x.cantidad]))
    const precio = new Set(tallasConPrecioNuevo(fila))
    const existentes = Object.entries(fila.existentes)
      .filter(([talla]) => fila.foto || sumar.has(talla) || precio.has(talla))
      .map(([talla, e]): FilaCarga => {
        const r = precio.has(talla) ? rangoDeTalla(fila, talla)! : null
        const minimo = r ? leerPesos(r.minimo) : Number(e.precio_minimo)
        const maximo = r ? maximoDe(r) : e.precio_maximo == null ? null : Number(e.precio_maximo)
        return {
          fila: `${nombre}, talla ${talla}`, ...comun, talla,
          precio_minimo: minimo, precio_maximo: maximo ?? undefined, stock: 0,
          ...(sumar.has(talla) ? { sumar: sumar.get(talla) } : {}),
        }
      })
    return [...nuevas, ...existentes]
  })
}
