import { Stack } from 'expo-router'

export default function CajaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="cierre" options={{ presentation: 'modal' }} />
      <Stack.Screen name="historial" />
      <Stack.Screen name="config" />
    </Stack>
  )
}
