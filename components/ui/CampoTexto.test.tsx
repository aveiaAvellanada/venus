import React from 'react'
import { TextInput } from 'react-native'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.useFakeTimers()

import { TemaProvider } from '../../lib/tema'
import { paletaClara } from '../../lib/theme'
import { CampoTexto } from './CampoTexto'
import { FilaLista } from './FilaLista'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

const aplanar = (estilo: unknown): Record<string, unknown> =>
  Object.assign({}, ...([estilo].flat(Infinity).filter(Boolean) as object[]))

describe('CampoTexto', () => {
  it('label visible y borde normal', async () => {
    const arbol = await montar(<CampoTexto etiqueta="Nombre del cliente" placeholder="Ana" />)
    expect(arbol.root.findByProps({ children: 'Nombre del cliente' })).toBeTruthy()
    const input = arbol.root.findByType(TextInput)
    expect(aplanar(input.props.style).borderColor).toBe(paletaClara.bordeFuerte)
  })

  it('focus pinta el borde primario; blur lo devuelve', async () => {
    const arbol = await montar(<CampoTexto etiqueta="Precio" />)
    const input = arbol.root.findByType(TextInput)
    await act(async () => input.props.onFocus?.({}))
    expect(aplanar(arbol.root.findByType(TextInput).props.style).borderColor).toBe(paletaClara.primario)
    await act(async () => input.props.onBlur?.({}))
    expect(aplanar(arbol.root.findByType(TextInput).props.style).borderColor).toBe(paletaClara.bordeFuerte)
  })

  it('error: borde peligro + mensaje debajo', async () => {
    const arbol = await montar(
      <CampoTexto etiqueta="Precio final" error="Está por debajo del precio mínimo" />
    )
    const input = arbol.root.findByType(TextInput)
    expect(aplanar(input.props.style).borderColor).toBe(paletaClara.peligro)
    expect(arbol.root.findByProps({ children: 'Está por debajo del precio mínimo' })).toBeTruthy()
  })
})

describe('FilaLista', () => {
  it('muestra título, subtítulo y llama onPress', async () => {
    const onPress = jest.fn()
    const arbol = await montar(
      <FilaLista titulo="Venta #102" subtitulo="2:14 PM · Efectivo" onPress={onPress} chevron />
    )
    expect(arbol.root.findByProps({ children: 'Venta #102' })).toBeTruthy()
    const fila = arbol.root.findByProps({ accessibilityRole: 'button' })
    fila.props.onPress()
    expect(onPress).toHaveBeenCalled()
  })
})
