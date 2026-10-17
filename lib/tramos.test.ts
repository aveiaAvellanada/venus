jest.mock('./supabase', () => ({ supabase: {} }))

import {
  borradorDesdeTramo, borradorVacio, claveReferencia, garantiaVigente, tallaNumerica, tramoDeTalla,
  tramoDesdeBorrador, validarTramos, vencimientoGarantia,
} from './tramos'

const b = (desde: string, hasta: string, minimo: string, maximo = '') => ({ desde, hasta, minimo, maximo })

describe('precios por tramo de talla', () => {
  test('claveReferencia ignora mayúsculas y espacios; vacía = null', () => {
    expect(claveReferencia('  TV-1 ')).toBe('tv-1')
    expect(claveReferencia('   ')).toBeNull()
    expect(claveReferencia(null)).toBeNull()
  })

  test('tallaNumerica: enteros y decimales con coma; "Única" no es numérica', () => {
    expect(tallaNumerica('38')).toBe(38)
    expect(tallaNumerica(' 38,5 ')).toBe(38.5)
    expect(tallaNumerica('Única')).toBeNull()
    expect(tallaNumerica(null)).toBeNull()
  })

  test('el mínimo es obligatorio y el máximo opcional', () => {
    expect(tramoDesdeBorrador(b('30', '38', ''))).toBeNull()
    expect(tramoDesdeBorrador(b('30', '38', '55000'))).toEqual({
      tallaDesde: 30, tallaHasta: 38, precioMinimo: 55000, precioMaximo: null,
    })
    expect(tramoDesdeBorrador(b('30', '38', '55000', '70000'))?.precioMaximo).toBe(70000)
  })

  test('validarTramos: ejemplo de la tienda (30–38 a 55.000 y 39–44 a 60.000) es válido', () => {
    expect(validarTramos([b('30', '38', '55000'), b('39', '44', '60000')])).toBeNull()
    expect(validarTramos([])).toBeNull()
  })

  test('validarTramos rechaza campos vacíos, talla invertida, máximo < mínimo y cruces', () => {
    expect(validarTramos([borradorVacio()])).toMatch(/llena talla desde/)
    expect(validarTramos([b('38', '30', '55000')])).toMatch(/mayor que la final/)
    expect(validarTramos([b('30', '38', '55000', '50000')])).toMatch(/máximo es menor/)
    expect(validarTramos([b('30', '38', '0')])).toMatch(/mayor que cero/)
    expect(validarTramos([b('39', '44', '60000'), b('30', '39', '55000')])).toMatch(/se cruzan/)
  })

  test('tramoDeTalla encuentra el tramo de una talla; sin tramo o talla no numérica = null', () => {
    const tramos = [
      { tallaDesde: 30, tallaHasta: 38, precioMinimo: 55000, precioMaximo: null },
      { tallaDesde: 39, tallaHasta: 44, precioMinimo: 60000, precioMaximo: 70000 },
    ]
    expect(tramoDeTalla(tramos, '36')?.precioMinimo).toBe(55000)
    expect(tramoDeTalla(tramos, '39')?.precioMinimo).toBe(60000)
    expect(tramoDeTalla(tramos, '45')).toBeNull()
    expect(tramoDeTalla(tramos, 'Única')).toBeNull()
  })

  test('borradorDesdeTramo vuelve a texto (máximo vacío si no hay)', () => {
    expect(borradorDesdeTramo({ tallaDesde: 30, tallaHasta: 38, precioMinimo: 55000, precioMaximo: null }))
      .toEqual({ desde: '30', hasta: '38', minimo: '55000', maximo: '' })
  })
});

describe('garantía por referencia', () => {
  test('vencimiento = fecha de venta + días', () => {
    const v = vencimientoGarantia('2026-10-01T10:00:00', 30)
    expect(v.getMonth()).toBe(9)
    expect(v.getDate()).toBe(31)
  })

  test('vigente hasta el último día; vencida después; sin garantía = null', () => {
    const venta = '2026-10-01T10:00:00'
    expect(garantiaVigente(venta, 30, new Date('2026-10-30T09:00:00'))).toBe(true)
    expect(garantiaVigente(venta, 30, new Date('2026-11-05T09:00:00'))).toBe(false)
    expect(garantiaVigente(venta, 0, new Date('2026-10-01T09:00:00'))).toBe(true)
    expect(garantiaVigente(venta, 0, new Date('2026-10-02T09:00:00'))).toBe(false)
    expect(garantiaVigente(venta, null)).toBeNull()
  })
})
