import React, { useEffect } from 'react'
import { DimensionValue } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useTema } from '../../lib/tema'

interface Props {
  ancho?: DimensionValue
  alto?: number
  radio?: number
}

// Receta 7: pulso de opacidad 0.5 ↔ 1 cada 1000ms.
export function Esqueleto({ ancho = '100%', alto = 16, radio: r = 8 }: Props) {
  const { paleta } = useTema()
  const op = useSharedValue(1)
  const reducido = useReducedMotion()

  useEffect(() => {
    if (reducido) return
    op.value = withRepeat(
      withSequence(withTiming(0.5, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1
    )
  }, [op, reducido])

  const estilo = useAnimatedStyle(() => ({ opacity: op.value }))

  return (
    <Animated.View
      testID="esqueleto"
      style={[{ width: ancho, height: alto, borderRadius: r, backgroundColor: paleta.superficie2 }, estilo]}
    />
  )
}
