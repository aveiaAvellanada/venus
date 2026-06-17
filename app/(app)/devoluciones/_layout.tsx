import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function DevolucionesLayout() {
  const requireModulo = useRequireModulo('devoluciones')
  if (requireModulo) return requireModulo
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: '#ffffff' }, headerShadowVisible: false,
      headerTintColor: '#111827', headerTitleStyle: { fontWeight: '600' },
      contentStyle: { backgroundColor: '#f9fafb' }, headerTitleAlign: 'center',
    }}>
      <Stack.Screen name="index" options={{ title: 'Devoluciones' }} />
      <Stack.Screen name="nueva" options={{ title: 'Nueva Devolución' }} />
    </Stack>
  )
}
