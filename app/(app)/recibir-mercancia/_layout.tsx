import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function RecibirMercanciaLayout() {
  // Enforce access control at the layout level
  const requireModulo = useRequireModulo('recibir-mercancia')
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
      <Stack.Screen name="index" options={{ title: 'Entradas de Mercancía' }} />
      <Stack.Screen name="nueva" options={{ title: 'Nueva Entrada' }} />
      <Stack.Screen name="[id]" options={{ title: 'Completar Entrada' }} />
    </Stack>
  )
}
