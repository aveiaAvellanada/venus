import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.useFakeTimers()

import { TemaProvider } from '../../lib/tema'
import { paletaClara } from '../../lib/theme'
import { ChipTalla } from './ChipTalla'
import { PillColor } from './PillColor'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

describe('ChipTalla', () => {
  it('muestra talla y stock; seleccionada usa primario', async () => {
    const arbol = await montar(<ChipTalla talla="40" stock={5} seleccionada onPress={() => {}} />)
    expect(arbol.root.findByProps({ children: '40' })).toBeTruthy()
    expect(arbol.root.findByProps({ children: 5 })).toBeTruthy()
    const chip = arbol.root.findByProps({ accessibilityRole: 'button' })
    expect(chip.props.accessibilityState).toMatchObject({ selected: true })
  })

  it('sin stock: visible pero deshabilitada, no dispara onPress', async () => {
    const onPress = jest.fn()
    const arbol = await montar(<ChipTalla talla="41" stock={0} seleccionada={false} onPress={onPress} />)
    const chip = arbol.root.findByProps({ accessibilityRole: 'button' })
    expect(chip.props.accessibilityState).toMatchObject({ disabled: true })
    chip.props.onPress?.()
    expect(onPress).not.toHaveBeenCalled()
  })
})

describe('PillColor', () => {
  it('muestra el nombre, marca selección y dispara onPress', async () => {
    const onPress = jest.fn()
    const arbol = await montar(<PillColor nombre="Negro" seleccionado onPress={onPress} />)
    expect(arbol.root.findByProps({ children: 'Negro' })).toBeTruthy()
    const pill = arbol.root.findByProps({ accessibilityRole: 'button' })
    expect(pill.props.accessibilityState).toEqual({ selected: true })
    await act(async () => pill.props.onPress())
    expect(onPress).toHaveBeenCalled()
    void paletaClara
  })
})
