import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// Mock Supabase (relative and absolute)
jest.mock('./supabase', () => ({ supabase: { rpc: jest.fn() } }))
jest.mock('../lib/supabase', () => ({ supabase: { rpc: jest.fn() } }))

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    Ionicons: (props: { name?: string; [key: string]: unknown }) =>
      React.createElement(Text, props, props.name),
  }
})

// Mock expo-router
jest.mock('expo-router', () => {
  const React = require('react')
  const StackScreen = (props: { name?: string; options?: unknown }) =>
    React.createElement('View', { testID: `stack-screen-${props.name}` })
  const Stack = (props: { children?: React.ReactNode; screenOptions?: unknown }) =>
    React.createElement('View', null, props.children)
  Stack.Screen = StackScreen
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: () => void) => {
      React.useEffect(() => {
        cb()
      }, [cb])
    },
    Redirect: jest.fn(({ href }: { href: string }) => `Redirected to ${href}`),
    Stack,
  }
})

// Mock auth — useRequireModulo returns null (granted) by default
import { useRequireModulo } from '../lib/auth'
jest.mock('../lib/auth', () => ({
  useAuth: jest.fn(),
  useRequireModulo: jest.fn(() => null),
}))

// Mock lib/balance — keep pure functions (proyeccionMes, rangoPeriodo), mock obtenerBalance
import * as apiBalance from './balance'
jest.mock('./balance', () => {
  const real = jest.requireActual('./balance')
  return { ...real, obtenerBalance: jest.fn() }
})
jest.mock('../lib/balance', () => {
  const real = jest.requireActual('../lib/balance')
  return { ...real, obtenerBalance: jest.fn() }
})

// Import screens AFTER all mocks
import BalanceLayout from '../app/(app)/balance/_layout'
import BalanceIndex from '../app/(app)/balance/index'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BALANCE_GANANCIA: apiBalance.Balance = {
  ingresos: { efectivo: 200000, nequi: 50000, daviplata: 0, reembolsos: 0, cobros_cambios: 0, total_neto: 250000 },
  egresos: { gastos_fijos: 20000, gastos_variables: 30000, pagos_proveedores: 40000, sueldos: 50000, total: 140000 },
  balance: 110000,
}

const BALANCE_PERDIDA: apiBalance.Balance = {
  ingresos: { efectivo: 100000, nequi: 0, daviplata: 0, reembolsos: 0, cobros_cambios: 0, total_neto: 100000 },
  egresos: { gastos_fijos: 20000, gastos_variables: 30000, pagos_proveedores: 40000, sueldos: 50000, total: 140000 },
  balance: -40000,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const flatten = (c: unknown): string => {
  if (typeof c === 'string') return c
  if (typeof c === 'number') return String(c)
  if (Array.isArray(c)) return c.map(flatten).join('')
  return ''
}

const findAllByText = (root: renderer.ReactTestInstance, text: string) =>
  root.findAll((el: renderer.ReactTestInstance) => el.type === 'Text' && flatten(el.props.children).trim() === text.trim())

const findAllContainingText = (root: renderer.ReactTestInstance, substring: string) =>
  root.findAll((el: renderer.ReactTestInstance) => el.type === 'Text' && flatten(el.props.children).includes(substring))

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Balance UI — tests de integración', () => {
  let tree: renderer.ReactTestRenderer | null = null

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRequireModulo as jest.Mock).mockReturnValue(null)
    ;(apiBalance.obtenerBalance as jest.Mock).mockResolvedValue(BALANCE_GANANCIA)
  })

  afterEach(async () => {
    if (tree) {
      try {
        await act(async () => {
          tree!.unmount()
        })
      } catch {
        // ignore
      }
      tree = null
    }
  })

  // ── 1. Gating dueño-only ─────────────────────────────────────────────────────
  describe('1. Gating de módulo (solo dueño)', () => {
    test('BalanceLayout llama a useRequireModulo con "balance"', async () => {
      await act(async () => {
        tree = renderer.create(<BalanceLayout />)
      })
      expect(useRequireModulo).toHaveBeenCalledWith('balance')
    })

    test('BalanceIndex llama a useRequireModulo con "balance"', async () => {
      await act(async () => {
        tree = renderer.create(<BalanceIndex />)
      })
      expect(useRequireModulo).toHaveBeenCalledWith('balance')
    })

    test('Cuando useRequireModulo devuelve un elemento, BalanceIndex no carga ni renderiza montos', async () => {
      const redirectEl = React.createElement('Text', null, 'Sin acceso')
      ;(useRequireModulo as jest.Mock).mockReturnValue(redirectEl)

      await act(async () => {
        tree = renderer.create(<BalanceIndex />)
      })

      // El guard corta el render: no se dispara la carga de datos
      expect(apiBalance.obtenerBalance).not.toHaveBeenCalled()
      const root = tree!.root
      expect(findAllByText(root, 'Ganancia').length).toBe(0)
      expect(findAllByText(root, 'Pérdida').length).toBe(0)
    })
  })

  // ── 2. Balance negativo en rojo ──────────────────────────────────────────────
  describe('2. Balance negativo (pérdida) en rojo', () => {
    test('Con balance < 0, muestra la etiqueta "Pérdida" y el estilo rojo', async () => {
      ;(apiBalance.obtenerBalance as jest.Mock).mockResolvedValue(BALANCE_PERDIDA)

      await act(async () => {
        tree = renderer.create(<BalanceIndex />)
      })

      const root = tree!.root
      const perdidaLabels = findAllByText(root, 'Pérdida')
      expect(perdidaLabels.length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Ganancia').length).toBe(0)

      // El monto del balance se muestra con el color rojo de pérdida (#b91c1c)
      const montoRojo = root.findAll((el: renderer.ReactTestInstance) => {
        if (el.type !== 'Text') return false
        const style = Array.isArray(el.props.style) ? Object.assign({}, ...el.props.style.filter(Boolean)) : el.props.style
        return flatten(el.props.children).includes('40.000') && style && style.color === '#b91c1c'
      })
      expect(montoRojo.length).toBeGreaterThan(0)
    })

    test('Con balance >= 0, muestra la etiqueta "Ganancia"', async () => {
      await act(async () => {
        tree = renderer.create(<BalanceIndex />)
      })
      const root = tree!.root
      expect(findAllByText(root, 'Ganancia').length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Pérdida').length).toBe(0)
    })
  })

  // ── 3. Cambio de período vuelve a llamar obtenerBalance ──────────────────────
  describe('3. Cambio de período', () => {
    test('Tocar "Semana" vuelve a invocar obtenerBalance con un rango de 7 días', async () => {
      await act(async () => {
        tree = renderer.create(<BalanceIndex />)
      })

      const callsTrasMontaje = (apiBalance.obtenerBalance as jest.Mock).mock.calls.length
      expect(callsTrasMontaje).toBeGreaterThan(0)

      const root = tree!.root
      const btnSemana = root.findByProps({ testID: 'btn-tipo-semana' })
      await act(async () => {
        btnSemana.props.onPress()
      })

      const mock = apiBalance.obtenerBalance as jest.Mock
      expect(mock.mock.calls.length).toBeGreaterThan(callsTrasMontaje)

      // La última llamada corresponde a una semana: desde y hasta separados por 6 días
      const [desde, hasta] = mock.mock.calls[mock.mock.calls.length - 1]
      const diffDias = (new Date(hasta).getTime() - new Date(desde).getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDias).toBe(6)
    })

    test('Tocar la flecha de período anterior vuelve a invocar obtenerBalance', async () => {
      await act(async () => {
        tree = renderer.create(<BalanceIndex />)
      })
      const callsAntes = (apiBalance.obtenerBalance as jest.Mock).mock.calls.length

      const root = tree!.root
      const btnPrev = root.findByProps({ testID: 'btn-nav-prev' })
      await act(async () => {
        btnPrev.props.onPress()
      })

      expect((apiBalance.obtenerBalance as jest.Mock).mock.calls.length).toBeGreaterThan(callsAntes)
    })
  })

  // ── 4. Totales renderizados ──────────────────────────────────────────────────
  describe('4. Totales y desglose', () => {
    test('Renderiza ingresos netos, egresos y el balance del mock', async () => {
      await act(async () => {
        tree = renderer.create(<BalanceIndex />)
      })
      const root = tree!.root
      // Ingresos netos 250.000, egresos 140.000, balance 110.000
      expect(findAllContainingText(root, '250.000').length).toBeGreaterThan(0)
      expect(findAllContainingText(root, '140.000').length).toBeGreaterThan(0)
      expect(findAllContainingText(root, '110.000').length).toBeGreaterThan(0)
      // Etiquetas de las tarjetas
      expect(findAllByText(root, 'Ingresos netos').length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Egresos').length).toBeGreaterThan(0)
    })

    test('Renderiza el desglose de egresos por categoría', async () => {
      await act(async () => {
        tree = renderer.create(<BalanceIndex />)
      })
      const root = tree!.root
      expect(findAllByText(root, 'Gastos fijos').length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Gastos variables').length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Pagos a proveedores').length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Sueldos').length).toBeGreaterThan(0)
    })
  })
})
