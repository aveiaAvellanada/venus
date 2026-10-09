import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { correoDeUsuario, pinValido, usuarioValido } from '@shared/usuarios'
import { mensajeErrorLogin, motivoSinAcceso, type PerfilPanel } from './acceso'
import { supabase } from './supabase'

export type EstadoSesion =
  | { tipo: 'cargando' }
  | { tipo: 'fuera'; aviso: string | null }
  | { tipo: 'dentro'; perfil: PerfilPanel }

interface ContextoSesion {
  estado: EstadoSesion
  entrar: (usuario: string, pin: string) => Promise<void>
  salir: () => Promise<void>
}

const Contexto = createContext<ContextoSesion | null>(null)

async function cargarPerfil(id: string): Promise<PerfilPanel | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, nombre, usuario, rol, activo, debe_cambiar_pin')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as PerfilPanel | null
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({ tipo: 'cargando' })

  // Con perfil válido entra; si no, se cierra la sesión y se dice por qué.
  const validar = useCallback(async (id: string) => {
    const perfil = await cargarPerfil(id)
    const motivo = motivoSinAcceso(perfil)
    if (motivo || !perfil) {
      await supabase.auth.signOut()
      setEstado({ tipo: 'fuera', aviso: motivo })
      throw new Error(motivo ?? 'Sin acceso.')
    }
    setEstado({ tipo: 'dentro', perfil })
  }, [])

  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return
      if (!data.session) {
        setEstado({ tipo: 'fuera', aviso: null })
        return
      }
      try {
        await validar(data.session.user.id)
      } catch (e) {
        if (vivo) setEstado({ tipo: 'fuera', aviso: e instanceof Error ? e.message : null })
      }
    })
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') {
        setEstado((previo) => (previo.tipo === 'fuera' ? previo : { tipo: 'fuera', aviso: null }))
      }
    })
    return () => {
      vivo = false
      data.subscription.unsubscribe()
    }
  }, [validar])

  const entrar = useCallback(
    async (usuario: string, pin: string) => {
      if (!usuarioValido(usuario)) throw new Error('Escribe tu usuario (de 3 a 20 letras o números).')
      if (!pinValido(pin)) throw new Error('El PIN tiene 6 números.')
      const { data, error } = await supabase.auth.signInWithPassword({
        email: correoDeUsuario(usuario),
        password: pin,
      })
      if (error) throw new Error(mensajeErrorLogin(error))
      await validar(data.user.id)
    },
    [validar],
  )

  const salir = useCallback(async () => {
    await supabase.auth.signOut()
    setEstado({ tipo: 'fuera', aviso: null })
  }, [])

  const valor = useMemo(() => ({ estado, entrar, salir }), [estado, entrar, salir])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>')
  return contexto
}
