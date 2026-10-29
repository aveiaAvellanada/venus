import type { jsPDF } from 'jspdf'
import { urlMiniatura } from '@shared/fotos'
import { pesos } from '@shared/formato'
import type { CategoriaPrecios, ModeloPrecios } from './precios'

// PDF de la hoja de precios: tamaño carta, cada categoría desde una página
// nueva y cada referencia en un bloque que no se parte entre páginas. Debajo
// de las tallas quedan renglones para escribir a mano los rangos de tallas con
// su precio mínimo y máximo, y la garantía.

const PAGINA = { ancho: 215.9, alto: 279.4 }
const MARGEN = 12
const CABECERA = 19 // título de la página y la instrucción
const PIE = 6
const FOTO = 20
const X_TABLA = MARGEN + FOTO + 4
const ANCHO_TABLA = PAGINA.ancho - MARGEN - X_TABLA
const COL_COLOR = 24
const COL_TOTAL = 11
const FILA = 4.3
const MAX_TALLAS_POR_TABLA = 26
const RENGLON = 6.8
const RENGLONES = 3
const SEPARACION = 4

export const RENGLONES_PRECIO = RENGLONES

const trozos = <T>(xs: T[], n: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out.length ? out : [[]]
}

// Alto de un bloque en mm (título, tablas de tallas y renglones de precios).
export function altoBloque(m: ModeloPrecios): number {
  const tablas = trozos(m.tallas, MAX_TALLAS_POR_TABLA).length
  const tallas = tablas * (m.colores.length + 1) * FILA + (tablas - 1) * 2
  const arriba = Math.max(FOTO, 10 + tallas)
  return arriba + 3 + Math.max(RENGLONES, m.tramos.length) * RENGLON + SEPARACION
}

const TITULO_CATEGORIA = 9

export type Renglon = { tipo: 'categoria'; etiqueta: string } | { tipo: 'modelo'; modelo: ModeloPrecios }
export interface Pagina {
  // Las categorías que aparecen en la página (para el encabezado).
  categorias: string[]
  renglones: Renglon[]
}

// Qué va en cada página. Las categorías siguen una tras otra con su título (sin
// gastar una hoja por categoría); el título nunca queda solo al final de una
// página y una referencia nunca se parte.
export function paginar(categorias: CategoriaPrecios[]): Pagina[] {
  const util = PAGINA.alto - MARGEN - CABECERA - PIE - MARGEN
  const paginas: Pagina[] = []
  let actual: Pagina = { categorias: [], renglones: [] }
  let usado = 0
  const nueva = () => {
    if (actual.renglones.length) paginas.push(actual)
    actual = { categorias: [], renglones: [] }
    usado = 0
  }
  for (const c of categorias) {
    c.modelos.forEach((m, i) => {
      const alto = altoBloque(m)
      const titulo = i === 0 ? TITULO_CATEGORIA : 0
      if (actual.renglones.length && usado + titulo + alto > util) nueva()
      if (i === 0 || !actual.renglones.length) {
        // Al pasar de página dentro de una categoría se repite el título.
        actual.renglones.push({ tipo: 'categoria', etiqueta: i === 0 ? c.etiqueta : `${c.etiqueta} (sigue)` })
        usado += TITULO_CATEGORIA
      }
      if (!actual.categorias.includes(c.etiqueta)) actual.categorias.push(c.etiqueta)
      actual.renglones.push({ tipo: 'modelo', modelo: m })
      usado += alto
    })
  }
  nueva()
  return paginas
}

// La miniatura como JPEG (jsPDF no lee WebP). null si no se pudo.
async function fotoJpeg(url: string): Promise<string | null> {
  try {
    const res = await fetch(urlMiniatura(url) ?? url)
    if (!res.ok) return null
    const imagen = await createImageBitmap(await res.blob())
    const lienzo = document.createElement('canvas')
    lienzo.width = 240
    lienzo.height = 240
    const ctx = lienzo.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 240, 240)
    ctx.drawImage(imagen, 0, 0, 240, 240)
    return lienzo.toDataURL('image/jpeg', 0.8)
  } catch {
    return null
  }
}

async function cargarFotos(modelos: ModeloPrecios[], conFotos: boolean): Promise<Map<string, string>> {
  const fotos = new Map<string, string>()
  if (!conFotos) return fotos
  const pendientes = modelos.filter((m) => m.foto)
  let i = 0
  const trabajador = async () => {
    while (i < pendientes.length) {
      const m = pendientes[i++]
      const jpeg = await fotoJpeg(m.foto!)
      if (jpeg) fotos.set(m.clave, jpeg)
    }
  }
  await Promise.all(Array.from({ length: 6 }, trabajador))
  return fotos
}

const GRIS = 120
const GRIS_CLARO = 190

function bloque(doc: jsPDF, m: ModeloPrecios, y: number, foto: string | undefined): number {
  // Foto
  if (foto) doc.addImage(foto, 'JPEG', MARGEN, y, FOTO, FOTO)
  else {
    doc.setDrawColor(GRIS_CLARO)
    doc.rect(MARGEN, y, FOTO, FOTO)
    doc.setFontSize(6)
    doc.setTextColor(GRIS)
    doc.text('Sin foto', MARGEN + FOTO / 2, y + FOTO / 2 + 1, { align: 'center' })
  }

  // Título
  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const titulo = [m.referencia, m.descripcion].filter(Boolean).join(' · ')
  doc.text(titulo, X_TABLA, y + 4, { maxWidth: ANCHO_TABLA - 30 })
  doc.text(`${m.total} ${m.total === 1 ? 'par' : 'pares'}`, PAGINA.ancho - MARGEN, y + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(GRIS)
  const datos = [
    m.marca,
    m.precioActual ? `Precio actual ${pesos(m.precioActual.min)}${m.precioActual.max !== m.precioActual.min ? ` – ${pesos(m.precioActual.max)}` : ''}` : 'Sin precio',
    m.garantia != null ? `Garantía ${m.garantia} días` : null,
  ].filter(Boolean).join(' · ')
  doc.text(datos, X_TABLA, y + 8)

  // Tallas: una fila por color con los pares de cada talla
  let yt = y + 10
  for (const tallas of trozos(m.tallas, MAX_TALLAS_POR_TABLA)) {
    const ancho = Math.min(9, (ANCHO_TABLA - COL_COLOR - COL_TOTAL) / Math.max(tallas.length, 1))
    const xTotal = X_TABLA + COL_COLOR + ancho * tallas.length
    doc.setFillColor(242, 242, 242)
    doc.rect(X_TABLA, yt, COL_COLOR + ancho * tallas.length + COL_TOTAL, FILA, 'F')
    doc.setFontSize(7)
    doc.setTextColor(GRIS)
    doc.text('Talla', X_TABLA + 1, yt + 3.3)
    tallas.forEach((t, i) => doc.text(t, X_TABLA + COL_COLOR + ancho * i + ancho / 2, yt + 3.3, { align: 'center' }))
    doc.text('Total', xTotal + COL_TOTAL / 2, yt + 3.3, { align: 'center' })
    yt += FILA
    for (const c of m.colores) {
      doc.setTextColor(0)
      doc.text(c.color, X_TABLA + 1, yt + 3.3, { maxWidth: COL_COLOR - 2 })
      tallas.forEach((t, i) => {
        const n = c.pares[t]
        if (n === undefined) return
        doc.setTextColor(n > 0 ? 0 : GRIS_CLARO)
        doc.text(n > 0 ? String(n) : '0', X_TABLA + COL_COLOR + ancho * i + ancho / 2, yt + 3.3, { align: 'center' })
      })
      doc.setTextColor(0)
      doc.setFont('helvetica', 'bold')
      doc.text(String(c.total), xTotal + COL_TOTAL / 2, yt + 3.3, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setDrawColor(225)
      doc.line(X_TABLA, yt + FILA, xTotal + COL_TOTAL, yt + FILA)
      yt += FILA
    }
    yt += 2
  }

  // Renglones para escribir los precios (con los rangos ya guardados, si hay)
  let yr = Math.max(y + FOTO, yt - 2) + 3
  doc.setFontSize(8.5)
  const filas = Math.max(RENGLONES, m.tramos.length)
  const linea = (x1: number, x2: number, yy: number) => { doc.setDrawColor(150); doc.line(x1, yy, x2, yy) }
  for (let i = 0; i < filas; i++) {
    const t = m.tramos[i]
    const base = yr + 5
    doc.setTextColor(0)
    doc.text('Tallas', MARGEN, base)
    linea(MARGEN + 10, MARGEN + 22, base + 0.6)
    doc.text('a', MARGEN + 24, base)
    linea(MARGEN + 27, MARGEN + 39, base + 0.6)
    doc.text('Mín $', MARGEN + 44, base)
    linea(MARGEN + 53, MARGEN + 85, base + 0.6)
    doc.text('Máx $', MARGEN + 90, base)
    linea(MARGEN + 99, MARGEN + 131, base + 0.6)
    if (t) {
      doc.setTextColor(GRIS)
      doc.text(String(t.tallaDesde), MARGEN + 16, base - 0.6, { align: 'center' })
      doc.text(String(t.tallaHasta), MARGEN + 33, base - 0.6, { align: 'center' })
      doc.text(pesos(t.precioMinimo).replace('$', ''), MARGEN + 55, base - 0.6)
      if (t.precioMaximo != null) doc.text(pesos(t.precioMaximo).replace('$', ''), MARGEN + 101, base - 0.6)
    }
    if (i === 0) {
      doc.setTextColor(0)
      doc.text('Garantía', MARGEN + 140, base)
      linea(MARGEN + 154, MARGEN + 172, base + 0.6)
      doc.text('días', MARGEN + 174, base)
      if (m.garantia != null) {
        doc.setTextColor(GRIS)
        doc.text(String(m.garantia), MARGEN + 163, base - 0.6, { align: 'center' })
      }
    }
    yr += RENGLON
  }
  const fin = y + altoBloque(m)
  doc.setDrawColor(215)
  doc.line(MARGEN, fin - SEPARACION / 2, PAGINA.ancho - MARGEN, fin - SEPARACION / 2)
  return fin
}

export async function crearPdfPrecios(
  categorias: CategoriaPrecios[],
  opciones: { conFotos?: boolean; fecha?: Date } = {},
): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const paginas = paginar(categorias)
  const fotos = await cargarFotos(
    paginas.flatMap((p) => p.renglones.flatMap((r) => (r.tipo === 'modelo' ? [r.modelo] : []))),
    opciones.conFotos ?? true,
  )
  const fecha = (opciones.fecha ?? new Date()).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

  paginas.forEach((p, n) => {
    if (n > 0) doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(0)
    doc.text(p.categorias.join(' · '), MARGEN, MARGEN + 5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(GRIS)
    doc.text('Venus · Hoja de precios', PAGINA.ancho - MARGEN, MARGEN + 5, { align: 'right' })
    doc.text(
      'Para cada zapato escribe los rangos de tallas con su precio mínimo y máximo (el máximo es opcional), y la garantía en días.',
      MARGEN, MARGEN + 11,
    )
    doc.setDrawColor(0)
    doc.line(MARGEN, MARGEN + 14, PAGINA.ancho - MARGEN, MARGEN + 14)
    doc.setLineWidth(0.2)

    let y = MARGEN + CABECERA
    for (const r of p.renglones) {
      if (r.tipo === 'modelo') {
        y = bloque(doc, r.modelo, y, fotos.get(r.modelo.clave))
        continue
      }
      doc.setFillColor(235, 235, 235)
      doc.rect(MARGEN, y, PAGINA.ancho - 2 * MARGEN, 6.5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(0)
      doc.text(r.etiqueta.toUpperCase(), MARGEN + 2, y + 4.6)
      doc.setFont('helvetica', 'normal')
      y += TITULO_CATEGORIA
    }

    doc.setFontSize(7.5)
    doc.setTextColor(GRIS)
    doc.text(`${fecha}`, MARGEN, PAGINA.alto - MARGEN + 2)
    doc.text(`Página ${n + 1} de ${paginas.length}`, PAGINA.ancho - MARGEN, PAGINA.alto - MARGEN + 2, { align: 'right' })
  })
  return doc
}

export async function descargarPdfPrecios(categorias: CategoriaPrecios[], nombre: string): Promise<void> {
  const doc = await crearPdfPrecios(categorias)
  doc.save(nombre)
}
