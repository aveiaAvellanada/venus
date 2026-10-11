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
import { motion, tabular, tipografia } from '../../lib/theme'
import { RayaDiagonal } from './RayaDiagonal'

interface Props {
  talla: string
  stock: number
  seleccionada: boolean
  onPress: () => void
  // Ancho fijo de la celda cuando va en grilla (detalle de producto).
  ancho?: number
}

// Spec §6.13: talla arriba / divisor / stock abajo (formato fracción, sin "u").
// Sin stock: visible pero deshabilitada, opaca y con raya diagonal "/"
// (nunca se oculta, regla de negocio).
export function ChipTalla({ talla, stock, seleccionada, onPress, ancho }: Props) {
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
    <Animated.View style={[ancho != null ? { width: ancho } : { flexGrow: 1, flexBasis: 56, maxWidth: 80 }, animado]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Talla ${talla}: ${stock} disponibles`}
        accessibilityState={{ selected: seleccionada, disabled: sinStock }}
        disabled={sinStock}
        onPress={sinStock ? undefined : onPress}
        style={{
          borderRadius: 10,
          borderWidth: seleccionada ? 2 : 1,
          borderColor: seleccionada ? paleta.primario : paleta.borde,
          backgroundColor: seleccionada ? paleta.primarioSoft : paleta.superficie,
          alignItems: 'center',
          paddingVertical: seleccionada ? 4 : 5,
          opacity: sinStock ? 0.5 : 1,
          overflow: 'hidden',
        }}
      >
        <Text style={[tipografia.cuerpoLg, { color, fontSize: 15, lineHeight: 20 }]}>{talla}</Text>
        <View style={{ height: 1, alignSelf: 'stretch', marginHorizontal: 8, marginVertical: 3, backgroundColor: seleccionada ? paleta.primario : paleta.borde, opacity: 0.5 }} />
        <Text style={[tipografia.micro, tabular, { color: sinStock ? paleta.textoDeshabilitado : seleccionada ? paleta.primario : paleta.texto3, textTransform: 'none', letterSpacing: 0 }]}>
          {stock}
        </Text>
        {sinStock ? <RayaDiagonal /> : null}
      </Pressable>
    </Animated.View>
  )
}
