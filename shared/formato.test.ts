import { conPuntosDeMiles, pesos, porcentaje, soloDigitos, variacion } from './formato'

describe('formato', () => {
  it('pesos con separador de miles y sin decimales', () => {
    expect(pesos(1234567.4)).toBe('$1.234.567')
    expect(pesos(0)).toBe('$0')
  })

  it('variacion sin base para comparar es null', () => {
    expect(variacion(100, 0)).toBeNull()
    expect(variacion(125, 100)).toBeCloseTo(0.25)
  })

  it('porcentaje con signo', () => {
    expect(porcentaje(0.254)).toBe('+25 %')
    expect(porcentaje(-0.08)).toBe('−8 %')
  })
})

describe('conPuntosDeMiles (campos de pesos)', () => {
  it.each([
    ['', ''],
    ['0', '0'],
    ['5', '5'],
    ['45000', '45.000'],
    ['1500000', '1.500.000'],
    ['45.000', '45.000'],
    ['45.0005', '450.005'],
    ['45000.00', '45.000'],
    ['45000.6', '45.001'],
    ['$ 1.250.000', '1.250.000'],
    ['007', '7'],
    [120000, '120.000'],
    [null, ''],
  ])('%p → %p', (entrada, salida) => {
    expect(conPuntosDeMiles(entrada as string)).toBe(salida)
  })

  it('lo que se escribe sobre el texto con puntos da los dígitos correctos', () => {
    expect(soloDigitos(conPuntosDeMiles('4500') + '0')).toBe('45000')
    expect(soloDigitos('1.500.00')).toBe('150000')
  })
})
