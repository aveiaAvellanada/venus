import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Image, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Camera, Pencil, Save } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { useAuth, useRequireModulo } from '../../../../lib/auth'
import { supabase } from '../../../../lib/supabase'
import { guardarVarios } from '../../../../lib/inventario'
import { comprimirYSubirImagen } from '../../../../lib/imagenes'
import { useTema } from '../../../../lib/tema'
import { espacio, radio, tipografia } from '../../../../lib/theme'
import { Boton, CampoTexto, Presionable, Tarjeta, useToast } from '../../../../components/ui'

export default function GranjaEditorScreen() {
  const requireModulo = useRequireModulo('granja')
  const { id } = useLocalSearchParams<{ id?: string }>()
  const router = useRouter()
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const { mostrar } = useToast()

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(!!id)

  const [nombre, setNombre] = useState('')
  const [unidadMedida, setUnidadMedida] = useState('')
  const [precioSugerido, setPrecioSugerido] = useState('')
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  const esDueno = perfil?.rol === 'dueno'
  const esAdmin = perfil?.rol === 'admin'

  useEffect(() => {
    if (perfil && !esDueno && !esAdmin) {
      router.replace('/productos')
    }
  }, [perfil, esDueno, esAdmin])

  useEffect(() => {
    async function fetchProducto() {
      if (!id) return
      try {
        const { data, error } = await supabase
          .from('productos_varios')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error

        setNombre(data.nombre || '')
        setUnidadMedida(data.unidad_medida || '')
        setPrecioSugerido(data.precio_sugerido?.toString() || '')
        setFotoUrl(data.foto_url || null)
      } catch (err) {
        console.error(err)
        mostrar('No se pudo cargar el producto', 'error')
        router.back()
      } finally {
        setFetching(false)
      }
    }

    if (perfil && (esDueno || esAdmin)) {
      fetchProducto()
    }
  }, [id, perfil, esDueno, esAdmin])

  if (requireModulo) return requireModulo

  if (!perfil || (!esDueno && !esAdmin)) {
    return null
  }

  const handleSeleccionarImagen = async () => {
    Alert.alert(
      'Seleccionar Foto',
      '¿Desde dónde quieres obtener la foto?',
      [
        {
          text: 'Cámara',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 1,
            })
            if (!result.canceled) {
              subirImagen(result.assets[0].uri)
            }
          }
        },
        {
          text: 'Galería',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 1,
            })
            if (!result.canceled) {
              subirImagen(result.assets[0].uri)
            }
          }
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    )
  }

  const subirImagen = async (uri: string) => {
    try {
      setLoading(true)
      const url = await comprimirYSubirImagen(uri)
      setFotoUrl(url)
    } catch (err: any) {
      console.error(err)
      mostrar('No se pudo subir la imagen: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleGuardar = async () => {
    if (!nombre || !unidadMedida) {
      mostrar('Por favor llena los campos obligatorios (*).', 'error')
      return
    }

    try {
      setLoading(true)
      await guardarVarios({
        id: id || undefined,
        nombre,
        unidad_medida: unidadMedida,
        precio_sugerido: precioSugerido ? parseFloat(precioSugerido) : null,
        foto_url: fotoUrl || null,
        activo: true,
      })

      mostrar(id ? 'El producto ha sido actualizado.' : 'Producto creado.')
      router.back()
    } catch (err: any) {
      console.error(err)
      mostrar('Hubo un error al guardar el producto.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={paleta.primario} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: espacio.m,
          paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m,
        }}
      >
        <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={paleta.texto} />
        </Presionable>
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>
          {id ? 'Editar Producto de Granja' : 'Nuevo Producto de Granja'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: espacio.xxxl, gap: espacio.l }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center' }}>
          <Presionable
            accessibilityRole="button"
            accessibilityLabel="Añadir foto"
            onPress={handleSeleccionarImagen}
            style={{
              width: 140, height: 140, borderRadius: radio.full,
              backgroundColor: paleta.superficie2, alignItems: 'center', justifyContent: 'center',
            }}
          >
            {fotoUrl ? (
              <Image source={{ uri: fotoUrl }} style={{ width: 140, height: 140, borderRadius: radio.full }} />
            ) : (
              <View style={{ alignItems: 'center', gap: espacio.s }}>
                <Camera size={40} color={paleta.texto3} />
                <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Añadir foto</Text>
              </View>
            )}
            {loading && (
              <View
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: paleta.overlay, borderRadius: radio.full,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ActivityIndicator color={paleta.sobrePrimario} size="large" />
              </View>
            )}
            <View
              style={{
                position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRadius: radio.full,
                backgroundColor: paleta.primario, alignItems: 'center', justifyContent: 'center',
                borderWidth: 3, borderColor: paleta.fondo,
              }}
            >
              <Pencil size={16} color={paleta.sobrePrimario} />
            </View>
          </Presionable>
        </View>

        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Información del producto</Text>
          <View style={{ marginTop: espacio.m }}>
            <CampoTexto etiqueta="Nombre *" value={nombre} onChangeText={setNombre} placeholder="Ej. Huevos Criollos" />
          </View>
          <View style={{ marginTop: espacio.m }}>
            <CampoTexto
              etiqueta="Unidad de medida *"
              value={unidadMedida}
              onChangeText={setUnidadMedida}
              placeholder="Ej. Cubeta, Unidad, Kg"
            />
          </View>
          <View style={{ marginTop: espacio.m }}>
            <CampoTexto
              etiqueta="Precio sugerido (opcional)"
              value={precioSugerido}
              onChangeText={setPrecioSugerido}
              placeholder="0.00"
              keyboardType="number-pad"
            />
          </View>
        </Tarjeta>
      </ScrollView>

      <View style={{ padding: espacio.l, paddingBottom: espacio.xxxl, borderTopWidth: 1, borderTopColor: paleta.borde, backgroundColor: paleta.fondo }}>
        <Boton
          titulo={id ? 'Actualizar producto' : 'Guardar producto'}
          onPress={handleGuardar}
          cargando={loading}
          icono={<Save size={20} color={paleta.sobrePrimario} />}
        />
      </View>
    </View>
  )
}
