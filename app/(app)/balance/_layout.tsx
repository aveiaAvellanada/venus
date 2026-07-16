import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function BalanceLayout() {
  const requireModulo = useRequireModulo('balance')
  if (requireModulo) return requireModulo
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  )
}
