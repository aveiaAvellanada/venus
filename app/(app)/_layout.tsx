import { View } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuth } from '../../lib/auth'
import { CarritoProvider } from '../../lib/carrito-contexto'
import { VentasPendientesProvider } from '../../lib/ventasPendientes-contexto'
import { ToastProvider } from '../../components/ui'
import { Pila } from '../../components/Pila'
import { AvisoSinConexion } from '../../components/AvisoSinConexion'

export default function AppLayout() {
  const { session } = useAuth()
  if (!session) return <Redirect href="/login" />
  return (
    <VentasPendientesProvider>
      <CarritoProvider>
        <ToastProvider>
          <View style={{ flex: 1 }}>
            <Pila />
            <AvisoSinConexion />
          </View>
        </ToastProvider>
      </CarritoProvider>
    </VentasPendientesProvider>
  )
}
