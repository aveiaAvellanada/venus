import React from 'react'
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

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

import { TemaProvider } from '../../lib/tema'
import { TabBar } from './TabBar'

function propsFalsas(indiceActivo = 0) {
  return {
    state: {
      index: indiceActivo,
      routes: [
        { key: 'index-1', name: 'index' },
        { key: 'mov-1', name: 'movimientos' },
        { key: 'prod-1', name: 'productos' },
        { key: 'perfil-1', name: 'perfil' },
      ],
    },
    navigation: {
      navigate: jest.fn(),
      emit: jest.fn(() => ({ defaultPrevented: false })),
    },
    // los demás campos de BottomTabBarProps no se usan
  } as never
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function montar(props: any) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <TabBar {...props} />
      </TemaProvider>
    )
  })
  return arbol
}

type Nodo = { props: { onPress?: () => void; accessibilityState?: { selected?: boolean } } }

describe('TabBar', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renderiza los 4 tabs con sus labels', async () => {
    const arbol = await montar(propsFalsas())
    for (const label of ['Menú', 'Movimientos', 'Productos', 'Perfil']) {
      expect(arbol.root.findByProps({ children: label })).toBeTruthy()
    }
    const tabs = arbol.root
      .findAllByProps({ accessibilityRole: 'tab' })
      .filter((n: Nodo) => n.props.onPress)
    expect(tabs).toHaveLength(4)
  })

  it('marca el tab activo como seleccionado', async () => {
    const arbol = await montar(propsFalsas(2))
    const tabs = arbol.root
      .findAllByProps({ accessibilityRole: 'tab' })
      .filter((n: Nodo) => n.props.onPress)
    expect(tabs[2].props.accessibilityState).toEqual({ selected: true })
    expect(tabs[0].props.accessibilityState).toEqual({ selected: false })
  })

  it('tocar un tab inactivo navega a su ruta', async () => {
    const props = propsFalsas(0) as { navigation: { navigate: jest.Mock } }
    const arbol = await montar(props as never)
    const tabs = arbol.root
      .findAllByProps({ accessibilityRole: 'tab' })
      .filter((n: Nodo) => n.props.onPress)
    await act(async () => tabs[2].props.onPress!())
    expect(props.navigation.navigate).toHaveBeenCalledWith('productos')
  })

  it('el FAB va a Nueva Venta', async () => {
    const arbol = await montar(propsFalsas())
    const fab = arbol.root.findByProps({ accessibilityLabel: 'Nueva venta' })
    await act(async () => fab.props.onPress())
    expect(mockPush).toHaveBeenCalledWith('/ventas/nueva')
  })
})
