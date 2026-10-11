import React from 'react'
import { Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import { Presionable } from './Presionable'

interface Props {
  titulo: string
  onPress: () => void
  deshabilitado?: boolean
  // Relleno extra abajo (área segura del sistema).
  inferior?: number
}

// Barra fija inferior oscura con esquinas superiores redondeadas: único botón
// de compra del detalle de Calzado y de la hoja de Granja (rediseño §4–§5).
export function BarraAccionInferior({ titulo, onPress, deshabilitado = false, inferior = 0 }: Props) {
  const { paleta } = useTema()
  return (
    <View
      style={{
        backgroundColor: paleta.superficieOscura,
        borderTopLeftRadius: radio.lg,
        borderTopRightRadius: radio.lg,
        paddingHorizontal: espacio.xl,
        paddingTop: espacio.l,
        paddingBottom: espacio.xl + inferior,
      }}
    >
      <Presionable
        accessibilityRole="button"
        accessibilityLabel={titulo}
        accessibilityState={{ disabled: deshabilitado }}
        disabled={deshabilitado}
        onPress={deshabilitado ? undefined : onPress}
        style={{ alignItems: 'center', justifyContent: 'center', minHeight: 32, opacity: deshabilitado ? 0.45 : 1 }}
      >
        <Text style={[tipografia.cuerpoLg, { color: paleta.sobreOscura, fontSize: 16 }]}>{titulo}</Text>
      </Presionable>
    </View>
  )
}
