import React, { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated'
import { useTema } from '../../lib/tema'
import { motion, radio, tipografia } from '../../lib/theme'

interface Props {
  talla: string
  stock: number
  seleccionada: boolean
  onPress: () => void
}

// Spec §6.13: talla arriba / divisor / stock abajo (formato fracción, sin "u").
// Sin stock: visible pero deshabilitada (nunca se oculta, regla de negocio).
export function ChipTalla({ talla, stock, seleccionada, onPress }: Props) {
  const { paleta } = useTema()
  const sinStock = stock <= 0
  const escala = useSharedValue(1)
  const reducido = useReducedMotion()

  useEffect(() => {
    if (seleccionada && !reducido) {
      escala.value = withSequence(
        withSpring(1.06, motion.springLayout),
        withSpring(1, motion.springLayout)
      )
    }
  }, [seleccionada, escala, reducido])

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }))
  const color = sinStock ? paleta.textoDeshabilitado : seleccionada ? paleta.primario : paleta.texto

  return (
    <Animated.View style={[{ flexGrow: 1, flexBasis: 56, maxWidth: 80 }, animado]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Talla ${talla}: ${stock} disponibles`}
        accessibilityState={{ selected: seleccionada, disabled: sinStock }}
        disabled={sinStock}
        onPress={sinStock ? undefined : onPress}
        style={{
          borderRadius: radio.sm,
          borderWidth: seleccionada ? 2 : 1,
          borderColor: seleccionada ? paleta.primario : paleta.borde,
          backgroundColor: seleccionada ? paleta.primarioSoft : paleta.superficie,
          alignItems: 'center',
          paddingVertical: seleccionada ? 7 : 8,
          opacity: sinStock ? 0.38 : 1,
        }}
      >
        <Text style={[tipografia.h3, { color }]}>{talla}</Text>
        <View style={{ height: 1, alignSelf: 'stretch', marginHorizontal: 10, marginVertical: 4, backgroundColor: seleccionada ? paleta.primario : paleta.borde, opacity: 0.5 }} />
        <Text style={[tipografia.caption, { color: sinStock ? paleta.textoDeshabilitado : seleccionada ? paleta.primario : paleta.texto3 }]}>
          {stock}
        </Text>
      </Pressable>
    </Animated.View>
  )
}
