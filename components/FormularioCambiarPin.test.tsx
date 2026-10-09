import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { Text } from 'react-native'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Error: 'error' },
}))

const mockCambiarMiPin = jest.fn()
jest.mock('../lib/usuarios', () => ({
  ...jest.requireActual('../lib/usuarios'),
  cambiarMiPin: (...a: unknown[]) => mockCambiarMiPin(...a),
}))
jest.mock('../lib/supabase', () => ({ supabase: {} }))

import { TemaProvider } from '../lib/tema'
import { FormularioCambiarPin } from './FormularioCambiarPin'

type Arbol = ReturnType<typeof renderer.create>

async function montar(onListo = jest.fn()) {
  let arbol!: Arbol
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <FormularioCambiarPin obligatorio onListo={onListo} />
      </TemaProvider>
    )
  })
  return arbol
}

const texto = (arbol: Arbol) =>
  arbol.root.findAllByType(Text).map((t: renderer.ReactTestInstance) => t.props.children).flat().join(' ')

async function tocar(arbol: Arbol, etiqueta: string) {
  const b = arbol.root.findAll(
    (n: renderer.ReactTestInstance) =>
      n.props?.accessibilityRole === 'button' && n.props?.accessibilityLabel === etiqueta && n.props?.onPress
  )[0]
  await act(async () => b.props.onPress())
}

async function teclear(arbol: Arbol, digitos: string) {
  for (const d of digitos) await tocar(arbol, d)
}

beforeEach(() => {
  mockCambiarMiPin.mockReset()
  mockCambiarMiPin.mockResolvedValue(undefined)
})

describe('FormularioCambiarPin', () => {
  it('PIN actual de 4 (Continuar) → nuevo de 6 → repetir: guarda y avisa', async () => {
    const onListo = jest.fn()
    const arbol = await montar(onListo)
    expect(texto(arbol)).toContain('Ahora los PIN son de 6 dígitos')
    await teclear(arbol, '1111')
    await tocar(arbol, 'Continuar')
    expect(texto(arbol)).toContain('Crea tu PIN nuevo de 6 dígitos')
    await teclear(arbol, '482915')
    expect(texto(arbol)).toContain('Repite el PIN nuevo')
    await teclear(arbol, '482915')
    expect(mockCambiarMiPin).toHaveBeenCalledWith('1111', '482915')
    expect(onListo).toHaveBeenCalled()
  })

  it('un PIN nuevo trivial se rechaza antes de ir al servidor', async () => {
    const arbol = await montar()
    await teclear(arbol, '1111')
    await tocar(arbol, 'Continuar')
    await teclear(arbol, '123456')
    expect(texto(arbol)).toContain('muy fácil de adivinar')
    expect(texto(arbol)).toContain('Crea tu PIN nuevo de 6 dígitos')
    expect(mockCambiarMiPin).not.toHaveBeenCalled()
  })

  it('si la confirmación no coincide, vuelve a pedir el PIN nuevo', async () => {
    const arbol = await montar()
    await teclear(arbol, '1111')
    await tocar(arbol, 'Continuar')
    await teclear(arbol, '482915')
    await teclear(arbol, '482916')
    expect(texto(arbol)).toContain('Los PIN no coinciden')
    expect(texto(arbol)).toContain('Crea tu PIN nuevo de 6 dígitos')
    expect(mockCambiarMiPin).not.toHaveBeenCalled()
  })

  it('con el PIN actual equivocado muestra el error y empieza de nuevo', async () => {
    mockCambiarMiPin.mockRejectedValue(new Error('El PIN actual no es correcto.'))
    const onListo = jest.fn()
    const arbol = await montar(onListo)
    await teclear(arbol, '9999')
    await tocar(arbol, 'Continuar')
    await teclear(arbol, '482915')
    await teclear(arbol, '482915')
    expect(texto(arbol)).toContain('El PIN actual no es correcto.')
    expect(texto(arbol)).toContain('Escribe tu PIN actual')
    expect(onListo).not.toHaveBeenCalled()
  })
})
