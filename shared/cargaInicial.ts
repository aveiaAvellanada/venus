import { coloresDeNombre, MAX_COLORES, MENSAJE_MAX_COLORES, nombreColores } from './colores'
import { leerPesos } from './formato'
import {
  cantidad, enRango, fotoDeFila, fotoDesactualizada, maximoDe, nombreFila, rangoDeTalla, tallasConCantidad,
  type FilaFactura,
} from './compras'

// Carga inicial (panel web): la mercancía que ya está en la tienda, sin
// proveedor ni costo, con la foto de cada referencia y color. Usa las mismas
// filas que la factura de compra (referencia y color, cantidades por talla y
// precios por rango) y se guarda con cargar_inventario: todo o nada; una talla
// nueva nace con su stock y una que ya existe no cambia su stock.

export const tallasNuevas = (fila: FilaFactura) => tallasConCantidad(fila).filter((x) => !fila.existentes[x.talla])

export const paresNuevos = (fila: FilaFactura): number => tallasNuevas(fila).reduce((s, x) => s + x.cantidad, 0)

// Cantidades escritas en tallas que ya estaban cargadas (no se usan).
export const tallasYaCargadas = (fila: FilaFactura): string[] =>
  tallasConCantidad(fila).filter((x) => fila.existentes[x.talla]).map((x) => x.talla)

const tieneExistentes = (fila: FilaFactura) => Object.keys(fila.existentes).length > 0

// Una fila se guarda si trae tallas nuevas o una foto nueva para lo que ya existe.
export const filaParaGuardar = (fila: FilaFactura): boolean =>
  tallasNuevas(fila).length > 0 || (!!fila.foto && tieneExistentes(fila))

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
  if (!filas.some(filaParaGuardar)) errores.push('Escribe la cantidad de al menos una talla nueva.')
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
    for (const r of fila.rangos.filter((r) => nuevas.some((x) => enRango(r, x.talla)))) {
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

// Avisos que no impiden guardar.
export function avisosCargaInicial(filas: FilaFactura[]): string[] {
  const avisos: string[] = []
  filas.forEach((fila, i) => {
    const ya = tallasYaCargadas(fila)
    if (ya.length) {
      avisos.push(`En ${nombreFila(fila, i)}, ${lista(ya)} ya ${ya.length === 1 ? 'estaba cargada' : 'estaban cargadas'}: su stock no cambia aquí (para corregirlo usa Conteo físico).`)
    }
  })
  return avisos
}

export interface ResumenCargaInicial {
  referencias: number
  tallasNuevas: number
  pares: number
  fotos: number
}

export function resumenCargaInicial(filas: FilaFactura[]): ResumenCargaInicial {
  const guardar = filas.filter(filaParaGuardar)
  return {
    referencias: guardar.length,
    tallasNuevas: guardar.reduce((s, f) => s + tallasNuevas(f).length, 0),
    pares: guardar.reduce((s, f) => s + paresNuevos(f), 0),
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
  foto_url?: string
}

// Lo que recibe cargar_inventario: una entrada por talla. Las tallas nuevas
// llevan su stock y el precio de su rango; si hay foto nueva, las que ya
// existían también van (con su precio de siempre y stock 0, que no se usa)
// para que la foto quede en todas.
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
    const conFoto = fila.foto
      ? Object.entries(fila.existentes)
        .filter(([talla]) => !nuevas.some((x) => x.talla === talla))
        .map(([talla, e]): FilaCarga => ({
          fila: `${nombre}, talla ${talla}`, ...comun, talla,
          precio_minimo: Number(e.precio_minimo), precio_maximo: e.precio_maximo == null ? undefined : Number(e.precio_maximo), stock: 0,
        }))
      : []
    return [...nuevas, ...conFoto]
  })
}
