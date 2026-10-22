import React from 'react'
import { Pressable, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio } from '../../lib/theme'

interface Props {
  ancho: number
  accessibilityLabel: string
  onPress: () => void
  // Contenido de la imagen cuadrada (foto o ícono placeholder).
  imagen: React.ReactNode
  // Insignia arriba a la izquierda (DESCONTINUADO / AGOTADO).
  insignia?: React.ReactNode
  // Acción arriba a la derecha (lápiz de editar en Granja).
  esquina?: React.ReactNode
  opaca?: boolean
  testID?: string
  children: React.ReactNode
}

// Tarjeta del grid de Productos (Calzado y Granja): imagen cuadrada sobre
// superficie2 y debajo el cuerpo de texto (rediseño §2 y §5).
export function TarjetaGrid({ ancho, accessibilityLabel, onPress, imagen, insignia, esquina, opaca, testID, children }: Props) {
  const { paleta } = useTema()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({ width: ancho, backgroundColor: paleta.fondo, opacity: pressed ? 0.85 : 1 })}
    >
      <View
        style={{
          width: ancho,
          height: ancho,
          backgroundColor: paleta.superficie2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <View style={{ opacity: opaca ? 0.5 : 1, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          {imagen}
        </View>
        {insignia ? <View style={{ position: 'absolute', top: espacio.s, left: espacio.s }}>{insignia}</View> : null}
        {esquina ? <View style={{ position: 'absolute', top: espacio.s, right: espacio.s }}>{esquina}</View> : null}
      </View>
      <View style={{ gap: 2, paddingHorizontal: espacio.m, paddingTop: espacio.m, paddingBottom: espacio.l }}>
        {children}
      </View>
    </Pressable>
  )
}
