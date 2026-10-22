process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('./supabase', () => ({ supabase: {} }))

import { mismoPerfil } from './auth'
import { perfilPrueba } from './perfilPrueba'

describe('mismoPerfil', () => {
  it('dos lecturas iguales del perfil son el mismo perfil', () => {
    expect(mismoPerfil(perfilPrueba('administrativo'), perfilPrueba('administrativo'))).toBe(true)
  })

  it('un permiso quitado o la cuenta desactivada cuentan como cambio', () => {
    const antes = perfilPrueba('administrativo')
    expect(mismoPerfil(antes, { ...antes, permisos: antes.permisos.slice(1) })).toBe(false)
    expect(mismoPerfil(antes, { ...antes, activo: false })).toBe(false)
    expect(mismoPerfil(antes, { ...antes, debeCambiarPin: true })).toBe(false)
  })
})
