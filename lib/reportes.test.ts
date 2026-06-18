jest.mock('./supabase', () => ({ supabase: {} }))

import { compararConAyer } from './reportes'

describe('compararConAyer', () => {
  it('sube: +50% cuando hoy=150k vs ayer=100k', () => {
    expect(compararConAyer(150000, 100000)).toEqual({ pct: 50, direccion: 'sube', sinBase: false })
  })
  it('baja: -20% cuando hoy=80k vs ayer=100k', () => {
    expect(compararConAyer(80000, 100000)).toEqual({ pct: 20, direccion: 'baja', sinBase: false })
  })
  it('igual cuando hoy=ayer', () => {
    expect(compararConAyer(100000, 100000)).toEqual({ pct: 0, direccion: 'igual', sinBase: false })
  })
  it('ayer=0 con ventas hoy → sube 100% sin base', () => {
    expect(compararConAyer(50000, 0)).toEqual({ pct: 100, direccion: 'sube', sinBase: true })
  })
  it('ambos 0 → igual sin base', () => {
    expect(compararConAyer(0, 0)).toEqual({ pct: 0, direccion: 'igual', sinBase: true })
  })
  it('redondea el porcentaje a entero', () => {
    expect(compararConAyer(133000, 100000)).toEqual({ pct: 33, direccion: 'sube', sinBase: false })
  })
})
