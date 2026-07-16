import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.useFakeTimers()

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Error: 'error' },
}))

import { TemaProvider } from '../../lib/tema'
import { TecladoPin } from './TecladoPin'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

type Nodo = { props: { onPress?: () => void; accessibilityLabel?: string } }

const teclas = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root
    .findAllByProps({ accessibilityRole: 'button' })
    .filter((n: Nodo) => n.props.onPress)

describe('TecladoPin', () => {
  it('renderiza los 10 dígitos y la tecla borrar', async () => {
    const arbol = await montar(<TecladoPin valor="" onDigito={() => {}} onBorrar={() => {}} />)
    const labels = teclas(arbol).map((n: Nodo) => n.props.accessibilityLabel)
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Borrar']) {
      expect(labels).toContain(d)
    }
  })

  it('tocar un dígito y borrar llaman sus callbacks', async () => {
    const onDigito = jest.fn()
    const onBorrar = jest.fn()
    const arbol = await montar(<TecladoPin valor="1" onDigito={onDigito} onBorrar={onBorrar} />)
    const todas = teclas(arbol)
    await act(async () => todas.find((n: Nodo) => n.props.accessibilityLabel === '5')!.props.onPress!())
    expect(onDigito).toHaveBeenCalledWith('5')
    await act(async () => todas.find((n: Nodo) => n.props.accessibilityLabel === 'Borrar')!.props.onPress!())
    expect(onBorrar).toHaveBeenCalled()
  })

  it('con valor "12" hay 2 puntos llenos y 2 vacíos', async () => {
    const arbol = await montar(<TecladoPin valor="12" onDigito={() => {}} onBorrar={() => {}} />)
    expect(arbol.root.findAllByProps({ testID: 'pin-punto-lleno' }).length).toBeGreaterThanOrEqual(2)
    expect(arbol.root.findAllByProps({ testID: 'pin-punto-vacio' }).length).toBeGreaterThanOrEqual(2)
  })

  it('deshabilitado no dispara onDigito', async () => {
    const onDigito = jest.fn()
    const arbol = await montar(
      <TecladoPin valor="" onDigito={onDigito} onBorrar={() => {}} deshabilitado />
    )
    const cinco = teclas(arbol).find((n: Nodo) => n.props.accessibilityLabel === '5')
    cinco?.props.onPress?.()
    expect(onDigito).not.toHaveBeenCalled()
  })
})
