import React from 'react'
import { Text } from 'react-native'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

import { CarritoProvider, useCarrito } from './carrito-contexto'

function Sonda() {
  const { items, dispatch } = useCarrito()
  return (
    <Text
      testID="sonda"
      onPress={() =>
        dispatch({
          tipo: 'agregar',
          producto: {
            tipo: 'calzado',
            id: 'c1',
            titulo: 'Nike Air Max',
            detalle: 'Nike · Talla 40 · Negro',
            precio: 220000,
            stock: 5,
            precioMin: 150000,
            precioMax: 220000,
          },
        })
      }
    >{`${items.length}|${items[0]?.subtotal ?? 0}`}</Text>
  )
}

describe('CarritoProvider', () => {
  it('agregar desde cualquier pantalla actualiza el carrito compartido', async () => {
    let arbol!: ReturnType<typeof renderer.create>
    await act(async () => {
      arbol = renderer.create(
        <CarritoProvider>
          <Sonda />
        </CarritoProvider>
      )
    })
    const sonda = arbol.root.findByProps({ testID: 'sonda' })
    expect(sonda.props.children).toBe('0|0')
    await act(async () => sonda.props.onPress())
    expect(arbol.root.findByProps({ testID: 'sonda' }).props.children).toBe('1|220000')
  })

  it('useCarrito fuera del provider lanza error claro', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      act(() => {
        renderer.create(<Sonda />)
      })
    }).toThrow('useCarrito debe usarse dentro de <CarritoProvider>')
    spy.mockRestore()
  })
})
