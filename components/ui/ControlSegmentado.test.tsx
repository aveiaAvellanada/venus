import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.useFakeTimers()

import { TemaProvider } from '../../lib/tema'
import { paletaClara } from '../../lib/theme'
import { Chip } from './Chip'
import { ControlSegmentado } from './ControlSegmentado'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

const aplanar = (estilo: unknown): Record<string, unknown> =>
  Object.assign({}, ...([estilo].flat(Infinity).filter(Boolean) as object[]))

describe('Chip', () => {
  it('activo usa primario, inactivo usa superficie', async () => {
    const a = await montar(<Chip etiqueta="Hoy" activo onPress={() => {}} />)
    expect(aplanar(a.root.findByProps({ accessibilityRole: 'button' }).props.style).backgroundColor)
      .toBe(paletaClara.primario)
    const b = await montar(<Chip etiqueta="Semana" activo={false} onPress={() => {}} />)
    expect(aplanar(b.root.findByProps({ accessibilityRole: 'button' }).props.style).backgroundColor)
      .toBe(paletaClara.superficie)
  })
})

describe('ControlSegmentado', () => {
  it('renderiza las opciones y marca la activa como seleccionada', async () => {
    const arbol = await montar(
      <ControlSegmentado opciones={['Ventas', 'Devoluciones', 'Gastos']} indice={0} onCambio={() => {}} />
    )
    const tabs = arbol.root.findAllByProps({ accessibilityRole: 'tab' }).filter((n: { props: { onPress?: unknown } }) => n.props.onPress)
    expect(tabs).toHaveLength(3)
    expect(tabs[0].props.accessibilityState).toEqual({ selected: true })
    expect(tabs[1].props.accessibilityState).toEqual({ selected: false })
  })

  it('tocar una opción llama onCambio con su índice', async () => {
    const onCambio = jest.fn()
    const arbol = await montar(
      <ControlSegmentado opciones={['Calzado', 'Granja']} indice={0} onCambio={onCambio} />
    )
    const tabs = arbol.root.findAllByProps({ accessibilityRole: 'tab' }).filter((n: { props: { onPress?: unknown } }) => n.props.onPress)
    await act(async () => {
      tabs[1].props.onPress()
    })
    expect(onCambio).toHaveBeenCalledWith(1)
  })
})
