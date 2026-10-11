import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTema } from '../../lib/tema'

// Raya diagonal "/" sobre un color o una talla sin stock (rediseño Productos §4).
// Se mide a sí misma: va como hijo absoluto de un contenedor con overflow oculto.
export function RayaDiagonal({ grosor = 2 }: { grosor?: number }) {
  const { paleta } = useTema()
  const [tam, setTam] = useState({ ancho: 0, alto: 0 })
  const largo = Math.hypot(tam.ancho, tam.alto)
  const angulo = Math.atan2(tam.alto, tam.ancho)

  return (
    <View
      testID="raya-diagonal"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setTam({ ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height })}
    >
      {largo > 0 ? (
        <View
          style={{
            position: 'absolute',
            width: largo,
            height: grosor,
            left: (tam.ancho - largo) / 2,
            top: (tam.alto - grosor) / 2,
            backgroundColor: paleta.texto,
            transform: [{ rotate: `${-angulo}rad` }],
          }}
        />
      ) : null}
    </View>
  )
}
