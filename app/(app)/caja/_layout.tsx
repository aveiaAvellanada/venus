import { Pila, OPCIONES_MODAL } from '../../../components/Pila'

export default function CajaLayout() {
  return (
    <Pila>
      <Pila.Screen name="index" />
      <Pila.Screen name="cierre" options={OPCIONES_MODAL} />
      <Pila.Screen name="historial" />
      <Pila.Screen name="config" />
    </Pila>
  )
}
