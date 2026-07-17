import React, { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import type { LucideIcon } from 'lucide-react-native'
import { ArrowLeftRight, CircleUserRound, Footprints, LayoutGrid, ShoppingCart } from 'lucide-react-native'
import { useCarrito } from '../../lib/carrito-contexto'
import { useTema } from '../../lib/tema'
import { motion, radio, tipografia } from '../../lib/theme'
import { Presionable } from './Presionable'

// Spec §6.1: 5 slots — Menú · Movimientos · [+] · Productos · Perfil.
const TABS: Record<string, { Icono: LucideIcon; label: string }> = {
  index: { Icono: LayoutGrid, label: 'Menú' },
  movimientos: { Icono: ArrowLeftRight, label: 'Movimientos' },
  productos: { Icono: Footprints, label: 'Productos' },
  perfil: { Icono: CircleUserRound, label: 'Perfil' },
}

function Tab({
  Icono,
  label,
  activo,
  onPress,
}: {
  Icono: LucideIcon
  label: string
  activo: boolean
  onPress: () => void
}) {
  const { paleta } = useTema()
  const escala = useSharedValue(1)

  useEffect(() => {
    if (activo) {
      escala.value = withSequence(
        withSpring(1.12, motion.springPress),
        withSpring(1, motion.springPress)
      )
    }
  }, [activo, escala])

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }))
  const color = activo ? paleta.primario : paleta.texto3

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: 64 }}
    >
      <Animated.View style={animado}>
        <Icono size={24} color={color} strokeWidth={activo ? 2.4 : 2} />
      </Animated.View>
      <Text
        numberOfLines={1}
        style={[tipografia.micro, { color, fontSize: 8.5, letterSpacing: 0.3, lineHeight: 11 }]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { paleta } = useTema()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { items } = useCarrito()
  const cantidadCarrito = items.reduce((s, i) => s + i.cantidad, 0)

  const irA = (name: string, key: string, enfocado: boolean) => {
    const evento = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true })
    if (!enfocado && !evento.defaultPrevented) navigation.navigate(name)
  }

  const abrirCarrito = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    router.push('/ventas/nueva')
  }

  const renderTab = (i: number) => {
    const ruta = state.routes[i]
    const config = TABS[ruta.name]
    if (!config) return null
    return (
      <Tab
        key={ruta.key}
        Icono={config.Icono}
        label={config.label}
        activo={state.index === i}
        onPress={() => irA(ruta.name, ruta.key, state.index === i)}
      />
    )
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: paleta.fondo,
        borderTopWidth: 1,
        borderTopColor: paleta.borde,
        paddingBottom: insets.bottom,
      }}
    >
      {renderTab(0)}
      {renderTab(1)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Presionable
          escala={0.92}
          accessibilityRole="button"
          accessibilityLabel="Carrito"
          onPress={abrirCarrito}
          style={{
            marginTop: -24,
            width: 60,
            height: 60,
            borderRadius: radio.full,
          }}
        >
          <LinearGradient
            colors={paleta.gradienteHero}
            style={{
              width: 60,
              height: 60,
              borderRadius: radio.full,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingCart size={26} color={paleta.sobrePrimario} strokeWidth={2.2} />
          </LinearGradient>
          {cantidadCarrito > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 20,
                height: 20,
                borderRadius: radio.full,
                backgroundColor: paleta.peligro,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
                borderWidth: 2,
                borderColor: paleta.fondo,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                {cantidadCarrito > 9 ? '9+' : cantidadCarrito}
              </Text>
            </View>
          ) : null}
        </Presionable>
      </View>
      {renderTab(2)}
      {renderTab(3)}
    </View>
  )
}
