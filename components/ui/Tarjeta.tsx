import React from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio } from '../../lib/theme'
import { Presionable } from './Presionable'

interface Props {
  children: React.ReactNode
  onPress?: () => void
  estilo?: StyleProp<ViewStyle>
}

export function Tarjeta({ children, onPress, estilo }: Props) {
  const { paleta } = useTema()
  const base: ViewStyle = {
    backgroundColor: paleta.superficie,
    borderWidth: 1,
    borderColor: paleta.borde,
    borderRadius: radio.md,
    padding: espacio.l,
  }
  if (onPress) {
    return (
      <Presionable testID="tarjeta" accessibilityRole="button" onPress={onPress} style={[base, estilo]}>
        {children}
      </Presionable>
    )
  }
  return (
    <View testID="tarjeta" style={[base, estilo]}>
      {children}
    </View>
  )
}
