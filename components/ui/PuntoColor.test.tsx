import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

import { TemaProvider } from '../../lib/tema'
import { PuntoColor } from './PuntoColor'

async function montar(color: string) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <PuntoColor color={color} tamano={12} />
      </TemaProvider>
    )
  })
  return arbol
}

const mitades = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root
    .findAll((n: { props: { testID?: string }; type: unknown }) => n.props.testID === 'punto-color-mitad' && typeof n.type !== 'function')
    .map((n: { props: { [k: string]: any } }) => n.props.style.backgroundColor)

describe('PuntoColor', () => {
  it('un color llena todo el círculo', async () => {
    expect(mitades(await montar('Negro'))).toEqual(['#1C1C1E'])
  })

  it('dos colores parten el círculo: el primero a la izquierda', async () => {
    expect(mitades(await montar('Rojo y blanco'))).toEqual(['#DC2626', '#FFFFFF'])
  })
})
