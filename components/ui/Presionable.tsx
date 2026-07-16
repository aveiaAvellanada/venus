import React from 'react'
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { motion } from '../../lib/theme'

const PressableAnimado = Animated.createAnimatedComponent(Pressable)

type Props = PressableProps & {
  escala?: number
  style?: StyleProp<ViewStyle>
}

// Receta 1 del motion system: scale al presionar con springPress.
export function Presionable({ escala = motion.escalaPress, style, onPressIn, onPressOut, ...resto }: Props) {
  const s = useSharedValue(1)
  const reducido = useReducedMotion()

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }))

  return (
    <PressableAnimado
      style={[style, reducido ? undefined : animado]}
      onPressIn={(e) => {
        s.value = withSpring(escala, motion.springPress)
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, motion.springPress)
        onPressOut?.(e)
      }}
      {...resto}
    />
  )
}
