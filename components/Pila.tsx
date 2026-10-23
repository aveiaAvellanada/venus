import React from 'react'
import JSStack, { TransitionPresets, type StackNavigationOptions } from 'expo-router/js-stack'
import { useTema } from '../lib/tema'

// Pila de pantallas con "swipe atrás": deslizar desde el borde izquierdo
// devuelve a la pantalla anterior y la pantalla sigue al dedo (como en iOS).
// La pila nativa de Android no tiene ese gesto; esta es la de JavaScript de
// react-navigation, incluida en expo-router. Se usa en vez de <Stack>.
const OPCIONES: StackNavigationOptions = {
  headerShown: false,
  gestureEnabled: true,
  // Zona del borde izquierdo donde empieza el gesto: 30 px, menos que el
  // margen de las pantallas (20) + el de las tarjetas, para no chocar con el
  // deslizador de precio del carrito ni con listas horizontales.
  gestureResponseDistance: 30,
  ...TransitionPresets.SlideFromRightIOS,
}

// Para las pantallas que se abren como hoja desde abajo: se cierran
// deslizando hacia abajo.
export const OPCIONES_MODAL: StackNavigationOptions = {
  presentation: 'modal',
  gestureEnabled: true,
  ...TransitionPresets.ModalSlideFromBottomIOS,
}

type Props = Omit<React.ComponentProps<typeof JSStack>, 'screenOptions'> & {
  screenOptions?: StackNavigationOptions
}

function PilaBase({ screenOptions, ...props }: Props) {
  const { paleta } = useTema()
  return (
    <JSStack
      {...props}
      screenOptions={{ ...OPCIONES, cardStyle: { backgroundColor: paleta.fondo }, ...screenOptions }}
    />
  )
}

export const Pila = Object.assign(PilaBase, { Screen: JSStack.Screen })
