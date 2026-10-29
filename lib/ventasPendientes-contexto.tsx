import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { Alert, AppState } from 'react-native'
import { useNetworkState } from 'expo-network'
import { useAuth } from './auth'
import { sinRed } from './conexion'
import {
  escucharPendientes, guardarPendiente, leerPendientes, mandarPendientes, quitarPendiente, reintentarPendiente,
  type ResultadoEnvio, type VentaPendiente,
} from './ventasPendientes'

interface Estado {
  // Las de esta persona.
  pendientes: VentaPendiente[]
  // El teléfono sabe que no hay internet.
  sinConexion: boolean
  enviando: boolean
  guardar: (venta: VentaPendiente) => Promise<void>
  mandar: () => Promise<void>
  reintentar: (clave: string) => Promise<void>
  descartar: (clave: string) => Promise<void>
}

const Contexto = createContext<Estado | undefined>(undefined)

// Mientras queden ventas por mandar se reintenta cada minuto.
const CADA_MS = 60_000

export function resumenEnvio(r: ResultadoEnvio): { titulo: string; mensaje: string } | null {
  if (!r.enviadas && !r.rechazadas) return null
  const partes: string[] = []
  if (r.enviadas) partes.push(r.enviadas === 1 ? 'Se mandó 1 venta hecha sin conexión.' : `Se mandaron ${r.enviadas} ventas hechas sin conexión.`)
  if (r.rechazadas) partes.push(r.rechazadas === 1 ? '1 venta no se pudo registrar: revísala en Movimientos.' : `${r.rechazadas} ventas no se pudieron registrar: revísalas en Movimientos.`)
  partes.push(...r.avisos)
  return { titulo: r.rechazadas ? 'Ventas sin conexión' : 'Ventas enviadas', mensaje: partes.join('\n\n') }
}

export function VentasPendientesProvider({ children }: PropsWithChildren) {
  const { perfil } = useAuth()
  const red = useNetworkState()
  const sinConexion = sinRed(red)
  const [todas, setTodas] = useState<VentaPendiente[]>([])
  const [enviando, setEnviando] = useState(false)
  const usuarioId = perfil?.id ?? null
  const usuarioRef = useRef(usuarioId)
  usuarioRef.current = usuarioId
  const sinRedRef = useRef(sinConexion)
  sinRedRef.current = sinConexion

  useEffect(() => {
    leerPendientes().then(setTodas)
    return escucharPendientes(setTodas)
  }, [])

  const mandar = useCallback(async () => {
    const id = usuarioRef.current
    if (!id) return
    // Sin red se intenta en silencio: el aviso no dice "Mandando…".
    setEnviando(!sinRedRef.current)
    try {
      const resumen = resumenEnvio(await mandarPendientes(id))
      if (resumen) Alert.alert(resumen.titulo, resumen.mensaje)
    } finally {
      setEnviando(false)
    }
  }, [])

  const pendientes = usuarioId ? todas.filter((v) => v.usuarioId === usuarioId) : []
  const porMandar = pendientes.filter((v) => !v.error).length

  // Se manda al volver la red, al volver a la app y cada minuto mientras queden
  // (también si el teléfono cree que no hay red: si se equivoca, igual llegan).
  useEffect(() => {
    if (!porMandar) return
    if (!sinConexion) mandar()
    const reloj = setInterval(mandar, CADA_MS)
    const sub = AppState.addEventListener('change', (e) => { if (e === 'active') mandar() })
    return () => {
      clearInterval(reloj)
      sub.remove()
    }
  }, [porMandar > 0, sinConexion, usuarioId, mandar]) // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = useCallback(async (venta: VentaPendiente) => { await guardarPendiente(venta) }, [])
  const reintentar = useCallback(async (clave: string) => {
    await reintentarPendiente(clave)
    await mandar()
  }, [mandar])
  const descartar = useCallback(async (clave: string) => { await quitarPendiente(clave) }, [])

  return (
    <Contexto.Provider value={{ pendientes, sinConexion, enviando, guardar, mandar, reintentar, descartar }}>
      {children}
    </Contexto.Provider>
  )
}

export function useVentasPendientes(): Estado {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useVentasPendientes debe usarse dentro de VentasPendientesProvider')
  return ctx
}
