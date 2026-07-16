import React from 'react'
import { Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, tabular, tipografia } from '../../lib/theme'
import { Tarjeta } from './Tarjeta'

interface Props {
  etiqueta: string
  valor: string
  sub?: string
  mini?: boolean
  icono?: React.ReactNode
}

export function TarjetaMetrica({ etiqueta, valor, sub, mini = false, icono }: Props) {
  const { paleta } = useTema()
  return (
    <Tarjeta estilo={mini ? { padding: espacio.m, flex: 1 } : undefined}>
      <View style={{ gap: espacio.xs }}>
        {icono}
        <Text style={[tipografia.micro, { color: paleta.texto3 }]}>{etiqueta}</Text>
        <Text style={[mini ? tipografia.cuerpoLg : tipografia.display, tabular, { color: paleta.texto }]}>
          {valor}
        </Text>
        {sub ? <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{sub}</Text> : null}
      </View>
    </Tarjeta>
  )
}
