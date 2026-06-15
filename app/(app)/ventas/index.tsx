import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'
import { listarVentasHoy, resumenHoy, type VentaResumen } from '../../../lib/ventas'

const pesos = (n: number) => '$' + n.toLocaleString('es-CO')

export default function VentasHub() {
  const redir = useRequireModulo('ventas')
  const router = useRouter()
  const [resumen, setResumen] = useState({ cantidad: 0, total: 0 })
  const [ventas, setVentas] = useState<VentaResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [r, v] = await Promise.all([resumenHoy(), listarVentasHoy()])
      setResumen(r)
      setVentas(v)
    } catch {
      setError('No se pudieron cargar las ventas de hoy.')
    } finally {
      setCargando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (redir) return redir

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16}>
          <Text style={styles.volver}>← Inicio</Text>
        </Pressable>
        <Text style={styles.titulo}>Ventas</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.resumen}>
        <Text style={styles.resumenMonto}>{pesos(resumen.total)}</Text>
        <Text style={styles.resumenSub}>Hoy · {resumen.cantidad} ventas</Text>
      </View>

      <Pressable style={styles.nuevaBtn} onPress={() => router.push('/ventas/nueva')}>
        <Text style={styles.nuevaBtnText}>+ Nueva venta</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {cargando ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : ventas.length === 0 ? (
          <Text style={styles.vacio}>Aún no hay ventas hoy.</Text>
        ) : (
          ventas.map(v => (
            <View key={v.id} style={styles.fila}>
              <View>
                <Text style={styles.filaTotal}>{pesos(v.total)}</Text>
                <Text style={styles.filaSub}>#{v.numero} · {v.metodos}</Text>
              </View>
              <Text style={styles.filaHora}>{v.hora}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  volver: { fontSize: 16, color: '#1E66F5', fontWeight: '600' },
  titulo: { fontSize: 20, fontWeight: '700' },
  resumen: { alignItems: 'center', paddingVertical: 24 },
  resumenMonto: { fontSize: 40, fontWeight: '800' },
  resumenSub: { fontSize: 16, color: '#666', marginTop: 4 },
  nuevaBtn: { backgroundColor: '#1E66F5', marginHorizontal: 20, borderRadius: 20, paddingVertical: 22, alignItems: 'center' },
  nuevaBtnText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  error: { color: '#D20F39', textAlign: 'center', marginTop: 16, fontSize: 15 },
  lista: { flex: 1, marginTop: 24, paddingHorizontal: 20 },
  vacio: { textAlign: 'center', color: '#999', marginTop: 24, fontSize: 16 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  filaTotal: { fontSize: 18, fontWeight: '700' },
  filaSub: { fontSize: 13, color: '#888', marginTop: 2 },
  filaHora: { fontSize: 14, color: '#666' },
})
