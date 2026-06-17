import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRequireModulo } from '../../../lib/auth'
import { buscarVentaParaDevolucion } from '../../../lib/devoluciones'

export default function DevolucionesIndex() {
  const requireModulo = useRequireModulo('devoluciones')
  const router = useRouter()

  const [numeroVenta, setNumeroVenta] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noEncontrada, setNoEncontrada] = useState(false)

  if (requireModulo) return requireModulo

  const handleBuscar = async () => {
    const num = parseInt(numeroVenta.trim(), 10)
    if (isNaN(num) || num <= 0) {
      setError('Ingresa un número de venta válido.')
      return
    }

    setLoading(true)
    setError(null)
    setNoEncontrada(false)

    try {
      const venta = await buscarVentaParaDevolucion(num)
      if (!venta) {
        setNoEncontrada(true)
        return
      }
      router.push({ pathname: '/devoluciones/nueva', params: { venta: venta.venta_id, numero: String(venta.numero) } })
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'Error al buscar la venta.'
      setError(mensaje)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Banner informativo */}
          <View style={styles.banner}>
            <Ionicons name="return-down-back-outline" size={20} color="#0284c7" />
            <Text style={styles.bannerText}>
              Ingresa el número de la venta para iniciar una devolución, cambio o ajuste parcial.
            </Text>
          </View>

          {/* Sección de búsqueda */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Buscar venta</Text>

            <View style={styles.inputRow}>
              <View style={styles.inputWrapper}>
                <Ionicons name="receipt-outline" size={18} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Número de venta"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={numeroVenta}
                  onChangeText={(t) => {
                    setNumeroVenta(t)
                    setError(null)
                    setNoEncontrada(false)
                  }}
                  onSubmitEditing={handleBuscar}
                  returnKeyType="search"
                  editable={!loading}
                  maxLength={10}
                  testID="input-numero-venta"
                />
              </View>

              <TouchableOpacity
                style={[styles.buscarButton, loading && styles.buscarButtonDisabled]}
                onPress={handleBuscar}
                disabled={loading}
                activeOpacity={0.8}
                testID="btn-buscar-venta"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.buscarButtonText}>Buscar</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Mensaje: no encontrada */}
            {noEncontrada && (
              <View style={styles.feedbackRow}>
                <Ionicons name="alert-circle-outline" size={16} color="#d97706" />
                <Text style={styles.noEncontradaText}>Venta no encontrada.</Text>
              </View>
            )}

            {/* Mensaje: error */}
            {error && (
              <View style={styles.feedbackRow}>
                <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>

          {/* Espacio reservado para devoluciones recientes (Task 7+) */}
          <View style={styles.recentesPlaceholder}>
            <Ionicons name="time-outline" size={40} color="#d1d5db" />
            <Text style={styles.recentesText}>El historial de devoluciones del día aparecerá aquí.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 10,
    height: 46,
  },
  inputIcon: { marginRight: 6 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },

  buscarButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  buscarButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buscarButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },

  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  noEncontradaText: {
    fontSize: 14,
    color: '#92400e',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    flex: 1,
  },

  recentesPlaceholder: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  recentesText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
})
