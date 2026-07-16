import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { CarritoProvider } from '../../lib/carrito-contexto'

export default function AppLayout() {
  const { session } = useAuth()
  if (!session) return <Redirect href="/login" />
  return (
    <CarritoProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </CarritoProvider>
  )
}
