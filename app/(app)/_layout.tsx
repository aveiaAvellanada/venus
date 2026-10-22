import { Redirect } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { CarritoProvider } from '../../lib/carrito-contexto'
import { ToastProvider } from '../../components/ui'
import { Pila } from '../../components/Pila'

export default function AppLayout() {
  const { session } = useAuth()
  if (!session) return <Redirect href="/login" />
  return (
    <CarritoProvider>
      <ToastProvider>
        <Pila />
      </ToastProvider>
    </CarritoProvider>
  )
}
