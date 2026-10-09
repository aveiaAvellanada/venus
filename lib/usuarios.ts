import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'

// Ya no hay personas fijas en el código: el dueño crea cada cuenta con un
// usuario y un PIN. Supabase Auth necesita un correo, así que se deriva del
// usuario con un dominio reservado (.invalid nunca recibe correo).
export const DOMINIO_USUARIOS = 'venus.invalid'

export const normalizarUsuario = (usuario: string): string => usuario.trim().toLowerCase()

// Mismo formato que el CHECK users_usuario_formato y que crear_empleado.
export const usuarioValido = (usuario: string): boolean =>
  /^[a-z0-9][a-z0-9._-]{2,19}$/.test(normalizarUsuario(usuario))

export const correoDeUsuario = (usuario: string): string =>
  `${normalizarUsuario(usuario)}@${DOMINIO_USUARIOS}`

export const pinValido = (pin: string): boolean => /^[0-9]{6}$/.test(pin)

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
