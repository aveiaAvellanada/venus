import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { CircleAlert, CircleCheck, Info } from 'lucide-react-native'
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'

export type TipoToast = 'exito' | 'error' | 'info'

interface ContextoToast {
  mostrar: (mensaje: string, tipo?: TipoToast) => void
}

const Contexto = createContext<ContextoToast | null>(null)

export function useToast(): ContextoToast {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [actual, setActual] = useState<{ id: number; mensaje: string; tipo: TipoToast } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mostrar = useCallback((mensaje: string, tipo: TipoToast = 'exito') => {
    if (timer.current) clearTimeout(timer.current)
    setActual(prev => ({ id: (prev?.id ?? 0) + 1, mensaje, tipo }))
    timer.current = setTimeout(() => setActual(null), 2500)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <Contexto.Provider value={{ mostrar }}>
      {children}
      {actual ? <VistaToast key={actual.id} mensaje={actual.mensaje} tipo={actual.tipo} /> : null}
    </Contexto.Provider>
  )
}

function VistaToast({ mensaje, tipo }: { mensaje: string; tipo: TipoToast }) {
  const { paleta } = useTema()
  const reducido = useReducedMotion()

  const Icono = { exito: CircleCheck, error: CircleAlert, info: Info }[tipo]
  const color = {
    exito: paleta.exitoTexto,
    error: paleta.peligroTexto,
    info: paleta.texto2,
  }[tipo]

  return (
    <Animated.View
      entering={reducido ? FadeIn.duration(150) : FadeInDown.duration(200)}
      exiting={FadeOut.duration(150)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: espacio.xl,
        right: espacio.xl,
        bottom: 96,
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.s,
        backgroundColor: paleta.superficie,
        borderWidth: 1,
        borderColor: paleta.borde,
        borderRadius: radio.md,
        paddingVertical: espacio.m,
        paddingHorizontal: espacio.l,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      <Icono size={20} color={color} />
      <Text style={[tipografia.cuerpo, { color: paleta.texto, flex: 1 }]} numberOfLines={2}>
        {mensaje}
      </Text>
    </Animated.View>
  )
}
