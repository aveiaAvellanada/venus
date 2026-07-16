import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function RecibirMercanciaLayout() {
  // Enforce access control at the layout level
  const requireModulo = useRequireModulo('recibir-mercancia')
  if (requireModulo) return requireModulo

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="nueva" />
      <Stack.Screen name="[id]" />
    </Stack>
  )
}
