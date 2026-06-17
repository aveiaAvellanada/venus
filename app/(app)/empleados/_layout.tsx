import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function EmpleadosLayout() {
  const requireModulo = useRequireModulo('gestion-empleado')
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
      <Stack.Screen name="index" options={{ title: 'Empleados' }} />
      <Stack.Screen name="[id]" options={{ title: 'Empleado' }} />
    </Stack>
  )
}
