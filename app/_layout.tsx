import { Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { AuthProvider, useAuth } from '../lib/auth'

function Navegacion() {
  const { cargando } = useAuth()
  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
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
