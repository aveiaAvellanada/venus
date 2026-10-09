import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { AppState } from 'react-native'
import { Redirect } from 'expo-router'
import { isAuthApiError, isAuthRetryableFetchError, type Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { puedeAcceder, type Rol } from './permisos'
import { correoDeUsuario, recordarUsuario } from './usuarios'

export interface Perfil {
  id: string
  nombre: string
  usuario: string
  rol: Rol
  permisos: string[]
  activo: boolean
  debeCambiarPin: boolean
}

// Por qué no hay perfil con sesión abierta: la cuenta fue desactivada, o no se
// pudo leer (red). La pantalla raíz muestra un mensaje distinto para cada caso.
export type MotivoSinPerfil = 'desactivado' | 'error' | null

interface AuthState {
  session: Session | null
  perfil: Perfil | null
  motivoSinPerfil: MotivoSinPerfil
  cargando: boolean
  iniciarSesion: (usuario: string, pin: string) => Promise<{ error: string | null }>
  cerrarSesion: () => Promise<void>
  recargarPerfil: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

type ResultadoPerfil = { perfil: Perfil } | { motivo: Exclude<MotivoSinPerfil, null> }

async function fetchPerfil(userId: string): Promise<ResultadoPerfil> {
  const { data, error } = await supabase
    .from('users')
    .select('id, nombre, usuario, rol, permisos, activo, debe_cambiar_pin')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.error('fetchPerfil error:', error.message)
    return { motivo: 'error' }
  }
  // Fail-closed: sin fila o cuenta desactivada no obtiene acceso.
  if (!data || data.activo === false) return { motivo: 'desactivado' }
  return {
    perfil: {
      id: data.id,
      nombre: data.nombre,
      usuario: data.usuario,
      rol: data.rol as Rol,
      permisos: data.permisos ?? [],
      activo: data.activo,
      debeCambiarPin: data.debe_cambiar_pin,
    },
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [motivoSinPerfil, setMotivoSinPerfil] = useState<MotivoSinPerfil>(null)
  const [cargando, setCargando] = useState(true)
  const perfilRef = useRef<Perfil | null>(null)
  const sesionRef = useRef<Session | null>(null)

  const aplicarPerfil = useCallback((userId: string, res: ResultadoPerfil) => {
    if ('perfil' in res) {
      perfilRef.current = res.perfil
      setPerfil(res.perfil)
      setMotivoSinPerfil(null)
      recordarUsuario({ usuario: res.perfil.usuario, nombre: res.perfil.nombre })
    } else if (res.motivo === 'error' && perfilRef.current?.id === userId) {
      // Un fallo de red no saca a quien ya estaba trabajando (ni le borra el carrito).
    } else {
      perfilRef.current = null
      setPerfil(null)
      setMotivoSinPerfil(res.motivo)
    }
  }, [])

  useEffect(() => {
    let montado = true
    // onAuthStateChange emite INITIAL_SESSION al suscribirse (sesión cacheada, sin red),
    // así que es la única fuente de verdad: evita el doble fetch y la condición de carrera.
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, nuevaSesion) => {
      if (!montado) return
      sesionRef.current = nuevaSesion
      if (!nuevaSesion) {
        perfilRef.current = null
        setSession(null)
        setPerfil(null)
        setMotivoSinPerfil(null)
        if (event === 'INITIAL_SESSION') setCargando(false)
        return
      }
      // Renovar el token no cambia el perfil: no hace falta ir a la red cada hora.
      if (event === 'TOKEN_REFRESHED' && perfilRef.current?.id === nuevaSesion.user.id) {
        setSession(nuevaSesion)
        return
      }
      // Resolver el perfil ANTES de comitear la sesión, para que session y perfil
      // queden siempre consistentes (sin un render intermedio session-sí/perfil-no).
      const res = await fetchPerfil(nuevaSesion.user.id)
      if (!montado) return
      setSession(nuevaSesion)
      aplicarPerfil(nuevaSesion.user.id, res)
      if (event === 'INITIAL_SESSION') setCargando(false)
    })
    return () => {
      montado = false
      sub.subscription.unsubscribe()
    }
  }, [aplicarPerfil])

  const recargarPerfil = useCallback(async () => {
    const actual = sesionRef.current
    if (!actual) return
    aplicarPerfil(actual.user.id, await fetchPerfil(actual.user.id))
  }, [aplicarPerfil])

  // Al volver a la app se releen los permisos: si el dueño los cambió o
  // desactivó la cuenta, la app lo refleja sin cerrar sesión.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') recargarPerfil()
    })
    return () => sub.remove()
  }, [recargarPerfil])

  async function iniciarSesion(usuario: string, pin: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: correoDeUsuario(usuario), password: pin })
    if (error) {
      // Distinguir fallo de red de credenciales inválidas: con datos apagados no es un PIN malo.
      if (isAuthRetryableFetchError(error)) {
        return { error: 'Sin conexión. Verifica tu internet e intenta de nuevo.' }
      }
      if (isAuthApiError(error) && (error.code === 'user_banned' || /banned/i.test(error.message))) {
        return { error: 'Esta cuenta está desactivada. Habla con el administrador.' }
      }
      return { error: 'Usuario o PIN incorrecto. Intenta de nuevo.' }
    }
    return { error: null }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, perfil, motivoSinPerfil, cargando, iniciarSesion, cerrarSesion, recargarPerfil }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

// Devuelve un <Redirect> si el perfil actual no puede ver el módulo, o null si sí puede.
// La pantalla lo llama incondicionalmente al inicio y renderiza el resultado.
export function useRequireModulo(id: string) {
  const { perfil } = useAuth()
  // Fail-closed: sin perfil (o sin permiso) no se accede al módulo.
  if (!perfil || !puedeAcceder(perfil, id)) {
    return <Redirect href="/" />
  }
  return null
}
