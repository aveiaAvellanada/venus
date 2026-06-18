import React from 'react'
import { Alert } from 'react-native'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), functions: { invoke: jest.fn() } } }))
jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), functions: { invoke: jest.fn() } } }))

jest.mock('@expo/vector-icons', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return { Ionicons: (props: { name?: string }) => React.createElement(Text, props, props.name) }
})

const mockRedirect = jest.fn(({ href }: { href: string }) => `Redirected to ${href}`)
jest.mock('expo-router', () => {
  const React = require('react')
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: () => void) => { React.useEffect(() => { cb() }, [cb]) },
    Redirect: (props: { href: string }) => mockRedirect(props),
  }
})

import { useAuth } from '../lib/auth'
jest.mock('../lib/auth', () => ({ useAuth: jest.fn(), useRequireModulo: jest.fn(() => null) }))

import * as api from './reporteDiario'
jest.mock('./reporteDiario', () => {
  const real = jest.requireActual('./reporteDiario')
  return { ...real, obtenerReporteConfig: jest.fn(), guardarReporteConfig: jest.fn() }
})
jest.mock('../lib/reporteDiario', () => {
  const real = jest.requireActual('../lib/reporteDiario')
  return { ...real, obtenerReporteConfig: jest.fn(), guardarReporteConfig: jest.fn() }
})

import ReportesConfig from '../app/(app)/reportes/config'

describe('Reportes Automáticos — config UI', () => {
  let tree: renderer.ReactTestRenderer | null = null

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuth as jest.Mock).mockReturnValue({ perfil: { rol: 'dueno', nombre: 'Andrés' } })
    ;(api.obtenerReporteConfig as jest.Mock).mockResolvedValue({
      whatsapp_on: true, correo_on: false, correo_destino: null, hora_envio: null,
    })
    ;(api.guardarReporteConfig as jest.Mock).mockResolvedValue(undefined)
  })

  afterEach(async () => {
    if (tree) {
      try { await act(async () => { tree!.unmount() }) } catch { /* ignore */ }
      tree = null
    }
  })

  test('Gating: con rol admin redirige y no carga la config', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({ perfil: { rol: 'admin', nombre: 'Sandra' } })
    await act(async () => { tree = renderer.create(<ReportesConfig />) })
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/reportes' })
    expect(api.obtenerReporteConfig).not.toHaveBeenCalled()
  })

  test('Guardar invoca guardarReporteConfig con los valores cargados', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    await act(async () => { tree = renderer.create(<ReportesConfig />) })
    const btn = tree!.root.findByProps({ testID: 'btn-guardar-config' })
    await act(async () => { btn.props.onPress() })
    expect(api.guardarReporteConfig).toHaveBeenCalledWith({
      whatsapp_on: true, correo_on: false, correo_destino: null,
    })
    alertSpy.mockRestore()
  })

  test('Validación: con correo activo pero vacío, no guarda', async () => {
    ;(api.obtenerReporteConfig as jest.Mock).mockResolvedValue({
      whatsapp_on: true, correo_on: true, correo_destino: null, hora_envio: null,
    })
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    await act(async () => { tree = renderer.create(<ReportesConfig />) })
    const btn = tree!.root.findByProps({ testID: 'btn-guardar-config' })
    await act(async () => { btn.props.onPress() })
    expect(api.guardarReporteConfig).not.toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith('Correo inválido', expect.any(String))
    alertSpy.mockRestore()
  })
})
