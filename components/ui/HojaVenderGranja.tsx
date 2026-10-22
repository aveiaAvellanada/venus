import React, { useEffect, useState } from 'react'
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native'
import { X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import type { ProductoVarios } from '../../lib/inventario'
import { BarraAccionInferior } from './BarraAccionInferior'
import { CampoTexto } from './CampoTexto'

interface Props {
  visible: boolean
  producto: ProductoVarios | null
  // Ícono del producto cuando no tiene foto (huevo / paquete).
  icono: React.ReactNode
  onCerrar: () => void
  onAgregar: (cantidad: number, precio: number) => void
}

// Hoja para vender Granja con el mismo patrón del detalle de Calzado
// (rediseño §5): sin stock ni precio guardado, cantidad y precio por unidad
// se definen en el momento de la venta (PRD §Granja).
export function HojaVenderGranja({ visible, producto, icono, onCerrar, onAgregar }: Props) {
  const { paleta } = useTema()
  const insets = useSafeAreaInsets()
  const [cantidad, setCantidad] = useState('1')
  const [precio, setPrecio] = useState('')

  useEffect(() => {
    if (visible) {
      setCantidad('1')
      setPrecio('')
    }
  }, [visible])

  if (!producto) return null
  const cantidadNum = parseFloat(cantidad.replace(',', '.')) || 0
  const precioNum = Number(precio.replace(/[^0-9]/g, '')) || 0
  const puedeVender = cantidadNum > 0 && precioNum > 0

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }} onPress={onCerrar}>
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: paleta.fondo,
              borderTopLeftRadius: radio.xl,
              borderTopRightRadius: radio.xl,
              paddingTop: espacio.m,
              gap: espacio.xl,
              overflow: 'hidden',
            }}
          >
            <View style={{ paddingHorizontal: espacio.xl, gap: espacio.xl }}>
              <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: radio.full, backgroundColor: paleta.bordeFuerte }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.m }}>
                <Text style={[tipografia.h3, { color: paleta.texto, flex: 1 }]} numberOfLines={1}>
                  {producto.nombre}
                </Text>
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
                  {producto.foto_url ? (
                    <Image source={{ uri: producto.foto_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    icono
                  )}
                </View>
                <View style={{ flex: 1, gap: 6, paddingTop: espacio.xs }}>
                  <Text style={[tipografia.cuerpo, { color: paleta.texto3 }]}>Granja</Text>
                  <Text style={[tipografia.cuerpoLg, { color: paleta.texto, fontSize: 15, lineHeight: 20 }]} numberOfLines={2}>
                    {producto.nombre}
                  </Text>
                  <Text style={[tipografia.cuerpo, { color: paleta.texto3 }]}>
                    {`Por ${producto.unidad_medida} · precio al vender`}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: espacio.m }}>
                <View style={{ flex: 1 }}>
                  <CampoTexto
                    etiqueta="Cantidad"
                    keyboardType="decimal-pad"
                    value={cantidad}
                    onChangeText={setCantidad}
                    placeholder="1"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <CampoTexto
                    etiqueta={`Precio por ${producto.unidad_medida}`}
                    keyboardType="number-pad"
                    value={precio}
                    onChangeText={(t) => setPrecio(t.replace(/[^0-9]/g, ''))}
                    placeholder="$0"
                  />
                </View>
              </View>
            </View>

            <BarraAccionInferior
              titulo="Agregar al carrito"
              deshabilitado={!puedeVender}
              inferior={insets.bottom}
              onPress={() => onAgregar(cantidadNum, precioNum)}
            />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}
