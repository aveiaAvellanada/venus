import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function EmpleadosLayout() {
  const requireModulo = useRequireModulo('gestion-empleado')
  if (requireModulo) return requireModulo
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  )
}
