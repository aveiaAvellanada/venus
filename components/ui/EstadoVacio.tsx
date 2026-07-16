import React from 'react'
import { Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import { Boton } from './Boton'

interface Props {
  icono?: React.ReactElement<{ color?: string; size?: number }>
  titulo: string
  mensaje?: string
  textoAccion?: string
  onAccion?: () => void
}

export function EstadoVacio({ icono, titulo, mensaje, textoAccion, onAccion }: Props) {
  const { paleta } = useTema()
  return (
    <View style={{ alignItems: 'center', gap: espacio.m, paddingVertical: espacio.xxxl }}>
      {icono ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radio.full,
            backgroundColor: paleta.superficie2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {React.cloneElement(icono, { color: paleta.texto3, size: 28 })}
        </View>
      ) : null}
      <Text style={[tipografia.h3, { color: paleta.texto, textAlign: 'center' }]}>{titulo}</Text>
      {mensaje ? (
        <Text style={[tipografia.cuerpo, { color: paleta.texto2, textAlign: 'center' }]}>{mensaje}</Text>
      ) : null}
      {textoAccion && onAccion ? (
        <Boton titulo={textoAccion} variante="secundario" tamano="md" onPress={onAccion} />
      ) : null}
    </View>
  )
}
