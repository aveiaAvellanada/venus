import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRequireModulo } from '../../../lib/auth'
import { obtenerBalance, rangoPeriodo, proyeccionMes, type Balance } from '../../../lib/balance'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

type Tipo = 'semana' | 'mes'

const NOMBRE_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// Etiqueta legible del período que contiene refDate
function etiquetaPeriodo(tipo: Tipo, refDate: Date): string {
  if (tipo === 'mes') {
    return `${NOMBRE_MES[refDate.getMonth()]} ${refDate.getFullYear()}`
  }
  const { desde, hasta } = rangoPeriodo('semana', refDate)
  return `${desde} → ${hasta}`
}

// ¿El período seleccionado es el mes en curso? (única condición para mostrar proyección)
function esMesEnCurso(tipo: Tipo, refDate: Date): boolean {
  if (tipo !== 'mes') return false
  const hoy = new Date()
  return refDate.getFullYear() === hoy.getFullYear() && refDate.getMonth() === hoy.getMonth()
}

export default function BalanceIndex() {
  const requireModulo = useRequireModulo('balance')

  const [tipo, setTipo] = useState<Tipo>('mes')
  const [refDate, setRefDate] = useState<Date>(new Date())
  const [data, setData] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarDatos = useCallback(async (t: Tipo, ref: Date, isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    setError(null)
    try {
      const { desde, hasta } = rangoPeriodo(t, ref)
      const bal = await obtenerBalance(desde, hasta)
      setData(bal)
    } catch (err: unknown) {
      console.error('Error al cargar balance:', err)
      setError('No se pudo cargar el balance. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      // No disparar la petición si el rol no tiene acceso (el guard redirige abajo).
      if (!requireModulo) cargarDatos(tipo, refDate)
    }, [cargarDatos, requireModulo, tipo, refDate])
  )

  if (requireModulo) return requireModulo

  const cambiarTipo = (t: Tipo) => {
    if (t === tipo) return
    setTipo(t)
    setRefDate(new Date())
  }

  // Mueve refDate un mes o una semana atrás (-1) o adelante (+1)
  const mover = (dir: -1 | 1) => {
    setRefDate((prev) => {
      if (tipo === 'mes') {
        return new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
      }
      return new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + dir * 7)
    })
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos(tipo, refDate, true)
  }

  const balanceNum = data?.balance ?? 0
  const esPerdida = balanceNum < 0

  // Proyección: solo cuando el período es el mes en curso
  const mostrarProyeccion = esMesEnCurso(tipo, refDate) && data != null
  let proyeccion = 0
  if (mostrarProyeccion) {
    const hoy = new Date()
    const diaActual = hoy.getDate()
    const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
    proyeccion = proyeccionMes(balanceNum, diaActual, diasDelMes)
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Selector de período */}
      <View style={styles.selectorWrap}>
        <View style={styles.tipoRow}>
          <TouchableOpacity
            testID="btn-tipo-semana"
            style={[styles.tipoBtn, tipo === 'semana' && styles.tipoBtnActivo]}
            onPress={() => cambiarTipo('semana')}
          >
            <Text style={[styles.tipoText, tipo === 'semana' && styles.tipoTextActivo]}>Semana</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="btn-tipo-mes"
            style={[styles.tipoBtn, tipo === 'mes' && styles.tipoBtnActivo]}
            onPress={() => cambiarTipo('mes')}
          >
            <Text style={[styles.tipoText, tipo === 'mes' && styles.tipoTextActivo]}>Mes</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity testID="btn-nav-prev" style={styles.navBtn} onPress={() => mover(-1)} accessibilityLabel="Período anterior">
            <Ionicons name="chevron-back" size={22} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.periodoLabel}>{etiquetaPeriodo(tipo, refDate)}</Text>
          <TouchableOpacity testID="btn-nav-next" style={styles.navBtn} onPress={() => mover(1)} accessibilityLabel="Período siguiente">
            <Ionicons name="chevron-forward" size={22} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => cargarDatos(tipo, refDate)}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />}
        >
          {/* Tarjeta Balance */}
          <View style={[styles.balanceCard, esPerdida ? styles.balanceCardPerdida : styles.balanceCardGanancia]}>
            <Text style={styles.balanceLabel}>{esPerdida ? 'Pérdida' : 'Ganancia'}</Text>
            <Text style={[styles.balanceMonto, esPerdida ? styles.textoPerdida : styles.textoGanancia]}>
              {pesos(balanceNum)}
            </Text>
          </View>

          {/* Ingresos / Egresos */}
          <View style={styles.dosColumnas}>
            <View style={[styles.miniCard, styles.miniCardIngreso]}>
              <Ionicons name="arrow-down-circle-outline" size={20} color="#15803d" />
              <Text style={styles.miniLabel}>Ingresos netos</Text>
              <Text style={[styles.miniMonto, styles.textoGanancia]}>{pesos(data.ingresos.total_neto)}</Text>
            </View>
            <View style={[styles.miniCard, styles.miniCardEgreso]}>
              <Ionicons name="arrow-up-circle-outline" size={20} color="#b91c1c" />
              <Text style={styles.miniLabel}>Egresos</Text>
              <Text style={[styles.miniMonto, styles.textoPerdida]}>{pesos(data.egresos.total)}</Text>
            </View>
          </View>

          {/* Desglose de ingresos */}
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>Ingresos</Text>
            <Fila etiqueta="Efectivo" valor={pesos(data.ingresos.efectivo)} />
            <Fila etiqueta="Nequi" valor={pesos(data.ingresos.nequi)} />
            <Fila etiqueta="Daviplata" valor={pesos(data.ingresos.daviplata)} />
            <Fila etiqueta="Reembolsos" valor={'- ' + pesos(data.ingresos.reembolsos)} />
            <Fila etiqueta="Cobros de cambios" valor={pesos(data.ingresos.cobros_cambios)} />
            <Fila etiqueta="Total neto" valor={pesos(data.ingresos.total_neto)} total />
          </View>

          {/* Desglose de egresos */}
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>Egresos</Text>
            <Fila etiqueta="Gastos fijos" valor={pesos(data.egresos.gastos_fijos)} />
            <Fila etiqueta="Gastos variables" valor={pesos(data.egresos.gastos_variables)} />
            <Fila etiqueta="Pagos a proveedores" valor={pesos(data.egresos.pagos_proveedores)} />
            <Fila etiqueta="Sueldos" valor={pesos(data.egresos.sueldos)} />
            <Fila etiqueta="Total" valor={pesos(data.egresos.total)} total />
          </View>

          {/* Proyección del mes en curso */}
          {mostrarProyeccion && (
            <View style={styles.proyeccionCard}>
              <Ionicons name="trending-up-outline" size={18} color="#1d4ed8" style={styles.iconMargin} />
              <View style={styles.proyeccionTexto}>
                <Text style={styles.proyeccionLabel}>Proyección de cierre del mes</Text>
                <Text style={styles.proyeccionSub}>Según el promedio diario de lo que va del mes</Text>
              </View>
              <Text style={[styles.proyeccionMonto, proyeccion < 0 ? styles.textoPerdida : styles.textoGanancia]}>
                {pesos(proyeccion)}
              </Text>
            </View>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  )
}

function Fila({ etiqueta, valor, total }: { etiqueta: string; valor: string; total?: boolean }) {
  return (
    <View style={[styles.fila, total && styles.filaTotal]}>
      <Text style={[styles.filaEtiqueta, total && styles.filaTextoTotal]}>{etiqueta}</Text>
      <Text style={[styles.filaValor, total && styles.filaTextoTotal]}>{valor}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  selectorWrap: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tipoRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 3,
  },
  tipoBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tipoBtnActivo: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tipoText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  tipoTextActivo: { color: '#111827' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  navBtn: { padding: 6, borderRadius: 8 },
  periodoLabel: { fontSize: 15, fontWeight: '600', color: '#111827', textTransform: 'capitalize' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  balanceCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  balanceCardGanancia: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  balanceCardPerdida: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  balanceLabel: { fontSize: 14, fontWeight: '600', color: '#4b5563', marginBottom: 4 },
  balanceMonto: { fontSize: 32, fontWeight: '800' },
  textoGanancia: { color: '#15803d' },
  textoPerdida: { color: '#b91c1c' },
  dosColumnas: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  miniCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  miniCardIngreso: {},
  miniCardEgreso: {},
  miniLabel: { fontSize: 12, color: '#6b7280', marginTop: 6 },
  miniMonto: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  seccion: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  seccionTitulo: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },
  fila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  filaTotal: { borderTopWidth: 1, borderTopColor: '#f3f4f6', marginTop: 4, paddingTop: 10 },
  filaEtiqueta: { fontSize: 14, color: '#4b5563' },
  filaValor: { fontSize: 14, color: '#111827', fontWeight: '500' },
  filaTextoTotal: { fontWeight: '700', color: '#111827' },
  proyeccionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  iconMargin: { marginRight: 4 },
  proyeccionTexto: { flex: 1, marginLeft: 4 },
  proyeccionLabel: { fontSize: 13, fontWeight: '600', color: '#1e3a8a' },
  proyeccionSub: { fontSize: 11, color: '#3b82f6', marginTop: 2 },
  proyeccionMonto: { fontSize: 16, fontWeight: '700', marginLeft: 8 },
  errorText: { fontSize: 15, color: '#ef4444', textAlign: 'center', marginTop: 12, marginBottom: 16 },
  retryButton: { backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  retryButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
})
