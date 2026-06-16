import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'
import { obtenerCajaHoy, abrirCaja, obtenerResumenEnVivo } from '../../../lib/caja'

const pesos = (n: number) => '$' + n.toLocaleString('es-CO')

export default function CajaDashboard() {
  const redir = useRequireModulo('caja')
  const router = useRouter()

  const [estadoCaja, setEstadoCaja] = useState<any>(null)
  const [resumen, setResumen] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [abriendo, setAbriendo] = useState(false)

  const cargarDatos = useCallback(async () => {
    try {
      const caja = await obtenerCajaHoy()
      setEstadoCaja(caja)
      if (caja && caja.estado === 'abierta') {
        const res = await obtenerResumenEnVivo()
        setResumen(res)
      } else if (caja && caja.estado === 'cerrada') {
        setResumen({
          total_general: caja.total_general,
          total_ventas: caja.total_ventas,
          total_efectivo: caja.total_efectivo,
          total_nequi: caja.total_nequi,
          total_daviplata: caja.total_daviplata
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  if (redir) return redir

  if (loading) {
    return (
      <View style={[styles.container, styles.centro]}>
        <ActivityIndicator size="large" color="#1E66F5" />
      </View>
    )
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos()
  }

  async function handleAbrir() {
    setAbriendo(true)
    try {
      await abrirCaja()
      await cargarDatos()
    } catch (e) {
      console.error(e)
    } finally {
      setAbriendo(false)
    }
  }

  if (!estadoCaja) {
    return (
      <View style={[styles.container, styles.centro]}>
        <Text style={styles.tituloGrande}>Caja del Día</Text>
        <Text style={styles.sub}>Aún no se ha abierto la caja para hoy.</Text>
        <Pressable style={styles.btnGigante} onPress={handleAbrir} disabled={abriendo}>
          {abriendo ? <ActivityIndicator color="#fff" size="large" /> : <Text style={styles.btnGiganteText}>Abrir Caja del Día</Text>}
        </Pressable>
      </View>
    )
  }

  const isAbierto = estadoCaja.estado === 'abierta'

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.tituloGrande}>{isAbierto ? 'Dashboard de Caja' : 'Resumen Final de Caja'}</Text>
      <Text style={[styles.estadoBadge, isAbierto ? styles.badgeAbierto : styles.badgeCerrado]}>
        {isAbierto ? 'ABIERTA' : 'CERRADA'}
      </Text>

      {resumen && (
        <View style={styles.dashboard}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardLabel}>Total General</Text>
            <Text style={styles.cardValueGigante}>{pesos(resumen.total_general)}</Text>
            <Text style={styles.cardSub}>{resumen.total_ventas} ventas en total</Text>
          </View>

          <View style={styles.grid}>
            <View style={styles.cardInfoMini}>
              <Text style={styles.cardLabel}>Efectivo</Text>
              <Text style={styles.cardValue}>{pesos(resumen.total_efectivo)}</Text>
            </View>
            <View style={styles.cardInfoMini}>
              <Text style={styles.cardLabel}>Nequi</Text>
              <Text style={styles.cardValue}>{pesos(resumen.total_nequi)}</Text>
            </View>
            <View style={styles.cardInfoMini}>
              <Text style={styles.cardLabel}>Daviplata</Text>
              <Text style={styles.cardValue}>{pesos(resumen.total_daviplata)}</Text>
            </View>
          </View>
        </View>
      )}

      {isAbierto && (
        <Pressable style={styles.btnCerrar} onPress={() => router.push('/caja/cierre')}>
          <Text style={styles.btnCerrarText}>Ir a Cerrar Caja</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  scrollContent: { padding: 24, paddingTop: 60, alignItems: 'center', gap: 20 },
  tituloGrande: { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 16, color: '#666', textAlign: 'center' },
  btnGigante: { backgroundColor: '#1E66F5', paddingVertical: 24, paddingHorizontal: 32, borderRadius: 24, marginTop: 20 },
  btnGiganteText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  estadoBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, overflow: 'hidden', fontWeight: '800', fontSize: 14 },
  badgeAbierto: { backgroundColor: '#E3F2E8', color: '#1E7A34' },
  badgeCerrado: { backgroundColor: '#FDECEF', color: '#D20F39' },
  dashboard: { width: '100%', gap: 12, marginTop: 12 },
  cardInfo: { backgroundColor: '#F8FAFC', padding: 24, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  cardLabel: { fontSize: 14, color: '#64748B', fontWeight: '600', textTransform: 'uppercase' },
  cardValueGigante: { fontSize: 40, fontWeight: '800', color: '#0F172A', marginVertical: 8 },
  cardSub: { fontSize: 14, color: '#64748B' },
  grid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  cardInfoMini: { flex: 1, minWidth: 100, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  cardValue: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginTop: 8 },
  btnCerrar: { width: '100%', backgroundColor: '#D20F39', paddingVertical: 18, borderRadius: 16, marginTop: 24, alignItems: 'center' },
  btnCerrarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
})
