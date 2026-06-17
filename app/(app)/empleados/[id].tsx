import React, { useState, useCallback } from 'react'
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
  SafeAreaView,
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRequireModulo } from '../../../lib/auth'
import {
  listarEmpleados,
  diasTrabajadosMes,
  historialPagos,
  guardarConfigEmpleado,
  actualizarNombreEmpleado,
  setActivoEmpleado,
  registrarPagoEmpleado,
  diasEsperadosMes,
  montoSugeridoPago,
  type Empleado,
  type PagoEmpleado,
} from '../../../lib/empleados'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

function hoyISO(): string {
  const d = new Date()
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export default function EmpleadoDetalleScreen() {
  const requireModulo = useRequireModulo('gestion-empleado')
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  // ─── Estado de carga ───────────────────────────────────────────────────────
  const [empleado, setEmpleado] = useState<Empleado | null>(null)
  const [diasEsteMes, setDiasEsteMes] = useState<number>(0)
  const [pagos, setPagos] = useState<PagoEmpleado[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // ─── Campos de edición ──────────────────────────────────────────────────────
  const [nombre, setNombre] = useState('')
  const [sueldoTexto, setSueldoTexto] = useState('')
  const [diasSemanaTexto, setDiasSemanaTexto] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [guardando, setGuardando] = useState(false)

  // ─── Estado — activar/desactivar ───────────────────────────────────────────
  const [cambiandoActivo, setCambiandoActivo] = useState(false)

  // ─── Campos de pago ────────────────────────────────────────────────────────
  const [montoTexto, setMontoTexto] = useState('')
  const [registrandoPago, setRegistrandoPago] = useState(false)

  // ─── Carga de datos ────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    if (!id) return
    setCargando(true)
    setErrorCarga(null)
    try {
      const ahora = new Date()
      const anio = ahora.getFullYear()
      const mes = ahora.getMonth() + 1 // 1-12

      const lista = await listarEmpleados()
      const emp = lista.find((e) => e.id === id) ?? null

      if (!emp) {
        setErrorCarga('Empleado no encontrado.')
        setCargando(false)
        return
      }

      const [dias, pagosData] = await Promise.all([
        diasTrabajadosMes(id, anio, mes),
        historialPagos(id),
      ])

      setEmpleado(emp)
      setDiasEsteMes(dias)
      setPagos(pagosData)

      // Inicializar campos de edición con los datos actuales
      setNombre(emp.nombre)
      setSueldoTexto(emp.config?.sueldo_mensual != null ? String(emp.config.sueldo_mensual) : '')
      setDiasSemanaTexto(
        emp.config?.dias_trabajo_semana != null ? String(emp.config.dias_trabajo_semana) : ''
      )
      setFechaInicio(emp.config?.fecha_inicio ?? '')

      // Calcular monto sugerido de pago
      const diasSemana = emp.config?.dias_trabajo_semana ?? null
      const sueldo = emp.config?.sueldo_mensual ?? 0
      const diasEsp = diasEsperadosMes(diasSemana, anio, mes)
      const montoSug = montoSugeridoPago(sueldo, dias, diasEsp)
      setMontoTexto(String(montoSug))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setErrorCarga(msg)
    } finally {
      setCargando(false)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      cargarDatos()
    }, [cargarDatos])
  )

  // ─── Guard de módulo ───────────────────────────────────────────────────────
  if (requireModulo) return requireModulo

  // ─── Guardar datos del empleado ────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!empleado) return
    const nombreTrimmed = nombre.trim()
    if (!nombreTrimmed) {
      Alert.alert('Validación', 'El nombre no puede estar vacío.')
      return
    }
    const sueldo = parseInt(sueldoTexto.replace(/[^0-9]/g, ''), 10)
    if (isNaN(sueldo) || sueldo < 0) {
      Alert.alert('Validación', 'El sueldo mensual debe ser un número válido.')
      return
    }
    const diasSemana =
      diasSemanaTexto.trim() !== ''
        ? parseInt(diasSemanaTexto.replace(/[^0-9]/g, ''), 10)
        : null
    if (diasSemana !== null && (isNaN(diasSemana) || diasSemana < 1 || diasSemana > 7)) {
      Alert.alert('Validación', 'Los días de trabajo por semana deben estar entre 1 y 7.')
      return
    }
    const fechaInicioParsed = fechaInicio.trim() || null
    if (fechaInicioParsed) {
      const regexFecha = /^\d{4}-\d{2}-\d{2}$/
      if (!regexFecha.test(fechaInicioParsed)) {
        Alert.alert('Validación', 'La fecha de inicio debe tener el formato AAAA-MM-DD.')
        return
      }
    }

    try {
      setGuardando(true)
      await actualizarNombreEmpleado(empleado.id, nombreTrimmed)
      await guardarConfigEmpleado(empleado.id, {
        sueldo_mensual: sueldo,
        fecha_inicio: fechaInicioParsed,
        dias_trabajo_semana: diasSemana,
      })
      Alert.alert('Guardado', 'Los datos del empleado se guardaron correctamente.')
      await cargarDatos()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      Alert.alert('Error', msg)
    } finally {
      setGuardando(false)
    }
  }

  // ─── Activar / Desactivar ──────────────────────────────────────────────────
  const handleToggleActivo = () => {
    if (!empleado) return
    const nuevoActivo = !empleado.activo
    const titulo = nuevoActivo ? 'Activar empleado' : 'Desactivar empleado'
    const mensaje = nuevoActivo
      ? `¿Activar a ${empleado.nombre}? Podrá iniciar sesión nuevamente.`
      : `¿Desactivar a ${empleado.nombre}? El empleado no podrá iniciar sesión.`

    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: nuevoActivo ? 'Activar' : 'Desactivar',
        style: nuevoActivo ? 'default' : 'destructive',
        onPress: async () => {
          try {
            setCambiandoActivo(true)
            await setActivoEmpleado(empleado.id, nuevoActivo)
            await cargarDatos()
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al cambiar estado'
            Alert.alert('Error', msg)
          } finally {
            setCambiandoActivo(false)
          }
        },
      },
    ])
  }

  // ─── Registrar pago ────────────────────────────────────────────────────────
  const handleRegistrarPago = async () => {
    if (!empleado) return
    const monto = parseInt(montoTexto.replace(/[^0-9]/g, ''), 10)
    if (isNaN(monto) || monto <= 0) {
      Alert.alert('Validación', 'El monto del pago debe ser mayor a cero.')
      return
    }

    Alert.alert(
      'Confirmar pago',
      `Registrar pago de ${pesos(monto)} para ${empleado.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Registrar',
          onPress: async () => {
            try {
              setRegistrandoPago(true)
              const ahora = new Date()
              const anio = ahora.getFullYear()
              const mes = ahora.getMonth() + 1
              // periodo: primer y último día del mes actual
              const periodoInicio = `${anio}-${String(mes).padStart(2, '0')}-01`
              const ultimoDia = new Date(anio, mes, 0).getDate()
              const periodoFin = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

              await registrarPagoEmpleado({
                empleado_id: empleado.id,
                monto,
                fecha_pago: hoyISO(),
                periodo_inicio: periodoInicio,
                periodo_fin: periodoFin,
                dias_trabajados: diasEsteMes,
              })
              Alert.alert('Pago registrado', 'El pago se registró correctamente.')
              const pagosActualizados = await historialPagos(empleado.id)
              setPagos(pagosActualizados)
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Error al registrar pago'
              Alert.alert('Error', msg)
            } finally {
              setRegistrandoPago(false)
            }
          },
        },
      ]
    )
  }

  // ─── Pantalla de carga ─────────────────────────────────────────────────────
  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Cargando empleado...</Text>
      </View>
    )
  }

  if (errorCarga || !empleado) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{errorCarga ?? 'Empleado no encontrado.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => cargarDatos()}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Volver al listado</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const rolLabel = empleado.rol === 'admin' ? 'Administrativo' : 'Operativo'
  const ahora = new Date()
  const anioActual = ahora.getFullYear()
  const mesActual = ahora.getMonth() + 1
  const diasSemanaNum = empleado.config?.dias_trabajo_semana ?? null
  const sueldoNum = empleado.config?.sueldo_mensual ?? 0
  const diasEsp = diasEsperadosMes(diasSemanaNum, anioActual, mesActual)
  const montoSug = montoSugeridoPago(sueldoNum, diasEsteMes, diasEsp)

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── Cabecera del empleado ── */}
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={28} color="#3b82f6" />
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.headerNombre}>{empleado.nombre}</Text>
                <Text style={styles.headerRol}>{rolLabel}</Text>
                {empleado.email ? (
                  <Text style={styles.headerEmail} numberOfLines={1}>
                    {empleado.email}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.badge, empleado.activo ? styles.badgeActivo : styles.badgeInactivo]}>
                <View style={[styles.badgeDot, empleado.activo ? styles.dotActivo : styles.dotInactivo]} />
                <Text style={[styles.badgeText, empleado.activo ? styles.badgeTextActivo : styles.badgeTextInactivo]}>
                  {empleado.activo ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Sección 1: Datos ── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Datos del empleado</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={nombre}
                onChangeText={setNombre}
                placeholder="Nombre completo"
                testID="input-nombre"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Sueldo mensual (COP) *</Text>
              <TextInput
                style={styles.input}
                value={sueldoTexto}
                onChangeText={(t) => setSueldoTexto(t.replace(/[^0-9]/g, ''))}
                placeholder="Ej. 1300000"
                keyboardType="numeric"
                testID="input-sueldo"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Días de trabajo por semana (opcional)</Text>
              <TextInput
                style={styles.input}
                value={diasSemanaTexto}
                onChangeText={(t) => setDiasSemanaTexto(t.replace(/[^0-9]/g, ''))}
                placeholder="Ej. 6  (predeterminado: 6)"
                keyboardType="numeric"
                maxLength={1}
                testID="input-dias-semana"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fecha de inicio (AAAA-MM-DD, opcional)</Text>
              <TextInput
                style={styles.input}
                value={fechaInicio}
                onChangeText={setFechaInicio}
                placeholder="Ej. 2025-01-15"
                maxLength={10}
                testID="input-fecha-inicio"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, guardando && styles.buttonDisabled]}
              onPress={handleGuardar}
              disabled={guardando}
              testID="btn-guardar"
            >
              {guardando ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#ffffff" style={styles.btnIcon} />
                  <Text style={styles.primaryButtonText}>Guardar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Sección 2: Estado (Activar / Desactivar) ── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Estado del empleado</Text>
            <Text style={styles.estadoDesc}>
              {empleado.activo
                ? 'El empleado puede iniciar sesión en la app.'
                : 'El empleado no puede iniciar sesión. Actívalo para restablecer el acceso.'}
            </Text>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                empleado.activo ? styles.toggleButtonDesactivar : styles.toggleButtonActivar,
                cambiandoActivo && styles.buttonDisabled,
              ]}
              onPress={handleToggleActivo}
              disabled={cambiandoActivo}
              testID="btn-toggle-activo"
            >
              {cambiandoActivo ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons
                    name={empleado.activo ? 'ban-outline' : 'checkmark-circle-outline'}
                    size={18}
                    color="#ffffff"
                    style={styles.btnIcon}
                  />
                  <Text style={styles.toggleButtonText}>
                    {empleado.activo ? 'Desactivar empleado' : 'Activar empleado'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Sección 3: Días este mes ── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Días trabajados este mes</Text>
            <View style={styles.diasRow}>
              <Ionicons name="calendar-outline" size={32} color="#3b82f6" />
              <View style={styles.diasInfo}>
                <Text style={styles.diasNumero}>{diasEsteMes}</Text>
                <Text style={styles.diasLabel}>días registrados</Text>
              </View>
              <View style={styles.diasExpected}>
                <Text style={styles.diasEspLabel}>Esperados</Text>
                <Text style={styles.diasEspNumero}>{diasEsp}</Text>
              </View>
            </View>
          </View>

          {/* ── Sección 4: Registrar pago ── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Registrar pago</Text>

            <View style={styles.montoSugeridoBanner}>
              <Ionicons name="information-circle-outline" size={16} color="#1d4ed8" />
              <Text style={styles.montoSugeridoText}>
                Monto proporcional sugerido: {pesos(montoSug)} ({diasEsteMes}/{diasEsp} días)
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Monto a pagar (COP) *</Text>
              <TextInput
                style={styles.input}
                value={montoTexto}
                onChangeText={(t) => setMontoTexto(t.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="Ej. 650000"
                testID="input-monto-pago"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, registrandoPago && styles.buttonDisabled]}
              onPress={handleRegistrarPago}
              disabled={registrandoPago}
              testID="btn-registrar-pago"
            >
              {registrandoPago ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="cash-outline" size={18} color="#ffffff" style={styles.btnIcon} />
                  <Text style={styles.primaryButtonText}>Registrar pago</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Sección 5: Historial de pagos ── */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Historial de pagos</Text>

            {pagos.length === 0 ? (
              <View style={styles.emptyHistorial}>
                <Ionicons name="receipt-outline" size={36} color="#d1d5db" />
                <Text style={styles.emptyHistorialText}>Sin pagos registrados.</Text>
              </View>
            ) : (
              pagos.map((pago) => (
                <View key={pago.id} style={styles.pagoRow}>
                  <View style={styles.pagoIcono}>
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  </View>
                  <View style={styles.pagoInfo}>
                    <Text style={styles.pagoMonto}>{pesos(pago.monto)}</Text>
                    <Text style={styles.pagoFecha}>
                      {new Date(pago.fecha_pago + 'T12:00:00').toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                    {pago.dias_trabajados != null && (
                      <Text style={styles.pagoMeta}>Días: {pago.dias_trabajados}</Text>
                    )}
                    {pago.periodo_inicio && pago.periodo_fin && (
                      <Text style={styles.pagoMeta}>
                        Período: {pago.periodo_inicio} → {pago.periodo_fin}
                      </Text>
                    )}
                    {pago.nota ? <Text style={styles.pagoNota}>{pago.nota}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f9fafb' },
  flex: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f9fafb',
  },
  loadingText: { marginTop: 12, color: '#4b5563', fontSize: 15 },
  errorText: {
    fontSize: 15,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  backLink: { paddingVertical: 8 },
  backLinkText: { color: '#6b7280', fontSize: 14, textDecorationLine: 'underline' },

  scrollContent: { padding: 16, paddingBottom: 48 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // Cabecera
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: { flex: 1 },
  headerNombre: { fontSize: 17, fontWeight: '700', color: '#111827' },
  headerRol: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  headerEmail: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeActivo: { backgroundColor: '#dcfce7' },
  badgeInactivo: { backgroundColor: '#fee2e2' },
  badgeDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  dotActivo: { backgroundColor: '#16a34a' },
  dotInactivo: { backgroundColor: '#dc2626' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextActivo: { color: '#15803d' },
  badgeTextInactivo: { color: '#b91c1c' },

  // Secciones
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },

  // Inputs
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#4b5563', marginBottom: 6 },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  // Botones
  primaryButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 4,
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  btnIcon: { marginRight: 7 },
  buttonDisabled: { opacity: 0.55 },

  toggleButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 4,
  },
  toggleButtonActivar: { backgroundColor: '#10b981' },
  toggleButtonDesactivar: { backgroundColor: '#ef4444' },
  toggleButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },

  estadoDesc: { fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 18 },

  // Días
  diasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  diasInfo: { flex: 1 },
  diasNumero: { fontSize: 36, fontWeight: '800', color: '#111827', lineHeight: 40 },
  diasLabel: { fontSize: 13, color: '#6b7280' },
  diasExpected: { alignItems: 'flex-end' },
  diasEspLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase' },
  diasEspNumero: { fontSize: 22, fontWeight: '700', color: '#4b5563' },

  // Pago
  montoSugeridoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  montoSugeridoText: { flex: 1, fontSize: 13, color: '#1d4ed8', lineHeight: 18 },

  // Historial
  emptyHistorial: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyHistorialText: { fontSize: 14, color: '#9ca3af' },
  pagoRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  pagoIcono: { paddingTop: 2 },
  pagoInfo: { flex: 1 },
  pagoMonto: { fontSize: 16, fontWeight: '700', color: '#111827' },
  pagoFecha: { fontSize: 13, color: '#4b5563', marginTop: 2 },
  pagoMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  pagoNota: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginTop: 2 },
})
