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
import { FormularioCambiarPin } from '../components/FormularioCambiarPin'

SplashScreen.preventAutoHideAsync().catch(() => {})

function Navegacion() {
  const { cargando, session, perfil, motivoSinPerfil, cerrarSesion, recargarPerfil } = useAuth()
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

  // Fail-closed: hay sesión pero no hay perfil. No montamos la app; ofrecemos
  // reintentar (si fue la red) o cerrar sesión (evita el loop de redirección).
  if (session && !perfil) {
    const desactivado = motivoSinPerfil === 'desactivado'
    return (
      <View style={centro}>
        <Text style={[tipografia.h2, { color: paleta.texto, textAlign: 'center' }]}>
          {desactivado ? 'Tu cuenta está desactivada' : 'No pudimos cargar tu perfil'}
        </Text>
        <Text style={[tipografia.cuerpo, { color: paleta.texto2, textAlign: 'center' }]}>
          {desactivado ? 'Habla con el administrador de la tienda.' : 'Revisa tu conexión e intenta de nuevo.'}
        </Text>
        {desactivado ? null : <Boton titulo="Reintentar" onPress={() => { recargarPerfil() }} />}
        <Boton titulo="Cerrar sesión" variante={desactivado ? 'primario' : 'fantasma'} onPress={salir} />
      </View>
    )
  }

  // Cuentas con el PIN viejo de 4 dígitos crean uno de 6 antes de seguir.
  if (session && perfil?.debeCambiarPin) {
    return <FormularioCambiarPin obligatorio onListo={() => { recargarPerfil() }} />
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
