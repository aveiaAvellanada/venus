import React from 'react'
import { View, type ViewStyle } from 'react-native'
import { useTema } from '../../lib/tema'
import { radio } from '../../lib/theme'
import { hexesDeColor } from '../../lib/productos'

// Círculo con el color del zapato. Con dos colores ("Rojo y blanco") se parte a
// la mitad: el primero a la izquierda y el segundo a la derecha.
export function PuntoColor({ color, tamano, style }: { color: string; tamano: number; style?: ViewStyle }) {
  const { paleta } = useTema()
  const hexes = hexesDeColor(color)
  return (
    <View
      testID="punto-color"
      style={[
        {
          width: tamano,
          height: tamano,
          borderRadius: radio.full,
          borderWidth: 1,
          borderColor: paleta.bordeFuerte,
          overflow: 'hidden',
          flexDirection: 'row',
        },
        style,
      ]}
    >
      {hexes.map((hex, i) => (
        <View key={i} testID="punto-color-mitad" style={{ flex: 1, backgroundColor: hex }} />
      ))}
    </View>
  )
}
