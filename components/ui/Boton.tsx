import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia, tipografiaCompacta } from '../../lib/theme'
import { Presionable } from './Presionable'

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma' | 'oscuro' | 'contorno'

interface Props {
  titulo: string
  onPress: () => void
  variante?: VarianteBoton
  tamano?: 'lg' | 'md'
  cargando?: boolean
  deshabilitado?: boolean
  icono?: React.ReactNode
  // Píldora (radio completo): "Ir al carrito", "Seguir", "Mostrar artículos".
  pildora?: boolean
  // 50 de alto y letra de 15 (carrito y cobro).
  compacto?: boolean
}

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  tamano = 'lg',
  cargando = false,
  deshabilitado = false,
  icono,
  pildora = false,
  compacto = false,
}: Props) {
  const { paleta } = useTema()
  const inactivo = deshabilitado || cargando

  const colores = {
    primario: { fondo: paleta.primario, texto: paleta.sobrePrimario },
    secundario: { fondo: paleta.primarioSoft, texto: paleta.primario },
    peligro: { fondo: paleta.peligro, texto: paleta.sobrePrimario },
    fantasma: { fondo: 'transparent', texto: paleta.primario },
    oscuro: { fondo: paleta.superficieOscura, texto: paleta.sobreOscura },
    contorno: { fondo: paleta.fondo, texto: paleta.texto },
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
        { backgroundColor: colores.fondo, height: compacto ? 50 : tamano === 'lg' ? 56 : 48 },
        pildora ? { borderRadius: radio.full, paddingHorizontal: espacio.s } : null,
        variante === 'contorno' ? { borderWidth: 1.5, borderColor: paleta.texto } : null,
        inactivo && !cargando ? estilos.deshabilitado : null,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colores.texto} />
      ) : icono ? (
        <View>{icono}</View>
      ) : null}
      <Text style={[compacto ? tipografiaCompacta.boton : tipografia.cuerpoLg, { color: colores.texto }]}>{titulo}</Text>
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
