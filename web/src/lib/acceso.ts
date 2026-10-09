import type { Rol } from '@shared/permisos'

export interface PerfilPanel {
  id: string
  nombre: string
  usuario: string
  rol: Rol
  activo: boolean
  debe_cambiar_pin: boolean
}

// El panel es solo del dueño (docs/panel-web.md). Esto es la puerta de la
// interfaz; los datos los protege la base (RLS) para cualquier otra cuenta.
export function motivoSinAcceso(perfil: PerfilPanel | null): string | null {
  if (!perfil) return 'No encontramos tu perfil. Revisa la cuenta desde la app del celular.'
  if (!perfil.activo) return 'Esta cuenta está desactivada.'
  if (perfil.rol !== 'dueno') return 'El panel web es solo para el dueño. Usa la app del celular.'
  if (perfil.debe_cambiar_pin) return 'Primero crea tu PIN de 6 dígitos en la app del celular.'
  return null
}

interface ErrorAuth {
  message?: string
  status?: number
  code?: string
}

export function mensajeErrorLogin(error: ErrorAuth): string {
  const texto = (error.message ?? '').toLowerCase()
  if (error.code === 'invalid_credentials' || texto.includes('invalid login')) return 'Usuario o PIN incorrecto.'
  if (error.code === 'user_banned' || texto.includes('banned')) return 'Esta cuenta está desactivada.'
  if (error.status === 429 || error.code === 'over_request_rate_limit' || texto.includes('rate limit')) {
    return 'Demasiados intentos. Espera unos minutos y vuelve a intentar.'
  }
  if (texto.includes('failed to fetch') || texto.includes('network')) {
    return 'No hay conexión con el servidor. Revisa el internet.'
  }
  return 'No se pudo iniciar sesión. Intenta de nuevo.'
}
