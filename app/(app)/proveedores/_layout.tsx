import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function ProveedoresLayout() {
  // Enforce access control at the layout level
  const requireModulo = useRequireModulo('proveedores')
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
      <Stack.Screen name="index" options={{ title: 'Proveedores' }} />
      <Stack.Screen name="editor" options={{ title: 'Editor de Proveedor', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Detalle de Proveedor' }} />
    </Stack>
  )
}
