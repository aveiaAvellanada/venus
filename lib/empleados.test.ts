// La capa de datos importa supabase; mockear para los tests puros (AsyncStorage en jest).
jest.mock('./supabase', () => ({ supabase: {} }))

import { diasEsperadosMes, montoSugeridoPago } from './empleados'

describe('diasEsperadosMes', () => {
  it('6 días/semana en un mes de 30 días ≈ 26', () => {
    expect(diasEsperadosMes(6, 2026, 6)).toBe(26) // round(6*30/7)=round(25.7)
  })
  it('asume 6 si dias_trabajo_semana es null', () => {
    expect(diasEsperadosMes(null, 2026, 6)).toBe(26)
  })
  it('5 días/semana en julio (31 días) ≈ 22', () => {
    expect(diasEsperadosMes(5, 2026, 7)).toBe(22) // round(5*31/7)=round(22.14)
  })
})

describe('montoSugeridoPago', () => {
  it('proporcional por días', () => {
    expect(montoSugeridoPago(1300000, 13, 26)).toBe(650000)
  })
  it('topa en el sueldo mensual si trabajó de más', () => {
    expect(montoSugeridoPago(1300000, 30, 26)).toBe(1300000)
  })
  it('paga el sueldo completo si diasEsperados es 0', () => {
    expect(montoSugeridoPago(1300000, 0, 0)).toBe(1300000)
  })
})
