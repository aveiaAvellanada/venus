import React, { useState } from 'react'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { CalendarDays } from 'lucide-react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'

const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const aFecha = (iso: string) => new Date(`${iso}T12:00:00`)
const aISO = (d: Date) => d.toLocaleDateString('en-CA')
export const fechaCorta = (iso: string) =>
  aFecha(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '')

// Fecha con el calendario nativo: se toca y se elige; nada de escribir AAAA-MM-DD.
export function CampoFecha({ etiqueta, valor, onCambio, minimo, maximo, placeholder = 'Elegir fecha', testID }: {
  etiqueta: string
  valor: string
  onCambio: (iso: string) => void
  minimo?: string
  maximo?: string
  placeholder?: string
  testID?: string
}) {
  const { paleta } = useTema()
  const [abierto, setAbierto] = useState(false)
  return (
    <View style={{ gap: 6 }}>
      <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>{etiqueta}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        testID={testID}
        onPress={() => setAbierto(true)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: espacio.s,
          minHeight: 48, paddingHorizontal: espacio.m, borderRadius: radio.sm,
          borderWidth: 1, borderColor: paleta.bordeFuerte,
          backgroundColor: pressed ? paleta.superficie2 : paleta.superficie,
        })}
      >
        <CalendarDays size={18} color={paleta.texto3} />
        <Text style={[tipografia.cuerpo, { color: valor ? paleta.texto : paleta.textoDeshabilitado, flex: 1 }]}>
          {valor ? fechaCorta(valor) : placeholder}
        </Text>
      </Pressable>
      {abierto ? (
        <DateTimePicker
          value={valor ? aFecha(valor) : maximo ? aFecha(maximo) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimo ? aFecha(minimo) : undefined}
          maximumDate={maximo ? aFecha(maximo) : undefined}
          onChange={(evento, fecha) => {
            setAbierto(false)
            if (evento.type === 'set' && fecha) onCambio(aISO(fecha))
          }}
        />
      ) : null}
    </View>
  )
}

// Chips con lo que ya existe (referencias, marcas, colores) que coinciden con
// lo escrito. Tocar uno lo usa; si no está, se deja lo que se escribió (nuevo).
export function Sugerencias({ opciones, texto, onElegir, maximo = 10, testID }: {
  opciones: string[]
  texto: string
  onElegir: (valor: string) => void
  maximo?: number
  testID?: string
}) {
  const { paleta } = useTema()
  const buscado = plano(texto)
  const visibles = opciones
    .filter((o) => plano(o) !== buscado && (!buscado || plano(o).includes(buscado)))
    .slice(0, maximo)
  if (!visibles.length) return null
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={{ gap: espacio.s, paddingVertical: 2 }}
      testID={testID}
    >
      {visibles.map((o) => (
        <Pressable
          key={o}
          accessibilityRole="button"
          accessibilityLabel={`Usar ${o}`}
          onPress={() => onElegir(o)}
          style={({ pressed }) => ({
            paddingVertical: 6, paddingHorizontal: 12, borderRadius: radio.full,
            borderWidth: 1, borderColor: paleta.borde,
            backgroundColor: pressed ? paleta.superficie2 : paleta.superficie,
          })}
        >
          <Text style={[tipografia.caption, { color: paleta.texto2 }]}>{o}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

// Título de sección dentro de una tarjeta o una hoja.
export function Seccion({ titulo, accion, children }: { titulo: string; accion?: React.ReactNode; children: React.ReactNode }) {
  const { paleta } = useTema()
  return (
    <View style={{ gap: espacio.m }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[tipografia.micro, { color: paleta.texto3 }]}>{titulo}</Text>
        {accion}
      </View>
      {children}
    </View>
  )
}
