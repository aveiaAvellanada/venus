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
import { ChipTalla } from './ChipTalla'

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
    expect(arbol.root.findAllByProps({ testID: 'raya-diagonal' }).length).toBeGreaterThan(0)
  })

  it('con stock no lleva raya diagonal; acepta ancho fijo de grilla', async () => {
    const arbol = await montar(<ChipTalla talla="38" stock={2} seleccionada={false} onPress={() => {}} ancho={56} />)
    expect(arbol.root.findAllByProps({ testID: 'raya-diagonal' })).toHaveLength(0)
  })
})
