import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ModoTema, Paleta, paletaClara, paletaOscura } from './theme'

const CLAVE_TEMA = 'venus.tema'

interface ContextoTema {
  paleta: Paleta
  esOscuro: boolean
  modo: ModoTema
  setModo: (modo: ModoTema) => void
}

const Contexto = createContext<ContextoTema | null>(null)

export function TemaProvider({ children }: { children: React.ReactNode }) {
  const sistema = useColorScheme()
  const [modo, setModoEstado] = useState<ModoTema>('sistema')
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_TEMA)
      .then((v) => {
        if (v === 'claro' || v === 'oscuro' || v === 'sistema') setModoEstado(v)
      })
      .catch(() => {})
      .finally(() => setCargado(true))
  }, [])

  const setModo = useCallback((m: ModoTema) => {
    setModoEstado(m)
    AsyncStorage.setItem(CLAVE_TEMA, m).catch(() => {})
  }, [])

  const esOscuro = modo === 'oscuro' || (modo === 'sistema' && sistema === 'dark')

  const valor = useMemo(
    () => ({ paleta: esOscuro ? paletaOscura : paletaClara, esOscuro, modo, setModo }),
    [esOscuro, modo, setModo]
  )

  // El splash sigue visible mientras se lee la preferencia: sin flash de tema.
  if (!cargado) return null

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useTema(): ContextoTema {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useTema debe usarse dentro de <TemaProvider>')
  return ctx
}
