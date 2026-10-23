import React, { useEffect, useRef } from 'react'
import { Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Check } from 'lucide-react-native'
import Animated, {
  Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion,
  useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated'
import { useTema } from '../../lib/tema'
import { espacio, tipografia } from '../../lib/theme'

// Sello de éxito con el verde de "caja abierta" (verdeSoft / verdeTexto):
// círculo verde con el chulo. Lo usan la animación y las pantallas de éxito.
export function SelloExito({ tamano = 132 }: { tamano?: number }) {
  const { paleta } = useTema()
  return (
    <View
      testID="sello-exito"
      style={{
        width: tamano, height: tamano, borderRadius: tamano / 2,
        backgroundColor: paleta.verdeSoft, alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Check size={tamano * 0.52} color={paleta.verdeTexto} strokeWidth={2.6} />
    </View>
  )
}

interface Props {
  visible: boolean
  mensaje?: string
  onFin: () => void
}

export function OverlayExito({ visible, mensaje, onFin }: Props) {
  const { paleta } = useTema()
  const reducido = useReducedMotion()
  const escala = useSharedValue(0.6)
  const flash = useSharedValue(0)
  const onFinRef = useRef(onFin)
  onFinRef.current = onFin

  useEffect(() => {
    if (!visible) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    if (!reducido) {
      escala.value = withSpring(1, { damping: 12, stiffness: 180 })
      flash.value = withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 250, easing: Easing.in(Easing.quad) })
      )
    } else {
      escala.value = 1
    }
    const t = setTimeout(() => onFinRef.current(), 1200)
    return () => clearTimeout(t)
  }, [visible, reducido, escala, flash])

  const estiloIcono = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }))
  const estiloFlash = useAnimatedStyle(() => ({ opacity: flash.value }))

  if (!visible) return null

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      accessibilityLiveRegion="assertive"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center', gap: espacio.l,
        backgroundColor: paleta.fondo, zIndex: 10,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: paleta.verdeSoft }, estiloFlash]}
      />
      <Animated.View style={estiloIcono}>
        <SelloExito />
      </Animated.View>
      {mensaje ? (
        <Text style={[tipografia.h2, { color: paleta.verdeTexto, textAlign: 'center' }]}>{mensaje}</Text>
      ) : null}
    </Animated.View>
  )
}
