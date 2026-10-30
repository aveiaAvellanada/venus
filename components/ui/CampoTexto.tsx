import React, { useState } from 'react'
import { Text, TextInput, TextInputProps, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tabular, tipografia, tipografiaCompacta } from '../../lib/theme'
import { conPuntosDeMiles, soloDigitos } from '../../shared/formato'

interface Props extends TextInputProps {
  etiqueta?: string
  error?: string
  gigante?: boolean
  // Más bajo y con letra de 14 (carrito y cobro, rediseño del carrito B5).
  compacto?: boolean
  // Pesos: se ve con punto de miles ("1.500.000") y onChangeText recibe solo
  // los dígitos ("1500000"), así se ve claro cuántos ceros lleva.
  dinero?: boolean
}

export function CampoTexto({ etiqueta, error, gigante = false, compacto = false, dinero = false, onFocus, onBlur, ...resto }: Props) {
  const { paleta } = useTema()
  const [enfocado, setEnfocado] = useState(false)

  const colorBorde = error ? paleta.peligro : enfocado ? paleta.primario : paleta.bordeFuerte

  return (
    <View style={{ gap: 6 }}>
      {etiqueta ? (
        <Text style={[compacto ? tipografiaCompacta.etiqueta : tipografia.etiqueta, { color: paleta.texto2 }]}>{etiqueta}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={paleta.textoDeshabilitado}
        onFocus={(e) => {
          setEnfocado(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setEnfocado(false)
          onBlur?.(e)
        }}
        style={[
          gigante
            ? [tipografia.display, tabular, { textAlign: 'center' as const }]
            : compacto
              ? tipografiaCompacta.input
              : tipografia.cuerpo,
          {
            height: gigante ? 64 : compacto ? 44 : 52,
            borderWidth: compacto ? 1.5 : 2,
            borderColor: colorBorde,
            borderRadius: radio.sm,
            backgroundColor: paleta.superficie,
            color: paleta.texto,
            paddingHorizontal: espacio.l,
          },
          resto.multiline
            ? {
                height: undefined,
                minHeight: 100,
                textAlignVertical: 'top' as const,
                paddingVertical: espacio.m,
              }
            : null,
        ]}
        {...resto}
        {...(dinero
          ? {
              keyboardType: 'number-pad' as const,
              value: conPuntosDeMiles(resto.value),
              onChangeText: (t: string) => resto.onChangeText?.(soloDigitos(t)),
            }
          : null)}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[tipografia.caption, { color: paleta.peligroTexto }]}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}
