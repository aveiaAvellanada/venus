import React, { useEffect, useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import type { ProductoVarios } from '../../lib/inventario'
import { Boton } from './Boton'
import { CampoTexto } from './CampoTexto'

interface Props {
  visible: boolean
  producto: ProductoVarios | null
  onCerrar: () => void
  onAgregar: (cantidad: number, precio: number) => void
  onCompraRapida: (cantidad: number, precio: number) => void
}

// Hoja modal para vender Granja: sin stock ni precio guardado, se
// definen ambos en el momento de la venta (PRD §Granja).
export function HojaVenderGranja({ visible, producto, onCerrar, onAgregar, onCompraRapida }: Props) {
  const { paleta } = useTema()
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
      <Pressable style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }} onPress={onCerrar}>
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
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: radio.full, backgroundColor: paleta.bordeFuerte }} />
          <Text style={[tipografia.h2, { color: paleta.texto }]}>{producto.nombre}</Text>

          <CampoTexto
            etiqueta={`Cantidad (${producto.unidad_medida})`}
            keyboardType="decimal-pad"
            value={cantidad}
            onChangeText={setCantidad}
            placeholder="1"
          />
          <CampoTexto
            etiqueta="Precio"
            keyboardType="number-pad"
            value={precio}
            onChangeText={(t) => setPrecio(t.replace(/[^0-9]/g, ''))}
            placeholder="0"
          />

          <Boton
            titulo="Agregar a carrito"
            deshabilitado={!puedeVender}
            onPress={() => onAgregar(cantidadNum, precioNum)}
          />
          <Boton
            titulo="Compra rápida"
            variante="secundario"
            deshabilitado={!puedeVender}
            onPress={() => onCompraRapida(cantidadNum, precioNum)}
          />
          <Boton titulo="Cancelar" variante="fantasma" tamano="md" onPress={onCerrar} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}
