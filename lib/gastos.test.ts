const mockSelect = jest.fn()
jest.mock('./supabase', () => ({
  supabase: { from: jest.fn(() => ({ select: mockSelect })) },
}))

import { obtenerGastosFijosPorVencer } from './gastos'

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
