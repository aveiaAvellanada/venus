import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { KeyboardAvoidingView, ScrollView, Text } from 'react-native'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.useFakeTimers()

import { TemaProvider } from '../../lib/tema'
import { ScreenWrapper } from './ScreenWrapper'

async function montar(ui: React.ReactElement) {
  let arbol!: renderer.ReactTestRenderer
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

describe('ScreenWrapper', () => {
  test('el contenido va en un scroll dentro de un KeyboardAvoidingView con padding', async () => {
    const arbol = await montar(<ScreenWrapper><Text>campo</Text></ScreenWrapper>)
    const kav = arbol.root.findByType(KeyboardAvoidingView)
    expect(kav.props.behavior).toBe('padding')
    const scroll = arbol.root.findByType(ScrollView)
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled')
    expect(() => scroll.findByType(Text)).not.toThrow()
  })

  test('encabezado fuera del scroll; pie dentro del área que sube con el teclado; overlay aparte', async () => {
    const arbol = await montar(
      <ScreenWrapper header={<Text>cabecera</Text>} footer={<Text>pie</Text>} overlay={<Text>modal</Text>}>
        <Text>cuerpo</Text>
      </ScreenWrapper>
    )
    const kav = arbol.root.findByType(KeyboardAvoidingView)
    const scroll = arbol.root.findByType(ScrollView)
    expect(scroll.findAllByType(Text).map((t: renderer.ReactTestInstance) => t.props.children)).toEqual(['cuerpo'])
    expect(kav.findAllByType(Text).map((t: renderer.ReactTestInstance) => t.props.children)).toEqual(['cuerpo', 'pie'])
    const todos = arbol.root.findAllByType(Text).map((t: renderer.ReactTestInstance) => t.props.children)
    expect(todos).toEqual(expect.arrayContaining(['cabecera', 'modal']))
    expect(kav.findAllByType(Text).some((t: renderer.ReactTestInstance) => t.props.children === 'cabecera')).toBe(false)
  })
})
