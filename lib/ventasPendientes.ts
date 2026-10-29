import AsyncStorage from '@react-native-async-storage/async-storage'
import { esErrorDeRed } from './conexion'
import { registrarVenta, type RegistrarVentaInput } from './ventas'
import type { VentaListado } from './movimientos'
import { diaBogota, horaCorta } from './movimientos'

// Ventas hechas sin conexión (2026-10-29). Se guardan en el teléfono con su
// clave de intento y la hora en que se hicieron, y se mandan en orden cuando
// vuelve la conexión: la misma clave hace que un envío repetido no duplique la
// venta, y el servidor la cuenta en su día (registrar_venta con p_vendida_en).
// Solo quien la hizo puede mandarla (la clave es por vendedor).

export interface VentaPendiente {
  clave: string
  usuarioId: string
  // Cuándo se hizo (ISO).
  vendidaEn: string
  input: RegistrarVentaInput
  // El servidor la rechazó (no fue la red): se queda hasta que se revise.
  error?: string | null
}

const CLAVE = 'venus.ventas.pendientes'

// Las escrituras van en fila: guardar una venta mientras se mandan otras no
// pisa la lista.
let cola: Promise<unknown> = Promise.resolve()
function enFila<T>(hacer: () => Promise<T>): Promise<T> {
  const siguiente = cola.then(hacer, hacer)
  cola = siguiente.catch(() => {})
  return siguiente
}

export async function leerPendientes(): Promise<VentaPendiente[]> {
  try {
    const texto = await AsyncStorage.getItem(CLAVE)
    const lista = texto ? JSON.parse(texto) : []
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

async function cambiar(fn: (lista: VentaPendiente[]) => VentaPendiente[]): Promise<VentaPendiente[]> {
  return enFila(async () => {
    const nueva = fn(await leerPendientes())
    await AsyncStorage.setItem(CLAVE, JSON.stringify(nueva))
    avisar(nueva)
    return nueva
  })
}

// Quien muestra la lista (el aviso de arriba, Movimientos) se entera de cada cambio.
const oyentes = new Set<(lista: VentaPendiente[]) => void>()
function avisar(lista: VentaPendiente[]) {
  oyentes.forEach((o) => o(lista))
}
export function escucharPendientes(oyente: (lista: VentaPendiente[]) => void): () => void {
  oyentes.add(oyente)
  return () => { oyentes.delete(oyente) }
}

// Guarda la venta (si ya está con esa clave, no la repite).
export function guardarPendiente(venta: VentaPendiente): Promise<VentaPendiente[]> {
  return cambiar((lista) => (lista.some((v) => v.clave === venta.clave) ? lista : [...lista, venta]))
}

export function quitarPendiente(clave: string): Promise<VentaPendiente[]> {
  return cambiar((lista) => lista.filter((v) => v.clave !== clave))
}

function marcarError(clave: string, error: string | null): Promise<VentaPendiente[]> {
  return cambiar((lista) => lista.map((v) => (v.clave === clave ? { ...v, error } : v)))
}

export const totalPendiente = (v: VentaPendiente): number => v.input.items.reduce((s, i) => s + i.subtotal, 0)

// El stock que se ve en el teléfono descuenta los zapatos de las ventas que
// aún no llegan a la base (nunca menos de 0).
export function aplicarPendientes<T extends { id: string; stock_actual: number }>(
  productos: T[],
  pendientes: VentaPendiente[],
): T[] {
  const vendidos = new Map<string, number>()
  for (const v of pendientes) {
    for (const i of v.input.items) {
      if (i.producto.tipo === 'calzado') vendidos.set(i.producto.id, (vendidos.get(i.producto.id) ?? 0) + i.cantidad)
    }
  }
  if (!vendidos.size) return productos
  return productos.map((p) => {
    const n = vendidos.get(p.id)
    return n ? { ...p, stock_actual: Math.max(0, p.stock_actual - n) } : p
  })
}

// Para la lista de Movimientos: estado 'por_mandar' (o 'rechazada' si el
// servidor no la recibió) y sin número, que lo pone la base.
export function ventaListadoDePendiente(v: VentaPendiente): VentaListado {
  const c = v.input.cliente
  return {
    id: `pendiente:${v.clave}`,
    numero: 0,
    total: totalPendiente(v),
    estado: v.error ? 'rechazada' : 'por_mandar',
    hora: horaCorta(v.vendidaEn),
    dia: diaBogota(v.vendidaEn),
    metodos: v.input.pagos.map((p) => p.metodo),
    nota: v.error ?? null,
    cliente: c && (c.nombre || c.apellido || c.documento || c.telefono)
      ? { nombre: c.nombre ?? null, apellido: c.apellido ?? null, documento: c.documento ?? null, telefono: c.telefono ?? null }
      : null,
    items: v.input.items.map((i, n) => ({
      id: `pendiente:${v.clave}:${n}`,
      descripcion: i.producto.titulo,
      ...(i.producto.tipo === 'calzado' ? tallaYColor(i.producto.detalle) : { talla: null, color: null }),
      esGranja: i.producto.tipo === 'varios',
      cantidad: i.cantidad,
      precio: i.precio,
      devuelto: 0,
      cambiado: false,
    })),
  }
}

// El detalle del carrito es "marca · Talla 38 · color" (detalleCalzado).
export function tallaYColor(detalle: string): { talla: string | null; color: string | null } {
  const partes = detalle.split(' · ')
  const i = partes.findIndex((p) => p.startsWith('Talla '))
  if (i < 0) return { talla: null, color: null }
  return { talla: partes[i].slice('Talla '.length), color: partes.slice(i + 1).join(' · ') || null }
}

export interface ResultadoEnvio {
  enviadas: number
  avisos: string[]
  // Rechazadas por el servidor en este envío (quedan guardadas con su error).
  rechazadas: number
  // Se cortó por falta de conexión: quedan para el próximo intento.
  sinConexion: boolean
}

let enviando: Promise<ResultadoEnvio> | null = null

// Manda, en el orden en que se hicieron, las ventas de esta persona que no
// tienen error. Si se cae la red, para y las deja para después. Un envío a la
// vez: si ya hay uno en curso, devuelve ese.
export function mandarPendientes(
  usuarioId: string,
  enviar: typeof registrarVenta = registrarVenta,
): Promise<ResultadoEnvio> {
  if (enviando) return enviando
  enviando = (async () => {
    const resultado: ResultadoEnvio = { enviadas: 0, avisos: [], rechazadas: 0, sinConexion: false }
    const propias = (await leerPendientes())
      .filter((v) => v.usuarioId === usuarioId && !v.error)
      .sort((a, b) => a.vendidaEn.localeCompare(b.vendidaEn))
    for (const v of propias) {
      try {
        const r = await enviar(v.input, v.clave, { vendidaEn: v.vendidaEn })
        await quitarPendiente(v.clave)
        resultado.enviadas += 1
        resultado.avisos.push(...r.avisos.map((a) => `Venta #${r.numero}: ${a}`))
      } catch (e) {
        if (esErrorDeRed(e)) {
          resultado.sinConexion = true
          break
        }
        await marcarError(v.clave, e instanceof Error ? e.message : 'No se pudo registrar la venta.')
        resultado.rechazadas += 1
      }
    }
    return resultado
  })().finally(() => {
    enviando = null
  })
  return enviando
}

// Volver a intentar una que el servidor rechazó (p. ej. ya se corrigió el permiso).
export async function reintentarPendiente(clave: string): Promise<void> {
  await marcarError(clave, null)
}
