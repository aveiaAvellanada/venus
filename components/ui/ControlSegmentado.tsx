import React, { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useTema } from '../../lib/tema'
import { motion, radio, tipografia } from '../../lib/theme'

interface Props {
  opciones: string[]
  indice: number
  onCambio: (indice: number) => void
}

const RELLENO = 4

// Receta 3: pill deslizante con springLayout.
export function ControlSegmentado({ opciones, indice, onCambio }: Props) {
  const { paleta, esOscuro } = useTema()
  const [ancho, setAncho] = useState(0)
  const x = useSharedValue(0)

  const anchoPill = ancho > 0 ? (ancho - RELLENO * 2) / opciones.length : 0

  useEffect(() => {
    x.value = withSpring(RELLENO + indice * anchoPill, motion.springLayout)
  }, [indice, anchoPill, x])

  const estiloPill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  return (
    <View
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        backgroundColor: paleta.superficie2,
        borderRadius: radio.full,
        padding: RELLENO,
      }}
    >
      {anchoPill > 0 ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: RELLENO,
              bottom: RELLENO,
              left: 0,
              width: anchoPill,
              borderRadius: radio.full,
              backgroundColor: esOscuro ? paleta.superficie : paleta.fondo,
              elevation: 2,
              shadowColor: '#0B1220',
              shadowOpacity: 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            },
            estiloPill,
          ]}
        />
      ) : null}
      {opciones.map((opcion, i) => (
        <Pressable
          key={opcion}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === indice }}
          onPress={() => onCambio(i)}
          style={{ flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            style={[tipografia.etiqueta, { color: i === indice ? paleta.primario : paleta.texto2 }]}
          >
            {opcion}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
