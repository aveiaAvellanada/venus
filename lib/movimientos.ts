import { supabase } from './supabase'
import { conCache } from './cacheLocal'

// Capa de datos del hub Movimientos (rediseño §7.3). Selects directos:
// la RLS ya limita lo que ve cada persona (sin `reportes` ni `devoluciones`,
// solo lo de hoy).

export type TipoBadgeMovimiento = 'exito' | 'peligro' | 'advertencia' | 'neutro'

export interface ClienteVenta {
  nombre: string | null
  apellido: string | null
  documento: string | null
  telefono: string | null
}

// Un producto vendido: la lista de Ventas muestra una fila por cada uno.
export interface ProductoVendido {
  id: string
  descripcion: string
  talla: string | null
  color: string | null
  esGranja: boolean
  cantidad: number
  precio: number
  // Cantidad ya devuelta o cambiada, y si alguna de esas devoluciones fue un cambio.
  devuelto: number
  cambiado: boolean
}

export interface VentaListado {
  id: string
  numero: number
  total: number
  estado: string
  hora: string
  // Día de la venta en Bogotá (YYYY-MM-DD), para agrupar la lista.
  dia: string
  metodos: string[]
  nota: string | null
  cliente: ClienteVenta | null
  items: ProductoVendido[]
}

export interface VentaDetalle {
  id: string
  numero: number
  total: number
  estado: string
  fecha: string
  hora: string
  // Fecha y hora exactas de la venta (ISO): de aquí se cuenta la garantía.
  creada: string
  vendedor: string | null
  cliente: { nombre: string | null; apellido: string | null; telefono: string | null; documento: string | null } | null
  nota: string | null
  efectivo_recibido: number
  cambio: number
  saldo_pendiente: number
  corregida: boolean
  correccion_motivo: string | null
  items: {
    descripcion: string
    talla: string | null
    color: string | null
    cantidad: number
    precio_unitario: number
    subtotal: number
    // Días de garantía prometidos en la venta (null = sin garantía).
    garantia_dias: number | null
  }[]
  pagos: { metodo: string; monto: number }[]
}

interface DevolucionBase {
  id: string
  venta_id: string
  numero_venta: number
  tipo: string
  monto_devuelto: number
  monto_cobrado: number
  hora: string
  fecha: string
}

export interface DevolucionListado extends DevolucionBase {
  dia: string
  motivo: string | null
  // Cliente de la venta original (para buscar) y los zapatos devueltos.
  cliente: ClienteVenta | null
  productos: { descripcion: string; talla: string | null; color: string | null }[]
}

export interface DevolucionDetalle extends DevolucionBase {
  motivo: string | null
  metodo_reembolso: string | null
  metodo_cobro: string | null
  items: { descripcion: string; talla: string | null; color: string | null; cantidad: number }[]
}

// Bogotá es UTC-5 fijo (sin horario de verano).
const inicioBogota = (fecha: string) => `${fecha}T00:00:00-05:00`
const finBogota = (fecha: string) => `${fecha}T23:59:59.999-05:00`

export const horaCorta = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  })

// Día en Bogotá (YYYY-MM-DD) de un instante ISO.
export const diaBogota = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  })

const BADGES_ESTADO: Record<string, { texto: string; tipo: TipoBadgeMovimiento }> = {
  completada: { texto: 'COMPLETADA', tipo: 'exito' },
  devuelta_parcial: { texto: 'DEV. PARCIAL', tipo: 'advertencia' },
  devuelta_total: { texto: 'DEVUELTA', tipo: 'peligro' },
  cambiada_parcial: { texto: 'CAMBIO', tipo: 'neutro' },
  cambiada_total: { texto: 'CAMBIO', tipo: 'neutro' },
  cancelada: { texto: 'CANCELADA', tipo: 'peligro' },
  separada: { texto: 'SEPARADA', tipo: 'advertencia' },
}

export function badgeEstadoVenta(estado: string): { texto: string; tipo: TipoBadgeMovimiento } {
  return BADGES_ESTADO[estado] ?? { texto: estado.toUpperCase(), tipo: 'neutro' }
}

const BADGES_TIPO_DEV: Record<string, { texto: string; tipo: TipoBadgeMovimiento }> = {
  total: { texto: 'TOTAL', tipo: 'peligro' },
  parcial: { texto: 'PARCIAL', tipo: 'advertencia' },
  cambio: { texto: 'CAMBIO', tipo: 'neutro' },
}

export function badgeTipoDevolucion(tipo: string): { texto: string; tipo: TipoBadgeMovimiento } {
  return BADGES_TIPO_DEV[tipo] ?? { texto: tipo.toUpperCase(), tipo: 'neutro' }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const clienteDe = (v: any): ClienteVenta | null =>
  v && (v.cliente_nombre || v.cliente_apellido || v.cliente_documento || v.cliente_telefono)
    ? {
        nombre: v.cliente_nombre ?? null,
        apellido: v.cliente_apellido ?? null,
        documento: v.cliente_documento ?? null,
        telefono: v.cliente_telefono ?? null,
      }
    : null
/* eslint-enable @typescript-eslint/no-explicit-any */

const CAMPOS_CLIENTE = 'cliente_nombre, cliente_apellido, cliente_documento, cliente_telefono'

// Sin conexión se muestra lo último que se leyó de ese período (cacheLocal).
export function listarVentasPeriodo(desde: string, hasta: string): Promise<VentaListado[]> {
  return conCache(`${desde}.${hasta}`, () => leerVentasPeriodo(desde, hasta), { familia: 'ventas' })
}

async function leerVentasPeriodo(desde: string, hasta: string): Promise<VentaListado[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select(
      `id, numero, total, estado, created_at, nota, ${CAMPOS_CLIENTE}, metodos_pago_venta(metodo), ` +
        'venta_items(id, tipo_producto, descripcion_snapshot, talla, color, cantidad, precio_unitario, ' +
        'devolucion_items(cantidad, devolucion:devoluciones(tipo_devolucion)))'
    )
    .gte('created_at', inicioBogota(desde))
    .lte('created_at', finBogota(hasta))
    .order('created_at', { ascending: false })
  if (error) throw error
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return ((data ?? []) as any[]).map((v) => ({
    id: v.id,
    numero: v.numero,
    total: Number(v.total),
    estado: v.estado,
    hora: horaCorta(v.created_at),
    dia: diaBogota(v.created_at),
    metodos: (v.metodos_pago_venta ?? []).map((m: any) => m.metodo),
    nota: v.nota ?? null,
    cliente: clienteDe(v),
    items: (v.venta_items ?? []).map((i: any) => {
      const devs = i.devolucion_items ?? []
      return {
        id: i.id,
        descripcion: i.descripcion_snapshot,
        talla: i.talla,
        color: i.color,
        esGranja: i.tipo_producto === 'varios',
        cantidad: Number(i.cantidad),
        precio: Number(i.precio_unitario),
        devuelto: devs.reduce((s: number, d: any) => s + Number(d.cantidad), 0),
        cambiado: devs.some((d: any) => d.devolucion?.tipo_devolucion === 'cambio'),
      }
    }),
  }))
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function obtenerVentaDetalle(id: string): Promise<VentaDetalle | null> {
  const { data, error } = await supabase
    .from('ventas')
    .select(
      '*, venta_items(descripcion_snapshot, talla, color, cantidad, precio_unitario, subtotal, garantia_dias_snapshot), metodos_pago_venta(metodo, monto), vendedor:users!ventas_vendedor_id_fkey(nombre)'
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const v = data as any
  return {
    id: v.id,
    numero: v.numero,
    total: Number(v.total),
    estado: v.estado,
    fecha: fechaCorta(v.created_at),
    hora: horaCorta(v.created_at),
    creada: v.created_at,
    vendedor: v.vendedor?.nombre ?? null,
    // Una venta con solo el documento (sin nombre) también muestra al cliente.
    cliente:
      v.cliente_nombre || v.cliente_documento
        ? {
            nombre: v.cliente_nombre ?? null,
            apellido: v.cliente_apellido ?? null,
            telefono: v.cliente_telefono ?? null,
            documento: v.cliente_documento ?? null,
          }
        : null,
    nota: v.nota,
    efectivo_recibido: Number(v.efectivo_recibido ?? 0),
    cambio: Number(v.cambio ?? 0),
    saldo_pendiente: Number(v.saldo_pendiente ?? 0),
    corregida: !!v.corregida,
    correccion_motivo: v.correccion_motivo,
    items: (v.venta_items ?? []).map((i: any) => ({
      descripcion: i.descripcion_snapshot,
      talla: i.talla,
      color: i.color,
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
      subtotal: Number(i.subtotal),
      garantia_dias: i.garantia_dias_snapshot != null ? Number(i.garantia_dias_snapshot) : null,
    })),
    pagos: (v.metodos_pago_venta ?? []).map((p: any) => ({ metodo: p.metodo, monto: Number(p.monto) })),
  }
}

export async function listarDevoluciones(desde: string, hasta: string): Promise<DevolucionListado[]> {
  const { data, error } = await supabase
    .from('devoluciones')
    .select(
      `id, venta_id, tipo_devolucion, monto_devuelto, monto_cobrado, motivo, created_at, venta:ventas(numero, ${CAMPOS_CLIENTE}), ` +
        'devolucion_items(venta_item:venta_items(descripcion_snapshot, talla, color))'
    )
    .gte('created_at', inicioBogota(desde))
    .lte('created_at', finBogota(hasta))
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((d) => {
    const fila = d as any
    return {
      id: fila.id,
      venta_id: fila.venta_id,
      numero_venta: fila.venta?.numero ?? 0,
      tipo: fila.tipo_devolucion,
      monto_devuelto: Number(fila.monto_devuelto ?? 0),
      monto_cobrado: Number(fila.monto_cobrado ?? 0),
      hora: horaCorta(fila.created_at),
      fecha: fechaCorta(fila.created_at),
      dia: diaBogota(fila.created_at),
      motivo: fila.motivo ?? null,
      cliente: clienteDe(fila.venta),
      productos: (fila.devolucion_items ?? [])
        .filter((i: any) => i.venta_item)
        .map((i: any) => ({
          descripcion: i.venta_item.descripcion_snapshot,
          talla: i.venta_item.talla ?? null,
          color: i.venta_item.color ?? null,
        })),
    }
  })
}

export async function obtenerDevolucionDetalle(id: string): Promise<DevolucionDetalle | null> {
  const { data, error } = await supabase
    .from('devoluciones')
    .select(
      '*, venta:ventas(numero), devolucion_items(cantidad, venta_item:venta_items(descripcion_snapshot, talla, color))'
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const d = data as any
  return {
    id: d.id,
    venta_id: d.venta_id,
    numero_venta: d.venta?.numero ?? 0,
    tipo: d.tipo_devolucion,
    monto_devuelto: Number(d.monto_devuelto ?? 0),
    monto_cobrado: Number(d.monto_cobrado ?? 0),
    hora: horaCorta(d.created_at),
    fecha: fechaCorta(d.created_at),
    motivo: d.motivo,
    metodo_reembolso: d.metodo_reembolso,
    metodo_cobro: d.metodo_cobro,
    items: (d.devolucion_items ?? []).map((i: any) => ({
      descripcion: i.venta_item?.descripcion_snapshot ?? '',
      talla: i.venta_item?.talla ?? null,
      color: i.venta_item?.color ?? null,
      cantidad: Number(i.cantidad),
    })),
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

// ── Lista por producto ──

// Estado de un producto vendido: en lugar del precio sale la etiqueta si se
// devolvió, se cambió o la venta se canceló.
export function estadoProducto(
  estadoVenta: string,
  p: ProductoVendido
): { texto: string; tipo: TipoBadgeMovimiento } | null {
  if (estadoVenta === 'cancelada') return { texto: 'CANCELADA', tipo: 'peligro' }
  // Hechas sin conexión (lib/ventasPendientes.ts): aún en el teléfono.
  if (estadoVenta === 'por_mandar') return { texto: 'POR MANDAR', tipo: 'advertencia' }
  if (estadoVenta === 'rechazada') return { texto: 'CON ERROR', tipo: 'peligro' }
  if (p.devuelto <= 0) return null
  if (p.devuelto >= p.cantidad) {
    return p.cambiado ? { texto: 'CAMBIADO', tipo: 'neutro' } : { texto: 'DEVUELTO', tipo: 'peligro' }
  }
  return { texto: p.cambiado ? 'CAMBIO PARCIAL' : 'DEV. PARCIAL', tipo: 'advertencia' }
}

// "T38 · Blanco y negro", o "Granja".
export function detalleProducto(p: ProductoVendido): string {
  if (p.esGranja) return 'Granja'
  return [p.talla ? `T${p.talla}` : null, p.color].filter(Boolean).join(' · ')
}

// ── Lista agrupada por día ──

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const aUTC = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

// Cabecera de cada día: Hoy, Ayer, Antier; el nombre del día si es de esta semana
// (lunes a domingo); si no, la fecha completa ("Jueves 8 de octubre de 2026").
export function etiquetaDia(dia: string, hoy: string): string {
  const atras = Math.round((aUTC(hoy) - aUTC(dia)) / 86400000)
  if (atras === 0) return 'Hoy'
  if (atras === 1) return 'Ayer'
  if (atras === 2) return 'Antier'
  const f = new Date(aUTC(dia))
  const nombre = mayuscula(DIAS_SEMANA[f.getUTCDay()])
  const lunes = aUTC(hoy) - ((new Date(aUTC(hoy)).getUTCDay() + 6) % 7) * 86400000
  if (atras > 0 && aUTC(dia) >= lunes) return nombre
  return `${nombre} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`
}

// Agrupa por día, del más reciente al más viejo; dentro de cada día se respeta el orden.
export function agruparPorDia<T>(xs: T[], diaDe: (x: T) => string): { dia: string; xs: T[] }[] {
  const grupos = new Map<string, T[]>()
  for (const x of xs) {
    const dia = diaDe(x)
    const grupo = grupos.get(dia)
    if (grupo) grupo.push(x)
    else grupos.set(dia, [x])
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dia, grupo]) => ({ dia, xs: grupo }))
}

// ── Buscador (dentro del período elegido) ──

const SIN_TILDE: Record<string, string> = {
  á: 'a', à: 'a', ä: 'a', â: 'a', é: 'e', è: 'e', ë: 'e', ê: 'e', í: 'i', ì: 'i', ï: 'i', î: 'i',
  ó: 'o', ò: 'o', ö: 'o', ô: 'o', ú: 'u', ù: 'u', ü: 'u', û: 'u', ñ: 'n',
}

// Minúsculas y sin tildes, letra por letra: el resultado mide lo mismo que el
// texto original, así lo resaltado cae en las mismas posiciones.
export function normalizar(texto: string | null | undefined): string {
  return Array.from(String(texto ?? '').toLowerCase(), (c) => (c.length === 1 ? SIN_TILDE[c] ?? c : c)).join('')
}

const soloDigitos = (t: string | null | undefined) => String(t ?? '').replace(/\D/g, '')

export interface Consulta {
  // Solo dígitos: número de venta (hasta 5 cifras), monto exacto, o cédula/NIT/teléfono (4+ cifras).
  digitos: string | null
  // Texto: todas las palabras deben aparecer.
  palabras: string[]
}

export function analizarConsulta(q: string): Consulta {
  const limpio = q.replace(/[#.\s$]/g, '')
  if (/^\d+$/.test(limpio)) return { digitos: limpio, palabras: [] }
  return { digitos: null, palabras: normalizar(q).split(/\s+/).filter(Boolean) }
}

export const nombreCliente = (c: ClienteVenta | null) =>
  c ? [c.nombre, c.apellido].filter(Boolean).join(' ') || c.documento : null

// Texto con las partes que coinciden marcadas, para pintarlas en negrita.
export interface Pieza {
  texto: string
  marcas: string[]
}

export interface ResultadoProducto {
  venta: VentaListado
  producto: ProductoVendido
  // Palabras a resaltar en el nombre y el detalle del producto.
  marcas: string[]
  // Por qué coincidió, si no fue por el producto (cliente, nota, número de venta).
  extra: Pieza[]
}

// Dígitos: número de venta o monto → todos los productos de esa venta; cédula o
// teléfono → los productos de ese cliente. Texto: cada palabra en el producto,
// el cliente o la nota de la venta.
export function buscarProductos(ventas: VentaListado[], c: Consulta): ResultadoProducto[] {
  const out: ResultadoProducto[] = []
  for (const v of ventas) {
    const cli = v.cliente
    const nombre = nombreCliente(cli)
    if (c.digitos) {
      const d = c.digitos
      let extra: Pieza[] | null = null
      if ((d.length <= 5 && String(v.numero) === d) || (d.length >= 4 && Math.round(v.total) === Number(d))) {
        extra = [{ texto: `Venta #${v.numero}`, marcas: [`Venta #${v.numero}`] }]
      } else if (d.length >= 4 && cli && soloDigitos(cli.documento).includes(d)) {
        extra = [{ texto: `${nombre} · CC ${cli.documento}`, marcas: [cli.documento ?? ''] }]
      } else if (d.length >= 4 && cli && soloDigitos(cli.telefono).includes(d)) {
        extra = [{ texto: `${nombre} · ${cli.telefono}`, marcas: [cli.telefono ?? ''] }]
      }
      if (extra) for (const p of v.items) out.push({ venta: v, producto: p, marcas: [], extra })
      continue
    }
    for (const p of v.items) {
      const pajar = normalizar(
        [p.descripcion, p.talla, p.color, p.esGranja ? 'granja' : '', nombre, cli?.documento, v.nota].join(' ')
      )
      if (!c.palabras.every((t) => pajar.includes(t))) continue
      const extra: Pieza[] = []
      if (nombre && c.palabras.some((t) => normalizar(nombre).includes(t))) extra.push({ texto: nombre, marcas: c.palabras })
      if (v.nota && c.palabras.some((t) => normalizar(v.nota).includes(t))) extra.push({ texto: v.nota, marcas: c.palabras })
      out.push({ venta: v, producto: p, marcas: c.palabras, extra })
    }
  }
  return out
}

export interface ResultadoDevolucion {
  devolucion: DevolucionListado
  // Lo que coincidió va primero (motivo, cliente, zapatos).
  piezas: Pieza[]
}

const zapatosDe = (d: DevolucionListado) =>
  d.productos.map((p) => [p.descripcion, p.talla, p.color].filter(Boolean).join(' '))

// Por número de la venta original, cédula o teléfono del cliente, motivo,
// cliente o el zapato devuelto.
export function buscarDevoluciones(devoluciones: DevolucionListado[], c: Consulta): ResultadoDevolucion[] {
  const out: ResultadoDevolucion[] = []
  for (const d of devoluciones) {
    const cli = d.cliente
    const base = [d.motivo, nombreCliente(cli), ...zapatosDe(d)].filter((x): x is string => !!x)
    if (c.digitos) {
      const n = c.digitos
      const porNumero = n.length <= 5 && String(d.numero_venta) === n
      const porCliente = n.length >= 4 && !!cli && (soloDigitos(cli.documento).includes(n) || soloDigitos(cli.telefono).includes(n))
      if (porNumero || porCliente) out.push({ devolucion: d, piezas: base.map((texto) => ({ texto, marcas: [] })) })
      continue
    }
    const pajar = normalizar([d.motivo, nombreCliente(cli), cli?.documento, ...zapatosDe(d)].join(' '))
    if (!c.palabras.every((t) => pajar.includes(t))) continue
    const aciertos = (x: string) => c.palabras.filter((t) => normalizar(x).includes(t)).length
    const ordenadas = [...base].sort((a, b) => aciertos(b) - aciertos(a))
    out.push({ devolucion: d, piezas: ordenadas.map((texto) => ({ texto, marcas: c.palabras })) })
  }
  return out
}

// Parte el texto en tramos normales y resaltados (sin distinguir tildes ni mayúsculas).
export function segmentos(texto: string, marcas: string[]): { texto: string; resaltado: boolean }[] {
  const base = normalizar(texto)
  const rangos: [number, number][] = []
  for (const m of marcas) {
    const t = normalizar(m)
    if (!t) continue
    let i = base.indexOf(t)
    while (i >= 0) {
      rangos.push([i, i + t.length])
      i = base.indexOf(t, i + t.length)
    }
  }
  if (rangos.length === 0) return texto ? [{ texto, resaltado: false }] : []
  rangos.sort((a, b) => a[0] - b[0])
  const out: { texto: string; resaltado: boolean }[] = []
  let pos = 0
  for (const [a, b] of rangos) {
    if (a < pos) continue
    if (a > pos) out.push({ texto: texto.slice(pos, a), resaltado: false })
    out.push({ texto: texto.slice(a, b), resaltado: true })
    pos = b
  }
  if (pos < texto.length) out.push({ texto: texto.slice(pos), resaltado: false })
  return out
}
