import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('./supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }))
jest.mock('../lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }))

jest.mock('@expo/vector-icons', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    Ionicons: (props: { name?: string; [key: string]: unknown }) =>
      React.createElement(Text, props, props.name),
  }
})

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

// Mock auth — useRequireModulo null (granted); useAuth perfil dueno por defecto
import { useRequireModulo, useAuth } from '../lib/auth'
jest.mock('../lib/auth', () => ({
  useAuth: jest.fn(),
  useRequireModulo: jest.fn(() => null),
}))

// Mock lib/reportes — conservar la pura (compararConAyer), mockear el acceso a datos
import * as apiReportes from './reportes'
jest.mock('./reportes', () => {
  const real = jest.requireActual('./reportes')
  return {
    ...real,
    obtenerResumenDia: jest.fn(),
    listarStockBajo: jest.fn(),
    obtenerDashboardDueno: jest.fn(),
    obtenerReportePeriodo: jest.fn(),
  }
})
jest.mock('../lib/reportes', () => {
  const real = jest.requireActual('../lib/reportes')
  return {
    ...real,
    obtenerResumenDia: jest.fn(),
    listarStockBajo: jest.fn(),
    obtenerDashboardDueno: jest.fn(),
    obtenerReportePeriodo: jest.fn(),
  }
})

import ReportesLayout from '../app/(app)/reportes/_layout'
import ReportesIndex from '../app/(app)/reportes/index'
import ReportesPeriodos from '../app/(app)/reportes/periodos'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const RESUMEN_HOY: apiReportes.ResumenDia = {
  total_ventas: 4, total_general: 150000, total_efectivo: 100000, total_nequi: 50000, total_daviplata: 0,
}
const RESUMEN_AYER: apiReportes.ResumenDia = {
  total_ventas: 2, total_general: 100000, total_efectivo: 100000, total_nequi: 0, total_daviplata: 0,
}
const DASH: apiReportes.DashboardDueno = {
  proveedores_por_vencer: [
    { proveedor: 'Calzado XYZ', fecha_vencimiento: '2026-06-20', saldo: 500000, vencida: false },
  ],
  empleados_sin_actividad: [{ id: 'emp-1', nombre: 'Camilo Artunduaga' }],
}

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

describe('Reportes/Dashboard UI — tests de integración', () => {
  let tree: renderer.ReactTestRenderer | null = null

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRequireModulo as jest.Mock).mockReturnValue(null)
    ;(useAuth as jest.Mock).mockReturnValue({ perfil: { rol: 'dueno', nombre: 'Andrés' } })
    ;(apiReportes.obtenerResumenDia as jest.Mock).mockResolvedValueOnce(RESUMEN_HOY).mockResolvedValueOnce(RESUMEN_AYER)
    ;(apiReportes.listarStockBajo as jest.Mock).mockResolvedValue([])
    ;(apiReportes.obtenerDashboardDueno as jest.Mock).mockResolvedValue(DASH)
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

  // ── 1. Gating ──────────────────────────────────────────────────────────────
  describe('1. Gating de módulo', () => {
    test('ReportesLayout llama a useRequireModulo con "reportes"', async () => {
      await act(async () => {
        tree = renderer.create(<ReportesLayout />)
      })
      expect(useRequireModulo).toHaveBeenCalledWith('reportes')
    })

    test('ReportesIndex llama a useRequireModulo con "reportes"', async () => {
      await act(async () => {
        tree = renderer.create(<ReportesIndex />)
      })
      expect(useRequireModulo).toHaveBeenCalledWith('reportes')
    })

    test('Cuando useRequireModulo devuelve elemento, no carga datos ni renderiza', async () => {
      const redirectEl = React.createElement('Text', null, 'Sin acceso')
      ;(useRequireModulo as jest.Mock).mockReturnValue(redirectEl)
      await act(async () => {
        tree = renderer.create(<ReportesIndex />)
      })
      expect(apiReportes.obtenerResumenDia).not.toHaveBeenCalled()
      expect(findAllByText(tree!.root, 'Ventas de hoy').length).toBe(0)
    })
  })

  // ── 2. Sandra (admin) no ve widgets de dueño ─────────────────────────────────
  describe('2. Recorte de permisos (Sandra/admin)', () => {
    test('Con rol admin, NO se invoca obtenerDashboardDueno ni se renderizan sus secciones', async () => {
      ;(useAuth as jest.Mock).mockReturnValue({ perfil: { rol: 'admin', nombre: 'Sandra' } })
      await act(async () => {
        tree = renderer.create(<ReportesIndex />)
      })
      const root = tree!.root
      expect(apiReportes.obtenerDashboardDueno).not.toHaveBeenCalled()
      expect(findAllByText(root, 'Proveedores por vencer').length).toBe(0)
      expect(findAllByText(root, 'Empleados sin actividad hoy').length).toBe(0)
      // Sí ve ventas y stock bajo
      expect(findAllByText(root, 'Ventas de hoy').length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Stock bajo').length).toBeGreaterThan(0)
    })
  })

  // ── 3. Dueño sí ve widgets de dueño ──────────────────────────────────────────
  describe('3. Dueño ve widgets de dueño', () => {
    test('Con rol dueno, se invoca obtenerDashboardDueno y se renderizan las secciones', async () => {
      await act(async () => {
        tree = renderer.create(<ReportesIndex />)
      })
      const root = tree!.root
      expect(apiReportes.obtenerDashboardDueno).toHaveBeenCalledWith(7)
      expect(findAllByText(root, 'Proveedores por vencer').length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Empleados sin actividad hoy').length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Calzado XYZ').length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Camilo Artunduaga').length).toBeGreaterThan(0)
    })
  })

  // ── 4. Comparación con ayer ──────────────────────────────────────────────────
  describe('4. Comparación con ayer', () => {
    test('hoy (150k) > ayer (100k) → muestra "50% vs ayer"', async () => {
      await act(async () => {
        tree = renderer.create(<ReportesIndex />)
      })
      const root = tree!.root
      expect(findAllContainingText(root, '50% vs ayer').length).toBeGreaterThan(0)
    })
  })

  // ── 5. Totales del día ───────────────────────────────────────────────────────
  describe('5. Totales del día', () => {
    test('Renderiza total vendido, nº de ventas y desglose por método', async () => {
      await act(async () => {
        tree = renderer.create(<ReportesIndex />)
      })
      const root = tree!.root
      expect(findAllContainingText(root, '150.000').length).toBeGreaterThan(0) // total
      expect(findAllContainingText(root, '4 ventas').length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Efectivo').length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Nequi').length).toBeGreaterThan(0)
      expect(findAllByText(root, 'Daviplata').length).toBeGreaterThan(0)
    })
  })
})

// ── Reporte de período (M12 it.2) ───────────────────────────────────────────────

const REPORTE = {
  total_vendido: 230000, total_anterior: 50000, num_ventas: 2,
  efectivo: 150000, nequi: 80000, daviplata: 0,
  dia_top: { fecha: '2051-05-10', monto: 150000 },
  top_productos: [
    { producto: 'Bota Smoke', unidades: 3, monto: 150000 },
    { producto: 'Tenis Smoke', unidades: 1, monto: 80000 },
  ],
  sin_movimiento: [{ id: 'p3', producto: 'Sandalia Smoke' }],
}

describe('Reporte de período UI', () => {
  let tree: renderer.ReactTestRenderer | null = null

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRequireModulo as jest.Mock).mockReturnValue(null)
    ;(useAuth as jest.Mock).mockReturnValue({ perfil: { rol: 'dueno', nombre: 'Andrés' } })
    ;(apiReportes.obtenerReportePeriodo as jest.Mock).mockResolvedValue(REPORTE)
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

  test('Gating: invoca useRequireModulo("reportes"); si devuelve elemento no carga datos', async () => {
    const redirectEl = React.createElement('Text', null, 'Sin acceso')
    ;(useRequireModulo as jest.Mock).mockReturnValue(redirectEl)
    await act(async () => {
      tree = renderer.create(<ReportesPeriodos />)
    })
    expect(useRequireModulo).toHaveBeenCalledWith('reportes')
    expect(apiReportes.obtenerReportePeriodo).not.toHaveBeenCalled()
  })

  test('Renderiza total, top productos, día top y sin movimiento del mock', async () => {
    await act(async () => {
      tree = renderer.create(<ReportesPeriodos />)
    })
    const root = tree!.root
    expect(findAllContainingText(root, '230.000').length).toBeGreaterThan(0)
    expect(findAllByText(root, 'Bota Smoke').length).toBeGreaterThan(0)
    expect(findAllByText(root, 'Tenis Smoke').length).toBeGreaterThan(0)
    expect(findAllByText(root, '2051-05-10').length).toBeGreaterThan(0)
    expect(findAllByText(root, 'Sandalia Smoke').length).toBeGreaterThan(0)
  })

  test('Comparación: total 230k vs anterior 50k → muestra "360% vs período anterior"', async () => {
    await act(async () => {
      tree = renderer.create(<ReportesPeriodos />)
    })
    expect(findAllContainingText(tree!.root, '360% vs período anterior').length).toBeGreaterThan(0)
  })

  test('Cambiar a Semana vuelve a invocar obtenerReportePeriodo', async () => {
    await act(async () => {
      tree = renderer.create(<ReportesPeriodos />)
    })
    const callsAntes = (apiReportes.obtenerReportePeriodo as jest.Mock).mock.calls.length
    const btnSemana = tree!.root.findByProps({ testID: 'btn-tipo-semana' })
    await act(async () => {
      btnSemana.props.onPress()
    })
    expect((apiReportes.obtenerReportePeriodo as jest.Mock).mock.calls.length).toBeGreaterThan(callsAntes)
  })
})
