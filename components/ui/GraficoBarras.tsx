import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { useTema } from '../../lib/tema'
import { motion, radio, tipografia } from '../../lib/theme'
import type { Granularidad, VentasBucket } from '../../lib/dashboard'
import { etiquetaBucket, etiquetaDia } from '../../lib/dashboard'

interface Props {
  datos: VentasBucket[]
  granularidad: Granularidad
}

const ALTO = 110

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

const SEPARACION = 6

// Receta 6: la barra crece con scaleY (origin bottom), stagger 30ms.
// Barras en píldora, redondas arriba y abajo: nunca más bajas que su ancho, así
// que la más baja (o un día en cero, más tenue) se ve como un círculo.
function Barra({
  proporcion,
  destacada,
  indice,
  ancho,
}: {
  proporcion: number
  destacada: boolean
  indice: number
  ancho: number
}) {
  const { paleta } = useTema()
  const escala = useSharedValue(0)
  const reducido = useReducedMotion()

  React.useEffect(() => {
    escala.value = reducido
      ? 1
      : withDelay(
          indice * 30,
          withTiming(1, { duration: motion.lento, easing: Easing.bezier(...motion.easeEnter) })
        )
  }, [escala, indice, reducido])

  const animado = useAnimatedStyle(() => ({ transform: [{ scaleY: escala.value }] }))

  return (
    <Animated.View
      style={[
        {
          width: '100%',
          height: Math.min(ALTO, Math.max(ALTO * proporcion, ancho)),
          borderRadius: radio.full,
          backgroundColor: destacada ? paleta.primario : paleta.primarioSoft,
          borderWidth: destacada ? 0 : 1,
          borderColor: paleta.borde,
          opacity: proporcion === 0 ? 0.5 : 1,
          transformOrigin: 'bottom',
        },
        animado,
      ]}
    />
  )
}

export function GraficoBarras({ datos, granularidad }: Props) {
  const { paleta } = useTema()
  const [seleccion, setSeleccion] = useState<number | null>(null)
  const [anchoBarras, setAnchoBarras] = useState(0)

  const max = datos.reduce((m, d) => Math.max(m, d.total), 0)

  if (datos.length === 0 || max <= 0) {
    return (
      <View style={{ height: ALTO, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[tipografia.cuerpo, { color: paleta.texto3 }]}>Sin ventas en este período</Text>
      </View>
    )
  }

  const anchoColumna = Math.max(0, (anchoBarras - SEPARACION * (datos.length - 1)) / datos.length)

  // Con muchos días (un rango largo) el eje lleva el número del día, cada n
  // para no amontonar; el detalle al tocar dice el día completo.
  const muchosDias = granularidad === 'dia' && datos.length > 8
  const salto = datos.length > 8 ? Math.ceil(datos.length / 7) : 1
  const eje = (inicio: string) => (muchosDias ? String(Number(inicio.slice(8, 10))) : etiquetaBucket(inicio, granularidad))
  const detalle = (inicio: string) => (granularidad === 'dia' ? etiquetaDia(inicio) : etiquetaBucket(inicio, granularidad))

  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 28, justifyContent: 'center' }}>
        {seleccion !== null ? (
          <View
            style={{
              alignSelf: 'center',
              backgroundColor: paleta.texto,
              borderRadius: radio.full,
              paddingVertical: 4,
              paddingHorizontal: 12,
            }}
          >
            <Text style={[tipografia.caption, { color: paleta.fondo }]}>
              {`${detalle(datos[seleccion].inicio)} · `}
              <Text style={[tipografia.caption, { color: paleta.fondo, fontVariant: ['tabular-nums'] }]}>
                {formatear(datos[seleccion].total)}
              </Text>
            </Text>
          </View>
        ) : null}
      </View>

      <View
        onLayout={(e) => setAnchoBarras(e.nativeEvent.layout.width)}
        style={{ flexDirection: 'row', alignItems: 'flex-end', height: ALTO, gap: SEPARACION }}
      >
        {datos.map((d, i) => (
          <Pressable
            key={d.inicio}
            accessibilityRole="button"
            accessibilityLabel={`${detalle(d.inicio)}: ${formatear(d.total)}`}
            onPress={() => setSeleccion(seleccion === i ? null : i)}
            style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
          >
            <Barra
              proporcion={max > 0 ? d.total / max : 0}
              destacada={d.total === max}
              indice={i}
              ancho={anchoColumna}
            />
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: SEPARACION }}>
        {datos.map((d, i) => (
          <Text
            key={d.inicio}
            numberOfLines={1}
            style={[tipografia.micro, { flex: 1, textAlign: 'center', color: paleta.texto3, fontSize: muchosDias ? 10 : 9 }]}
          >
            {i % salto === 0 ? eje(d.inicio) : ''}
          </Text>
        ))}
      </View>
    </View>
  )
}
