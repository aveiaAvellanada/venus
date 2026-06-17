import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../../lib/auth'
import { obtenerCompraPorId, completarInformacionFinanciera } from '../../../lib/proveedores'

export default function RecepcionDetalleFinancieroScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { perfil, cargando } = useAuth()

  const [compra, setCompra] = useState<any>(null)
  const [cargandoCompra, setCargandoCompra] = useState(true)
  const [itemsCostos, setItemsCostos] = useState<Array<{ item_id: string; costo_unitario: number }>>([])
  const [condicionPago, setCondicionPago] = useState<'contado' | 'credito'>('contado')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Gating access control: Only owner (dueno) can access this detail page
  if (!cargando && (!perfil || perfil.rol !== 'dueno')) {
    return <Redirect href="/" />
  }

  useEffect(() => {
    async function cargarCompra() {
      if (!id) return
      try {
        setCargandoCompra(true)
        const data = await obtenerCompraPorId(id)
        if (data) {
          setCompra(data)
          setCondicionPago(data.condicion_pago === 'credito' ? 'credito' : 'contado')
          setFechaVencimiento(data.fecha_vencimiento || '')
          setNotas(data.notas || '')
          
          // Initialise item costs
          const initialCostos = (data.items || []).map((item: any) => ({
            item_id: item.id,
            costo_unitario: item.costo_unitario || 0,
          }))
          setItemsCostos(initialCostos)
        } else {
          Alert.alert('Error', 'No se encontró la recepción física seleccionada.')
          router.back()
        }
      } catch (err: any) {
        console.error('Error al cargar la recepción:', err)
        Alert.alert('Error', 'No se pudo cargar la información de la recepción.')
      } finally {
        setCargandoCompra(false)
      }
    }
    cargarCompra()
  }, [id])

  const handleCostoChange = (itemId: string, text: string) => {
    const val = text.replace(/[^0-9]/g, '')
    const num = parseInt(val, 10) || 0
    setItemsCostos(prev =>
      prev.map(c => (c.item_id === itemId ? { ...c, costo_unitario: num } : c))
    )
  }

  const calcularTotal = () => {
    if (!compra || !compra.items) return 0
    return compra.items.reduce((sum: number, item: any) => {
      const costObj = itemsCostos.find(c => c.item_id === item.id)
      const cost = costObj ? costObj.costo_unitario : 0
      return sum + item.cantidad * cost
    }, 0)
  }

  const handleCompletarFinanzas = async () => {
    if (!perfil || !id) return

    // Validations
    const inputsInvalidos = itemsCostos.some(c => c.costo_unitario <= 0)
    if (inputsInvalidos) {
      Alert.alert('Validación', 'El costo unitario de todos los productos debe ser mayor a cero.')
      return
    }

    if (condicionPago === 'credito' && !fechaVencimiento.trim()) {
      Alert.alert('Validación', 'La fecha de vencimiento es requerida para compras a crédito.')
      return
    }

    // Basic date format check YYYY-MM-DD
    if (condicionPago === 'credito') {
      const regexFecha = /^\d{4}-\d{2}-\d{2}$/
      if (!regexFecha.test(fechaVencimiento)) {
        Alert.alert('Validación', 'La fecha de vencimiento debe tener el formato AAAA-MM-DD.')
        return
      }
    }

    try {
      setGuardando(true)
      await completarInformacionFinanciera({
        compra_id: id,
        revisada_por: perfil.id,
        condicion_pago: condicionPago,
        fecha_vencimiento: condicionPago === 'credito' ? fechaVencimiento : null,
        notas: notas.trim() || null,
        itemsCostos: itemsCostos.map(c => ({
          item_id: c.item_id,
          costo_unitario: c.costo_unitario
        }))
      })

      Alert.alert('Éxito', 'Información financiera guardada correctamente.')
      router.replace('/recibir-mercancia')
    } catch (err: any) {
      console.error('Error al guardar finanzas:', err)
      Alert.alert('Error', err.message || 'Ocurrió un error al guardar los datos.')
    } finally {
      setGuardando(false)
    }
  }

  if (cargandoCompra || cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Cargando recepción...</Text>
      </View>
    )
  }

  if (compra && compra.estado !== 'pendiente_revision') {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle-outline" size={64} color="#10b981" />
        <Text style={styles.completedTitle}>Recepción Completada</Text>
        <Text style={styles.completedText}>Esta mercancía ya cuenta con información financiera registrada.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver al listado</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const formatMoneda = (val: number) => {
    return `$${val.toLocaleString('es-CO')}`
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Card de cabecera */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Detalles de Recepción</Text>
          <Text style={styles.metaText}>
            <Text style={styles.bold}>Proveedor: </Text>
            {compra?.proveedor_nombre || 'Desconocido'}
          </Text>
          <Text style={styles.metaText}>
            <Text style={styles.bold}>Fecha Entrada: </Text>
            {compra ? new Date(compra.created_at).toLocaleDateString('es-CO') : ''}
          </Text>
          <Text style={styles.metaText}>
            <Text style={styles.bold}>Registrado por: </Text>
            {compra?.registrada_por_nombre || 'Empleado'}
          </Text>
        </View>

        {/* Card de items */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Productos Recibidos</Text>
          {(compra?.items || []).map((item: any) => {
            const costObj = itemsCostos.find(c => c.item_id === item.id)
            const unitCost = costObj ? costObj.costo_unitario : 0
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemDesc}>{item.descripcion}</Text>
                  <Text style={styles.itemMeta}>
                    {item.color ? `Color: ${item.color}` : ''}
                    {item.talla ? ` | Talla: ${item.talla}` : ''}
                    {item.referencia ? ` | Ref: ${item.referencia}` : ''}
                  </Text>
                  <Text style={styles.itemQuantity}>Cantidad recibida: {item.cantidad}</Text>
                </View>
                
                <View style={styles.costInputContainer}>
                  <Text style={styles.inputLabel}>Costo Unitario ($)</Text>
                  <TextInput
                    style={styles.inputCosto}
                    keyboardType="numeric"
                    placeholder="0"
                    value={unitCost > 0 ? String(unitCost) : ''}
                    onChangeText={(text) => handleCostoChange(item.id, text)}
                    testID={`cost-input-${item.id}`}
                  />
                  <Text style={styles.subtotalText}>
                    Subtotal: {formatMoneda(item.cantidad * unitCost)}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* Card de condiciones financieras */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Condiciones de Factura</Text>
          
          <Text style={styles.label}>Condición de Pago</Text>
          <View style={styles.paymentConditionContainer}>
            <TouchableOpacity
              style={[
                styles.conditionButton,
                condicionPago === 'contado' && styles.conditionActiveButton,
              ]}
              onPress={() => setCondicionPago('contado')}
              testID="payment-contado"
            >
              <Text
                style={[
                  styles.conditionButtonText,
                  condicionPago === 'contado' && styles.conditionActiveButtonText,
                ]}
              >
                Contado
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.conditionButton,
                condicionPago === 'credito' && styles.conditionActiveButton,
              ]}
              onPress={() => setCondicionPago('credito')}
              testID="payment-credito"
            >
              <Text
                style={[
                  styles.conditionButtonText,
                  condicionPago === 'credito' && styles.conditionActiveButtonText,
                ]}
              >
                Crédito
              </Text>
            </TouchableOpacity>
          </View>

          {condicionPago === 'credito' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fecha de Vencimiento (AAAA-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-07-16"
                value={fechaVencimiento}
                onChangeText={setFechaVencimiento}
                maxLength={10}
                testID="date-input"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notas de la compra (Opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ej. Factura #9812, pendiente descuento..."
              value={notas}
              onChangeText={setNotas}
              multiline
              numberOfLines={3}
              testID="notes-input"
            />
          </View>
        </View>

        {/* Resumen del total */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>TOTAL COSTO COMPRA</Text>
          <Text style={styles.totalValue}>{formatMoneda(calcularTotal())}</Text>
        </View>
      </ScrollView>

      {/* Botón de guardado fijo al fondo */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, guardando && styles.submitButtonDisabled]}
          onPress={handleCompletarFinanzas}
          disabled={guardando}
          testID="submit-button"
        >
          {guardando ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="wallet-outline" size={20} color="#ffffff" style={styles.buttonIcon} />
              <Text style={styles.submitButtonText}>Guardar y Completar Recepción</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f9fafb' },
  loadingText: { marginTop: 12, color: '#4b5563', fontSize: 15 },
  completedTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 16, marginBottom: 8 },
  completedText: { fontSize: 15, color: '#6b7280', textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  backButton: { backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  backButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  bold: { fontWeight: '600', color: '#374151' },
  metaText: { fontSize: 14, color: '#4b5563', marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingBottom: 8 },
  itemRow: {
    flexDirection: 'column',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 16,
    marginBottom: 16,
  },
  itemInfo: { flex: 1, marginBottom: 10 },
  itemDesc: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  itemQuantity: { fontSize: 13, fontWeight: '500', color: '#374151', marginTop: 4 },
  costInputContainer: { width: '100%' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#4b5563', marginBottom: 4 },
  inputCosto: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  subtotalText: { fontSize: 12, color: '#10b981', fontWeight: '600', textAlign: 'right', marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#4b5563', marginBottom: 6 },
  paymentConditionContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  conditionButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  conditionActiveButton: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  conditionButtonText: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  conditionActiveButtonText: { color: '#1d4ed8' },
  inputGroup: { marginBottom: 16 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  totalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },
  totalValue: { fontSize: 24, fontWeight: '800', color: '#ffffff', marginTop: 4 },
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
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: { opacity: 0.6 },
  buttonIcon: { marginRight: 8 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
})
