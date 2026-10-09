import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'

export * from '../shared/usuarios'

// ─── Usuarios recordados en este teléfono ────────────────────────────────────
// El login los muestra como botones; nadie fuera de la app ve la lista del equipo.

export interface UsuarioReciente {
  usuario: string
  nombre: string
}

const CLAVE_RECIENTES = 'venus.usuariosRecientes'
const MAX_RECIENTES = 6

export async function leerUsuariosRecientes(): Promise<UsuarioReciente[]> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_RECIENTES)
    const lista: unknown = crudo ? JSON.parse(crudo) : []
    if (!Array.isArray(lista)) return []
    return lista.filter(
      (u): u is UsuarioReciente => typeof u?.usuario === 'string' && typeof u?.nombre === 'string',
    )
  } catch {
    return []
  }
}

export async function recordarUsuario(u: UsuarioReciente): Promise<void> {
  try {
    const previos = await leerUsuariosRecientes()
    const lista = [u, ...previos.filter((p) => p.usuario !== u.usuario)].slice(0, MAX_RECIENTES)
    await AsyncStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista))
  } catch {
    // Recordar es una comodidad: si falla, el login sigue funcionando escribiendo el usuario.
  }
}

export async function olvidarUsuario(usuario: string): Promise<void> {
  try {
    const previos = await leerUsuariosRecientes()
    await AsyncStorage.setItem(
      CLAVE_RECIENTES,
      JSON.stringify(previos.filter((p) => p.usuario !== usuario)),
    )
  } catch {
    // Ídem.
  }
}

// ─── PIN propio ──────────────────────────────────────────────────────────────

export async function cambiarMiPin(pinActual: string, pinNuevo: string): Promise<void> {
  const { error } = await supabase.rpc('cambiar_mi_pin', {
    p_pin_actual: pinActual,
    p_pin_nuevo: pinNuevo,
  })
  if (error) throw error
}
