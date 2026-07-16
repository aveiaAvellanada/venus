import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { colorAHex } from '../../lib/productos'
import { useTema } from '../../lib/tema'
import { radio, tipografia } from '../../lib/theme'

interface Props {
  nombre: string
  seleccionado: boolean
  onPress: () => void
}

export function PillColor({ nombre, seleccionado, onPress }: Props) {
  const { paleta } = useTema()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nombre}
      accessibilityState={{ selected: seleccionado }}
      onPress={onPress}
      hitSlop={6}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: radio.full,
        borderWidth: seleccionado ? 1.5 : 1,
        borderColor: seleccionado ? paleta.primario : paleta.borde,
        backgroundColor: seleccionado ? paleta.primarioSoft : paleta.superficie,
        paddingVertical: 6,
        paddingHorizontal: 12,
      }}
    >
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: radio.full,
          backgroundColor: colorAHex(nombre),
          borderWidth: 1,
          borderColor: 'rgba(11,18,32,0.15)',
        }}
      />
      <Text style={[tipografia.etiqueta, { color: seleccionado ? paleta.primario : paleta.texto2 }]}>
        {nombre}
      </Text>
    </Pressable>
  )
}
