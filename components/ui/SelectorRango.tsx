import React, { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { CalendarDays } from 'lucide-react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import { Boton } from './Boton'
import { Chip } from './Chip'

interface Props {
  activo: boolean
  onAplicar: (desde: string, hasta: string) => void
}

const aISO = (d: Date) => d.toLocaleDateString('en-CA')
const aTexto = (d: Date) =>
  d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

// Chip "Rango ▾" que abre una hoja con calendario nativo para elegir
// un período a la medida (redisign.md Parte B/C).
export function SelectorRango({ activo, onAplicar }: Props) {
  const { paleta } = useTema()
  const [abierto, setAbierto] = useState(false)
  const [desde, setDesde] = useState<Date>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return d
  })
  const [hasta, setHasta] = useState<Date>(new Date())
  const [editando, setEditando] = useState<'desde' | 'hasta' | null>(null)

  const invalido = desde.getTime() > hasta.getTime()

  const FilaFecha = ({ etiqueta, valor, onPress }: { etiqueta: string; valor: Date; onPress: () => void }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        paddingVertical: espacio.m,
        paddingHorizontal: espacio.l,
        borderRadius: radio.sm,
        borderWidth: 1,
        borderColor: paleta.bordeFuerte,
        backgroundColor: pressed ? paleta.superficie2 : paleta.superficie,
      })}
    >
      <CalendarDays size={18} color={paleta.texto3} />
      <Text style={[tipografia.etiqueta, { color: paleta.texto3, width: 48 }]}>{etiqueta}</Text>
      <Text style={[tipografia.cuerpo, { color: paleta.texto, flex: 1 }]}>{aTexto(valor)}</Text>
    </Pressable>
  )

  return (
    <>
      <Chip etiqueta="Rango ▾" activo={activo} onPress={() => setAbierto(true)} />

      <Modal visible={abierto} transparent animationType="slide" onRequestClose={() => setAbierto(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }}
          onPress={() => setAbierto(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: paleta.fondo,
              borderTopLeftRadius: radio.xl,
              borderTopRightRadius: radio.xl,
              padding: espacio.xxl,
              gap: espacio.m,
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 36,
                height: 4,
                borderRadius: radio.full,
                backgroundColor: paleta.bordeFuerte,
              }}
            />
            <Text style={[tipografia.h2, { color: paleta.texto }]}>Elegir período</Text>

            <FilaFecha etiqueta="Desde" valor={desde} onPress={() => setEditando('desde')} />
            <FilaFecha etiqueta="Hasta" valor={hasta} onPress={() => setEditando('hasta')} />

            {invalido ? (
              <Text style={[tipografia.caption, { color: paleta.peligroTexto }]}>
                La fecha inicial no puede ser después de la final.
              </Text>
            ) : null}

            <Boton
              titulo="Aplicar"
              deshabilitado={invalido}
              onPress={() => {
                setAbierto(false)
                onAplicar(aISO(desde), aISO(hasta))
              }}
            />
            <Boton titulo="Cancelar" variante="fantasma" tamano="md" onPress={() => setAbierto(false)} />
          </Pressable>
        </Pressable>

        {editando ? (
          <DateTimePicker
            value={editando === 'desde' ? desde : hasta}
            mode="date"
            onChange={(_evento, fecha) => {
              const cual = editando
              setEditando(null)
              if (!fecha) return
              if (cual === 'desde') setDesde(fecha)
              else setHasta(fecha)
            }}
          />
        ) : null}
      </Modal>
    </>
  )
}
