import React, { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useTema } from '../../lib/tema'
import { radio, tipografia } from '../../lib/theme'

export type TipoBadge = 'exito' | 'peligro' | 'advertencia' | 'neutro'

interface Props {
  texto: string
  tipo?: TipoBadge
  punto?: boolean
}

// Receta 11: el punto pulsante (caja ABIERTA) es el único loop de la app.
function PuntoPulsante({ color }: { color: string }) {
  const op = useSharedValue(1)
  const reducido = useReducedMotion()

  useEffect(() => {
    if (reducido) return
    op.value = withRepeat(
      withSequence(withTiming(0.45, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1
    )
  }, [op, reducido])

  const estilo = useAnimatedStyle(() => ({ opacity: op.value }))
  return (
    <Animated.View
      style={[{ width: 7, height: 7, borderRadius: radio.full, backgroundColor: color }, estilo]}
    />
  )
}

export function Badge({ texto, tipo = 'neutro', punto = false }: Props) {
  const { paleta } = useTema()
  const colores = {
    exito: { fondo: paleta.exitoSoft, texto: paleta.exitoTexto },
    peligro: { fondo: paleta.peligroSoft, texto: paleta.peligroTexto },
    advertencia: { fondo: paleta.advertenciaSoft, texto: paleta.advertenciaTexto },
    neutro: { fondo: paleta.superficie2, texto: paleta.texto2 },
  }[tipo]

  return (
    <View
      testID="badge"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: colores.fondo,
        borderRadius: radio.full,
        paddingVertical: 6,
        paddingHorizontal: 12,
      }}
    >
      {punto ? <PuntoPulsante color={colores.texto} /> : null}
      <Text style={[tipografia.micro, { color: colores.texto }]}>{texto}</Text>
    </View>
  )
}
