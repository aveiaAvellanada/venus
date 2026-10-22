import React, { useEffect, useRef, type ReactNode } from 'react'
import {
  Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, View,
  type RefreshControlProps, type StyleProp, type ViewStyle,
} from 'react-native'
import { useTema } from '../../lib/tema'

interface Props {
  children: ReactNode
  // Fuera del scroll, arriba (encabezado de la pantalla).
  header?: ReactNode
  // Fuera del scroll, abajo (barra de acción fija); sube con el teclado.
  footer?: ReactNode
  // Hermanos del scroll que no ocupan espacio (modales, overlays).
  overlay?: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
  refreshControl?: React.ReactElement<RefreshControlProps>
}

// Contenedor de pantallas con campos de texto: al abrirse el teclado el contenido
// se encoge (nunca queda tapado) y el campo enfocado se desplaza a la vista.
// `padding` en ambas plataformas: en Android con borde a borde `height` no
// recoloca el pie fijo y `adjustResize` ya no actúa.
export function ScreenWrapper({ children, header, footer, overlay, contentContainerStyle, refreshControl }: Props) {
  const { paleta } = useTema()
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    const evento = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const sub = Keyboard.addListener(evento, () => {
      // Espera al reacomodo del contenedor para medir con el alto ya reducido.
      setTimeout(() => {
        try {
          const campo = TextInput.State.currentlyFocusedInput?.()
          const interior = (scrollRef.current as unknown as { getInnerViewRef?: () => unknown } | null)?.getInnerViewRef?.()
          if (!campo || !interior) return
          ;(campo as unknown as {
            measureLayout: (
              rel: unknown, ok: (x: number, y: number, w: number, h: number) => void, fail: () => void,
            ) => void
          }).measureLayout(interior, (_x, y) => {
            scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true })
          }, () => {})
        } catch {
          // sin medir: queda el desplazamiento nativo del sistema
        }
      }, 120)
    })
    return () => sub.remove()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      {header}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
      {overlay}
    </View>
  )
}
