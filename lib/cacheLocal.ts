import AsyncStorage from '@react-native-async-storage/async-storage'
import { esErrorDeRed } from './conexion'

// Lo último que se leyó de la base, guardado en el teléfono por persona (cada
// una ve lo que sus permisos dejan). Sin conexión se muestra eso: el
// inventario y las ventas del día como estaban cuando se cortó.

let usuario: string | null = null

// lib/auth.tsx lo fija al entrar (y lo quita al salir).
export function fijarUsuarioCache(id: string | null) {
  usuario = id
}

const prefijo = (id: string) => `venus.cache.${id}.`

// Sin señal un pedido puede tardar más de un minuto en fallar: pasado el
// límite se usa lo guardado.
function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let reloj: ReturnType<typeof setTimeout>
  const agotado = new Promise<never>((_, rechazar) => { reloj = setTimeout(() => rechazar(new Error('timeout')), ms) })
  return Promise.race([promesa, agotado]).finally(() => clearTimeout(reloj))
}

// `familia`: lecturas que cambian con la fecha (las ventas de un período). Se
// guardan juntas y solo las últimas CONSERVAR, para que no crezcan cada día
// (el almacenamiento del teléfono es limitado y ahí van también las ventas por
// mandar).
const CONSERVAR = 3

export async function conCache<T>(
  nombre: string,
  traer: () => Promise<T>,
  opciones: { familia?: string; tiempoLimiteMs?: number } = {},
): Promise<T> {
  const id = usuario
  const clave = id ? prefijo(id) + (opciones.familia ?? nombre) : null
  try {
    const datos = await conLimite(traer(), opciones.tiempoLimiteMs ?? 12000)
    if (clave) guardar(clave, nombre, datos, opciones.familia).catch(() => {})
    return datos
  } catch (e) {
    if (clave && esErrorDeRed(e)) {
      const texto = await AsyncStorage.getItem(clave).catch(() => null)
      if (texto) {
        const guardado = JSON.parse(texto)
        if (!opciones.familia) return guardado as T
        if (guardado?.[nombre]) return guardado[nombre].datos as T
      }
    }
    throw e
  }
}

async function guardar(clave: string, nombre: string, datos: unknown, familia?: string) {
  if (!familia) return AsyncStorage.setItem(clave, JSON.stringify(datos))
  const previo = JSON.parse((await AsyncStorage.getItem(clave)) ?? '{}') as Record<string, { t: number; datos: unknown }>
  const todos = { ...previo, [nombre]: { t: Date.now(), datos } }
  const ultimos = Object.entries(todos).sort((a, b) => b[1].t - a[1].t).slice(0, CONSERVAR)
  await AsyncStorage.setItem(clave, JSON.stringify(Object.fromEntries(ultimos)))
}

export async function borrarCache(id: string): Promise<void> {
  try {
    const claves = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefijo(id)))
    if (claves.length) await AsyncStorage.multiRemove(claves)
  } catch {
    // no importa: se sobrescribe al volver a leer
  }
}
