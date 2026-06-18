import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function ReportesLayout() {
  const requireModulo = useRequireModulo('reportes')
  if (requireModulo) return requireModulo
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerShadowVisible: false,
        headerTintColor: '#111827',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#f9fafb' },
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Reportes' }} />
      <Stack.Screen name="periodos" options={{ title: 'Reporte de período' }} />
    </Stack>
  )
}
