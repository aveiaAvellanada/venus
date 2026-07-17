import React, { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import { Boton } from './Boton'
import { Chip } from './Chip'
import { SliderPrecio } from './SliderPrecio'

interface Props {
  visible: boolean
  marcas: string[]
  marcasSeleccionadas: string[]
  precioMinAbsoluto: number
  precioMaxAbsoluto: number
  precioSeleccionado: [number, number]
  onAplicar: (marcas: string[], precio: [number, number]) => void
  onCerrar: () => void
}

export function HojaFiltrosProductos({
  visible, marcas, marcasSeleccionadas, precioMinAbsoluto, precioMaxAbsoluto,
  precioSeleccionado, onAplicar, onCerrar,
}: Props) {
  const { paleta } = useTema()
  const [marcasElegidas, setMarcasElegidas] = useState<string[]>(marcasSeleccionadas)
  const [precioMax, setPrecioMax] = useState<number>(precioSeleccionado[1])

  // Reseed local state from props each time the sheet opens: la hoja está
  // montada siempre, así que su estado inicial se siembra antes de que
  // carguen los datos (precioMaxAbsoluto=0). Sin esto, precioMax queda
  // pegado en 0 y "Aplicar" vaciaría la lista.
  useEffect(() => {
    if (visible) {
      setMarcasElegidas(marcasSeleccionadas)
      setPrecioMax(precioSeleccionado[1])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const toggleMarca = (m: string) => {
    setMarcasElegidas((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }} onPress={onCerrar}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: paleta.fondo,
            borderTopLeftRadius: radio.xl,
            borderTopRightRadius: radio.xl,
            padding: espacio.xxl,
            gap: espacio.l,
            maxHeight: '80%',
          }}
        >
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: radio.full, backgroundColor: paleta.bordeFuerte }} />
          <Text style={[tipografia.h2, { color: paleta.texto }]}>Filtros</Text>

          <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Marca</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espacio.s }}>
            {marcas.map((m) => (
              <Chip key={m} etiqueta={m} activo={marcasElegidas.includes(m)} onPress={() => toggleMarca(m)} />
            ))}
          </ScrollView>

          <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Precio máximo</Text>
          <SliderPrecio
            valor={precioMax}
            minimo={precioMinAbsoluto}
            maximo={precioMaxAbsoluto}
            onCambio={setPrecioMax}
          />

          <Boton titulo="Aplicar filtros" onPress={() => onAplicar(marcasElegidas, [precioMinAbsoluto, precioMax])} />
          <Boton
            titulo="Limpiar filtros"
            variante="fantasma"
            tamano="md"
            onPress={() => {
              setMarcasElegidas([])
              setPrecioMax(precioMaxAbsoluto)
              onAplicar([], [precioMinAbsoluto, precioMaxAbsoluto])
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}
