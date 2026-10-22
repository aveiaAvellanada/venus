import { useRequireModulo } from '../../../lib/auth'
import { Pila } from '../../../components/Pila'

export default function DevolucionesLayout() {
  const requireModulo = useRequireModulo('devoluciones')
  if (requireModulo) return requireModulo
  return (
    <Pila />
  )
}
