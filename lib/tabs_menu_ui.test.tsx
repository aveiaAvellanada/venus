import React from 'react'
import { Alert, type AlertButton } from 'react-native'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('@react-native-community/datetimepicker', () => () => null)

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

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
const mockObtenerModoCierre = jest.fn()
const mockCerrarCajaSinDiferencia = jest.fn()
jest.mock('../lib/caja', () => ({
  obtenerCajaHoy: (...args: unknown[]) => mockObtenerCajaHoy(...args),
  obtenerModoCierre: (...args: unknown[]) => mockObtenerModoCierre(...args),
  cerrarCajaSinDiferencia: (...args: unknown[]) => mockCerrarCajaSinDiferencia(...args),
}))

const mockUseAuth = jest.fn()
jest.mock('../lib/auth', () => ({ useAuth: () => mockUseAuth() }))

const mockReportePeriodo = jest.fn()
const mockResumenDia = jest.fn()
jest.mock('../lib/reportes', () => ({
  ...jest.requireActual('../lib/reportes'),
  obtenerReportePeriodo: (...args: unknown[]) => mockReportePeriodo(...args),
  obtenerResumenDia: (...args: unknown[]) => mockResumenDia(...args),
}))

const mockVentasSub = jest.fn()
const mockGastosPeriodo = jest.fn()
jest.mock('../lib/dashboard', () => ({
  ...jest.requireActual('../lib/dashboard'),
  obtenerVentasPorSubperiodo: (...args: unknown[]) => mockVentasSub(...args),
  obtenerGastosPeriodo: (...args: unknown[]) => mockGastosPeriodo(...args),
}))

const mockGastosFijosPorVencer = jest.fn()
jest.mock('../lib/gastos', () => ({
  obtenerGastosFijosPorVencer: (...args: unknown[]) => mockGastosFijosPorVencer(...args),
}))

import { rangoParaPeriodo } from './dashboard'
import { TemaProvider } from './tema'
import { ToastProvider } from '../components/ui'
import Menu from '../app/(app)/(tabs)/index'

const REPORTE = {
  total_vendido: 1250000,
  total_anterior: 1100000,
  num_ventas: 18,
  efectivo: 600000,
  nequi: 400000,
  bre_b: 250000,
  otro: 0,
  dia_top: null,
  top_productos: [],
  sin_movimiento: [],
}

const BUCKETS = [{ inicio: '2026-07-15', total: 1250000, num_ventas: 18 }]

const GASTOS = {
  total: 315000,
  gastos: [
    { tipo: 'fijo', nombre: 'Arriendo', detalle: null, monto: 300000, fecha: '2026-07-01' },
    { tipo: 'variable', nombre: 'Domicilio', detalle: 'transporte', monto: 15000, fecha: '2026-07-14' },
  ],
}

const RESUMEN_HOY = {
  total_ventas: 5,
  total_general: 430000,
  total_efectivo: 200000,
  total_nequi: 150000,
  total_bre_b: 80000,
  total_otro: 0,
}

function conPerfil(rol: string, nombre = 'Andrés Artunduaga') {
  mockUseAuth.mockReturnValue({ perfil: { nombre, rol }, cerrarSesion: jest.fn() })
}

async function montar() {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <ToastProvider>
          <Menu />
        </ToastProvider>
      </TemaProvider>
    )
  })
  return arbol
}

type Nodo = { props: { onPress?: () => void; accessibilityLabel?: string } }

const existeTexto = (arbol: ReturnType<typeof renderer.create>, texto: string) =>
  arbol.root.findAllByProps({ children: texto }).length > 0

describe('Menú — dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockObtenerCajaHoy.mockResolvedValue(null)
    mockObtenerModoCierre.mockResolvedValue('con_diferencia')
    mockReportePeriodo.mockResolvedValue(REPORTE)
    mockVentasSub.mockResolvedValue(BUCKETS)
    mockGastosPeriodo.mockResolvedValue(GASTOS)
    mockResumenDia.mockResolvedValue(RESUMEN_HOY)
    mockGastosFijosPorVencer.mockResolvedValue([])
  })

  it('dueño: hero con total, métodos y gastos con total', async () => {
    conPerfil('dueno')
    const arbol = await montar()
    expect(existeTexto(arbol, 'Total vendido')).toBe(true)
    expect(arbol.root.findAllByProps({ accessibilityLabel: '$1.250.000' }).length).toBeGreaterThan(0)
    for (const t of ['Efectivo', 'Nequi', 'Bre-B', 'Arriendo', 'Domicilio', 'Total gastos']) {
      expect({ [t]: existeTexto(arbol, t) }).toEqual({ [t]: true })
    }
    expect(existeTexto(arbol, '$315.000')).toBe(true)
    // "Otro" siempre se muestra, incluso en cero (grilla 2x2 de 4 métodos)
    expect(existeTexto(arbol, 'Otro')).toBe(true)
  })

  it('cambiar el chip a Semana recarga con el rango de 7 días', async () => {
    conPerfil('dueno')
    const arbol = await montar()
    const chipSemana = arbol.root
      .findAllByProps({ accessibilityRole: 'button' })
      .filter((n: Nodo) => n.props.onPress)
      .find((n: Nodo) => n.props.accessibilityLabel === 'Semana')
    expect(chipSemana).toBeTruthy()
    await act(async () => chipSemana!.props.onPress!())
    const rango = rangoParaPeriodo('semana')
    expect(mockVentasSub).toHaveBeenLastCalledWith(rango.desde, rango.hasta, 'dia')
    expect(mockReportePeriodo).toHaveBeenLastCalledWith(rango.desde, rango.hasta)
  })

  it('empleado: solo hoy, sin chips ni gastos', async () => {
    conPerfil('empleado', 'Camilo Artunduaga')
    const arbol = await montar()
    expect(mockResumenDia).toHaveBeenCalled()
    expect(mockReportePeriodo).not.toHaveBeenCalled()
    expect(arbol.root.findAllByProps({ accessibilityLabel: '$430.000' }).length).toBeGreaterThan(0)
    expect(existeTexto(arbol, 'Semana')).toBe(false)
    expect(existeTexto(arbol, 'Total gastos')).toBe(false)
    expect(existeTexto(arbol, 'Proveedores')).toBe(false)
  })

  it('dueño: banner de gastos fijos por vencer, con botón Confirmar pago', async () => {
    conPerfil('dueno')
    mockGastosFijosPorVencer.mockResolvedValue([
      { id: 'g1', nombre: 'Arriendo', monto_aproximado: 500000, dia_pago: 20, dias_restantes: 2 },
    ])
    const arbol = await montar()
    expect(existeTexto(arbol, 'Gastos fijos por vencer')).toBe(true)
    expect(existeTexto(arbol, 'Arriendo')).toBe(true)
    const boton = arbol.root.findByProps({ accessibilityLabel: 'Confirmar pago de Arriendo' })
    await act(async () => boton.props.onPress())
    expect(mockPush).toHaveBeenCalledWith('/gastos/pagar?id=g1&nombre=Arriendo&monto=500000')
  })

  it('empleado: no ve el banner de gastos fijos por vencer', async () => {
    conPerfil('empleado', 'Camilo Artunduaga')
    mockGastosFijosPorVencer.mockResolvedValue([
      { id: 'g1', nombre: 'Arriendo', monto_aproximado: 500000, dia_pago: 20, dias_restantes: 2 },
    ])
    const arbol = await montar()
    expect(existeTexto(arbol, 'Gastos fijos por vencer')).toBe(false)
  })

  it('badge de caja: SIN ABRIR / ABIERTA; cerrada navega a /caja', async () => {
    conPerfil('dueno')
    const a = await montar()
    expect(a.root.findByProps({ children: 'SIN ABRIR' })).toBeTruthy()
    const badgeA = a.root.findByProps({ accessibilityLabel: 'Estado de caja' })
    await act(async () => badgeA.props.onPress())
    expect(mockPush).toHaveBeenCalledWith('/caja')
  })

  it('caja abierta + modo con_diferencia: navega directo a /caja/cierre', async () => {
    conPerfil('dueno')
    mockObtenerCajaHoy.mockResolvedValue({ estado: 'abierta' })
    mockObtenerModoCierre.mockResolvedValue('con_diferencia')
    const b = await montar()
    expect(b.root.findByProps({ children: 'ABIERTA' })).toBeTruthy()
    const badge = b.root.findByProps({ accessibilityLabel: 'Estado de caja' })
    await act(async () => badge.props.onPress())
    expect(mockPush).toHaveBeenCalledWith('/caja/cierre')
  })

  it('caja abierta + modo sin_diferencia: confirma y cierra automático sin navegar', async () => {
    conPerfil('dueno')
    mockObtenerCajaHoy.mockResolvedValue({ estado: 'abierta' })
    mockObtenerModoCierre.mockResolvedValue('sin_diferencia')
    mockCerrarCajaSinDiferencia.mockResolvedValue({})
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(
      (_title, _message, buttons?: AlertButton[]) => {
        const confirmBtn = buttons?.find((b) => b.text === 'Cerrar caja')
        confirmBtn?.onPress?.()
      }
    )

    const b = await montar()
    const badge = b.root.findByProps({ accessibilityLabel: 'Estado de caja' })
    await act(async () => badge.props.onPress())

    expect(mockCerrarCajaSinDiferencia).toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalledWith('/caja/cierre')
    expect(mockPush).not.toHaveBeenCalledWith('/caja')

    alertSpy.mockRestore()
  })
})
