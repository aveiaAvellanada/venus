import React from 'react'
import { Text, View } from 'react-native'
import Slider from '@react-native-community/slider'
import { useTema } from '../../lib/tema'
import { espacio, tabular, tipografia } from '../../lib/theme'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

interface Props {
  valor: number
  minimo: number
  maximo: number
  onCambio: (valor: number) => void
  paso?: number
}

// Slider de precio para regateo: entre precio_minimo y precio_maximo, en múltiplos de $1.000.
export function SliderPrecio({ valor, minimo, maximo, onCambio, paso = 1000 }: Props) {
  const { paleta } = useTema()
  const bajoMinimo = valor < minimo

  return (
    <View style={{ gap: espacio.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{pesos(minimo)}</Text>
        <Text
          style={[
            tipografia.h3,
            tabular,
            { color: bajoMinimo ? paleta.peligroTexto : paleta.texto },
          ]}
        >
          {pesos(valor)}
        </Text>
        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{pesos(maximo)}</Text>
      </View>
      <Slider
        minimumValue={minimo}
        maximumValue={Math.max(maximo, minimo + paso)}
        step={paso}
        value={valor}
        onValueChange={onCambio}
        minimumTrackTintColor={paleta.primario}
        maximumTrackTintColor={paleta.borde}
        thumbTintColor={paleta.primario}
        accessibilityLabel="Precio de venta"
      />
    </View>
  )
}
