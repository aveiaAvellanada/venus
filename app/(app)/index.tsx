import { useRouter } from 'expo-router'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../../lib/auth'
import { modulosPara } from '../../lib/permisos'

export default function Home() {
  const { perfil, cerrarSesion } = useAuth()
  const router = useRouter()
  if (!perfil) return null
  const modulos = modulosPara(perfil.rol)

  async function salir() {
    try {
      await cerrarSesion()
    } catch {
      Alert.alert('Error', 'No se pudo cerrar sesión. Intenta de nuevo.')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.saludo}>Hola, {perfil.nombre.split(' ')[0]}</Text>
        <Pressable onPress={salir} hitSlop={16}>
          <Text style={styles.salir}>Salir</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.grid}>
        {modulos.map(m => (
          <Pressable key={m.id} style={styles.tile} onPress={() => router.push(m.ruta ?? `/modulo/${m.id}`)}>
            <Text style={styles.icono}>{m.icono}</Text>
            <Text style={styles.tileText}>{m.titulo}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  saludo: { fontSize: 26, fontWeight: '700' },
  salir: { fontSize: 18, color: '#D20F39', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16, gap: 16 },
  tile: {
    width: '47%', aspectRatio: 1, backgroundColor: '#EFF5FF', borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  icono: { fontSize: 48 },
  tileText: { fontSize: 18, fontWeight: '600', textAlign: 'center', paddingHorizontal: 8 },
})
