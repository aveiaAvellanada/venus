import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { obtenerProveedorPorId, crearProveedor, actualizarProveedor } from '../../../lib/proveedores'
import { useRequireModulo } from '../../../lib/auth'

export default function ProveedorEditorScreen() {
  const requireModulo = useRequireModulo('proveedores')
  const { id } = useLocalSearchParams<{ id?: string }>()
  const router = useRouter()

  // Form Fields State
  const [nombre, setNombre] = useState('')
  const [nitCedula, setNitCedula] = useState('')
  const [telefono, setTelefono] = useState('')
  const [ciudad, setCiudad] = useState('') // Maps to "Ciudad" in DB (address equivalent)
  const [email, setEmail] = useState('') // DB does not support email; will append to notas
  const [notas, setNotas] = useState('')
  const [activo, setActivo] = useState(true)

  // Loading States
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(!!id)

  useEffect(() => {
    async function cargarProveedor() {
      if (!id) return
      try {
        const data = await obtenerProveedorPorId(id)
        if (!data) {
          Alert.alert('Error', 'No se encontró el proveedor especificado.')
          router.back()
          return
        }
        setNombre(data.nombre)
        setNitCedula(data.nit_cedula || '')
        setTelefono(data.telefono || '')
        setCiudad(data.ciudad || '')
        setActivo(data.activo)

        // Parse email and clean notes if stored with email prefix
        const dbNotes = data.notas || ''
        const emailMatch = dbNotes.match(/^Email:\s*(.*?)(?:\n|$)/)
        if (emailMatch) {
          setEmail(emailMatch[1])
          setNotas(dbNotes.slice(emailMatch[0].length))
        } else {
          setNotas(dbNotes)
        }
      } catch (err: any) {
        console.error('Error al cargar proveedor:', err)
        Alert.alert('Error', 'No se pudieron cargar los datos del proveedor.')
        router.back()
      } finally {
        setFetching(false)
      }
    }

    cargarProveedor()
  }, [id])

  if (requireModulo) return requireModulo

  const handleGuardar = async () => {
    if (!nombre || nombre.trim() === '') {
      Alert.alert('Campo obligatorio', 'El nombre del proveedor es requerido.')
      return
    }

    // Since DB lacks email column, format email at top of notes
    let notasFormateadas = notas
    if (email && email.trim() !== '') {
      notasFormateadas = `Email: ${email.trim()}\n${notas}`
    }

    const payload = {
      nombre: nombre.trim(),
      nit_cedula: nitCedula.trim() || null,
      telefono: telefono.trim() || null,
      ciudad: ciudad.trim() || null,
      notas: notasFormateadas.trim() || null,
      activo,
    }

    try {
      setLoading(true)
      if (id) {
        await actualizarProveedor(id, payload)
        Alert.alert('Éxito', 'El proveedor ha sido actualizado correctamente.', [
          { text: 'Aceptar', onPress: () => router.back() },
        ])
      } else {
        await crearProveedor(payload)
        Alert.alert('Éxito', 'El proveedor ha sido registrado correctamente.', [
          { text: 'Aceptar', onPress: () => router.back() },
        ])
      }
    } catch (err: any) {
      console.error('Error al guardar proveedor:', err)
      Alert.alert('Error', err.message || 'No se pudo guardar el proveedor.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Cargando datos del proveedor...</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Form Container */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Datos Generales</Text>

          {/* Nombre Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre del Proveedor *</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej. Distribuidora del Caquetá"
              placeholderTextColor="#9ca3af"
              testID="input-nombre"
            />
          </View>

          {/* NIT / CC Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>NIT / Cédula</Text>
            <TextInput
              style={styles.input}
              value={nitCedula}
              onChangeText={setNitCedula}
              placeholder="Ej. 900123456-1"
              placeholderTextColor="#9ca3af"
              testID="input-nit"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contacto y Ubicación</Text>

          {/* Teléfono Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Teléfono de Contacto</Text>
            <TextInput
              style={styles.input}
              value={telefono}
              onChangeText={setTelefono}
              placeholder="Ej. 3123456789"
              keyboardType="phone-pad"
              placeholderTextColor="#9ca3af"
              testID="input-telefono"
            />
          </View>

          {/* Ciudad / Dirección Input (Maps to ciudad) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dirección / Ciudad</Text>
            <TextInput
              style={styles.input}
              value={ciudad}
              onChangeText={setCiudad}
              placeholder="Ej. Florencia, Caquetá"
              placeholderTextColor="#9ca3af"
              testID="input-ciudad"
            />
          </View>

          {/* Email Input (Appended to notas) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo Electrónico (Email)</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Ej. compras@proveedor.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9ca3af"
              testID="input-email"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Adicionales</Text>

          {/* Notas Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notas y Observaciones</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notas}
              onChangeText={setNotas}
              placeholder="Ingresa notas adicionales..."
              multiline
              numberOfLines={4}
              placeholderTextColor="#9ca3af"
              testID="input-notas"
            />
          </View>

          {/* Active Switch Toggle */}
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Proveedor Activo</Text>
              <Text style={styles.switchSublabel}>Habilita o deshabilita este proveedor en compras</Text>
            </View>
            <Switch
              value={activo}
              onValueChange={setActivo}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={activo ? '#3b82f6' : '#f3f4f6'}
              testID="switch-activo"
            />
          </View>
        </View>
      </ScrollView>

      {/* Sticky Save Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleGuardar}
          disabled={loading}
          activeOpacity={0.8}
          testID="btn-guardar"
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.saveButtonText}>
                {id ? 'Actualizar Proveedor' : 'Registrar Proveedor'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: '#4b5563', fontSize: 15 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#4b5563', marginBottom: 6 },
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
  textArea: { height: 100, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  switchSublabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
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
  saveButtonDisabled: { opacity: 0.7 },
  buttonIcon: { marginRight: 8 },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
})
