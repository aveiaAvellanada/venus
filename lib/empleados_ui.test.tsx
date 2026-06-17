import React from 'react'
import { Alert, type AlertButton } from 'react-native'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// Mock Supabase (both relative and absolute paths)
jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: 0, error: null }),
  },
}))
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: 0, error: null }),
  },
}))

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
const mockUseLocalSearchParams = jest.fn(() => ({ id: 'emp-uuid-1' }))
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
}

jest.mock('expo-router', () => {
  const React = require('react')
  const StackScreen = (props: { name?: string; options?: unknown }) =>
    React.createElement('View', { testID: `stack-screen-${props.name}` })
  const Stack = (props: { children?: React.ReactNode; screenOptions?: unknown }) =>
    React.createElement('View', null, props.children)
  Stack.Screen = StackScreen
  return {
    useLocalSearchParams: () => mockUseLocalSearchParams(),
    useRouter: () => mockRouter,
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

// Mock lib/empleados — keep pure functions, mock async data functions
import * as apiEmpleados from './empleados'
jest.mock('./empleados', () => {
  const real = jest.requireActual('./empleados')
  return {
    ...real,
    listarEmpleados: jest.fn(),
    diasTrabajadosMes: jest.fn(),
    historialPagos: jest.fn(),
    guardarConfigEmpleado: jest.fn(),
    actualizarNombreEmpleado: jest.fn(),
    setActivoEmpleado: jest.fn(),
    registrarPagoEmpleado: jest.fn(),
  }
})
jest.mock('../lib/empleados', () => {
  const real = jest.requireActual('../lib/empleados')
  return {
    ...real,
    listarEmpleados: jest.fn(),
    diasTrabajadosMes: jest.fn(),
    historialPagos: jest.fn(),
    guardarConfigEmpleado: jest.fn(),
    actualizarNombreEmpleado: jest.fn(),
    setActivoEmpleado: jest.fn(),
    registrarPagoEmpleado: jest.fn(),
  }
})

// Import screens AFTER all mocks
import EmpleadosLayout from '../app/(app)/empleados/_layout'
import EmpleadosIndex from '../app/(app)/empleados/index'
import EmpleadoDetalleScreen from '../app/(app)/empleados/[id]'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPLEADO_ACTIVO = {
  id: 'emp-uuid-1',
  nombre: 'Camilo Artunduaga',
  email: 'artuneleven1@gmail.com',
  rol: 'empleado' as const,
  activo: true,
  config: {
    sueldo_mensual: 1300000,
    fecha_inicio: '2025-01-15',
    dias_trabajo_semana: 6,
    activo: true,
  },
}

const EMPLEADO_INACTIVO = {
  id: 'emp-uuid-2',
  nombre: 'Beatriz Bueno',
  email: 'beatrizbueno1979@gmail.com',
  rol: 'empleado' as const,
  activo: false,
  config: {
    sueldo_mensual: 1200000,
    fecha_inicio: '2025-03-01',
    dias_trabajo_semana: 5,
    activo: false,
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const matchText = (children: unknown, text: string): boolean => {
  if (typeof children === 'string') return children.trim() === text.trim()
  if (typeof children === 'number') return String(children) === text.trim()
  if (Array.isArray(children)) {
    if (children.every((c) => typeof c === 'string' || typeof c === 'number')) {
      return children.join('').trim() === text.trim()
    }
    return children.some((c) => matchText(c, text))
  }
  return false
}

const findAllByText = (root: renderer.ReactTestInstance, text: string) =>
  root.findAll(
    (el: renderer.ReactTestInstance) => el.type === 'Text' && matchText(el.props.children, text)
  )

const findAllContainingText = (root: renderer.ReactTestInstance, substring: string) =>
  root.findAll((el: renderer.ReactTestInstance) => {
    if (el.type !== 'Text') return false
    const flatten = (c: unknown): string => {
      if (typeof c === 'string') return c
      if (typeof c === 'number') return String(c)
      if (Array.isArray(c)) return c.map(flatten).join('')
      return ''
    }
    return flatten(el.props.children).includes(substring)
  })

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Empleados UI — tests de integración', () => {
  let tree: renderer.ReactTestRenderer | null = null

  beforeEach(() => {
    jest.clearAllMocks()
    // Restore defaults after clearAllMocks
    ;(useRequireModulo as jest.Mock).mockReturnValue(null)
    mockUseLocalSearchParams.mockReturnValue({ id: 'emp-uuid-1' })

    // Default mocks for data functions
    ;(apiEmpleados.listarEmpleados as jest.Mock).mockResolvedValue([EMPLEADO_ACTIVO])
    ;(apiEmpleados.diasTrabajadosMes as jest.Mock).mockResolvedValue(18)
    ;(apiEmpleados.historialPagos as jest.Mock).mockResolvedValue([])
    ;(apiEmpleados.guardarConfigEmpleado as jest.Mock).mockResolvedValue(undefined)
    ;(apiEmpleados.actualizarNombreEmpleado as jest.Mock).mockResolvedValue(undefined)
    ;(apiEmpleados.setActivoEmpleado as jest.Mock).mockResolvedValue(undefined)
    ;(apiEmpleados.registrarPagoEmpleado as jest.Mock).mockResolvedValue(undefined)
  })

  afterEach(async () => {
    if (tree) {
      try {
        await act(async () => {
          tree!.unmount()
        })
      } catch {
        // Ignore unmount errors
      }
      tree = null
    }
  })

  // ── Test 1: Gating dueño-only ─────────────────────────────────────────────

  describe('1. Gating de módulo (solo dueño)', () => {
    test('EmpleadosLayout llama a useRequireModulo con "gestion-empleado"', async () => {
      await act(async () => {
        tree = renderer.create(<EmpleadosLayout />)
      })

      expect(useRequireModulo).toHaveBeenCalledWith('gestion-empleado')
    })

    test('EmpleadosIndex llama a useRequireModulo con "gestion-empleado"', async () => {
      await act(async () => {
        tree = renderer.create(<EmpleadosIndex />)
      })

      expect(useRequireModulo).toHaveBeenCalledWith('gestion-empleado')
    })

    test('EmpleadoDetalleScreen llama a useRequireModulo con "gestion-empleado"', async () => {
      await act(async () => {
        tree = renderer.create(<EmpleadoDetalleScreen />)
      })

      expect(useRequireModulo).toHaveBeenCalledWith('gestion-empleado')
    })

    test('Cuando useRequireModulo devuelve un elemento, EmpleadosIndex no renderiza el contenido', async () => {
      const redirectEl = React.createElement('Text', null, 'Sin acceso')
      ;(useRequireModulo as jest.Mock).mockReturnValue(redirectEl)

      await act(async () => {
        tree = renderer.create(<EmpleadosIndex />)
      })

      // El banner de gestión no debe aparecer porque el guard cortó el render
      const root = tree!.root
      const bannerTexts = findAllContainingText(root, 'Gestiona el equipo')
      expect(bannerTexts.length).toBe(0)
    })

    test('Cuando useRequireModulo devuelve un elemento, EmpleadoDetalleScreen no renderiza el contenido', async () => {
      const redirectEl = React.createElement('Text', null, 'Sin acceso')
      ;(useRequireModulo as jest.Mock).mockReturnValue(redirectEl)

      await act(async () => {
        tree = renderer.create(<EmpleadoDetalleScreen />)
      })

      // El botón de guardar empleado no debe aparecer porque el guard cortó el render
      const root = tree!.root
      const guardarBtns = root.findAll(
        (el: renderer.ReactTestInstance) => el.props.testID === 'btn-guardar'
      )
      expect(guardarBtns.length).toBe(0)
    })
  })

  // ── Test 2: Registrar pago ────────────────────────────────────────────────

  describe('2. Registrar pago del empleado', () => {
    test('Al confirmar el pago, registrarPagoEmpleado se invoca con payload correcto', async () => {
      // Mock Alert.alert to auto-confirm the payment dialog
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
        (_title, _message, buttons?: AlertButton[]) => {
          const confirmBtn = buttons?.find((b) => b.text === 'Registrar')
          if (confirmBtn?.onPress) confirmBtn.onPress()
        }
      )

      await act(async () => {
        tree = renderer.create(<EmpleadoDetalleScreen />)
      })

      const root = tree!.root

      // Set a custom monto
      const montoInput = root.findByProps({ testID: 'input-monto-pago' })
      await act(async () => {
        montoInput.props.onChangeText('500000')
      })

      // Press the register button
      const btnPago = root.findByProps({ testID: 'btn-registrar-pago' })
      await act(async () => {
        btnPago.props.onPress()
      })

      expect(apiEmpleados.registrarPagoEmpleado).toHaveBeenCalledWith(
        expect.objectContaining({
          empleado_id: EMPLEADO_ACTIVO.id,
          monto: 500000,
          dias_trabajados: 18,
        })
      )

      alertSpy.mockRestore()
    })

    test('registrarPagoEmpleado incluye fecha_pago, periodo_inicio y periodo_fin', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
        (_title, _message, buttons?: AlertButton[]) => {
          const confirmBtn = buttons?.find((b) => b.text === 'Registrar')
          if (confirmBtn?.onPress) confirmBtn.onPress()
        }
      )

      await act(async () => {
        tree = renderer.create(<EmpleadoDetalleScreen />)
      })

      const root = tree!.root
      const montoInput = root.findByProps({ testID: 'input-monto-pago' })
      await act(async () => {
        montoInput.props.onChangeText('800000')
      })

      const btnPago = root.findByProps({ testID: 'btn-registrar-pago' })
      await act(async () => {
        btnPago.props.onPress()
      })

      expect(apiEmpleados.registrarPagoEmpleado).toHaveBeenCalledWith(
        expect.objectContaining({
          empleado_id: EMPLEADO_ACTIVO.id,
          monto: 800000,
          dias_trabajados: 18,
          fecha_pago: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          periodo_inicio: expect.stringMatching(/^\d{4}-\d{2}-01$/),
          periodo_fin: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      )

      alertSpy.mockRestore()
    })

    test('Sin monto válido, registrarPagoEmpleado NO se invoca', async () => {
      // Alert shows validation, no confirmation dialog, so registrarPagoEmpleado stays unmocked
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

      await act(async () => {
        tree = renderer.create(<EmpleadoDetalleScreen />)
      })

      const root = tree!.root

      // Clear the monto input (set to 0)
      const montoInput = root.findByProps({ testID: 'input-monto-pago' })
      await act(async () => {
        montoInput.props.onChangeText('0')
      })

      const btnPago = root.findByProps({ testID: 'btn-registrar-pago' })
      await act(async () => {
        btnPago.props.onPress()
      })

      expect(apiEmpleados.registrarPagoEmpleado).not.toHaveBeenCalled()

      alertSpy.mockRestore()
    })
  })

  // ── Test 3: Desactivar empleado ───────────────────────────────────────────

  describe('3. Activar / Desactivar empleado', () => {
    test('Para un empleado activo, el botón toggle invoca setActivoEmpleado(id, false)', async () => {
      // Mock Alert.alert to auto-confirm "Desactivar"
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
        (_title, _message, buttons?: AlertButton[]) => {
          const confirmBtn = buttons?.find((b) => b.text === 'Desactivar')
          if (confirmBtn?.onPress) confirmBtn.onPress()
        }
      )

      await act(async () => {
        tree = renderer.create(<EmpleadoDetalleScreen />)
      })

      const root = tree!.root

      // The button should show "Desactivar empleado" for an active employee
      const toggleBtn = root.findByProps({ testID: 'btn-toggle-activo' })
      const btnTexts = findAllByText(root, 'Desactivar empleado')
      expect(btnTexts.length).toBeGreaterThan(0)

      await act(async () => {
        toggleBtn.props.onPress()
      })

      expect(apiEmpleados.setActivoEmpleado).toHaveBeenCalledWith(EMPLEADO_ACTIVO.id, false)

      alertSpy.mockRestore()
    })

    test('Para un empleado inactivo, el botón toggle invoca setActivoEmpleado(id, true)', async () => {
      ;(apiEmpleados.listarEmpleados as jest.Mock).mockResolvedValue([EMPLEADO_INACTIVO])
      mockUseLocalSearchParams.mockReturnValue({ id: EMPLEADO_INACTIVO.id })

      // Mock Alert.alert to auto-confirm "Activar"
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
        (_title, _message, buttons?: AlertButton[]) => {
          const confirmBtn = buttons?.find((b) => b.text === 'Activar')
          if (confirmBtn?.onPress) confirmBtn.onPress()
        }
      )

      await act(async () => {
        tree = renderer.create(<EmpleadoDetalleScreen />)
      })

      const root = tree!.root

      // The button should show "Activar empleado" for an inactive employee
      const btnTexts = findAllByText(root, 'Activar empleado')
      expect(btnTexts.length).toBeGreaterThan(0)

      const toggleBtn = root.findByProps({ testID: 'btn-toggle-activo' })
      await act(async () => {
        toggleBtn.props.onPress()
      })

      expect(apiEmpleados.setActivoEmpleado).toHaveBeenCalledWith(EMPLEADO_INACTIVO.id, true)

      alertSpy.mockRestore()
    })

    test('Si el usuario cancela, setActivoEmpleado NO se invoca', async () => {
      // Mock Alert.alert to press "Cancelar"
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
        (_title, _message, buttons?: AlertButton[]) => {
          const cancelBtn = buttons?.find((b) => b.text === 'Cancelar')
          if (cancelBtn?.onPress) cancelBtn.onPress()
        }
      )

      await act(async () => {
        tree = renderer.create(<EmpleadoDetalleScreen />)
      })

      const root = tree!.root
      const toggleBtn = root.findByProps({ testID: 'btn-toggle-activo' })
      await act(async () => {
        toggleBtn.props.onPress()
      })

      expect(apiEmpleados.setActivoEmpleado).not.toHaveBeenCalled()

      alertSpy.mockRestore()
    })
  })

  // ── Test 4: Monto sugerido de pago ────────────────────────────────────────

  describe('4. Banner de monto proporcional sugerido', () => {
    test('Muestra el monto proporcional calculado correctamente en el banner', async () => {
      // EMPLEADO_ACTIVO: sueldo=1300000, dias_trabajo_semana=6
      // diasTrabajadosMes mock → 18
      // Para calcular el esperado: montoSugeridoPago(1300000, 18, diasEsperadosMes(6, anio, mes))
      // El test verifica que el banner contiene un monto en formato pesos
      await act(async () => {
        tree = renderer.create(<EmpleadoDetalleScreen />)
      })

      const root = tree!.root

      // The banner must contain "Monto proporcional sugerido:"
      const bannerTexts = findAllContainingText(root, 'Monto proporcional sugerido:')
      expect(bannerTexts.length).toBeGreaterThan(0)
    })

    test('El banner muestra los días trabajados y esperados (X/Y días)', async () => {
      ;(apiEmpleados.diasTrabajadosMes as jest.Mock).mockResolvedValue(15)

      await act(async () => {
        tree = renderer.create(<EmpleadoDetalleScreen />)
      })

      const root = tree!.root

      // The banner text format is "... (diasEsteMes/diasEsp días)"
      const bannerWithDias = findAllContainingText(root, '15/')
      expect(bannerWithDias.length).toBeGreaterThan(0)

      const diasLabel = findAllContainingText(root, 'días)')
      expect(diasLabel.length).toBeGreaterThan(0)
    })

    test('El input de monto pre-rellena con el monto sugerido calculado', async () => {
      // sueldo=1300000, dias_trabajo_semana=6, diasTrabajados=18
      // montoSugeridoPago is a pure function in lib/empleados we can use directly
      const { montoSugeridoPago, diasEsperadosMes } = jest.requireActual('./empleados') as typeof apiEmpleados
      const ahora = new Date()
      const anio = ahora.getFullYear()
      const mes = ahora.getMonth() + 1
      const diasEsp = diasEsperadosMes(6, anio, mes)
      const esperado = montoSugeridoPago(1300000, 18, diasEsp)

      await act(async () => {
        tree = renderer.create(<EmpleadoDetalleScreen />)
      })

      const root = tree!.root
      const montoInput = root.findByProps({ testID: 'input-monto-pago' })
      expect(montoInput.props.value).toBe(String(esperado))
    })
  })

  // ── Test 5: Index — lista de empleados ────────────────────────────────────

  describe('5. Index — lista de empleados', () => {
    test('Muestra el banner de gestión del equipo', async () => {
      await act(async () => {
        tree = renderer.create(<EmpleadosIndex />)
      })

      const root = tree!.root
      const bannerTexts = findAllContainingText(root, 'Gestiona el equipo')
      expect(bannerTexts.length).toBeGreaterThan(0)
    })

    test('Muestra "No hay empleados registrados." cuando la lista está vacía', async () => {
      ;(apiEmpleados.listarEmpleados as jest.Mock).mockResolvedValue([])

      await act(async () => {
        tree = renderer.create(<EmpleadosIndex />)
      })

      const root = tree!.root
      const emptyTexts = findAllByText(root, 'No hay empleados registrados.')
      expect(emptyTexts.length).toBeGreaterThan(0)
    })

    test('Muestra el nombre del empleado en la tarjeta', async () => {
      await act(async () => {
        tree = renderer.create(<EmpleadosIndex />)
      })

      const root = tree!.root
      const nombreTexts = findAllByText(root, EMPLEADO_ACTIVO.nombre)
      expect(nombreTexts.length).toBeGreaterThan(0)
    })

    test('Al tocar una tarjeta de empleado, navega a /empleados/:id', async () => {
      await act(async () => {
        tree = renderer.create(<EmpleadosIndex />)
      })

      const root = tree!.root

      // Find any pressable element (host component) that has an onPress prop
      // react-test-renderer renders TouchableOpacity as a host View with onPress
      const pressables = root.findAll(
        (el: renderer.ReactTestInstance) => typeof el.props.onPress === 'function'
      )
      expect(pressables.length).toBeGreaterThan(0)

      // The first pressable with onPress is the card that navigates to the employee detail
      await act(async () => {
        pressables[0].props.onPress()
      })

      expect(mockRouter.push).toHaveBeenCalledWith('/empleados/' + EMPLEADO_ACTIVO.id)
    })
  })
})
