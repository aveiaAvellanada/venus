import { useRequireModulo } from '../../../lib/auth'
import { Pila, OPCIONES_MODAL } from '../../../components/Pila'

export default function ProveedoresLayout() {
  // Enforce access control at the layout level
  const requireModulo = useRequireModulo('proveedores')
  if (requireModulo) return requireModulo

  return (
    <Pila>
      <Pila.Screen name="index" />
      <Pila.Screen name="editor" options={OPCIONES_MODAL} />
      <Pila.Screen name="[id]" />
    </Pila>
  )
}
