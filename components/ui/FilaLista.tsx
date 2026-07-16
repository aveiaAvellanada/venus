import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { useTema } from '../../lib/tema'
import { espacio, tipografia } from '../../lib/theme'

interface Props {
  icono?: React.ReactNode
  titulo: string
  subtitulo?: string
  derecha?: React.ReactNode
  chevron?: boolean
  onPress?: () => void
}

export function FilaLista({ icono, titulo, subtitulo, derecha, chevron = false, onPress }: Props) {
  const { paleta } = useTema()

  const contenido = (presionada: boolean) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        minHeight: 64,
        paddingVertical: espacio.s,
        backgroundColor: presionada ? paleta.superficie2 : 'transparent',
        borderRadius: 12,
      }}
    >
      {icono}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[tipografia.h3, { color: paleta.texto }]} numberOfLines={1}>
          {titulo}
        </Text>
        {subtitulo ? (
          <Text style={[tipografia.caption, { color: paleta.texto3 }]} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>
      {derecha}
      {chevron ? <ChevronRight size={20} color={paleta.texto3} /> : null}
    </View>
  )

  if (!onPress) return contenido(false)

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => contenido(pressed)}
    </Pressable>
  )
}
