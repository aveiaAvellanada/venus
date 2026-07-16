import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.useFakeTimers()

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('./supabase', () => ({ supabase: {} }))
jest.mock('../lib/supabase', () => ({ supabase: {} }))

const mockUseAuth = jest.fn()
jest.mock('../lib/auth', () => ({ useAuth: () => mockUseAuth() }))

import AsyncStorage from '@react-native-async-storage/async-storage'
import { TemaProvider } from './tema'
import Perfil from '../app/(app)/(tabs)/perfil'

function conPerfil(rol: string, nombre = 'Andrés Artunduaga') {
  mockUseAuth.mockReturnValue({ perfil: { nombre, rol }, cerrarSesion: jest.fn() })
}

async function montar() {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <Perfil />
      </TemaProvider>
    )
  })
  return arbol
}

type Nodo = { props: { onPress?: () => void; accessibilityState?: { selected?: boolean } } }

const existeTexto = (arbol: ReturnType<typeof renderer.create>, texto: string) =>
  arbol.root.findAllByProps({ children: texto }).length > 0

describe('Perfil', () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    jest.clearAllMocks()
  })

  it('muestra nombre y badge de rol para el dueño', async () => {
    conPerfil('dueno')
    const arbol = await montar()
    expect(existeTexto(arbol, 'Andrés Artunduaga')).toBe(true)
    expect(existeTexto(arbol, 'Dueño')).toBe(true)
  })

  it('el segmentado de tema arranca en Sistema y al elegir Oscuro persiste', async () => {
    conPerfil('dueno')
    const arbol = await montar()
    const tabs = arbol.root.findAllByProps({ accessibilityRole: 'tab' }).filter((n: Nodo) => n.props.onPress)
    expect(tabs).toHaveLength(3)
    expect(tabs[2].props.accessibilityState).toEqual({ selected: true }) // Sistema
    await act(async () => tabs[1].props.onPress!()) // Oscuro
    expect(await AsyncStorage.getItem('venus.tema')).toBe('oscuro')
  })

  it('empleado no ve Automatización de caja ni Empleados', async () => {
    conPerfil('empleado', 'Camilo Artunduaga')
    const arbol = await montar()
    expect(existeTexto(arbol, 'Automatización de caja')).toBe(false)
    expect(existeTexto(arbol, 'Empleados')).toBe(false)
    expect(existeTexto(arbol, 'Operativo')).toBe(true)
  })

  it('la fila Cerrar sesión existe', async () => {
    conPerfil('dueno')
    const arbol = await montar()
    expect(existeTexto(arbol, 'Cerrar sesión')).toBe(true)
  })
})
