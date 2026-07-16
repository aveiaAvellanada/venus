import React, { useState } from 'react'
import { Text, TextInput, TextInputProps, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../lib/theme'

interface Props extends TextInputProps {
  etiqueta?: string
  error?: string
  gigante?: boolean
}

export function CampoTexto({ etiqueta, error, gigante = false, onFocus, onBlur, ...resto }: Props) {
  const { paleta } = useTema()
  const [enfocado, setEnfocado] = useState(false)

  const colorBorde = error ? paleta.peligro : enfocado ? paleta.primario : paleta.bordeFuerte

  return (
    <View style={{ gap: 6 }}>
      {etiqueta ? <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>{etiqueta}</Text> : null}
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
          gigante ? [tipografia.display, tabular, { textAlign: 'center' as const }] : tipografia.cuerpo,
          {
            height: gigante ? 64 : 52,
            borderWidth: 2,
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
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[tipografia.caption, { color: paleta.peligroTexto }]}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}
