import React from 'react'
import { View } from 'react-native'
import { useTema } from '../../lib/tema'
import { radio } from '../../lib/theme'

export type TonoIcono = 'primario' | 'exito' | 'peligro' | 'acento'

interface Props {
  tono?: TonoIcono
  tamano?: number
  children: React.ReactElement<{ color?: string; size?: number }>
}

// Contenedor soft que reemplaza la calidez de los emojis (spec §4).
export function CirculoIcono({ tono = 'primario', tamano = 44, children }: Props) {
  const { paleta } = useTema()
  const colores = {
    primario: { fondo: paleta.primarioSoft, icono: paleta.primario },
    exito: { fondo: paleta.exitoSoft, icono: paleta.exito },
    peligro: { fondo: paleta.peligroSoft, icono: paleta.peligro },
    acento: { fondo: paleta.acentoSoft, icono: paleta.acento },
  }[tono]

  return (
    <View
      style={{
        width: tamano,
        height: tamano,
        borderRadius: radio.full,
        backgroundColor: colores.fondo,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {React.cloneElement(children, { color: colores.icono, size: Math.round(tamano * 0.48) })}
    </View>
  )
}
