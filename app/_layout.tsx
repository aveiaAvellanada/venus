import { useCallback } from 'react'
import { Stack } from 'expo-router'
import { ActivityIndicator, Alert, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import { AuthProvider, useAuth } from '../lib/auth'
import { TemaProvider, useTema } from '../lib/tema'
import { espacio, tipografia } from '../lib/theme'
import { Boton } from '../components/ui'

SplashScreen.preventAutoHideAsync().catch(() => {})

function Navegacion() {
  const { cargando, session, perfil, cerrarSesion } = useAuth()
  const { paleta } = useTema()

  const salir = useCallback(async () => {
    try {
      await cerrarSesion()
    } catch {
      Alert.alert('Error', 'No se pudo cerrar sesión. Intenta de nuevo.')
    }
  }, [cerrarSesion])

  const centro = {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: espacio.l,
    padding: espacio.xxl,
    backgroundColor: paleta.fondo,
  }

  if (cargando) {
    return (
      <View style={centro}>
        <ActivityIndicator size="large" color={paleta.primario} />
      </View>
    )
  }

  // Fail-closed: hay sesión pero no se pudo cargar el perfil. No montamos la app;
  // ofrecemos cerrar sesión para volver al login (evita el loop de redirección).
  if (session && !perfil) {
    return (
      <View style={centro}>
        <Text style={[tipografia.h2, { color: paleta.texto, textAlign: 'center' }]}>
          No pudimos cargar tu perfil
        </Text>
        <Text style={[tipografia.cuerpo, { color: paleta.texto2, textAlign: 'center' }]}>
          Revisa tu conexión e intenta de nuevo.
        </Text>
        <Boton titulo="Cerrar sesión" onPress={salir} />
      </View>
    )
  }

  return <Stack screenOptions={{ headerShown: false }} />
}

function BarraEstado() {
  const { esOscuro } = useTema()
  return <StatusBar style={esOscuro ? 'light' : 'dark'} />
}

export default function RootLayout() {
  const [fuentesListas] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  })

  if (fuentesListas) SplashScreen.hideAsync().catch(() => {})
  if (!fuentesListas) return null

  return (
    <TemaProvider>
      <BarraEstado />
      <AuthProvider>
        <Navegacion />
      </AuthProvider>
    </TemaProvider>
  )
}
