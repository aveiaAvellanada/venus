import React, { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter, type Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated'
import type { LucideIcon } from 'lucide-react-native'
import { ArrowLeftRight, CircleUserRound, Footprints, LayoutGrid, ShoppingCart } from 'lucide-react-native'
import { useCarrito } from '../../lib/carrito-contexto'
import { useTema } from '../../lib/tema'
import { fuentes, motion, radio } from '../../lib/theme'
import { Presionable } from './Presionable'

// expo-router incluye react-navigation internamente y no exporta este tipo.
type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0]

// Spec §6.1: 5 slots — Menú · Movimientos · [+] · Productos · Perfil.
const TABS: Record<string, { Icono: LucideIcon; label: string }> = {
  index: { Icono: LayoutGrid, label: 'Menú' },
  movimientos: { Icono: ArrowLeftRight, label: 'Movimientos' },
  productos: { Icono: Footprints, label: 'Productos' },
  perfil: { Icono: CircleUserRound, label: 'Perfil' },
}

// Barra flotante sólida en forma de píldora (maqueta docs/maquetas/movimientos.html):
// separada de los bordes, pestaña activa resaltada y el carrito que sobresale.
const ALTO_BARRA = 62
const MARGEN_LATERAL = 22
const FAB = 59
const ANILLO_FAB = 4

// Distancia de la barra al borde inferior: nunca menos de 24 ni encima de la
// barra de gestos del sistema.
function useMargenInferior(): number {
  const insets = useSafeAreaInsets()
  return Math.max(24, insets.bottom + 12)
}

// Espacio que cada pestaña deja al final del scroll para que lo último no
// quede debajo de la barra flotante.
export function useEspacioTabBar(): number {
  return useMargenInferior() + ALTO_BARRA + 30
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
  const color = activo ? paleta.sobreOscura : paleta.sobreOscuraSuave

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 0,
        height: ALTO_BARRA - 10,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        borderRadius: radio.full,
        backgroundColor: activo ? paleta.veloOscura : 'transparent',
      }}
    >
      <Animated.View style={animado}>
        <Icono size={21} color={color} strokeWidth={activo ? 2.4 : 2} />
      </Animated.View>
      <Text
        numberOfLines={1}
        style={{ color, fontFamily: fuentes.negrita, fontSize: 10, lineHeight: 12, letterSpacing: -0.2 }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { paleta } = useTema()
  const margenInferior = useMargenInferior()
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
        position: 'absolute',
        left: MARGEN_LATERAL,
        right: MARGEN_LATERAL,
        bottom: margenInferior,
        height: ALTO_BARRA,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 5,
        borderRadius: radio.full,
        backgroundColor: paleta.superficieOscura,
        shadowColor: '#000000',
        shadowOpacity: 0.22,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 10 },
        elevation: 12,
      }}
    >
      {renderTab(0)}
      {renderTab(1)}
      <View style={{ width: 66, alignSelf: 'stretch', alignItems: 'center' }}>
        <Presionable
          escala={0.92}
          accessibilityRole="button"
          accessibilityLabel="Carrito"
          onPress={abrirCarrito}
          style={{
            // El anillo del color de la barra recorta el carrito sobre el contenido.
            marginTop: -24 - ANILLO_FAB,
            width: FAB + ANILLO_FAB * 2,
            height: FAB + ANILLO_FAB * 2,
            borderRadius: radio.full,
            borderWidth: ANILLO_FAB,
            borderColor: paleta.superficieOscura,
            backgroundColor: paleta.sobreOscura,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000000',
            shadowOpacity: 0.25,
            shadowRadius: 9,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          <ShoppingCart size={25} color={paleta.superficieOscura} strokeWidth={2.2} />
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
              <Text style={{ color: paleta.sobrePrimario, fontSize: 11, fontFamily: fuentes.negrita }}>
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
