import React, { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Delete } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useTema } from '../../lib/tema'
import { motion, radio, tipografia } from '../../lib/theme'

interface Props {
  valor: string
  onDigito: (digito: string) => void
  onBorrar: () => void
  error?: boolean
  deshabilitado?: boolean
}

// Receta 9: el punto hace pop al llenarse; error = shake + puntos en peligro.
function Punto({ lleno, error }: { lleno: boolean; error: boolean }) {
  const { paleta } = useTema()
  const escala = useSharedValue(1)
  const reducido = useReducedMotion()

  useEffect(() => {
    if (lleno && !reducido) {
      escala.value = withSequence(
        withTiming(1.25, { duration: 60 }),
        withTiming(1, { duration: 60 })
      )
    }
  }, [lleno, escala, reducido])

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }))
  const color = error ? paleta.peligro : paleta.primario

  return (
    <Animated.View
      testID={lleno ? 'pin-punto-lleno' : 'pin-punto-vacio'}
      style={[
        {
          width: 16,
          height: 16,
          borderRadius: radio.full,
          borderWidth: 2,
          borderColor: lleno ? color : paleta.bordeFuerte,
          backgroundColor: lleno ? color : 'transparent',
        },
        animado,
      ]}
    />
  )
}

function Tecla({
  etiqueta,
  onPress,
  deshabilitado,
  children,
}: {
  etiqueta: string
  onPress: () => void
  deshabilitado: boolean
  children: React.ReactNode
}) {
  const { paleta } = useTema()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={deshabilitado ? undefined : onPress}
      style={({ pressed }) => ({
        width: 72,
        height: 72,
        borderRadius: radio.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? paleta.primarioSoft : 'transparent',
        transform: [{ scale: pressed ? 0.95 : 1 }],
        opacity: deshabilitado ? 0.45 : 1,
      })}
    >
      {children}
    </Pressable>
  )
}

const FILAS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
]

export function TecladoPin({ valor, onDigito, onBorrar, error = false, deshabilitado = false }: Props) {
  const { paleta } = useTema()
  const desplazamiento = useSharedValue(0)
  const reducido = useReducedMotion()

  useEffect(() => {
    if (!error) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    if (reducido) return
    desplazamiento.value = withSequence(
      withSpring(-8, motion.springPress),
      withSpring(8, motion.springPress),
      withSpring(-8, motion.springPress),
      withSpring(0, motion.springPress)
    )
  }, [error, desplazamiento, reducido])

  const estiloPuntos = useAnimatedStyle(() => ({
    transform: [{ translateX: desplazamiento.value }],
  }))

  return (
    <View style={{ alignItems: 'center', gap: 28 }}>
      <Animated.View style={[{ flexDirection: 'row', gap: 14 }, estiloPuntos]}>
        {[0, 1, 2, 3].map((i) => (
          <Punto key={i} lleno={i < valor.length} error={error} />
        ))}
      </Animated.View>

      <View style={{ gap: 6 }}>
        {FILAS.map((fila) => (
          <View key={fila[0]} style={{ flexDirection: 'row', gap: 14 }}>
            {fila.map((d) => (
              <Tecla key={d} etiqueta={d} deshabilitado={deshabilitado} onPress={() => onDigito(d)}>
                <Text style={[tipografia.display, { color: paleta.texto, fontSize: 26, lineHeight: 32 }]}>
                  {d}
                </Text>
              </Tecla>
            ))}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ width: 72, height: 72 }} />
          <Tecla etiqueta="0" deshabilitado={deshabilitado} onPress={() => onDigito('0')}>
            <Text style={[tipografia.display, { color: paleta.texto, fontSize: 26, lineHeight: 32 }]}>
              0
            </Text>
          </Tecla>
          <Tecla etiqueta="Borrar" deshabilitado={deshabilitado} onPress={onBorrar}>
            <Delete size={24} color={paleta.texto2} />
          </Tecla>
        </View>
      </View>
    </View>
  )
}
