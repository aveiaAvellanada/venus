import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function ReportesLayout() {
  const requireModulo = useRequireModulo('reportes')
  if (requireModulo) return requireModulo
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="periodos" />
      <Stack.Screen name="config" />
    </Stack>
  )
}
