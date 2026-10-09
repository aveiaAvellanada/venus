import { pesos, porcentaje, variacion } from './formato'

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
