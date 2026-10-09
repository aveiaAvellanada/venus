const mockRpc = jest.fn()
const mockFrom = jest.fn()
jest.mock('./supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

import { abrirCaja, cerrarCaja, cerrarCajaSinDiferencia, reabrirCaja } from './caja'

const CAJA = { id: 'c1', fecha: '2026-10-09', estado: 'abierta' }

beforeEach(() => {
  mockRpc.mockReset()
  mockFrom.mockReset()
  mockRpc.mockResolvedValue({ data: CAJA, error: null })
})

describe('caja: escrituras solo por RPC', () => {
  it('abrirCaja llama abrir_caja y devuelve la caja', async () => {
    await expect(abrirCaja()).resolves.toEqual(CAJA)
    expect(mockRpc).toHaveBeenCalledWith('abrir_caja')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('reabrirCaja llama reabrir_caja', async () => {
    await reabrirCaja()
    expect(mockRpc).toHaveBeenCalledWith('reabrir_caja')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('cerrarCaja manda solo el conteo y la nota; la diferencia la calcula el servidor', async () => {
    await cerrarCaja({ efectivo_contado: 150000, nota: 'Faltó sencillo' })
    expect(mockRpc).toHaveBeenCalledWith('cerrar_caja', {
      p_efectivo_contado: 150000,
      p_nota: 'Faltó sencillo',
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('cerrarCajaSinDiferencia omite conteo y nota', async () => {
    await cerrarCajaSinDiferencia()
    expect(mockRpc).toHaveBeenCalledWith('cerrar_caja', {
      p_efectivo_contado: undefined,
      p_nota: undefined,
    })
  })

  it('propaga el mensaje del servidor', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error('Como hay diferencia, debes ingresar una justificación.'),
    })
    await expect(cerrarCaja({ efectivo_contado: 1, nota: null })).rejects.toThrow('justificación')
  })
})
