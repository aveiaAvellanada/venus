import { useRequireModulo } from '../../../lib/auth'
import { Pila } from '../../../components/Pila'

export default function EmpleadosLayout() {
  const requireModulo = useRequireModulo('gestion-empleado')
  if (requireModulo) return requireModulo
  return (
    <Pila>
      <Pila.Screen name="index" />
      <Pila.Screen name="nuevo" />
      <Pila.Screen name="[id]" />
    </Pila>
  )
}
