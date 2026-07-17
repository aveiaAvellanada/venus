import { Alert } from 'react-native'

// Compra rápida vacía el carrito antes de agregar su único ítem. Si el
// carrito ya tiene productos sin cobrar, pide confirmación para no perder
// una venta a medio armar. Con el carrito vacío no molesta y continúa directo.
export function confirmarCompraRapida(itemsEnCarrito: number, continuar: () => void): void {
  if (itemsEnCarrito <= 0) {
    continuar()
    return
  }
  Alert.alert(
    'Carrito con productos',
    `Tienes ${itemsEnCarrito} producto${itemsEnCarrito === 1 ? '' : 's'} sin cobrar. ` +
      'Compra rápida los quitará para vender solo este. ¿Continuar?',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Vaciar y continuar', style: 'destructive', onPress: continuar },
    ],
  )
}
