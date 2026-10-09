import { fechaLarga, hoyEn, sumarDias } from './fechas'

describe('fechas del negocio', () => {
  it('hoy es la fecha de Colombia aunque en UTC ya sea mañana', () => {
    // 9 oct 2026, 23:30 en Bogotá = 10 oct 04:30 UTC
    expect(hoyEn(new Date('2026-10-10T04:30:00Z'))).toBe('2026-10-09')
  })

  it('sumarDias cruza meses y años sin desfase', () => {
    expect(sumarDias('2026-10-01', -1)).toBe('2026-09-30')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('fechaLarga en español', () => {
    expect(fechaLarga('2026-10-09')).toBe('viernes, 9 de octubre')
  })
})
