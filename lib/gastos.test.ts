const mockSelect = jest.fn()
jest.mock('./supabase', () => ({
  supabase: { from: jest.fn(() => ({ select: mockSelect })) },
}))

import {
  CATEGORIAS_GASTO, etiquetaCategoriaGasto, fechaCortaGasto, hoyBogota, obtenerGastosFijosPorVencer,
} from './gastos'

function encadenar(data: unknown) {
  const builder: any = {
    eq: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    then: (resolve: (v: unknown) => void) => resolve({ data, error: null }),
  }
  return builder
}

describe('obtenerGastosFijosPorVencer', () => {
  const HOY = new Date().getDate()

  it('incluye gastos sin pago registrado con dia_pago dentro de los próximos 3 días', () => {
    const diaCercano = Math.min(HOY + 2, 31)
    mockSelect.mockReturnValue(
      encadenar([
        { id: '1', nombre: 'Arriendo', monto_aproximado: 500000, dia_pago: diaCercano, gastos_fijos_pagos: [] },
      ])
    )
    return obtenerGastosFijosPorVencer().then((r) => {
      expect(r).toHaveLength(1)
      expect(r[0].nombre).toBe('Arriendo')
    })
  })

  it('excluye los que ya tienen un pago registrado este período', () => {
    mockSelect.mockReturnValue(
      encadenar([
        { id: '2', nombre: 'Internet', monto_aproximado: 100000, dia_pago: HOY, gastos_fijos_pagos: [{ id: 'p1' }] },
      ])
    )
    return obtenerGastosFijosPorVencer().then((r) => {
      expect(r).toHaveLength(0)
    })
  })

  it('excluye los que vencen en más de 3 días', () => {
    const diaLejano = Math.min(HOY + 10, 31)
    mockSelect.mockReturnValue(
      encadenar([
        { id: '3', nombre: 'Seguro', monto_aproximado: 200000, dia_pago: diaLejano, gastos_fijos_pagos: [] },
      ])
    )
    return obtenerGastosFijosPorVencer().then((r) => {
      expect(r).toHaveLength(0)
    })
  })
})

describe('gastos: fecha y categorías', () => {
  it('a las 8 p. m. en Florencia sigue siendo hoy (no la fecha UTC de mañana)', () => {
    // 2026-10-09 01:00 UTC = 2026-10-08 20:00 en Bogotá
    expect(hoyBogota(new Date('2026-10-09T01:00:00Z'))).toBe('2026-10-08')
  })

  it('muestra la fecha del gasto sin correrla un día', () => {
    expect(fechaCortaGasto('2026-10-09')).toBe('09/10/2026')
  })

  it('las categorías que viajan a la base son las del CHECK, en minúscula', () => {
    expect(CATEGORIAS_GASTO.map((c) => c.valor)).toEqual(['transporte', 'reparaciones', 'insumos', 'otros'])
    expect(etiquetaCategoriaGasto('transporte')).toBe('Transporte')
    expect(etiquetaCategoriaGasto('desconocida')).toBe('desconocida')
  })
})
