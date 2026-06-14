import { useCallback } from 'react'
import { Stack } from 'expo-router'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { AuthProvider, useAuth } from '../lib/auth'

function Navegacion() {
  const { cargando, session, perfil, cerrarSesion } = useAuth()

  const salir = useCallback(async () => {
    try {
      await cerrarSesion()
    } catch {
      Alert.alert('Error', 'No se pudo cerrar sesión. Intenta de nuevo.')
    }
  }, [cerrarSesion])

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  // Fail-closed: hay sesión pero no se pudo cargar el perfil. No montamos la app;
  // ofrecemos cerrar sesión para volver al login (evita el loop de redirección).
  if (session && !perfil) {
    return (
      <View style={styles.centro}>
        <Text style={styles.titulo}>No pudimos cargar tu perfil</Text>
        <Text style={styles.sub}>Revisa tu conexión e intenta de nuevo.</Text>
        <Pressable style={styles.btn} onPress={salir} hitSlop={16}>
          <Text style={styles.btnText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    )
  }

  return <Stack screenOptions={{ headerShown: false }} />
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Navegacion />
    </AuthProvider>
  )
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: '#fff' },
  titulo: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  sub: { fontSize: 16, color: '#777', textAlign: 'center' },
  btn: { marginTop: 8, backgroundColor: '#1E66F5', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 32 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
})
