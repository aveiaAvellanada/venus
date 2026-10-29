import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import AsyncStorage from '@react-native-async-storage/async-storage'

// supabase-js sin red y con el token vencido: INITIAL_SESSION llega vacía
// aunque la sesión siga guardada en el teléfono.
let mockEvento: [string, unknown] = ['INITIAL_SESSION', null]
const mockFrom = jest.fn()
const mockSignOut = jest.fn(async () => ({ error: null }))
jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      storageKey: 'sb-venus-auth-token',
      onAuthStateChange: (cb: (e: string, s: unknown) => Promise<void>) => {
        setTimeout(() => cb(...mockEvento), 0)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      signOut: () => mockSignOut(),
    },
    from: (...a: unknown[]) => mockFrom(...a),
  },
}))
jest.mock('expo-router', () => ({ Redirect: () => null }))

import { AuthProvider, VentasSinMandarError, useAuth, type Perfil } from './auth'
import { guardarPendiente } from './ventasPendientes'

const PERFIL: Perfil = {
  id: 'u1', nombre: 'Ana', usuario: 'ana', rol: 'empleado', permisos: ['ventas'], activo: true, debeCambiarPin: false,
}
const SESION = { access_token: 'viejo', refresh_token: 'r1', expires_at: 1, user: { id: 'u1' } }

// La consulta del perfil falla por la red.
const sinRed = () => {
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'TypeError: Network request failed' } }) }) }),
  })
}

let estado: ReturnType<typeof useAuth>
function Sonda() {
  estado = useAuth()
  return null
}

async function montar() {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<AuthProvider><Sonda /></AuthProvider>)
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 10)) })
  return arbol
}

beforeEach(async () => {
  await AsyncStorage.clear()
  jest.clearAllMocks()
  mockEvento = ['INITIAL_SESSION', null]
  sinRed()
})

describe('arrancar sin conexión', () => {
  it('quien ya entró en este teléfono entra con su sesión y su perfil guardados', async () => {
    await AsyncStorage.setItem('sb-venus-auth-token', JSON.stringify(SESION))
    await AsyncStorage.setItem('venus.perfil.u1', JSON.stringify(PERFIL))
    const arbol = await montar()
    expect(estado.cargando).toBe(false)
    expect(estado.session?.user.id).toBe('u1')
    expect(estado.perfil).toEqual(PERFIL)
    act(() => arbol.unmount())
  })

  it('sin perfil guardado (nunca entró aquí) no entra', async () => {
    await AsyncStorage.setItem('sb-venus-auth-token', JSON.stringify(SESION))
    const arbol = await montar()
    expect(estado.session).toBeNull()
    expect(estado.perfil).toBeNull()
    act(() => arbol.unmount())
  })

  it('con el token aún vigente pero sin red, usa el perfil guardado', async () => {
    mockEvento = ['INITIAL_SESSION', SESION]
    await AsyncStorage.setItem('venus.perfil.u1', JSON.stringify(PERFIL))
    const arbol = await montar()
    expect(estado.perfil).toEqual(PERFIL)
    act(() => arbol.unmount())
  })

  it('con ventas sin mandar no deja cerrar sesión', async () => {
    await AsyncStorage.setItem('sb-venus-auth-token', JSON.stringify(SESION))
    await AsyncStorage.setItem('venus.perfil.u1', JSON.stringify(PERFIL))
    await guardarPendiente({
      clave: 'k1', usuarioId: 'u1', vendidaEn: new Date().toISOString(),
      input: { items: [], pagos: [], efectivoRecibido: null },
    })
    const arbol = await montar()
    await expect(estado.cerrarSesion()).rejects.toBeInstanceOf(VentasSinMandarError)
    expect(mockSignOut).not.toHaveBeenCalled()
    act(() => arbol.unmount())
  })

  it('al cerrar sesión se borra lo guardado de esa persona', async () => {
    await AsyncStorage.setItem('sb-venus-auth-token', JSON.stringify(SESION))
    await AsyncStorage.setItem('venus.perfil.u1', JSON.stringify(PERFIL))
    await AsyncStorage.setItem('venus.cache.u1.calzado', '[]')
    const arbol = await montar()
    await act(async () => { await estado.cerrarSesion() })
    expect(mockSignOut).toHaveBeenCalled()
    expect(await AsyncStorage.getItem('venus.perfil.u1')).toBeNull()
    expect(await AsyncStorage.getItem('venus.cache.u1.calzado')).toBeNull()
    act(() => arbol.unmount())
  })
})
