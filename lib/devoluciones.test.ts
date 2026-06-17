// lib/devoluciones.ts importa el cliente supabase (para el acceso a datos); en jest
// eso intenta inicializar AsyncStorage y falla. Estas pruebas son de lógica pura, así
// que mockeamos el cliente (igual que recibir_mercancia/proveedores_e2e).
jest.mock('./supabase', () => ({ supabase: {} }))

import { calcularDiferenciaCambio, netearDevolucion, validarCantidades } from './devoluciones'

describe('calcularDiferenciaCambio', () => {
  it('cobra cuando el reemplazo es más caro', () => {
    expect(calcularDiferenciaCambio(50000, 60000, 1)).toBe(10000)
  })
  it('reembolsa (negativo) cuando es más barato', () => {
    expect(calcularDiferenciaCambio(50000, 40000, 2)).toBe(-20000)
  })
  it('es 0 en cambio par', () => {
    expect(calcularDiferenciaCambio(50000, 50000, 3)).toBe(0)
  })
})

describe('netearDevolucion', () => {
  it('reembolso puro suma subtotales', () => {
    expect(netearDevolucion('parcial', [{ diferencia: 0, subtotal: 50000 }, { diferencia: 0, subtotal: 20000 }]))
      .toEqual({ monto_devuelto: 70000, monto_cobrado: 0 })
  })
  it('cambio con diferencia positiva cobra', () => {
    expect(netearDevolucion('cambio', [{ diferencia: 10000, subtotal: 0 }]))
      .toEqual({ monto_devuelto: 0, monto_cobrado: 10000 })
  })
  it('cambio con diferencia negativa reembolsa', () => {
    expect(netearDevolucion('cambio', [{ diferencia: -15000, subtotal: 0 }]))
      .toEqual({ monto_devuelto: 15000, monto_cobrado: 0 })
  })
  it('cambio par no mueve dinero', () => {
    expect(netearDevolucion('cambio', [{ diferencia: 0, subtotal: 0 }]))
      .toEqual({ monto_devuelto: 0, monto_cobrado: 0 })
  })
})

describe('validarCantidades', () => {
  const vendido = { vi1: 3 }; const yaDev = { vi1: 1 }
  it('acepta dentro del disponible', () => {
    expect(validarCantidades([{ venta_item_id: 'vi1', cantidad: 2 }], vendido, yaDev)).toEqual([])
  })
  it('rechaza exceso', () => {
    expect(validarCantidades([{ venta_item_id: 'vi1', cantidad: 3 }], vendido, yaDev))
      .toContain('La cantidad a devolver de un producto supera lo disponible')
  })
  it('rechaza cantidad <= 0', () => {
    expect(validarCantidades([{ venta_item_id: 'vi1', cantidad: 0 }], vendido, yaDev))
      .toContain('La cantidad debe ser mayor a 0')
  })
})
