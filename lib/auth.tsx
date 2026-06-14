import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { Redirect } from 'expo-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { puedeAcceder, type Rol } from './permisos'

export interface Perfil {
  id: string
  nombre: string
  rol: Rol
  activo: boolean
}

interface AuthState {
  session: Session | null
  perfil: Perfil | null
  cargando: boolean
  iniciarSesion: (email: string, pin: string) => Promise<{ error: string | null }>
  cerrarSesion: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

async function fetchPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, nombre, rol, activo')
    .eq('id', userId)
    .single()
  if (error || !data) {
    if (error) console.error('fetchPerfil error:', error.message)
    return null
  }
  return { id: data.id, nombre: data.nombre, rol: data.rol as Rol, activo: data.activo }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let montado = true
    // onAuthStateChange emite INITIAL_SESSION al suscribirse (sesión cacheada, sin red),
    // así que es la única fuente de verdad: evita el doble fetch y la condición de carrera.
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, nuevaSesion) => {
      if (!montado) return
      // Resolver el perfil ANTES de comitear la sesión, para que session y perfil
      // queden siempre consistentes (sin un render intermedio session-sí/perfil-no).
      const nuevoPerfil = nuevaSesion ? await fetchPerfil(nuevaSesion.user.id) : null
      if (!montado) return
      setSession(nuevaSesion)
      setPerfil(nuevoPerfil)
      if (event === 'INITIAL_SESSION') setCargando(false)
    })
    return () => {
      montado = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function iniciarSesion(email: string, pin: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pin })
    if (error) return { error: 'PIN incorrecto. Intenta de nuevo.' }
    return { error: null }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, perfil, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

// Devuelve un <Redirect> si el rol actual no puede ver el módulo, o null si sí puede.
// La pantalla lo llama incondicionalmente al inicio y renderiza el resultado.
export function useRequireModulo(id: string) {
  const { perfil } = useAuth()
  // Fail-closed: sin perfil (o sin permiso) no se accede al módulo.
  if (!perfil || !puedeAcceder(perfil.rol, id)) {
    return <Redirect href="/" />
  }
  return null
}
