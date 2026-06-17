import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, useRequireModulo } from '../../../lib/auth'
import {
  obtenerProveedorPorId,
  listarCuentasBancarias,
  crearCuentaBancaria,
  eliminarCuentaBancaria,
  obtenerWhatsAppLink,
  obtenerDeudaProveedor,
  listarCompras,
  listarPagosProveedor,
  registrarPagoProveedor,
  type Proveedor,
  type CuentaBancaria,
  type Compra,
  type CompraPago,
} from '../../../lib/proveedores'

export default function ProveedorDetailScreen() {
  const requireModulo = useRequireModulo('proveedores')
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { perfil } = useAuth()

  // General States
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [email, setEmail] = useState('')
  const [parsedNotas, setParsedNotas] = useState('')
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [loadingGeneral, setLoadingGeneral] = useState(true)

  // Bank Account Modal Form State
  const [cuentaModalVisible, setCuentaModalVisible] = useState(false)
  const [banco, setBanco] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState<'ahorros' | 'corriente'>('ahorros')
  const [numeroCuenta, setNumeroCuenta] = useState('')
  const [titular, setTitular] = useState('')
  const [guardandoCuenta, setGuardandoCuenta] = useState(false)

  // Financial States (Owner-Only)
  const [deudaTotal, setDeudaTotal] = useState<number>(0)
  const [comprasCredito, setComprasCredito] = useState<Compra[]>([])
  const [historialPagos, setHistorialPagos] = useState<CompraPago[]>([])
  const [loadingFinanzas, setLoadingFinanzas] = useState(false)

  // Payment Modal State
  const [pagoModalVisible, setPagoModalVisible] = useState(false)
  const [compraSeleccionada, setCompraSeleccionada] = useState<Compra | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [notasPago, setNotasPago] = useState('')
  const [guardandoPago, setGuardandoPago] = useState(false)

  // Load General Information
  const cargarInformacionGeneral = useCallback(async () => {
    if (!id) return
    try {
      setLoadingGeneral(true)
      const [dataProveedor, dataCuentas] = await Promise.all([
        obtenerProveedorPorId(id),
        listarCuentasBancarias(id),
      ])
      
      setProveedor(dataProveedor)
      setCuentas(dataCuentas)

      if (dataProveedor) {
        const dbNotes = dataProveedor.notas || ''
        const emailMatch = dbNotes.match(/^Email:\s*(.*?)(?:\n|$)/)
        if (emailMatch) {
          setEmail(emailMatch[1])
          setParsedNotas(dbNotes.slice(emailMatch[0].length))
        } else {
          setEmail('')
          setParsedNotas(dbNotes)
        }
      }
    } catch (err: any) {
      console.error('Error al cargar info general:', err)
      Alert.alert('Error', 'No se pudo cargar la información general del proveedor.')
    } finally {
      setLoadingGeneral(false)
    }
  }, [id])

  // Load Financial Information (Dueno only)
  const cargarInformacionFinanciera = useCallback(async () => {
    if (!id || !perfil || perfil.rol !== 'dueno') return
    try {
      setLoadingFinanzas(true)
      const [totalDeuda, listaCompras, listaPagos] = await Promise.all([
        obtenerDeudaProveedor(id),
        listarCompras({ proveedor_id: id, estado: 'completada' }),
        listarPagosProveedor(id),
      ])

      setDeudaTotal(totalDeuda)
      
      // Filter purchases on client-side to only show completed credit purchases with pending balance
      const creditPurchases = listaCompras.filter(
        c => c.condicion_pago === 'credito' && Number(c.saldo_pendiente) > 0
      )
      setComprasCredito(creditPurchases)
      setHistorialPagos(listaPagos)
    } catch (err: any) {
      console.error('Error al cargar finanzas:', err)
      Alert.alert('Error', 'No se pudo cargar la información financiera del proveedor.')
    } finally {
      setLoadingFinanzas(false)
    }
  }, [id, perfil])

  // Combined reloading on focus
  useFocusEffect(
    useCallback(() => {
      cargarInformacionGeneral()
      cargarInformacionFinanciera()
    }, [cargarInformacionGeneral, cargarInformacionFinanciera])
  )

  if (requireModulo) return requireModulo

  // WhatsApp contact trigger
  const handleWhatsAppContact = async (telefono: string | null) => {
    if (!telefono) {
      Alert.alert('Teléfono faltante', 'Este proveedor no tiene teléfono registrado.')
      return
    }
    const defaultMessage = 'Hola, nos contactamos de la Tienda de Calzado Venus.'
    const url = obtenerWhatsAppLink(telefono, defaultMessage)
    if (!url) {
      Alert.alert('Error', 'El formato del número de teléfono no es válido.')
      return
    }
    try {
      await Linking.openURL(url)
    } catch (error) {
      console.error('Error opening WhatsApp:', error)
      Alert.alert('Error', 'No se pudo abrir WhatsApp. Por favor verifica si tienes la aplicación instalada.')
    }
  }

  // Create Bank Account
  const handleGuardarCuenta = async () => {
    if (!banco.trim() || !numeroCuenta.trim()) {
      Alert.alert('Campos obligatorios', 'El banco y el número de cuenta son obligatorios.')
      return
    }
    if (!id) return

    try {
      setGuardandoCuenta(true)
      await crearCuentaBancaria({
        proveedor_id: id,
        banco: banco.trim(),
        tipo_cuenta: tipoCuenta,
        numero_cuenta: numeroCuenta.trim(),
        titular: titular.trim() || null,
      })
      Alert.alert('Éxito', 'Cuenta bancaria agregada correctamente.')
      setCuentaModalVisible(false)
      // Reset form
      setBanco('')
      setTipoCuenta('ahorros')
      setNumeroCuenta('')
      setTitular('')
      // Reload accounts
      const updatedCuentas = await listarCuentasBancarias(id)
      setCuentas(updatedCuentas)
    } catch (err: any) {
      console.error('Error al guardar cuenta:', err)
      Alert.alert('Error', err.message || 'No se pudo agregar la cuenta bancaria.')
    } finally {
      setGuardandoCuenta(false)
    }
  }

  // Delete Bank Account Prompt
  const handleEliminarCuenta = (cuentaId: string) => {
    Alert.alert(
      'Eliminar Cuenta',
      '¿Estás seguro de que deseas eliminar esta cuenta bancaria?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarCuentaBancaria(cuentaId)
              Alert.alert('Éxito', 'Cuenta bancaria eliminada.')
              if (id) {
                const updatedCuentas = await listarCuentasBancarias(id)
                setCuentas(updatedCuentas)
              }
            } catch (err: any) {
              console.error('Error al eliminar cuenta:', err)
              Alert.alert('Error', err.message || 'No se pudo eliminar la cuenta.')
            }
          },
        },
      ]
    )
  }

  // Register Payment
  const handleGuardarPago = async () => {
    if (!compraSeleccionada || !perfil) return

    const monto = parseFloat(montoPago)
    if (isNaN(monto) || monto <= 0) {
      Alert.alert('Monto inválido', 'El monto debe ser un número mayor a cero.')
      return
    }

    if (monto > Number(compraSeleccionada.saldo_pendiente)) {
      Alert.alert('Monto excedido', 'El monto del pago supera el saldo pendiente de la compra.')
      return
    }

    try {
      setGuardandoPago(true)
      await registrarPagoProveedor({
        compra_id: compraSeleccionada.id,
        registrado_por: perfil.id,
        monto,
        notas: notasPago.trim() || null,
      })

      Alert.alert('Éxito', 'Pago registrado correctamente.')
      setPagoModalVisible(false)
      setMontoPago('')
      setNotasPago('')
      setCompraSeleccionada(null)
      
      // Reload financial data
      await cargarInformacionFinanciera()
    } catch (err: any) {
      console.error('Error al guardar pago:', err)
      Alert.alert('Error', err.message || 'No se pudo registrar el pago.')
    } finally {
      setGuardandoPago(false)
    }
  }

  if (loadingGeneral) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Cargando detalle del proveedor...</Text>
      </View>
    )
  }

  if (!proveedor) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>No se encontró el proveedor especificado.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 1. General Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Información General</Text>
            <TouchableOpacity
              style={styles.editHeaderButton}
              onPress={() => router.push(`/proveedores/editor?id=${proveedor.id}`)}
            >
              <Ionicons name="create-outline" size={20} color="#3b82f6" />
              <Text style={styles.editHeaderText}>Editar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Nombre</Text>
            <Text style={styles.infoValue}>{proveedor.nombre}</Text>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>NIT / CC</Text>
            <Text style={styles.infoValue}>{proveedor.nit_cedula || 'No registrado'}</Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.infoBlock, { flex: 1 }]}>
              <Text style={styles.infoLabel}>Teléfono</Text>
              <Text style={styles.infoValue}>{proveedor.telefono || 'No registrado'}</Text>
            </View>
            {proveedor.telefono && (
              <TouchableOpacity
                style={styles.whatsappButton}
                onPress={() => handleWhatsAppContact(proveedor.telefono)}
                testID="whatsapp-btn"
              >
                <Ionicons name="logo-whatsapp" size={18} color="#ffffff" style={styles.waIcon} />
                <Text style={styles.whatsappButtonText}>Escribir</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Ciudad / Dirección</Text>
            <Text style={styles.infoValue}>{proveedor.ciudad || 'No registrado'}</Text>
          </View>

          {email ? (
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Correo Electrónico (Email)</Text>
              <Text style={styles.infoValue}>{email}</Text>
            </View>
          ) : null}

          {parsedNotas ? (
            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Notas</Text>
              <Text style={styles.infoValue}>{parsedNotas}</Text>
            </View>
          ) : null}

          <View style={styles.statusRow}>
            <Text style={styles.infoLabel}>Estado</Text>
            <View style={[styles.badge, proveedor.activo ? styles.badgeActive : styles.badgeInactive]}>
              <Text style={styles.badgeText}>{proveedor.activo ? 'ACTIVO' : 'INACTIVO'}</Text>
            </View>
          </View>
        </View>

        {/* 2. Bank Accounts Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Cuentas Bancarias</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setCuentaModalVisible(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#3b82f6" />
              <Text style={styles.addButtonText}>Agregar</Text>
            </TouchableOpacity>
          </View>

          {cuentas.length === 0 ? (
            <View style={styles.emptyCardContainer}>
              <Ionicons name="card-outline" size={32} color="#9ca3af" />
              <Text style={styles.emptyCardText}>No hay cuentas bancarias registradas.</Text>
            </View>
          ) : (
            cuentas.map((cuenta) => (
              <View key={cuenta.id} style={styles.cuentaRow}>
                <View style={styles.cuentaDetails}>
                  <Text style={styles.cuentaBanco}>{cuenta.banco}</Text>
                  <Text style={styles.cuentaMeta}>
                    {cuenta.tipo_cuenta === 'ahorros' ? 'Ahorros' : 'Corriente'} · {cuenta.numero_cuenta}
                  </Text>
                  {cuenta.titular && (
                    <Text style={styles.cuentaTitular}>Titular: {cuenta.titular}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.deleteCuentaBtn}
                  onPress={() => handleEliminarCuenta(cuenta.id)}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* 3. Owner-Only Financial Panel */}
        {perfil?.rol === 'dueno' && (
          <View testID="financial-panel">
            {loadingFinanzas ? (
              <View style={styles.card}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={styles.loadingText}>Cargando información financiera...</Text>
              </View>
            ) : (
              <>
                {/* Consolidated Debt Card */}
                <View style={[styles.card, styles.debtCard]}>
                  <Text style={styles.debtLabel}>Deuda Total Consolidada</Text>
                  <Text style={styles.debtValue}>
                    ${deudaTotal.toLocaleString('es-CO')}
                  </Text>
                </View>

                {/* Credit Purchases Card */}
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Compras a Crédito Pendientes</Text>
                  {comprasCredito.length === 0 ? (
                    <View style={styles.emptyCardContainer}>
                      <Ionicons name="checkmark-circle-outline" size={32} color="#10b981" />
                      <Text style={styles.emptyCardText}>No hay compras con saldo pendiente.</Text>
                    </View>
                  ) : (
                    comprasCredito.map((compra) => (
                      <View key={compra.id} style={styles.purchaseRow}>
                        <View style={styles.purchaseMeta}>
                          <Text style={styles.purchaseDate}>
                            Fecha: {new Date(compra.created_at).toLocaleDateString('es-CO')}
                          </Text>
                          <Text style={styles.purchaseTotal}>
                            Total: ${Number(compra.total).toLocaleString('es-CO')}
                          </Text>
                          <Text style={styles.purchaseSaldo}>
                            Saldo: ${Number(compra.saldo_pendiente).toLocaleString('es-CO')}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.payBtn}
                          onPress={() => {
                            setCompraSeleccionada(compra)
                            setPagoModalVisible(true)
                          }}
                        >
                          <Text style={styles.payBtnText}>Registrar Pago</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>

                {/* Payment History Card */}
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Historial de Pagos</Text>
                  {historialPagos.length === 0 ? (
                    <View style={styles.emptyCardContainer}>
                      <Ionicons name="receipt-outline" size={32} color="#9ca3af" />
                      <Text style={styles.emptyCardText}>No se han registrado pagos para este proveedor.</Text>
                    </View>
                  ) : (
                    historialPagos.map((pago) => (
                      <View key={pago.id} style={styles.paymentRow}>
                        <View style={styles.paymentMeta}>
                          <Text style={styles.paymentMonto}>
                            ${Number(pago.monto).toLocaleString('es-CO')}
                          </Text>
                          <Text style={styles.paymentDate}>
                            {pago.fecha}
                          </Text>
                        </View>
                        {pago.notas ? (
                          <Text style={styles.paymentNotas}>{pago.notas}</Text>
                        ) : null}
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </View>
        )}

      </ScrollView>

      {/* 4. Bank Account Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={cuentaModalVisible}
        onRequestClose={() => setCuentaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva Cuenta Bancaria</Text>
              <TouchableOpacity onPress={() => setCuentaModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={24} color="#4b5563" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Banco *</Text>
                <TextInput
                  style={styles.input}
                  value={banco}
                  onChangeText={setBanco}
                  placeholder="ej: Bancolombia, Nequi, Daviplata"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tipo de Cuenta *</Text>
                <View style={styles.pickerRow}>
                  <TouchableOpacity
                    style={[styles.pickerBtn, tipoCuenta === 'ahorros' && styles.pickerBtnActive]}
                    onPress={() => setTipoCuenta('ahorros')}
                  >
                    <Text style={[styles.pickerBtnText, tipoCuenta === 'ahorros' && styles.pickerBtnTextActive]}>
                      Ahorros
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pickerBtn, tipoCuenta === 'corriente' && styles.pickerBtnActive]}
                    onPress={() => setTipoCuenta('corriente')}
                  >
                    <Text style={[styles.pickerBtnText, tipoCuenta === 'corriente' && styles.pickerBtnTextActive]}>
                      Corriente
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Número de Cuenta *</Text>
                <TextInput
                  style={styles.input}
                  value={numeroCuenta}
                  onChangeText={setNumeroCuenta}
                  placeholder="Número de cuenta"
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Titular (Opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={titular}
                  onChangeText={setTitular}
                  placeholder="Nombre del titular"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, guardandoCuenta && styles.saveBtnDisabled]}
                onPress={handleGuardarCuenta}
                disabled={guardandoCuenta}
              >
                {guardandoCuenta ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Guardar Cuenta</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* 5. Payment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={pagoModalVisible}
        onRequestClose={() => {
          setPagoModalVisible(false)
          setCompraSeleccionada(null)
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Pago</Text>
              <TouchableOpacity
                onPress={() => {
                  setPagoModalVisible(false)
                  setCompraSeleccionada(null)
                }}
                hitSlop={12}
              >
                <Ionicons name="close" size={24} color="#4b5563" />
              </TouchableOpacity>
            </View>

            {compraSeleccionada && (
              <ScrollView contentContainerStyle={styles.modalForm} showsVerticalScrollIndicator={false}>
                <View style={styles.purchaseSummary}>
                  <Text style={styles.summaryLabel}>
                    Compra: {new Date(compraSeleccionada.created_at).toLocaleDateString('es-CO')}
                  </Text>
                  <Text style={styles.summaryLabel}>
                    Saldo Pendiente: ${Number(compraSeleccionada.saldo_pendiente).toLocaleString('es-CO')}
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Monto del Pago *</Text>
                  <TextInput
                    style={styles.input}
                    value={montoPago}
                    onChangeText={setMontoPago}
                    placeholder="Monto en COP"
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Notas / Observaciones</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={notasPago}
                    onChangeText={setNotasPago}
                    placeholder="Comprobante, Nequi ref, etc."
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, guardandoPago && styles.saveBtnDisabled]}
                  onPress={handleGuardarPago}
                  disabled={guardandoPago}
                >
                  {guardandoPago ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Registrar Pago</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: '#4b5563', fontSize: 15 },
  errorText: { fontSize: 15, color: '#ef4444', textAlign: 'center', marginTop: 12, marginBottom: 16 },
  backButton: { backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  backButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  scrollContent: { padding: 16, paddingBottom: 60 },
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  editHeaderButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editHeaderText: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonText: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  infoBlock: { marginBottom: 14 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' },
  infoValue: { fontSize: 15, color: '#111827', fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  waIcon: { marginRight: 6 },
  whatsappButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeInactive: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#111827' },
  emptyCardContainer: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyCardText: { color: '#9ca3af', fontSize: 14, textAlign: 'center' },
  cuentaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cuentaDetails: { flex: 1, marginRight: 16 },
  cuentaBanco: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cuentaMeta: { fontSize: 13, color: '#4b5563', marginTop: 2 },
  cuentaTitular: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  deleteCuentaBtn: { padding: 8 },
  debtCard: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  debtLabel: { fontSize: 13, fontWeight: '600', color: '#1d4ed8', textTransform: 'uppercase', marginBottom: 6 },
  debtValue: { fontSize: 24, fontWeight: '800', color: '#1e3a8a' },
  purchaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  purchaseMeta: { flex: 1, marginRight: 16 },
  purchaseDate: { fontSize: 14, color: '#4b5563' },
  purchaseTotal: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  purchaseSaldo: { fontSize: 14, fontWeight: '600', color: '#b91c1c', marginTop: 2 },
  payBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  payBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  paymentRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  paymentMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  paymentMonto: { fontSize: 15, fontWeight: '600', color: '#10b981' },
  paymentDate: { fontSize: 13, color: '#6b7280' },
  paymentNotas: { fontSize: 13, color: '#4b5563', fontStyle: 'italic' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalForm: { padding: 20, paddingBottom: 40 },
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
  textArea: { height: 74, textAlignVertical: 'top' },
  pickerRow: { flexDirection: 'row', gap: 10 },
  pickerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pickerBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  pickerBtnText: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  pickerBtnTextActive: { color: '#ffffff' },
  saveBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  purchaseSummary: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 14, color: '#374151', fontWeight: '500', marginBottom: 4 },
})
