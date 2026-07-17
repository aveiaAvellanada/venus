import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { Text } from 'react-native'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.useFakeTimers()

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

import { TemaProvider } from '../../lib/tema'
import { ToastProvider, useToast } from './Toast'

function Disparador({ mensaje, tipo }: { mensaje: string; tipo?: 'exito' | 'error' | 'info' }) {
  const { mostrar } = useToast()
  return <Text onPress={() => mostrar(mensaje, tipo)}>disparar</Text>
}

// Montar con await para que TemaProvider se cargue correctamente
async function montar(mensaje: string, tipo?: 'exito' | 'error' | 'info') {
  let arbol: renderer.ReactTestRenderer
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <ToastProvider>
          <Disparador mensaje={mensaje} tipo={tipo} />
        </ToastProvider>
      </TemaProvider>
    )
  })
  return arbol!
}

const textos = (arbol: renderer.ReactTestRenderer) =>
  arbol.root.findAllByType(Text).map((t: any) => t.props.children).flat().join(' ')

describe('Toast', () => {
  test('mostrar() renderiza el mensaje', async () => {
    const arbol = await montar('Agregado: talla 40 · Negro')
    act(() => { arbol.root.findAllByType(Text)[0].props.onPress() })
    expect(textos(arbol)).toContain('Agregado: talla 40 · Negro')
  })

  test('se autodescarta a los 2.5s', async () => {
    const arbol = await montar('Hola')
    act(() => { arbol.root.findAllByType(Text)[0].props.onPress() })
    expect(textos(arbol)).toContain('Hola')
    act(() => { jest.advanceTimersByTime(2600) })
    expect(textos(arbol)).not.toContain('Hola')
  })

  test('un toast a la vez: el nuevo reemplaza al anterior', async () => {
    const arbol = await montar('Primero')
    const boton = arbol.root.findAllByType(Text)[0]
    act(() => { boton.props.onPress() })
    act(() => { arbol.update(
      <TemaProvider><ToastProvider><Disparador mensaje="Segundo" /></ToastProvider></TemaProvider>
    ) })
    act(() => { arbol.root.findAllByType(Text)[0].props.onPress() })
    expect(textos(arbol)).toContain('Segundo')
    expect(textos(arbol)).not.toContain('Primero')
  })

  test('useToast fuera del provider lanza error', () => {
    function Suelto() { useToast(); return null }
    expect(() => {
      act(() => {
        renderer.create(<Suelto />)
      })
    }).toThrow('ToastProvider')
  })
})
