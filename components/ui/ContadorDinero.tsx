import React, { useEffect } from 'react'
import { StyleProp, TextInput, TextInputProps, TextStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useTema } from '../../lib/tema'
import { motion } from '../../lib/theme'

const TextInputAnimado = Animated.createAnimatedComponent(TextInput)

// Formato es-CO sin Intl (corre dentro del worklet): 1250000 -> "1.250.000".
function formatearMiles(n: number): string {
  'worklet'
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

interface Props {
  valor: number
  estilo?: StyleProp<TextStyle>
  color?: string
}

// Receta 2: count-up de dinero al cambiar de período (500ms, easeMove).
export function ContadorDinero({ valor, estilo, color }: Props) {
  const { paleta } = useTema()
  const v = useSharedValue(0)
  const reducido = useReducedMotion()

  useEffect(() => {
    v.value = reducido
      ? valor
      : withTiming(valor, { duration: 500, easing: Easing.bezier(...motion.easeMove) })
  }, [valor, v, reducido])

  const propsAnimadas = useAnimatedProps(() => {
    return { text: '$' + formatearMiles(v.value) } as { text: string }
  })

  return (
    <TextInputAnimado
      editable={false}
      value={'$' + formatearMiles(valor)}
      animatedProps={propsAnimadas as unknown as Partial<TextInputProps>}
      accessibilityLabel={'$' + formatearMiles(valor)}
      style={[{ color: color ?? paleta.texto, padding: 0, fontVariant: ['tabular-nums'] }, estilo]}
    />
  )
}
