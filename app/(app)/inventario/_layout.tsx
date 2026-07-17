import { Stack } from 'expo-router'

export default function InventarioLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="calzado/[id]" options={{ presentation: 'card' }} />
    </Stack>
  )
}
