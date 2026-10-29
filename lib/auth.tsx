import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect } from 'expo-router'
import { isAuthApiError, isAuthRetryableFetchError, type Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { puedeAcceder, type Rol } from './permisos'
import { correoDeUsuario, recordarUsuario } from './usuarios'
import { borrarCache, fijarUsuarioCache } from './cacheLocal'
import { leerPendientes } from './ventasPendientes'

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

// El perfil de cada persona queda en el teléfono: sin conexión la app arranca
// con él (los permisos los vuelve a exigir la base al mandar las ventas).
const clavePerfil = (id: string) => `venus.perfil.${id}`

async function perfilGuardado(id: string): Promise<Perfil | null> {
  try {
    const texto = await AsyncStorage.getItem(clavePerfil(id))
    const p = texto ? (JSON.parse(texto) as Perfil) : null
    return p && p.id === id && p.activo ? p : null
  } catch {
    return null
  }
}

// La sesión que supabase-js dejó en el teléfono. Al arrancar sin conexión con
// el token vencido, INITIAL_SESSION llega vacía aunque la sesión siga ahí (no
// se pudo renovar); la app la usa para entrar y supabase-js la renueva sola
// cuando vuelve la red. Si se cerró sesión o la base la anuló, ya no está.
async function sesionGuardada(): Promise<Session | null> {
  try {
    const clave = (supabase.auth as unknown as { storageKey?: string }).storageKey
    const texto = clave ? await AsyncStorage.getItem(clave) : null
    const s = texto ? JSON.parse(texto) : null
    return s && s.user?.id && s.refresh_token ? (s as Session) : null
  } catch {
    return null
  }
}

export function mismoPerfil(a: Perfil, b: Perfil): boolean {
  return (
    a.id === b.id &&
    a.nombre === b.nombre &&
    a.usuario === b.usuario &&
    a.rol === b.rol &&
    a.activo === b.activo &&
    a.debeCambiarPin === b.debeCambiarPin &&
    a.permisos.length === b.permisos.length &&
    a.permisos.every((p, i) => p === b.permisos[i])
  )
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [motivoSinPerfil, setMotivoSinPerfil] = useState<MotivoSinPerfil>(null)
  const [cargando, setCargando] = useState(true)
  const perfilRef = useRef<Perfil | null>(null)
  const sesionRef = useRef<Session | null>(null)
  // Se entró con la sesión guardada en el teléfono (sin conexión).
  const desdeTelefonoRef = useRef(false)

  const aplicarPerfil = useCallback((userId: string, res: ResultadoPerfil) => {
    if ('perfil' in res) {
      // Si nada cambió se conserva el mismo objeto, para no disparar efectos que
      // dependen de `perfil` cada vez que se vuelve a la app.
      if (perfilRef.current && mismoPerfil(perfilRef.current, res.perfil)) {
        setMotivoSinPerfil(null)
        return
      }
      perfilRef.current = res.perfil
      setPerfil(res.perfil)
      setMotivoSinPerfil(null)
      recordarUsuario({ usuario: res.perfil.usuario, nombre: res.perfil.nombre })
      AsyncStorage.setItem(clavePerfil(userId), JSON.stringify(res.perfil)).catch(() => {})
    } else if (res.motivo === 'error' && perfilRef.current?.id === userId) {
      // Un fallo de red no saca a quien ya estaba trabajando (ni le borra el carrito).
    } else {
      if (res.motivo === 'desactivado') AsyncStorage.removeItem(clavePerfil(userId)).catch(() => {})
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
      if (!nuevaSesion && event === 'INITIAL_SESSION') {
        // Sin conexión y con el token vencido: entra con la sesión y el perfil
        // guardados en el teléfono (solo quien ya había entrado aquí).
        const guardada = await sesionGuardada()
        const perfilPrevio = guardada ? await perfilGuardado(guardada.user.id) : null
        if (!montado) return
        if (guardada && perfilPrevio) {
          sesionRef.current = guardada
          perfilRef.current = perfilPrevio
          desdeTelefonoRef.current = true
          fijarUsuarioCache(guardada.user.id)
          setSession(guardada)
          setPerfil(perfilPrevio)
          setMotivoSinPerfil(null)
          setCargando(false)
          return
        }
      }
      sesionRef.current = nuevaSesion
      fijarUsuarioCache(nuevaSesion?.user.id ?? null)
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
        // Había entrado sin conexión: con la red de vuelta se releen los permisos.
        if (desdeTelefonoRef.current) {
          desdeTelefonoRef.current = false
          aplicarPerfil(nuevaSesion.user.id, await fetchPerfil(nuevaSesion.user.id))
        }
        return
      }
      // Resolver el perfil ANTES de comitear la sesión, para que session y perfil
      // queden siempre consistentes (sin un render intermedio session-sí/perfil-no).
      let res = await fetchPerfil(nuevaSesion.user.id)
      // Sin conexión (token aún vigente): el perfil guardado en el teléfono.
      if ('motivo' in res && res.motivo === 'error' && perfilRef.current?.id !== nuevaSesion.user.id) {
        const previo = await perfilGuardado(nuevaSesion.user.id)
        if (previo) res = { perfil: previo }
      }
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

  // Con ventas hechas sin conexión que aún no llegan a la base no se sale:
  // solo quien las hizo puede mandarlas.
  async function cerrarSesion() {
    const id = sesionRef.current?.user.id
    if (id && (await leerPendientes()).some((v) => v.usuarioId === id)) {
      throw new VentasSinMandarError()
    }
    const { error } = await supabase.auth.signOut()
    // Sin conexión no se cierra: la sesión (y lo guardado) sigue en el teléfono.
    if (error) throw error
    if (id) {
      await borrarCache(id)
      await AsyncStorage.removeItem(clavePerfil(id)).catch(() => {})
    }
  }

  return (
    <AuthContext.Provider
      value={{ session, perfil, motivoSinPerfil, cargando, iniciarSesion, cerrarSesion, recargarPerfil }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export class VentasSinMandarError extends Error {
  constructor() {
    super('Tienes ventas hechas sin conexión que aún no llegan a la base. Espera a que vuelva la conexión y se manden antes de cerrar sesión.')
    this.name = 'VentasSinMandarError'
  }
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
