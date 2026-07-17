import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.useFakeTimers()

const mockNotification = jest.fn((_arg?: unknown) => Promise.resolve())
jest.mock('expo-haptics', () => ({
  notificationAsync: (arg: unknown) => mockNotification(arg),
  NotificationFeedbackType: { Success: 'success' },
}))

import { TemaProvider } from '../../lib/tema'
import { OverlayExito } from './OverlayExito'

async function montar(visible: boolean, mensaje?: string, onFin?: jest.Mock) {
  let arbol: renderer.ReactTestRenderer
  const cb = onFin || jest.fn()
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <OverlayExito visible={visible} mensaje={mensaje} onFin={cb} />
      </TemaProvider>
    )
  })
  return arbol!
}

describe('OverlayExito', () => {
  test('visible dispara haptic y llama onFin a los 1.2s', async () => {
    const onFin = jest.fn()
    await montar(true, 'Venta registrada', onFin)
    expect(mockNotification).toHaveBeenCalled()
    expect(onFin).not.toHaveBeenCalled()
    act(() => { jest.advanceTimersByTime(1300) })
    expect(onFin).toHaveBeenCalledTimes(1)
  })

  test('no visible: no renderiza ni agenda nada', async () => {
    const onFin = jest.fn()
    const arbol = await montar(false, undefined, onFin)
    expect(arbol!.toJSON()).toBeNull()
    act(() => { jest.advanceTimersByTime(2000) })
    expect(onFin).not.toHaveBeenCalled()
  })
})
