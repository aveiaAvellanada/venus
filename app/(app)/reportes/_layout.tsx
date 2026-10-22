import { useRequireModulo } from '../../../lib/auth'
import { Pila } from '../../../components/Pila'

export default function ReportesLayout() {
  const requireModulo = useRequireModulo('reportes')
  if (requireModulo) return requireModulo
  return (
    <Pila>
      <Pila.Screen name="index" />
      <Pila.Screen name="periodos" />
      <Pila.Screen name="config" />
    </Pila>
  )
}
