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
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRequireModulo, useAuth } from '../../../lib/auth'
import {
  obtenerResumenDia,
  listarStockBajo,
  obtenerDashboardDueno,
  compararConAyer,
  type ResumenDia,
  type ProductoStockBajo,
  type DashboardDueno,
} from '../../../lib/reportes'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ReportesIndex() {
  const requireModulo = useRequireModulo('reportes')
  const { perfil } = useAuth()
  const router = useRouter()
  const esDueno = perfil?.rol === 'dueno'

  const [hoy, setHoy] = useState<ResumenDia | null>(null)
  const [ayer, setAyer] = useState<ResumenDia | null>(null)
  const [stockBajo, setStockBajo] = useState<ProductoStockBajo[]>([])
  const [dashDueno, setDashDueno] = useState<DashboardDueno | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarDatos = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true)
      setError(null)
      try {
        const ahora = new Date()
        const fechaHoy = toISO(ahora)
        const fechaAyer = toISO(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1))

        const [rHoy, rAyer, stock, dash] = await Promise.all([
          obtenerResumenDia(fechaHoy),
          obtenerResumenDia(fechaAyer),
          listarStockBajo(),
          esDueno ? obtenerDashboardDueno(7) : Promise.resolve(null),
        ])

        setHoy(rHoy)
        setAyer(rAyer)
        setStockBajo(stock)
        setDashDueno(dash)
      } catch (err: unknown) {
        console.error('Error al cargar el dashboard:', err)
        setError('No se pudo cargar el dashboard. Intenta de nuevo.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [esDueno]
  )

  useFocusEffect(
    useCallback(() => {
      // No disparar la carga si el rol no tiene acceso (el guard redirige abajo).
      if (!requireModulo) cargarDatos()
    }, [cargarDatos, requireModulo])
  )

  if (requireModulo) return requireModulo

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos(true)
  }

  const cmp =
    hoy && ayer ? compararConAyer(hoy.total_general, ayer.total_general) : null

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => cargarDatos()}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : hoy ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />}
        >
          {/* Acceso al reporte por semana / mes */}
          <TouchableOpacity
            testID="btn-ver-periodos"
            style={styles.linkPeriodos}
            onPress={() => router.push('/reportes/periodos')}
          >
            <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
            <Text style={styles.linkPeriodosText}>Ver reporte por semana / mes</Text>
            <Ionicons name="chevron-forward" size={16} color="#1d4ed8" />
          </TouchableOpacity>

          {/* Ventas de hoy */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Ventas de hoy</Text>
            <Text style={styles.totalHoy}>{pesos(hoy.total_general)}</Text>
            <View style={styles.ventasRow}>
              <Text style={styles.subtle}>{hoy.total_ventas} {hoy.total_ventas === 1 ? 'venta' : 'ventas'}</Text>
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
                      <Text
                        style={[
                          styles.cmpText,
                          cmp.direccion === 'sube' ? styles.textoSube : cmp.direccion === 'baja' ? styles.textoBaja : styles.cmpNeutro,
                        ]}
                      >
                        {cmp.pct}% vs ayer
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>
            <View style={styles.desglose}>
              <Fila etiqueta="Efectivo" valor={pesos(hoy.total_efectivo)} />
              <Fila etiqueta="Nequi" valor={pesos(hoy.total_nequi)} />
              <Fila etiqueta="Daviplata" valor={pesos(hoy.total_daviplata)} />
            </View>
          </View>

          {/* Stock bajo (ambos roles) */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Stock bajo</Text>
            {stockBajo.length === 0 ? (
              <Text style={styles.vacio}>Todo en orden con el stock.</Text>
            ) : (
              stockBajo.map((p) => (
                <View key={p.id} style={styles.fila}>
                  <Text style={styles.filaEtiqueta} numberOfLines={1}>
                    {p.descripcion}{p.talla ? ` · talla ${p.talla}` : ''}
                  </Text>
                  <Text style={styles.filaAlerta}>quedan {p.stock_actual}</Text>
                </View>
              ))
            )}
          </View>

          {/* Widgets solo-dueño */}
          {esDueno && dashDueno && (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitulo}>Proveedores por vencer</Text>
                {dashDueno.proveedores_por_vencer.length === 0 ? (
                  <Text style={styles.vacio}>Sin pagos próximos a vencer.</Text>
                ) : (
                  dashDueno.proveedores_por_vencer.map((p, i) => (
                    <View key={i} style={styles.fila}>
                      <View style={styles.provInfo}>
                        <Text style={styles.filaEtiqueta} numberOfLines={1}>{p.proveedor}</Text>
                        <Text style={[styles.provFecha, p.vencida && styles.textoBaja]}>
                          {p.vencida ? 'Vencida · ' : 'Vence '}{p.fecha_vencimiento}
                        </Text>
                      </View>
                      <Text style={[styles.filaValor, p.vencida && styles.textoBaja]}>{pesos(p.saldo)}</Text>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitulo}>Empleados sin actividad hoy</Text>
                {dashDueno.empleados_sin_actividad.length === 0 ? (
                  <Text style={styles.vacio}>Todos registraron actividad hoy.</Text>
                ) : (
                  dashDueno.empleados_sin_actividad.map((e) => (
                    <View key={e.id} style={styles.fila}>
                      <Ionicons name="person-outline" size={14} color="#6b7280" style={styles.iconMargin} />
                      <Text style={styles.filaEtiqueta}>{e.nombre}</Text>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
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
  linkPeriodos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 12, marginBottom: 12 },
  linkPeriodosText: { fontSize: 14, fontWeight: '600', color: '#1d4ed8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  cardTitulo: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },
  totalHoy: { fontSize: 30, fontWeight: '800', color: '#111827' },
  ventasRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, marginBottom: 8 },
  subtle: { fontSize: 13, color: '#6b7280' },
  cmpRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cmpText: { fontSize: 13, fontWeight: '600' },
  cmpNeutro: { fontSize: 13, color: '#6b7280' },
  textoSube: { color: '#15803d' },
  textoBaja: { color: '#b91c1c' },
  desglose: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  filaEtiqueta: { fontSize: 14, color: '#4b5563', flex: 1 },
  filaValor: { fontSize: 14, color: '#111827', fontWeight: '500' },
  filaAlerta: { fontSize: 13, color: '#b45309', fontWeight: '600' },
  provInfo: { flex: 1, marginRight: 8 },
  provFecha: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  vacio: { fontSize: 13, color: '#9ca3af', paddingVertical: 4 },
  iconMargin: { marginRight: 6 },
  errorText: { fontSize: 15, color: '#ef4444', textAlign: 'center', marginTop: 12, marginBottom: 16 },
  retryButton: { backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  retryButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
})
