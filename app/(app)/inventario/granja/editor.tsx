import { useEffect, useState } from 'react'
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useAuth, useRequireModulo } from '../../../../lib/auth'
import { supabase } from '../../../../lib/supabase'
import { guardarVarios } from '../../../../lib/inventario'
import { comprimirYSubirImagen } from '../../../../lib/imagenes'

export default function GranjaEditorScreen() {
  const requireModulo = useRequireModulo('granja')
  const { id } = useLocalSearchParams<{ id?: string }>()
  const router = useRouter()
  const { perfil } = useAuth()

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
      router.replace('/(app)/inventario/granja')
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
        Alert.alert('Error', 'No se pudo cargar el producto')
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
      Alert.alert('Error', 'No se pudo subir la imagen: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGuardar = async () => {
    if (!nombre || !unidadMedida) {
      Alert.alert('Campos requeridos', 'Por favor llena los campos obligatorios (*).')
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
      
      Alert.alert('Guardado exitoso', id ? 'El producto ha sido actualizado.' : 'Producto creado.')
      router.back()
    } catch (err: any) {
      console.error(err)
      Alert.alert('Error', 'Hubo un error al guardar el producto.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.imageSection}>
          <TouchableOpacity onPress={handleSeleccionarImagen} style={styles.imagePickerContainer} activeOpacity={0.8}>
            {fotoUrl ? (
              <Image source={{ uri: fotoUrl }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera-outline" size={48} color="#9ca3af" />
                <Text style={styles.imagePlaceholderText}>Añadir foto</Text>
              </View>
            )}
            {loading && (
              <View style={styles.imageLoadingOverlay}>
                <ActivityIndicator color="#ffffff" size="large" />
              </View>
            )}
            <View style={styles.editIconBadge}>
              <Ionicons name="pencil" size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Información del Producto</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej. Huevos Criollos" placeholderTextColor="#9ca3af" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Unidad de Medida *</Text>
            <TextInput style={styles.input} value={unidadMedida} onChangeText={setUnidadMedida} placeholder="Ej. Cubeta, Unidad, Kg" placeholderTextColor="#9ca3af" />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Precio Sugerido (Opcional)</Text>
            <TextInput style={styles.input} value={precioSugerido} onChangeText={setPrecioSugerido} placeholder="0.00" keyboardType="numeric" placeholderTextColor="#9ca3af" />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
          onPress={handleGuardar}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.saveButtonText}>{id ? 'Actualizar Producto' : 'Guardar Producto'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 100, padding: 16 },
  imageSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  imagePickerContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 70,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3b82f6',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f9fafb',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
})
