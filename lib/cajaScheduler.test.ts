import { decidirAccionCaja } from './cajaScheduler'

const cfg = { modo_automatico: true, hora_apertura: '06:00', hora_cierre: '23:00' }

describe('decidirAccionCaja', () => {
  it('no hace nada si el modo automático está apagado', () => {
    expect(decidirAccionCaja({ ...cfg, modo_automatico: false }, '07:00', null)).toBe('nada')
  })
  it('no hace nada si faltan horas configuradas', () => {
    expect(decidirAccionCaja({ modo_automatico: true, hora_apertura: null, hora_cierre: '23:00' }, '07:00', null)).toBe('nada')
  })
  it('abre si pasó la apertura, antes del cierre y no hay caja', () => {
    expect(decidirAccionCaja(cfg, '06:00', null)).toBe('abrir')
    expect(decidirAccionCaja(cfg, '12:30', null)).toBe('abrir')
  })
  it('no abre si ya existe la caja de hoy', () => {
    expect(decidirAccionCaja(cfg, '12:30', { estado: 'abierta' })).toBe('nada')
    expect(decidirAccionCaja(cfg, '12:30', { estado: 'cerrada' })).toBe('nada')
  })
  it('no abre antes de la hora de apertura', () => {
    expect(decidirAccionCaja(cfg, '05:59', null)).toBe('nada')
  })
  it('cierra (blando) si pasó el cierre y la caja sigue abierta', () => {
    expect(decidirAccionCaja(cfg, '23:00', { estado: 'abierta' })).toBe('cerrar_blando')
    expect(decidirAccionCaja(cfg, '23:45', { estado: 'abierta' })).toBe('cerrar_blando')
  })
  it('no recierra si la caja ya está cerrada', () => {
    expect(decidirAccionCaja(cfg, '23:30', { estado: 'cerrada' })).toBe('nada')
  })
  it('no cierra ni reabre si pasó el cierre y no hay caja', () => {
    expect(decidirAccionCaja(cfg, '23:30', null)).toBe('nada')
  })
  it('ignora los segundos al comparar', () => {
    expect(decidirAccionCaja(cfg, '23:00:30', { estado: 'abierta' })).toBe('cerrar_blando')
  })
})

import { diaSemanaDeFecha, horarioDelDia, type HorarioSemanal } from './cajaScheduler'

describe('diaSemanaDeFecha', () => {
  it('mapea getDay() al nombre del día en español', () => {
    // 2026-06-17 es miércoles
    expect(diaSemanaDeFecha(new Date(2026, 5, 17))).toBe('miercoles')
    // 2026-06-14 es domingo
    expect(diaSemanaDeFecha(new Date(2026, 5, 14))).toBe('domingo')
    // 2026-06-20 es sábado
    expect(diaSemanaDeFecha(new Date(2026, 5, 20))).toBe('sabado')
  })
})

describe('horarioDelDia', () => {
  const horario: HorarioSemanal = {
    lunes: { apertura: '08:00', cierre: '19:00' },
    sabado: { apertura: '09:00', cierre: '17:00' },
  }
  it('devuelve el horario configurado del día', () => {
    expect(horarioDelDia(horario, 'lunes')).toEqual({ apertura: '08:00', cierre: '19:00' })
  })
  it('devuelve apertura/cierre null si el día no tiene horario configurado', () => {
    expect(horarioDelDia(horario, 'domingo')).toEqual({ apertura: null, cierre: null })
  })
})
