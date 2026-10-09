const mockRpc = jest.fn()
const mockFrom = jest.fn()
jest.mock('./supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

import {
  abrirCaja, cerrarCaja, cerrarCajaSinDiferencia, obtenerArqueoCaja, obtenerBasePredeterminada, reabrirCaja,
} from './caja'

const CAJA = { id: 'c1', fecha: '2026-10-09', estado: 'abierta' }

beforeEach(() => {
  mockRpc.mockReset()
  mockFrom.mockReset()
  mockRpc.mockResolvedValue({ data: CAJA, error: null })
})

describe('caja: escrituras solo por RPC', () => {
  it('abrirCaja sin base deja que el servidor use la predeterminada', async () => {
    await expect(abrirCaja()).resolves.toEqual(CAJA)
    expect(mockRpc).toHaveBeenCalledWith('abrir_caja', { p_base_inicial: undefined })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('abrirCaja manda la base contada al abrir', async () => {
    await abrirCaja(80000)
    expect(mockRpc).toHaveBeenCalledWith('abrir_caja', { p_base_inicial: 80000 })
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

describe('caja: arqueo', () => {
  it('obtenerArqueoCaja convierte el desglose a números', async () => {
    mockRpc.mockResolvedValue({
      data: { base_inicial: '50000', efectivo_ventas: '90000', gastos_caja: '20000', efectivo_esperado: '120000' },
      error: null,
    })
    await expect(obtenerArqueoCaja()).resolves.toEqual({
      base_inicial: 50000, efectivo_ventas: 90000, gastos_caja: 20000, efectivo_esperado: 120000,
    })
    expect(mockRpc).toHaveBeenCalledWith('obtener_arqueo_caja')
  })

  it('obtenerBasePredeterminada devuelve 0 si no hay valor', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    await expect(obtenerBasePredeterminada()).resolves.toBe(0)
  })
})
