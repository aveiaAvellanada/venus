import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { TextInput } from 'react-native'

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

import AsyncStorage from '@react-native-async-storage/async-storage'
import { TemaProvider } from './tema'
import { recordarUsuario } from './usuarios'
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

async function tocar(arbol: ReturnType<typeof renderer.create>, etiqueta: string) {
  const b = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === etiqueta)!
  await act(async () => b.props.onPress!())
}

async function escribirUsuario(arbol: ReturnType<typeof renderer.create>, texto: string) {
  const campo = arbol.root.findByType(TextInput)
  await act(async () => campo.props.onChangeText(texto))
  await tocar(arbol, 'Continuar')
}

async function teclear(arbol: ReturnType<typeof renderer.create>, digitos: string) {
  for (const d of digitos) await tocar(arbol, d)
}

describe('Login: usuario + PIN de 6', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await AsyncStorage.clear()
    mockIniciarSesion.mockResolvedValue({})
  })

  it('sin nadie recordado pide escribir el usuario (no hay lista fija de personas)', async () => {
    const arbol = await montar()
    expect(existeTexto(arbol, '¿Quién eres?')).toBe(true)
    expect(existeTexto(arbol, 'Tu usuario')).toBe(true)
  })

  it('muestra como botones a quienes ya entraron en este teléfono', async () => {
    await recordarUsuario({ usuario: 'luisa', nombre: 'Luisa Gómez' })
    const arbol = await montar()
    expect(existeTexto(arbol, 'Luisa Gómez')).toBe(true)
    await tocar(arbol, 'Luisa Gómez')
    expect(existeTexto(arbol, 'Hola, Luisa')).toBe(true)
  })

  it('al teclear 6 dígitos entra automáticamente con el usuario escrito', async () => {
    const arbol = await montar()
    await escribirUsuario(arbol, '  Pedro.T ')
    expect(existeTexto(arbol, 'Escribe tu PIN de 6 dígitos')).toBe(true)
    await teclear(arbol, '12345')
    expect(mockIniciarSesion).not.toHaveBeenCalled()
    await teclear(arbol, '6')
    expect(mockIniciarSesion).toHaveBeenCalledWith('pedro.t', '123456')
  })

  it('un usuario con espacios o tildes no avanza', async () => {
    const arbol = await montar()
    await escribirUsuario(arbol, 'luisa gómez')
    expect(existeTexto(arbol, 'Escribe tu usuario (sin espacios ni tildes).')).toBe(true)
    expect(existeTexto(arbol, 'Escribe tu PIN de 6 dígitos')).toBe(false)
  })

  it('el PIN anterior de 4 dígitos entra con el botón (y luego debe cambiarlo)', async () => {
    const arbol = await montar()
    await escribirUsuario(arbol, 'andres')
    await teclear(arbol, '1234')
    expect(mockIniciarSesion).not.toHaveBeenCalled()
    await tocar(arbol, 'Entrar con mi PIN de 4')
    expect(mockIniciarSesion).toHaveBeenCalledWith('andres', '1234')
  })

  it('con error muestra el mensaje y limpia el PIN a los 600ms', async () => {
    mockIniciarSesion.mockResolvedValue({ error: 'Usuario o PIN incorrecto. Intenta de nuevo.' })
    const arbol = await montar()
    await escribirUsuario(arbol, 'luisa')
    await teclear(arbol, '999999')
    expect(existeTexto(arbol, 'Usuario o PIN incorrecto. Intenta de nuevo.')).toBe(true)
    await act(async () => {
      jest.advanceTimersByTime(700)
    })
    expect(arbol.root.findAllByProps({ testID: 'pin-punto-lleno' }).length).toBe(0)
  })

  it('Cambiar usuario vuelve al paso 1', async () => {
    const arbol = await montar()
    await escribirUsuario(arbol, 'luisa')
    await tocar(arbol, 'Cambiar usuario')
    expect(existeTexto(arbol, '¿Quién eres?')).toBe(true)
  })
})
