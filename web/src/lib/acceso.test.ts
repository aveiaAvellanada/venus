import { mensajeErrorLogin, motivoSinAcceso, type PerfilPanel } from './acceso'

const dueno: PerfilPanel = {
  id: '1', nombre: 'Andrés', usuario: 'andres', rol: 'dueno', activo: true, debe_cambiar_pin: false,
}

describe('motivoSinAcceso', () => {
  it('el dueño activo con PIN de 6 entra', () => {
    expect(motivoSinAcceso(dueno)).toBeNull()
  })

  it('un empleado no entra, aunque tenga todos los permisos', () => {
    expect(motivoSinAcceso({ ...dueno, rol: 'empleado' })).toMatch(/solo para el dueño/)
  })

  it('una cuenta desactivada no entra', () => {
    expect(motivoSinAcceso({ ...dueno, activo: false })).toMatch(/desactivada/)
  })

  it('con PIN viejo de 4 dígitos, primero lo cambia en el celular', () => {
    expect(motivoSinAcceso({ ...dueno, debe_cambiar_pin: true })).toMatch(/app del celular/)
  })

  it('sin perfil no entra', () => {
    expect(motivoSinAcceso(null)).not.toBeNull()
  })
})

describe('mensajeErrorLogin', () => {
  it.each([
    [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'Usuario o PIN incorrecto.'],
    [{ code: 'user_banned', message: 'User is banned' }, 'Esta cuenta está desactivada.'],
    [{ status: 429, message: 'Request rate limit reached' }, /Demasiados intentos/],
    [{ message: 'Failed to fetch' }, /conexión/],
    [{ message: 'algo raro' }, /No se pudo iniciar sesión/],
  ])('%o', (error, esperado) => {
    expect(mensajeErrorLogin(error)).toMatch(esperado)
  })
})
