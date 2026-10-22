import { useRequireModulo } from '../../../lib/auth'
import { Pila } from '../../../components/Pila'

export default function BalanceLayout() {
  const requireModulo = useRequireModulo('balance')
  if (requireModulo) return requireModulo
  return (
    <Pila>
      <Pila.Screen name="index" />
    </Pila>
  )
}
