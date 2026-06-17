jest.mock('./supabase', () => ({ supabase: {} }))

import { proyeccionMes, rangoPeriodo } from './balance'

describe('proyeccionMes', () => {
  it('proyecta linealmente a fin de mes', () => {
    expect(proyeccionMes(500000, 10, 30)).toBe(1500000)
  })
  it('proyecta pérdidas (negativo)', () => {
    expect(proyeccionMes(-200000, 10, 30)).toBe(-600000)
  })
  it('día 0 → 0 (evita división por cero)', () => {
    expect(proyeccionMes(100000, 0, 30)).toBe(0)
  })
})

describe('rangoPeriodo', () => {
  it('mes: primer y último día del mes que contiene la fecha', () => {
    expect(rangoPeriodo('mes', new Date(2026, 1, 15))).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' })
  })
  it('semana: lunes a domingo que contiene la fecha (mié 2026-06-17)', () => {
    expect(rangoPeriodo('semana', new Date(2026, 5, 17))).toEqual({ desde: '2026-06-15', hasta: '2026-06-21' })
  })
})
