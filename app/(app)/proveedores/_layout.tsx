import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function ProveedoresLayout() {
  // Enforce access control at the layout level
  const requireModulo = useRequireModulo('proveedores')
  if (requireModulo) return requireModulo

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="editor" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]" />
    </Stack>
  )
}
