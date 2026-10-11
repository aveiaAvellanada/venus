import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import { Presionable } from './Presionable'

interface Props {
  titulo: string
  onPress: () => void
  deshabilitado?: boolean
  cargando?: boolean
  // Relleno extra abajo (área segura del sistema).
  inferior?: number
}

// Barra fija inferior oscura con esquinas superiores redondeadas: único botón
// de compra del detalle de Calzado y de la hoja de Granja (rediseño §4–§5).
export function BarraAccionInferior({ titulo, onPress, deshabilitado = false, cargando = false, inferior = 0 }: Props) {
  const inactivo = deshabilitado || cargando
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
        accessibilityState={{ disabled: inactivo, busy: cargando }}
        disabled={inactivo}
        onPress={inactivo ? undefined : onPress}
        style={{
          flexDirection: 'row',
          gap: espacio.s,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 32,
          opacity: deshabilitado && !cargando ? 0.45 : 1,
        }}
      >
        {cargando ? <ActivityIndicator color={paleta.sobreOscura} /> : null}
        <Text style={[tipografia.cuerpoLg, { color: paleta.sobreOscura, fontSize: 16 }]}>{titulo}</Text>
      </Presionable>
    </View>
  )
}
