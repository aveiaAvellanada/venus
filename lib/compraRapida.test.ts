import { Alert } from 'react-native'
import { confirmarCompraRapida } from './compraRapida'


describe('confirmarCompraRapida', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })

  test('carrito vacío: continúa directo, sin preguntar', () => {
    const continuar = jest.fn()
    confirmarCompraRapida(0, continuar)
    expect(continuar).toHaveBeenCalledTimes(1)
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  test('carrito con ítems: pregunta y NO continúa hasta confirmar', () => {
    const continuar = jest.fn()
    confirmarCompraRapida(3, continuar)
    expect(continuar).not.toHaveBeenCalled()
    expect(Alert.alert).toHaveBeenCalledTimes(1)

    const botones = (Alert.alert as jest.Mock).mock.calls[0][2]
    const cancelar = botones.find((b: { style?: string }) => b.style === 'cancel')
    const confirmar = botones.find((b: { style?: string }) => b.style === 'destructive')
    expect(cancelar).toBeTruthy()

    confirmar.onPress()
    expect(continuar).toHaveBeenCalledTimes(1)
  })

  test('mensaje en singular con un solo producto', () => {
    confirmarCompraRapida(1, jest.fn())
    const mensaje = (Alert.alert as jest.Mock).mock.calls[0][1]
    expect(mensaje).toContain('1 producto ')
    expect(mensaje).not.toContain('1 productos')
  })
})
