import React from 'react'
import { Image, Modal, Pressable, Text, View } from 'react-native'
import { X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTema } from '../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../lib/theme'
import { Boton } from './Boton'

export interface ProductoAnadido {
  foto: string | null
  // Ícono placeholder cuando no hay foto.
  icono: React.ReactNode
  marca: string
  nombre: string
  // Talla (Calzado) o cantidad con unidad (Granja).
  detalle: string
  precio: number
}

interface Props {
  producto: ProductoAnadido | null
  onCerrar: () => void
  onSeguir: () => void
  onIrAlCarrito: () => void
}

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// Hoja "Producto añadido al carrito": la misma para Calzado y Granja (rediseño §4).
export function HojaProductoAnadido({ producto, onCerrar, onSeguir, onIrAlCarrito }: Props) {
  const { paleta } = useTema()
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={producto != null} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }} onPress={onCerrar}>
        {producto ? (
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: paleta.fondo,
              borderTopLeftRadius: radio.xl,
              borderTopRightRadius: radio.xl,
              paddingTop: espacio.m,
              paddingHorizontal: espacio.xl,
              paddingBottom: espacio.xxl + insets.bottom,
              gap: espacio.xl,
            }}
          >
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: radio.full, backgroundColor: paleta.bordeFuerte }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m }}>
              <Text style={[tipografia.h3, { color: paleta.texto, flex: 1 }]}>Producto añadido al carrito</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={12} onPress={onCerrar}>
                <X size={24} color={paleta.texto} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: espacio.l }}>
              <View
                style={{
                  width: '42%',
                  aspectRatio: 3 / 4,
                  backgroundColor: paleta.superficie2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {producto.foto ? (
                  <Image source={{ uri: producto.foto }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  producto.icono
                )}
              </View>
              <View style={{ flex: 1, gap: 6, paddingTop: espacio.xs }}>
                <Text style={[tipografia.cuerpo, { color: paleta.texto3 }]}>{producto.marca}</Text>
                <Text style={[tipografia.cuerpoLg, { color: paleta.texto, fontSize: 15, lineHeight: 20 }]} numberOfLines={2}>
                  {producto.nombre}
                </Text>
                <Text style={[tipografia.cuerpo, { color: paleta.texto3 }]}>{producto.detalle}</Text>
                <Text style={[tipografia.h2, tabular, { color: paleta.texto, marginTop: 'auto' }]}>
                  {pesos(producto.precio)}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: espacio.m }}>
              <View style={{ flex: 1 }}>
                <Boton titulo="Seguir" variante="contorno" pildora tamano="md" onPress={onSeguir} />
              </View>
              <View style={{ flex: 1 }}>
                <Boton titulo="Ir al carrito" variante="oscuro" pildora tamano="md" onPress={onIrAlCarrito} />
              </View>
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  )
}
