import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { CarritoProvider } from '../../lib/carrito-contexto'
import { ToastProvider } from '../../components/ui'

export default function AppLayout() {
  const { session } = useAuth()
  if (!session) return <Redirect href="/login" />
  return (
    <CarritoProvider>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ToastProvider>
    </CarritoProvider>
  )
}
