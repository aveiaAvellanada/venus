import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  Switch,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native'
import { useFocusEffect, Redirect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../../lib/auth'
import { obtenerReporteConfig, guardarReporteConfig } from '../../../lib/reporteDiario'

export default function ReportesConfig() {
  const { perfil } = useAuth()

  const [whatsappOn, setWhatsappOn] = useState(true)
  const [correoOn, setCorreoOn] = useState(false)
  const [correoDestino, setCorreoDestino] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const cfg = await obtenerReporteConfig()
      if (cfg) {
        setWhatsappOn(cfg.whatsapp_on)
        setCorreoOn(cfg.correo_on)
        setCorreoDestino(cfg.correo_destino ?? '')
      }
    } catch (e) {
      console.warn('No se pudo cargar la configuración:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (perfil?.rol === 'dueno') cargar()
    }, [cargar, perfil])
  )

  // Gate: solo el dueño
  if (perfil && perfil.rol !== 'dueno') return <Redirect href="/reportes" />

  const guardar = async () => {
    if (correoOn && !correoDestino.includes('@')) {
      Alert.alert('Correo inválido', 'Ingresa un correo válido para el envío automático.')
      return
    }
    setSaving(true)
    try {
      await guardarReporteConfig({
        whatsapp_on: whatsappOn,
        correo_on: correoOn,
        correo_destino: correoDestino.trim() || null,
      })
      Alert.alert('Guardado', 'La configuración se actualizó.')
    } catch (e: unknown) {
      Alert.alert('Error', 'No se pudo guardar. Intenta de nuevo.')
      console.warn('Error al guardar config:', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitulo}>WhatsApp</Text>
              <Text style={styles.rowSub}>Mostrar el resumen para enviar al cerrar la caja.</Text>
            </View>
            <Switch testID="sw-whatsapp" value={whatsappOn} onValueChange={setWhatsappOn} />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitulo}>Correo automático</Text>
              <Text style={styles.rowSub}>Enviar el resumen por correo al cerrar la caja.</Text>
            </View>
            <Switch testID="sw-correo" value={correoOn} onValueChange={setCorreoOn} />
          </View>

          {correoOn && (
            <TextInput
              testID="input-correo"
              style={styles.input}
              value={correoDestino}
              onChangeText={setCorreoDestino}
              placeholder="correo@ejemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        </View>

        <View style={styles.nota}>
          <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
          <Text style={styles.notaText}>
            El correo automático requiere configurar la clave del proveedor de envío en el servidor.
          </Text>
        </View>

        <TouchableOpacity testID="btn-guardar-config" style={styles.boton} onPress={guardar} disabled={saving}>
          <Text style={styles.botonText}>{saving ? 'Guardando…' : 'Guardar'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  body: { padding: 16 },
  card: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  rowText: { flex: 1, marginRight: 12 },
  rowTitulo: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rowSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 12 },
  input: { marginTop: 12, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827' },
  nota: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginBottom: 16, paddingHorizontal: 4 },
  notaText: { flex: 1, fontSize: 12, color: '#6b7280', lineHeight: 17 },
  boton: { backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  botonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
})
