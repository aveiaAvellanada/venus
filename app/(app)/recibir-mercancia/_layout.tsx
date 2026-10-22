import { useRequireModulo } from '../../../lib/auth'
import { Pila } from '../../../components/Pila'

export default function RecibirMercanciaLayout() {
  // Enforce access control at the layout level
  const requireModulo = useRequireModulo('recibir-mercancia')
  if (requireModulo) return requireModulo

  return (
    <Pila>
      <Pila.Screen name="index" />
      <Pila.Screen name="nueva" />
      <Pila.Screen name="[id]" />
    </Pila>
  )
}
