import type { NetworkState } from 'expo-network'

// Modo sin conexión (2026-10-29): si se va la luz o el internet, la app sigue
// vendiendo con lo guardado en el teléfono y manda las ventas al volver.

// El pedido no llegó al servidor, o no se supo su respuesta: sin señal, tiempo
// agotado o cancelado. Cualquier otro error es una respuesta del servidor.
export function esErrorDeRed(e: unknown): boolean {
  if (e instanceof SinConexionError) return true
  const o = (typeof e === 'object' && e) ? (e as { name?: unknown; message?: unknown }) : null
  const texto = o ? `${String(o.name ?? '')} ${String(o.message ?? '')}` : String(e)
  return /network request failed|failed to fetch|fetch failed|network ?error|load failed|timed? ?out|timeout|abort|AuthRetryableFetchError/i.test(texto)
}

// Error de red ya traducido para mostrar (lib/ventas.ts): el mensaje es para la
// persona y el tipo dice que fue la conexión.
export class SinConexionError extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'SinConexionError'
  }
}

// El teléfono sabe que no hay internet: sin wifi ni datos, o conectado a un
// wifi sin salida (el router sin luz). Si no lo sabe (undefined), se intenta.
export function sinRed(estado: Pick<NetworkState, 'isConnected' | 'isInternetReachable'>): boolean {
  return estado.isConnected === false || estado.isInternetReachable === false
}

// Corta una espera larga: sin señal un pedido puede tardar más de un minuto en
// fallar, y en la caja no se puede esperar tanto.
export async function conTiempoLimite<T>(hacer: (senal: AbortSignal) => PromiseLike<T>, ms: number): Promise<T> {
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), ms)
  try {
    return await hacer(control.signal)
  } finally {
    clearTimeout(reloj)
  }
}
