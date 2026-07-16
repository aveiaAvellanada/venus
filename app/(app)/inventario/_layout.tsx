import { Stack } from 'expo-router'

export default function InventarioLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerShadowVisible: false,
        headerTintColor: '#111827',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#f9fafb' },
      }}
    >
      <Stack.Screen name="calzado/[id]" options={{ title: 'Detalle del Calzado', presentation: 'card' }} />
    </Stack>
  )
}
