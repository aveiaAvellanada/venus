import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.useFakeTimers()

jest.mock('./supabase', () => ({ supabase: {} }))
jest.mock('../lib/supabase', () => ({ supabase: {} }))

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Error: 'error' },
}))

const mockIniciarSesion = jest.fn()
jest.mock('../lib/auth', () => ({
  useAuth: () => ({ iniciarSesion: mockIniciarSesion }),
}))

import { TemaProvider } from './tema'
import { USUARIOS } from './usuarios'
import Login from '../app/(auth)/login'

async function montar() {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <Login />
      </TemaProvider>
    )
  })
  return arbol
}

type Nodo = { props: { onPress?: () => void; accessibilityLabel?: string } }

const botones = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root.findAllByProps({ accessibilityRole: 'button' }).filter((n: Nodo) => n.props.onPress)

const existeTexto = (arbol: ReturnType<typeof renderer.create>, texto: string) =>
  arbol.root.findAllByProps({ children: texto }).length > 0

async function elegirUsuario(arbol: ReturnType<typeof renderer.create>) {
  const primero = botones(arbol).find(
    (n: Nodo) => n.props.accessibilityLabel === USUARIOS[0].nombre
  )!
  await act(async () => primero.props.onPress!())
}

async function teclear(arbol: ReturnType<typeof renderer.create>, digitos: string) {
  for (const d of digitos) {
    const tecla = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === d)!
    await act(async () => tecla.props.onPress!())
  }
}

describe('Login con TecladoPin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIniciarSesion.mockResolvedValue({})
  })

  it('paso 1: muestra ¿Quién eres? y todos los usuarios', async () => {
    const arbol = await montar()
    expect(existeTexto(arbol, '¿Quién eres?')).toBe(true)
    for (const u of USUARIOS) {
      expect(existeTexto(arbol, u.nombre)).toBe(true)
    }
  })

  it('elegir usuario muestra el saludo y el teclado', async () => {
    const arbol = await montar()
    await elegirUsuario(arbol)
    expect(existeTexto(arbol, `Hola, ${USUARIOS[0].nombre.split(' ')[0]}`)).toBe(true)
    expect(botones(arbol).some((n: Nodo) => n.props.accessibilityLabel === '5')).toBe(true)
  })

  it('al teclear 4 dígitos llama iniciarSesion automáticamente', async () => {
    const arbol = await montar()
    await elegirUsuario(arbol)
    await teclear(arbol, '1234')
    expect(mockIniciarSesion).toHaveBeenCalledWith(USUARIOS[0].email, '1234')
  })

  it('con error muestra el mensaje y limpia el pin a los 600ms', async () => {
    mockIniciarSesion.mockResolvedValue({ error: 'PIN incorrecto' })
    const arbol = await montar()
    await elegirUsuario(arbol)
    await teclear(arbol, '9999')
    expect(existeTexto(arbol, 'PIN incorrecto')).toBe(true)
    await act(async () => {
      jest.advanceTimersByTime(700)
    })
    expect(arbol.root.findAllByProps({ testID: 'pin-punto-vacio' }).length).toBeGreaterThanOrEqual(4)
  })

  it('Cambiar usuario vuelve al paso 1', async () => {
    const arbol = await montar()
    await elegirUsuario(arbol)
    const volver = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Cambiar usuario')!
    await act(async () => volver.props.onPress!())
    expect(existeTexto(arbol, '¿Quién eres?')).toBe(true)
  })
})
