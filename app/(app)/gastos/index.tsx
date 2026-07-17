import React, { useState, useEffect } from 'react'
import { View, Text, FlatList, Modal, ActivityIndicator, Image, ScrollView, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { ArrowLeft, Camera, Plus, Receipt, X } from 'lucide-react-native'
import { obtenerGastosVariables, guardarGastoVariable } from '../../../lib/gastos'
import { useAuth } from '../../../lib/auth'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { Database } from '../../../lib/database.types'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { Badge, Boton, CampoTexto, ControlSegmentado, EstadoVacio, Presionable, Tarjeta, useToast } from '../../../components/ui'

type GastoVariableRow = Database['public']['Tables']['gastos_variables']['Row']

// Encabezado a nivel de módulo: no se remonta en cada render (Regla 2).
function Encabezado({ paleta, onVolver }: { paleta: Paleta; onVolver: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        paddingHorizontal: espacio.xl,
        paddingTop: 56,
        paddingBottom: espacio.m,
      }}
    >
      <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={onVolver} hitSlop={12}>
        <ArrowLeft size={24} color={paleta.texto} />
      </Presionable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Gastos Variables</Text>
    </View>
  )
}

export default function GastosVariablesScreen() {
  const router = useRouter()
  const { session } = useAuth()
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const paddingInferior100 = usePaddingInferior(100)
  const paddingInferiorXxxl = usePaddingInferior(espacio.xxxl)
  const bottomFab = usePaddingInferior(espacio.xl)

  const [gastos, setGastos] = useState<GastoVariableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form
  const [categoria, setCategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [fotoUri, setFotoUri] = useState<string | null>(null)

  const loadData = async () => {
    try {
      const now = new Date()
      const data = await obtenerGastosVariables(now.getMonth() + 1, now.getFullYear())
      setGastos(data)
    } catch (error: any) {
      mostrar(error.message, 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    })

    if (!result.canceled) {
      setFotoUri(result.assets[0].uri)
    }
  }

  const handleSave = async () => {
    if (!descripcion || !monto || !categoria) {
      mostrar('Por favor llena todos los campos obligatorios', 'error')
      return
    }

    setSaving(true)
    try {
      await guardarGastoVariable(
        {
          categoria,
          descripcion,
          monto: parseFloat(monto),
          fecha: new Date().toISOString(),
        },
        fotoUri || undefined
      )

      mostrar('Gasto guardado correctamente')
      setModalVisible(false)
      resetForm()
      loadData()
    } catch (error: any) {
      mostrar(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setCategoria('')
    setDescripcion('')
    setMonto('')
    setFotoUri(null)
  }

  const renderItem = ({ item }: { item: GastoVariableRow }) => (
    <Tarjeta estilo={{ marginBottom: espacio.m }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.s }}>
        <Badge texto={item.categoria} />
        <Text style={[tipografia.h3, tabular, { color: paleta.texto }]}>${item.monto.toLocaleString()}</Text>
      </View>
      <Text style={[tipografia.cuerpo, { color: paleta.texto2, marginBottom: espacio.s }]}>{item.descripcion}</Text>
      <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{new Date(item.fecha).toLocaleDateString()}</Text>
    </Tarjeta>
  )

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />

      <View style={{ paddingHorizontal: espacio.xl, marginBottom: espacio.m }}>
        <ControlSegmentado
          opciones={['Variables', 'Fijos']}
          indice={0}
          onCambio={(i) => {
            if (i === 1) router.replace('/gastos/fijos')
          }}
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      ) : (
        <FlatList
          data={gastos}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: espacio.xl, paddingBottom: paddingInferior100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={paleta.primario} />}
          ListEmptyComponent={<EstadoVacio icono={<Receipt />} titulo="No hay gastos variables este mes" />}
        />
      )}

      <Presionable
        accessibilityRole="button"
        accessibilityLabel="Agregar gasto variable"
        onPress={() => setModalVisible(true)}
        hitSlop={8}
        style={{
          position: 'absolute',
          bottom: bottomFab,
          right: espacio.xl,
          width: 56,
          height: 56,
          borderRadius: radio.full,
          backgroundColor: paleta.primario,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: paleta.sombraFab,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Plus size={28} color={paleta.sobrePrimario} />
      </Presionable>

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: paleta.fondo }}
          contentContainerStyle={{ padding: espacio.xl, paddingBottom: paddingInferiorXxxl }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: espacio.xxl,
              marginTop: espacio.s,
            }}
          >
            <Text style={[tipografia.h1, { color: paleta.texto }]}>Nuevo Gasto Variable</Text>
            <Presionable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setModalVisible(false)} hitSlop={12}>
              <X size={28} color={paleta.texto2} />
            </Presionable>
          </View>

          <View style={{ gap: espacio.l }}>
            <CampoTexto
              etiqueta="Categoría (ej: Fletes, Insumos)"
              value={categoria}
              onChangeText={setCategoria}
              placeholder="Escribe la categoría"
            />

            <CampoTexto
              etiqueta="Descripción"
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="¿Qué compraste?"
              multiline
            />

            <CampoTexto
              etiqueta="Monto"
              value={monto}
              onChangeText={setMonto}
              placeholder="0.00"
              keyboardType="number-pad"
            />

            <View>
              <Text style={[tipografia.etiqueta, { color: paleta.texto2, marginBottom: espacio.s }]}>
                Foto de Factura (Opcional)
              </Text>
              <Presionable
                accessibilityRole="button"
                accessibilityLabel={fotoUri ? 'Cambiar foto de factura' : 'Tomar foto de factura'}
                onPress={pickImage}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: espacio.s,
                  backgroundColor: paleta.primarioSoft,
                  padding: espacio.l,
                  borderRadius: radio.sm,
                  borderWidth: 1,
                  borderColor: paleta.primario,
                  borderStyle: 'dashed',
                }}
              >
                <Camera size={22} color={paleta.primario} />
                <Text style={[tipografia.cuerpoLg, { color: paleta.primario }]}>
                  {fotoUri ? 'Cambiar Foto' : 'Tomar Foto'}
                </Text>
              </Presionable>
              {fotoUri && (
                <Image
                  source={{ uri: fotoUri }}
                  style={{ width: '100%', height: 200, borderRadius: radio.sm, marginTop: espacio.m }}
                />
              )}
            </View>

            <Boton titulo="Guardar Gasto" onPress={handleSave} cargando={saving} deshabilitado={saving} />
          </View>
        </ScrollView>
      </Modal>
    </View>
  )
}
