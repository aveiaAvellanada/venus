import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRequireModulo } from '../../../lib/auth'
import { MODULOS } from '../../../lib/permisos'

export default function ModuloPlaceholder() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const redireccion = useRequireModulo(id ?? '')
  if (redireccion) return redireccion

  const modulo = MODULOS.find(m => m.id === id)
  return (
    <View style={styles.container}>
      <Text style={styles.icono}>{modulo?.icono ?? '❓'}</Text>
      <Text style={styles.titulo}>{modulo?.titulo ?? 'Módulo'}</Text>
      <Text style={styles.sub}>En construcción</Text>
      <Pressable style={styles.btn} onPress={() => router.back()}>
        <Text style={styles.btnText}>← Volver</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#fff' },
  icono: { fontSize: 64 },
  titulo: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 18, color: '#777' },
  btn: { marginTop: 24, backgroundColor: '#1E66F5', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
})
