import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import { Presionable } from './Presionable'

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma'

interface Props {
  titulo: string
  onPress: () => void
  variante?: VarianteBoton
  tamano?: 'lg' | 'md'
  cargando?: boolean
  deshabilitado?: boolean
  icono?: React.ReactNode
}

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  tamano = 'lg',
  cargando = false,
  deshabilitado = false,
  icono,
}: Props) {
  const { paleta } = useTema()
  const inactivo = deshabilitado || cargando

  const colores = {
    primario: { fondo: paleta.primario, texto: paleta.sobrePrimario },
    secundario: { fondo: paleta.primarioSoft, texto: paleta.primario },
    peligro: { fondo: paleta.peligro, texto: paleta.sobrePrimario },
    fantasma: { fondo: 'transparent', texto: paleta.primario },
  }[variante]

  return (
    <Presionable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      disabled={inactivo}
      onPress={inactivo ? undefined : onPress}
      style={[
        estilos.base,
        { backgroundColor: colores.fondo, height: tamano === 'lg' ? 56 : 48 },
        inactivo && !cargando ? estilos.deshabilitado : null,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colores.texto} />
      ) : icono ? (
        <View>{icono}</View>
      ) : null}
      <Text style={[tipografia.cuerpoLg, { color: colores.texto }]}>{titulo}</Text>
    </Presionable>
  )
}

const estilos = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.s,
    borderRadius: radio.md,
    paddingHorizontal: espacio.xxl,
  },
  deshabilitado: { opacity: 0.45 },
})
