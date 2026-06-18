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
import { rangoPeriodo } from '../../../lib/balance'
import { obtenerReportePeriodo, compararConAyer, type ReportePeriodo } from '../../../lib/reportes'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

type Tipo = 'semana' | 'mes'

const NOMBRE_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function etiquetaPeriodo(tipo: Tipo, refDate: Date): string {
  if (tipo === 'mes') return `${NOMBRE_MES[refDate.getMonth()]} ${refDate.getFullYear()}`
  const { desde, hasta } = rangoPeriodo('semana', refDate)
  return `${desde} → ${hasta}`
}

export default function ReportesPeriodos() {
  const requireModulo = useRequireModulo('reportes')

  const [tipo, setTipo] = useState<Tipo>('mes')
  const [refDate, setRefDate] = useState<Date>(new Date())
  const [data, setData] = useState<ReportePeriodo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarDatos = useCallback(async (t: Tipo, ref: Date, isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    setError(null)
    try {
      const { desde, hasta } = rangoPeriodo(t, ref)
      setData(await obtenerReportePeriodo(desde, hasta))
    } catch (err: unknown) {
      console.error('Error al cargar el reporte:', err)
      setError('No se pudo cargar el reporte. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (!requireModulo) cargarDatos(tipo, refDate)
    }, [cargarDatos, requireModulo, tipo, refDate])
  )

  if (requireModulo) return requireModulo

  const cambiarTipo = (t: Tipo) => {
    if (t === tipo) return
    setTipo(t)
    setRefDate(new Date())
  }

  const mover = (dir: -1 | 1) => {
    setRefDate((prev) => {
      if (tipo === 'mes') return new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
      return new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + dir * 7)
    })
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos(tipo, refDate, true)
  }

  const cmp = data ? compararConAyer(data.total_vendido, data.total_anterior) : null

  return (
    <SafeAreaView style={styles.container}>
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
          {/* Total + comparación */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Total vendido</Text>
            <Text style={styles.total}>{pesos(data.total_vendido)}</Text>
            {cmp && (
              <View style={styles.cmpRow}>
                {cmp.sinBase ? (
                  <Text style={styles.cmpNeutro}>— sin comparación</Text>
                ) : (
                  <>
                    <Ionicons
                      name={cmp.direccion === 'sube' ? 'arrow-up' : cmp.direccion === 'baja' ? 'arrow-down' : 'remove'}
                      size={14}
                      color={cmp.direccion === 'sube' ? '#15803d' : cmp.direccion === 'baja' ? '#b91c1c' : '#6b7280'}
                    />
                    <Text style={[styles.cmpText, cmp.direccion === 'sube' ? styles.textoSube : cmp.direccion === 'baja' ? styles.textoBaja : styles.cmpNeutro]}>
                      {cmp.pct}% vs período anterior
                    </Text>
                  </>
                )}
              </View>
            )}
            <View style={styles.desglose}>
              <Fila etiqueta="Nº de ventas" valor={String(data.num_ventas)} />
              <Fila etiqueta="Efectivo" valor={pesos(data.efectivo)} />
              <Fila etiqueta="Nequi" valor={pesos(data.nequi)} />
              <Fila etiqueta="Daviplata" valor={pesos(data.daviplata)} />
            </View>
          </View>

          {/* Día con más ventas */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Día con más ventas</Text>
            {data.dia_top ? (
              <View style={styles.fila}>
                <Text style={styles.filaEtiqueta}>{data.dia_top.fecha}</Text>
                <Text style={styles.filaValor}>{pesos(data.dia_top.monto)}</Text>
              </View>
            ) : (
              <Text style={styles.vacio}>Sin ventas en el período.</Text>
            )}
          </View>

          {/* Top productos */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Top productos (por unidades)</Text>
            {data.top_productos.length === 0 ? (
              <Text style={styles.vacio}>Sin ventas en el período.</Text>
            ) : (
              data.top_productos.map((p, i) => (
                <View key={i} style={styles.fila}>
                  <Text style={styles.filaEtiqueta} numberOfLines={1}>{p.producto}</Text>
                  <View style={styles.topValores}>
                    <Text style={styles.filaValor}>{p.unidades} u.</Text>
                    <Text style={styles.topMonto}>{pesos(p.monto)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Sin movimiento */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Calzado sin movimiento</Text>
            {data.sin_movimiento.length === 0 ? (
              <Text style={styles.vacio}>Todo el catálogo tuvo movimiento.</Text>
            ) : (
              data.sin_movimiento.map((p) => (
                <View key={p.id} style={styles.fila}>
                  <Text style={styles.filaEtiqueta} numberOfLines={1}>{p.producto}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  )
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaEtiqueta}>{etiqueta}</Text>
      <Text style={styles.filaValor}>{valor}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  selectorWrap: { backgroundColor: '#ffffff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tipoRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 10, padding: 3 },
  tipoBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tipoBtnActivo: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tipoText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  tipoTextActivo: { color: '#111827' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  navBtn: { padding: 6, borderRadius: 8 },
  periodoLabel: { fontSize: 15, fontWeight: '600', color: '#111827', textTransform: 'capitalize' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12 },
  cardTitulo: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },
  total: { fontSize: 28, fontWeight: '800', color: '#111827' },
  cmpRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, marginBottom: 6 },
  cmpText: { fontSize: 13, fontWeight: '600' },
  cmpNeutro: { fontSize: 13, color: '#6b7280' },
  textoSube: { color: '#15803d' },
  textoBaja: { color: '#b91c1c' },
  desglose: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  filaEtiqueta: { fontSize: 14, color: '#4b5563', flex: 1, marginRight: 8 },
  filaValor: { fontSize: 14, color: '#111827', fontWeight: '500' },
  topValores: { alignItems: 'flex-end' },
  topMonto: { fontSize: 12, color: '#6b7280' },
  vacio: { fontSize: 13, color: '#9ca3af', paddingVertical: 4 },
  errorText: { fontSize: 15, color: '#ef4444', textAlign: 'center', marginTop: 12, marginBottom: 16 },
  retryButton: { backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  retryButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
})
