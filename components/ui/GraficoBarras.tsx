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
import { etiquetaBucket } from '../../lib/dashboard'

interface Props {
  datos: VentasBucket[]
  granularidad: Granularidad
}

const ALTO = 110

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// Receta 6: la barra crece con scaleY (origin bottom), stagger 30ms.
function Barra({
  proporcion,
  destacada,
  indice,
}: {
  proporcion: number
  destacada: boolean
  indice: number
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
          height: Math.max(ALTO * proporcion, proporcion > 0 ? 4 : 2),
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          backgroundColor: destacada ? paleta.primario : paleta.primarioSoft,
          borderWidth: destacada ? 0 : 1,
          borderBottomWidth: 0,
          borderColor: paleta.borde,
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

  const max = datos.reduce((m, d) => Math.max(m, d.total), 0)

  if (datos.length === 0 || max <= 0) {
    return (
      <View style={{ height: ALTO, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[tipografia.cuerpo, { color: paleta.texto3 }]}>Sin ventas en este período</Text>
      </View>
    )
  }

  // Con muchos buckets (mes = 30), etiquetar solo cada n para no amontonar.
  const salto = datos.length > 8 ? Math.ceil(datos.length / 6) : 1

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
              {`${etiquetaBucket(datos[seleccion].inicio, granularidad)} · `}
              <Text style={[tipografia.caption, { color: paleta.fondo, fontVariant: ['tabular-nums'] }]}>
                {formatear(datos[seleccion].total)}
              </Text>
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: ALTO, gap: 4 }}>
        {datos.map((d, i) => (
          <Pressable
            key={d.inicio}
            accessibilityRole="button"
            accessibilityLabel={`${etiquetaBucket(d.inicio, granularidad)}: ${formatear(d.total)}`}
            onPress={() => setSeleccion(seleccion === i ? null : i)}
            style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
          >
            <Barra proporcion={max > 0 ? d.total / max : 0} destacada={d.total === max} indice={i} />
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 4 }}>
        {datos.map((d, i) => (
          <Text
            key={d.inicio}
            numberOfLines={1}
            style={[tipografia.micro, { flex: 1, textAlign: 'center', color: paleta.texto3, fontSize: 9 }]}
          >
            {i % salto === 0 ? etiquetaBucket(d.inicio, granularidad) : ''}
          </Text>
        ))}
      </View>
    </View>
  )
}
