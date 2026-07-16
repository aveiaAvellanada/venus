import React from 'react'
import { Pressable, Text } from 'react-native'
import { useTema } from '../../lib/tema'
import { radio, tipografia } from '../../lib/theme'

interface Props {
  etiqueta: string
  activo: boolean
  onPress: () => void
}

export function Chip({ etiqueta, activo, onPress }: Props) {
  const { paleta } = useTema()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      onPress={onPress}
      hitSlop={6}
      style={{
        height: 36,
        paddingHorizontal: 16,
        borderRadius: radio.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: activo ? paleta.primario : paleta.superficie,
        borderWidth: 1,
        borderColor: activo ? paleta.primario : paleta.borde,
      }}
    >
      <Text style={[tipografia.etiqueta, { color: activo ? paleta.sobrePrimario : paleta.texto2 }]}>
        {etiqueta}
      </Text>
    </Pressable>
  )
}
