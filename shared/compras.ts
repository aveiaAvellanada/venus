import { coloresDeNombre, MAX_COLORES, MENSAJE_MAX_COLORES, nombreColores } from './colores'
import { leerPesos } from './formato'

// Factura de compra (panel web A1 y Recibir mercancía de la app). Lógica pura: la pantalla edita
// textos tal como se escriben y aquí se calculan totales, validaciones y lo
// que se manda a registrar_compra.

// La tienda maneja de la 20 a la 45 en todas las categorías (decisión del dueño, 2026-10-12).
export const TALLAS: string[] = Array.from({ length: 26 }, (_, i) => String(20 + i))

// Redondeo de precios sugeridos y cambios en lote (decisión del dueño, 2026-10-12).
export const REDONDEO_PRECIO = 1000
export const redondearPrecio = (n: number): number => Math.round(n / REDONDEO_PRECIO) * REDONDEO_PRECIO

// Una misma referencia puede tener costo y precios distintos según el rango de
// tallas (p. ej. 20–26 más barato que 27–35). Cada rango cubre tallas seguidas.
export interface RangoPrecio {
  desde: string
  hasta: string
  costo: string
  minimo: string
  maximo: string
}

export interface TallaExistente {
  id: string
  precio_minimo: number
  precio_maximo: number
  foto_url?: string | null
}

export interface FilaFactura {
  id: string
  referencia: string
  descripcion: string
  marca: string
  categoria: string
  color: string
  // Tallas que ya existen en el inventario para esta referencia y color.
  existentes: Record<string, TallaExistente>
  cantidades: Record<string, string>
  rangos: RangoPrecio[]
  // Foto nueva de esta referencia y color (URL pública ya subida). Al guardar
  // queda en todas sus tallas. Vacía = se conserva la que tenga.
  foto?: string
}

export type Condicion = 'contado' | 'credito'

export interface Factura {
  proveedorId: string
  numeroFactura: string
  fechaFactura: string
  condicion: Condicion
  fechaVencimiento: string
  notas: string
  filas: FilaFactura[]
}

const n = (talla: string) => Number(talla)
// Como se escribe un monto en pantalla: "60.000".
export const miles = (v: number): string => Math.round(v).toLocaleString('es-CO')
export const enRango = (r: RangoPrecio, talla: string) => n(talla) >= n(r.desde) && n(talla) <= n(r.hasta)

export function rangoDeTalla(fila: FilaFactura, talla: string): RangoPrecio | undefined {
  return fila.rangos.find((r) => enRango(r, talla))
}

export const rangoCompleto = (o: Partial<RangoPrecio> = {}): RangoPrecio => ({
  desde: TALLAS[0], hasta: TALLAS[TALLAS.length - 1], costo: '', minimo: '', maximo: '', ...o,
})

export function filaVacia(id: string): FilaFactura {
  return { id, referencia: '', descripcion: '', marca: '', categoria: '', color: '', existentes: {}, cantidades: {}, rangos: [rangoCompleto()], foto: '' }
}

// "Otro color": la misma referencia con todo igual (descripción, marca,
// categoría, costo y precios por rango), sin color, cantidades ni foto.
export function otroColor(fila: FilaFactura, id: string): FilaFactura {
  return {
    ...fila,
    id,
    color: '',
    existentes: {},
    cantidades: {},
    rangos: fila.rangos.map((r) => ({ ...r })),
    foto: '',
  }
}

// Foto que se ve en la fila: la nueva o, si no hay, la que ya tiene ese color.
export function fotoDeFila(fila: FilaFactura): string | null {
  return fila.foto || Object.values(fila.existentes).find((e) => e.foto_url)?.foto_url || null
}

// El color se escribe en dos campos (hasta dos colores). Se guarda como
// "Rojo y blanco"; aquí se parte y se une sin perder lo que se está escribiendo.
export function partesColor(color: string): [string, string] {
  const i = color.search(/\s+y\s+/i)
  if (i < 0) return [color, '']
  const resto = color.slice(i).replace(/^\s+y\s+/i, '')
  return [color.slice(0, i), resto]
}

export function unirColores(primero: string, segundo: string): string {
  return segundo.trim() ? `${primero} y ${segundo}` : primero
}

// "Precio distinto desde la talla X": parte el rango que contiene a X en dos,
// con los mismos valores, para cambiar solo el de arriba.
export function dividirRango(fila: FilaFactura, desde: string): FilaFactura {
  const i = fila.rangos.findIndex((r) => enRango(r, desde) && r.desde !== desde)
  if (i < 0) return fila
  const r = fila.rangos[i]
  const anterior = String(n(desde) - 1)
  const rangos = [...fila.rangos]
  rangos.splice(i, 1, { ...r, hasta: anterior }, { ...r, desde })
  return { ...fila, rangos }
}

// Quitar un rango: se lo queda el de abajo (o el de arriba si es el primero).
export function unirRango(fila: FilaFactura, indice: number): FilaFactura {
  if (fila.rangos.length < 2) return fila
  const rangos = [...fila.rangos]
  const [quitado] = rangos.splice(indice, 1)
  if (indice > 0) rangos[indice - 1] = { ...rangos[indice - 1], hasta: quitado.hasta }
  else rangos[0] = { ...rangos[0], desde: quitado.desde }
  return { ...fila, rangos }
}

// Al reconocer una referencia: rangos a partir de los precios que ya tiene cada
// talla (tallas seguidas con el mismo precio forman un rango) y el último costo.
export function rangosDesdeExistentes(
  existentes: Record<string, TallaExistente>,
  costos?: Map<string, { ultimo: number }>,
): RangoPrecio[] {
  const conPrecio = TALLAS.filter((t) => existentes[t])
  if (!conPrecio.length) return [rangoCompleto()]
  const valores = (t: string) => {
    const e = existentes[t]
    const costo = costos?.get(e.id)?.ultimo
    return {
      costo: costo == null ? '' : miles(costo),
      minimo: miles(Number(e.precio_minimo)),
      maximo: miles(Number(e.precio_maximo)),
    }
  }
  const rangos: RangoPrecio[] = []
  for (const t of conPrecio) {
    const v = valores(t)
    const ultimo = rangos[rangos.length - 1]
    if (ultimo && ultimo.minimo === v.minimo && ultimo.maximo === v.maximo && (ultimo.costo === v.costo || !v.costo || !ultimo.costo)) {
      ultimo.hasta = t
      if (!ultimo.costo) ultimo.costo = v.costo
    } else {
      rangos.push({ desde: t, hasta: t, ...v })
    }
  }
  // Las tallas sin precio quedan en el rango vecino: los rangos cubren de la 20 a la 45.
  rangos[0].desde = TALLAS[0]
  for (let i = 1; i < rangos.length; i++) rangos[i - 1].hasta = String(n(rangos[i].desde) - 1)
  rangos[rangos.length - 1].hasta = TALLAS[TALLAS.length - 1]
  return rangos
}

export const cantidad = (texto: string | undefined): number => {
  const v = Number((texto ?? '').trim())
  return Number.isInteger(v) && v > 0 ? v : 0
}

export function tallasConCantidad(fila: FilaFactura): { talla: string; cantidad: number }[] {
  return TALLAS.map((t) => ({ talla: t, cantidad: cantidad(fila.cantidades[t]) })).filter((x) => x.cantidad > 0)
}

export const unidadesFila = (fila: FilaFactura): number =>
  tallasConCantidad(fila).reduce((s, x) => s + x.cantidad, 0)

export function subtotalFila(fila: FilaFactura): number {
  return tallasConCantidad(fila).reduce((s, x) => {
    const costo = leerPesos(rangoDeTalla(fila, x.talla)?.costo ?? '')
    return s + (Number.isNaN(costo) ? 0 : costo * x.cantidad)
  }, 0)
}

export interface ResumenFactura {
  unidades: number
  total: number
  referencias: number
  tallasNuevas: number
  preciosCambiados: number
}

export function resumenFactura(f: Factura): ResumenFactura {
  let tallasNuevas = 0
  let preciosCambiados = 0
  const conCantidad = f.filas.filter((fila) => unidadesFila(fila) > 0)
  for (const fila of conCantidad) {
    for (const { talla } of tallasConCantidad(fila)) {
      const e = fila.existentes[talla]
      const r = rangoDeTalla(fila, talla)
      if (!e) tallasNuevas++
      else if (r && (leerPesos(r.minimo) !== Number(e.precio_minimo) || leerPesos(r.maximo) !== Number(e.precio_maximo))) preciosCambiados++
    }
  }
  return {
    unidades: conCantidad.reduce((s, fila) => s + unidadesFila(fila), 0),
    total: conCantidad.reduce((s, fila) => s + subtotalFila(fila), 0),
    referencias: conCantidad.length,
    tallasNuevas,
    preciosCambiados,
  }
}

const nombreFila = (fila: FilaFactura, i: number) => fila.referencia.trim() || fila.descripcion.trim() || `la fila ${i + 1}`

// Errores que impiden guardar (la base vuelve a validar todo).
export function erroresFactura(f: Factura, hoy: string): string[] {
  const errores: string[] = []
  if (!f.proveedorId) errores.push('Elige el proveedor.')
  if (!f.fechaFactura || f.fechaFactura > hoy) errores.push('La fecha de la factura no puede faltar ni ser futura.')
  if (f.condicion === 'credito' && !f.fechaVencimiento) errores.push('Una compra a crédito necesita la fecha de vencimiento.')
  if (f.fechaVencimiento && f.fechaFactura && f.fechaVencimiento < f.fechaFactura) {
    errores.push('El vencimiento no puede ser anterior a la fecha de la factura.')
  }
  const conCantidad = f.filas.filter((fila) => unidadesFila(fila) > 0)
  if (!conCantidad.length) errores.push('Escribe la cantidad de al menos una talla.')
  f.filas.forEach((fila, i) => {
    const tallas = tallasConCantidad(fila)
    const textoMalo = Object.entries(fila.cantidades).some(([, v]) => v.trim() !== '' && cantidad(v) === 0)
    if (textoMalo) errores.push(`En ${nombreFila(fila, i)} hay cantidades que no son números enteros.`)
    if (!tallas.length) return
    if (coloresDeNombre(fila.color).length > MAX_COLORES) errores.push(`En ${nombreFila(fila, i)}: ${MENSAJE_MAX_COLORES}`)
    const hayNuevas = tallas.some((x) => !fila.existentes[x.talla])
    if (hayNuevas && !fila.descripcion.trim()) errores.push(`Falta la descripción de ${nombreFila(fila, i)}.`)
    if (hayNuevas && !fila.categoria) errores.push(`Falta la categoría de ${nombreFila(fila, i)}.`)
    const rangosUsados = fila.rangos.filter((r) => tallas.some((x) => enRango(r, x.talla)))
    for (const r of rangosUsados) {
      const costo = leerPesos(r.costo)
      const minimo = leerPesos(r.minimo)
      const maximo = leerPesos(r.maximo)
      const tramo = r.desde === r.hasta ? `talla ${r.desde}` : `tallas ${r.desde}–${r.hasta}`
      if (Number.isNaN(costo) || costo < 0) errores.push(`Falta el costo de ${nombreFila(fila, i)} (${tramo}).`)
      if (Number.isNaN(minimo) || Number.isNaN(maximo) || minimo <= 0) {
        errores.push(`Faltan los precios de ${nombreFila(fila, i)} (${tramo}).`)
      } else if (minimo > maximo) {
        errores.push(`En ${nombreFila(fila, i)} (${tramo}) el precio mínimo pasa del máximo.`)
      }
    }
  })
  return errores
}

// Avisos que no impiden guardar.
export function avisosFactura(f: Factura): string[] {
  const avisos: string[] = []
  if (!f.numeroFactura.trim()) avisos.push('Sin número de factura: sirve para la facturación futura.')
  f.filas.forEach((fila, i) => {
    for (const { talla } of tallasConCantidad(fila)) {
      const r = rangoDeTalla(fila, talla)
      const costo = leerPesos(r?.costo ?? '')
      const minimo = leerPesos(r?.minimo ?? '')
      if (!Number.isNaN(costo) && !Number.isNaN(minimo) && minimo < costo) {
        avisos.push(`En ${nombreFila(fila, i)} el precio mínimo queda por debajo del costo.`)
        return
      }
    }
  })
  return avisos
}

export interface ItemCompra {
  producto_id?: string
  referencia?: string
  descripcion?: string
  marca?: string
  categoria?: string
  color?: string
  talla: string
  cantidad: number
  costo_unitario: number
  precio_minimo: number
  precio_maximo: number
}

// Lo que recibe registrar_compra: una entrada por talla con cantidad.
export function itemsDeFactura(f: Factura): ItemCompra[] {
  return f.filas.flatMap((fila) =>
    tallasConCantidad(fila).map(({ talla, cantidad: c }) => {
      const r = rangoDeTalla(fila, talla)!
      const precios = {
        talla,
        cantidad: c,
        costo_unitario: leerPesos(r.costo),
        precio_minimo: leerPesos(r.minimo),
        precio_maximo: leerPesos(r.maximo),
      }
      const e = fila.existentes[talla]
      if (e) return { producto_id: e.id, ...precios }
      return {
        referencia: fila.referencia.trim() || undefined,
        descripcion: fila.descripcion.trim(),
        marca: fila.marca.trim() || undefined,
        categoria: fila.categoria,
        // "rojo/blanco" → "Rojo y blanco" (hasta dos colores).
        color: nombreColores(fila.color) ?? undefined,
        ...precios,
      }
    }),
  )
}

export function payloadFactura(f: Factura) {
  return {
    proveedor_id: f.proveedorId,
    numero_factura: f.numeroFactura.trim() || undefined,
    fecha_factura: f.fechaFactura,
    condicion_pago: f.condicion,
    fecha_vencimiento: f.condicion === 'credito' ? f.fechaVencimiento : undefined,
    notas: f.notas.trim() || undefined,
    items: itemsDeFactura(f),
  }
}
