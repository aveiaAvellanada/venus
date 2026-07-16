import React from 'react'
import { Text } from 'react-native'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

import AsyncStorage from '@react-native-async-storage/async-storage'
import { TemaProvider, useTema } from './tema'

function Sonda() {
  const { paleta, esOscuro, modo, setModo } = useTema()
  return (
    <Text testID="sonda" onPress={() => setModo('oscuro')}>{`${modo}|${esOscuro}|${paleta.primario}`}</Text>
  )
}

async function montar() {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <Sonda />
      </TemaProvider>
    )
  })
  return arbol
}

const leerSonda = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root.findByProps({ testID: 'sonda' }).props.children as string

describe('TemaProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    jest.clearAllMocks()
  })

  it('por defecto modo sistema → claro (useColorScheme null en tests)', async () => {
    const arbol = await montar()
    expect(leerSonda(arbol)).toBe('sistema|false|#1E66F5')
  })

  it('setModo cambia a oscuro y persiste en venus.tema', async () => {
    const arbol = await montar()
    await act(async () => {
      arbol.root.findByProps({ testID: 'sonda' }).props.onPress()
    })
    expect(leerSonda(arbol)).toBe('oscuro|true|#4C82F7')
    expect(await AsyncStorage.getItem('venus.tema')).toBe('oscuro')
  })

  it('carga el modo persistido al montar', async () => {
    await AsyncStorage.setItem('venus.tema', 'oscuro')
    const arbol = await montar()
    expect(leerSonda(arbol)).toBe('oscuro|true|#4C82F7')
  })

  it('useTema fuera del provider lanza error claro', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      act(() => {
        renderer.create(<Sonda />)
      })
    }).toThrow('useTema debe usarse dentro de <TemaProvider>')
    spy.mockRestore()
  })
})
