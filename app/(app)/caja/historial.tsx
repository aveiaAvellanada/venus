import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuth } from '../../../lib/auth'
import { supabase } from '../../../lib/supabase'

const pesos = (n: number) => '$' + n.toLocaleString('es-CO')

export default function HistorialCaja() {
  const { perfil } = useAuth()
  const puedeVer = perfil?.rol === 'dueno' || perfil?.rol === 'admin'
  const [cierres, setCierres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!puedeVer) return

      const { data, error } = await supabase
        .from('cierres_caja')
        .select('*, cerrado_por_user:users!cerrado_por(nombre)')
        .order('fecha', { ascending: false })

      if (!error && data) {
        setCierres(data)
      }
      setLoading(false)
    }
    load()
  }, [perfil])

  if (!puedeVer) {
    return <Redirect href="/caja" />
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centro]}>
        <ActivityIndicator size="large" color="#1E66F5" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.list}
        data={cierres}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => {
          const diff = item.diferencia || 0
          const isFaltante = diff < 0
          const hasDiff = Math.abs(diff) > 0.01

          return (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.fecha}>{item.fecha}</Text>
                <Text style={[styles.estadoBadge, item.estado === 'abierta' ? styles.bgAbierto : styles.bgCerrado]}>
                  {item.estado.toUpperCase()}
                </Text>
              </View>
              
              <View style={styles.totalesRow}>
                <View>
                  <Text style={styles.label}>Total General</Text>
                  <Text style={styles.totalGeneral}>{pesos(item.total_general || 0)}</Text>
                </View>

                {item.estado === 'cerrada' && (
                  <View style={styles.rightAlign}>
                    <Text style={styles.label}>Diferencia</Text>
                    <Text style={[styles.diferencia, hasDiff ? (isFaltante ? styles.textRojo : styles.textVerde) : styles.textGris]}>
                      {diff > 0 ? '+' : ''}{pesos(diff)}
                    </Text>
                  </View>
                )}
              </View>
              
              {item.estado === 'cerrada' && hasDiff && item.diferencia_nota && (
                <Text style={styles.nota}>Nota: {item.diferencia_nota}</Text>
              )}

              {item.estado === 'cerrada' && (
                <Text style={styles.nota}>Cerró: {item.cerrado_por_user?.nombre ?? 'Automático'}</Text>
              )}
            </View>
          )
        }}
        ListEmptyComponent={<Text style={styles.empty}>No hay registros de caja.</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centro: { justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  fecha: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  estadoBadge: { fontSize: 12, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  bgAbierto: { backgroundColor: '#E3F2E8', color: '#1E7A34' },
  bgCerrado: { backgroundColor: '#F1F5F9', color: '#64748B' },
  totalesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  label: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  totalGeneral: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  rightAlign: { alignItems: 'flex-end' },
  diferencia: { fontSize: 16, fontWeight: '700' },
  textGris: { color: '#64748B' },
  textRojo: { color: '#DC2626' },
  textVerde: { color: '#16A34A' },
  nota: { marginTop: 12, fontSize: 14, color: '#475569', fontStyle: 'italic', backgroundColor: '#F1F5F9', padding: 8, borderRadius: 8 },
  empty: { textAlign: 'center', color: '#64748B', marginTop: 40, fontSize: 16 }
})
