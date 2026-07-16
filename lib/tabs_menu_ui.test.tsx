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
jest.mock('expo-router', () => {
  const ReactMock = require('react')
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: () => void) => {
      ReactMock.useEffect(() => {
        cb()
      }, [cb])
    },
  }
})

jest.mock('./supabase', () => ({ supabase: {} }))
jest.mock('../lib/supabase', () => ({ supabase: {} }))

const mockObtenerCajaHoy = jest.fn()
jest.mock('../lib/caja', () => ({ obtenerCajaHoy: (...args: unknown[]) => mockObtenerCajaHoy(...args) }))

const mockUseAuth = jest.fn()
jest.mock('../lib/auth', () => ({ useAuth: () => mockUseAuth() }))

import { TemaProvider } from './tema'
import Menu from '../app/(app)/(tabs)/index'

function conPerfil(rol: string, nombre = 'Andrés Artunduaga') {
  mockUseAuth.mockReturnValue({ perfil: { nombre, rol }, cerrarSesion: jest.fn() })
}

async function montar() {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <Menu />
      </TemaProvider>
    )
  })
  return arbol
}

const textos = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root
    .findAllByType(require('react-native').Text)
    .map((t: { props: { children: unknown } }) => t.props.children)
    .flat()

describe('Menú (tab index)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockObtenerCajaHoy.mockResolvedValue(null)
  })

  it('dueño: saludo y las 4 filas del menú', async () => {
    conPerfil('dueno')
    const arbol = await montar()
    expect(textos(arbol)).toContain('Hola, Andrés')
    for (const titulo of ['Proveedores', 'Reportes', 'Balance', 'Análisis IA']) {
      expect(arbol.root.findByProps({ children: titulo })).toBeTruthy()
    }
  })

  it('empleado: no ve módulos administrativos', async () => {
    conPerfil('empleado', 'Camilo Artunduaga')
    const arbol = await montar()
    const t = textos(arbol)
    for (const titulo of ['Proveedores', 'Reportes', 'Balance', 'Análisis IA']) {
      expect(t).not.toContain(titulo)
    }
  })

  it('badge: SIN ABRIR con caja null, ABIERTA con caja abierta', async () => {
    conPerfil('dueno')
    const a = await montar()
    expect(a.root.findByProps({ children: 'SIN ABRIR' })).toBeTruthy()

    mockObtenerCajaHoy.mockResolvedValue({ estado: 'abierta' })
    const b = await montar()
    expect(b.root.findByProps({ children: 'ABIERTA' })).toBeTruthy()
  })

  it('tocar el badge de caja navega a /caja', async () => {
    conPerfil('dueno')
    const arbol = await montar()
    const badge = arbol.root.findByProps({ accessibilityLabel: 'Estado de caja' })
    await act(async () => badge.props.onPress())
    expect(mockPush).toHaveBeenCalledWith('/caja')
  })
})
