jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
const mockRpc = jest.fn()
jest.mock('./supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }))

import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  cambiarMiPin, correoDeUsuario, leerUsuariosRecientes, olvidarUsuario, pinDebil, pinValido, recordarUsuario,
  usuarioValido,
} from './usuarios'

beforeEach(async () => {
  await AsyncStorage.clear()
  mockRpc.mockReset()
})

describe('usuarios: formato', () => {
  it('el correo de Auth se deriva del usuario normalizado', () => {
    expect(correoDeUsuario('  Luisa ')).toBe('luisa@venus.invalid')
  })

  it.each([
    ['luisa', true], ['pedro.t', true], ['camilo2', true], ['  Luisa ', true],
    ['lu', false], ['luisa gómez', false], ['luisa!', false], ['.luisa', false], ['a'.repeat(21), false],
  ])('usuarioValido(%p) = %p', (u, esperado) => {
    expect(usuarioValido(u)).toBe(esperado)
  })

  it.each(['000000', '777777', '123456', '456789', '987654', '543210', '121212', '909090', '123123', '482482'])(
    'PIN trivial %s se rechaza (mismos casos que private.validar_pin)',
    (pin) => {
      expect(pinDebil(pin)).toBe(true)
    },
  )

  it.each(['482915', '111222', '730264', '135790'])('PIN %s es aceptable', (pin) => {
    expect(pinDebil(pin)).toBe(false)
  })

  it('el PIN es de exactamente 6 números', () => {
    expect(pinValido('123456')).toBe(true)
    expect(pinValido('1234')).toBe(false)
    expect(pinValido('12345a')).toBe(false)
  })
})

describe('usuarios recordados en el teléfono', () => {
  it('el último en entrar queda primero, sin repetidos, máximo 6', async () => {
    for (const u of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7']) {
      await recordarUsuario({ usuario: u, nombre: u.toUpperCase() })
    }
    await recordarUsuario({ usuario: 'c3', nombre: 'C3' })
    const lista = await leerUsuariosRecientes()
    expect(lista.map((u) => u.usuario)).toEqual(['c3', 'g7', 'f6', 'e5', 'd4', 'b2'])
  })

  it('olvidar quita a la persona del teléfono', async () => {
    await recordarUsuario({ usuario: 'luisa', nombre: 'Luisa' })
    await olvidarUsuario('luisa')
    expect(await leerUsuariosRecientes()).toEqual([])
  })

  it('datos dañados en el almacenamiento no rompen el login', async () => {
    await AsyncStorage.setItem('venus.usuariosRecientes', '{no es json')
    expect(await leerUsuariosRecientes()).toEqual([])
  })
})

describe('cambiarMiPin', () => {
  it('llama la RPC con el PIN actual y el nuevo', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    await cambiarMiPin('1111', '123456')
    expect(mockRpc).toHaveBeenCalledWith('cambiar_mi_pin', { p_pin_actual: '1111', p_pin_nuevo: '123456' })
  })

  it('propaga el error del servidor', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('El PIN actual no es correcto.') })
    await expect(cambiarMiPin('9', '123456')).rejects.toThrow('no es correcto')
  })
})
