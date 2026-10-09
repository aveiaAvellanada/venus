import { horaEn, saludo } from './tiempo'

describe('saludo según la hora del negocio', () => {
  it('usa la hora de Colombia, no la del computador', () => {
    // 10 oct 2026 01:30 UTC = 9 oct 20:30 en Bogotá
    expect(horaEn(new Date('2026-10-10T01:30:00Z'), 'America/Bogota')).toBe(20)
  })

  it.each([[7, 'Buenos días'], [12, 'Buenas tardes'], [18, 'Buenas tardes'], [19, 'Buenas noches']])(
    'a las %i: %s',
    (hora, esperado) => {
      expect(saludo(hora)).toBe(esperado)
    },
  )
})
