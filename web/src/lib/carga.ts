import { pesos } from '@shared/formato'
import { CATEGORIAS, type FilaConError, type FilaValida } from '@shared/excel'
import { compararTallas, type Costo, type ProductoCalzado } from './inventario'
import { plano } from '../navegacion'

// Carga masiva (fase 1, A9): la plantilla de Excel de la app
// (plantilla_carga_inventario.md), revisada contra el inventario antes de
// guardar. La base (cargar_inventario) aplica las mismas reglas: esto solo
// muestra antes lo que va a pasar.

export const COLUMNAS = [
  'categoria', 'descripcion', 'marca', 'referencia', 'talla', 'color',
  'precio_minimo', 'precio_maximo', 'costo', 'stock',
] as const

export const MAX_FILAS = 5000

export type EstadoFila = 'nueva' | 'cambia' | 'igual'

export interface FilaRevisada {
  fila: number
  datos: FilaValida
  estado: EstadoFila
  cambios: string[]
  // Talla existente cuyo stock en el archivo difiere del sistema: se ignora.
  stockSistema: number | null
}

export interface Revision {
  filas: FilaRevisada[]
  errores: FilaConError[]
  nuevas: number
  cambian: number
  iguales: number
  paresNuevos: number
  stockIgnorado: number
}

// La misma llave que usa la base: referencia, o descripción si no tiene; más
// color y talla. Sin distinguir mayúsculas ni espacios de los extremos (las
// tildes sí cuentan, como en la base).
const limpio = (t: string | null | undefined) => (t ?? '').trim().toLowerCase()

export function llave(p: { referencia: string | null; descripcion: string; color: string | null; talla: string | null }): string {
  const ref = limpio(p.referencia)
  return [ref ? `r|${ref}` : `d|${limpio(p.descripcion)}`, limpio(p.color), limpio(p.talla)].join('|')
}

const centavos = (n: number) => Math.round(n * 100) / 100
const etiqueta = (valor: string) => CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? valor
const rango = (min: number, max: number) => `${pesos(min)}–${pesos(max)}`

function cambiosDe(actual: ProductoCalzado, d: FilaValida): string[] {
  const cambios: string[] = []
  const min = centavos(d.precio_min)
  const max = centavos(d.precio_max)
  if (Number(actual.precio_minimo) !== min || Number(actual.precio_maximo) !== max) {
    cambios.push(`Precio ${rango(Number(actual.precio_minimo), Number(actual.precio_maximo))} → ${rango(min, max)}`)
  }
  if (actual.descripcion !== d.descripcion) cambios.push(`Descripción: ${actual.descripcion} → ${d.descripcion}`)
  if ((actual.marca ?? null) !== d.marca) cambios.push(`Marca: ${actual.marca ?? 'sin marca'} → ${d.marca ?? 'sin marca'}`)
  if (actual.categoria !== d.categoria) cambios.push(`Categoría: ${etiqueta(actual.categoria)} → ${etiqueta(d.categoria)}`)
  return cambios
}

// Clasifica cada fila válida contra el inventario y marca como error las tallas
// repetidas dentro del archivo (la base también las rechaza).
export function revisarCarga(
  validacion: { validas: FilaValida[]; errores: FilaConError[] },
  inventario: ProductoCalzado[],
): Revision {
  const existentes = new Map<string, ProductoCalzado>()
  for (const p of inventario) {
    const k = llave(p)
    const previo = existentes.get(k)
    if (!previo || (!previo.activo && p.activo)) existentes.set(k, p)
  }

  const errores = [...validacion.errores]
  const vistas = new Map<string, number>()
  const filas: FilaRevisada[] = []
  for (const datos of validacion.validas) {
    const fila = datos.fila
    const k = llave(datos)
    const repetida = vistas.get(k)
    if (repetida != null) {
      errores.push({
        fila,
        datos: datos.datos_originales,
        errores: [`Esa talla ya viene en la fila ${repetida} (${datos.referencia ?? datos.descripcion}${datos.color ? ` ${datos.color}` : ''}, talla ${datos.talla ?? 'única'})`],
      })
      continue
    }
    vistas.set(k, fila)
    const actual = existentes.get(k)
    if (!actual) {
      filas.push({ fila, datos, estado: 'nueva', cambios: [], stockSistema: null })
      continue
    }
    const cambios = cambiosDe(actual, datos)
    filas.push({
      fila,
      datos,
      estado: cambios.length ? 'cambia' : 'igual',
      cambios,
      stockSistema: actual.stock_actual !== datos.stock ? actual.stock_actual : null,
    })
  }
  errores.sort((a, b) => a.fila - b.fila)

  const nuevas = filas.filter((f) => f.estado === 'nueva')
  return {
    filas,
    errores,
    nuevas: nuevas.length,
    cambian: filas.filter((f) => f.estado === 'cambia').length,
    iguales: filas.filter((f) => f.estado === 'igual').length,
    paresNuevos: nuevas.reduce((s, f) => s + f.datos.stock, 0),
    stockIgnorado: filas.filter((f) => f.stockSistema != null).length,
  }
}

// Lo que recibe cargar_inventario. Van todas las filas (también las que no
// cambian) para que la base cuente y valide lo mismo que se vio aquí.
export function payloadCarga(filas: FilaRevisada[]) {
  return filas.map(({ fila, datos: d }) => ({
    fila,
    categoria: d.categoria,
    descripcion: d.descripcion,
    marca: d.marca,
    referencia: d.referencia,
    talla: d.talla,
    color: d.color,
    precio_minimo: d.precio_min,
    precio_maximo: d.precio_max,
    costo: d.costo,
    stock: d.stock,
  }))
}

type Celda = string | number | null

// El inventario activo con el formato de la plantilla, para corregir en Excel
// y volver a subir. El costo es el último conocido (vacío si no hay o sin permiso).
export function filasDeExportacion(productos: ProductoCalzado[], costos?: Map<string, Costo>): Celda[][] {
  const activos = productos
    .filter((p) => p.activo)
    .sort((a, b) =>
      plano(a.referencia || a.descripcion).localeCompare(plano(b.referencia || b.descripcion), 'es')
      || plano(a.color ?? '').localeCompare(plano(b.color ?? ''), 'es')
      || compararTallas(a.talla, b.talla))
  return [
    [...COLUMNAS],
    ...activos.map((p) => [
      etiqueta(p.categoria),
      p.descripcion,
      p.marca,
      p.referencia,
      p.talla,
      p.color,
      Number(p.precio_minimo),
      Number(p.precio_maximo),
      costos?.get(p.id)?.ultimo ?? null,
      p.stock_actual,
    ]),
  ]
}

export const INSTRUCCIONES: Celda[][] = [
  ['Cómo llenar la hoja Inventario'],
  ['Cada fila es una talla. La fila 1 son los encabezados; no les cambies el nombre.'],
  ['Obligatorias: categoria, descripcion, precio_minimo, precio_maximo y stock. Las demás pueden quedar vacías.'],
  [`Categorías: ${CATEGORIAS.map((c) => c.etiqueta).join(', ')}.`],
  ['Precios, costo y stock como números, sin $ ni puntos de miles (90000). El stock, entero.'],
  ['Una talla que ya existe (misma referencia —o descripción si no tiene—, color y talla) actualiza sus datos y precios, pero NO su stock: el stock cambia con compras, ventas y devoluciones.'],
  ['Una talla nueva se crea con el stock de la hoja.'],
  ['Si una sola fila tiene error no se guarda nada: el panel muestra cuál corregir.'],
]
