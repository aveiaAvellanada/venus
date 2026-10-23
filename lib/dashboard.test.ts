process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'

jest.mock('./supabase', () => ({ supabase: { rpc: jest.fn() } }))

import { supabase } from './supabase'
import {
  rangoParaPeriodo,
  obtenerVentasPorSubperiodo,
  obtenerGastosPeriodo,
  etiquetaBucket,
  granularidadParaRango,
  rangoDeMes,
  tituloMes,
  etiquetaDia,
  celdasDelMes,
} from './dashboard'

const rpc = supabase.rpc as jest.Mock

// 2026-07-15 a las 8pm hora Bogotá
const AHORA = new Date('2026-07-15T20:00:00-05:00')

describe('rangoParaPeriodo', () => {
  it('hoy: mismo día, granularidad día', () => {
    expect(rangoParaPeriodo('hoy', AHORA)).toEqual({
      desde: '2026-07-15',
      hasta: '2026-07-15',
      granularidad: 'dia',
    })
  })

  it('semana: últimos 7 días incluyendo hoy', () => {
    expect(rangoParaPeriodo('semana', AHORA)).toEqual({
      desde: '2026-07-09',
      hasta: '2026-07-15',
      granularidad: 'dia',
    })
  })

  it('mes: últimos 30 días', () => {
    expect(rangoParaPeriodo('mes', AHORA)).toEqual({
      desde: '2026-06-16',
      hasta: '2026-07-15',
      granularidad: 'dia',
    })
  })

  it('anio: desde el día 1 del mes hace 11 meses, granularidad mes', () => {
    expect(rangoParaPeriodo('anio', AHORA)).toEqual({
      desde: '2025-08-01',
      hasta: '2026-07-15',
      granularidad: 'mes',
    })
  })

  it('cruce de año: enero mira hacia el año anterior', () => {
    const enero = new Date('2026-01-05T10:00:00-05:00')
    expect(rangoParaPeriodo('anio', enero).desde).toBe('2025-02-01')
    expect(rangoParaPeriodo('semana', enero).desde).toBe('2025-12-30')
  })
})

describe('granularidadParaRango', () => {
  it('hasta 31 días es por día; más largo por mes', () => {
    expect(granularidadParaRango('2026-07-01', '2026-07-31')).toBe('dia')
    expect(granularidadParaRango('2026-05-01', '2026-07-15')).toBe('mes')
  })
})

describe('etiquetaBucket', () => {
  it('dia: abreviatura del día de la semana en es-CO', () => {
    expect(etiquetaBucket('2026-07-13', 'dia')).toBe('lun')
    expect(etiquetaBucket('2026-07-15', 'dia')).toBe('mié')
    expect(etiquetaBucket('2026-07-19', 'dia')).toBe('dom')
  })

  it('semana: día y mes cortos', () => {
    expect(etiquetaBucket('2026-07-13', 'semana')).toBe('13 jul')
  })

  it('mes: mes corto', () => {
    expect(etiquetaBucket('2026-07-01', 'mes')).toBe('jul')
    expect(etiquetaBucket('2025-12-01', 'mes')).toBe('dic')
  })
})

describe('wrappers RPC', () => {
  beforeEach(() => rpc.mockReset())

  it('obtenerVentasPorSubperiodo llama la RPC con los args y retorna el array', async () => {
    const datos = [{ inicio: '2026-07-15', total: 1250000, num_ventas: 18 }]
    rpc.mockResolvedValue({ data: datos, error: null })
    const res = await obtenerVentasPorSubperiodo('2026-07-09', '2026-07-15', 'dia')
    expect(rpc).toHaveBeenCalledWith('obtener_ventas_por_subperiodo', {
      p_desde: '2026-07-09',
      p_hasta: '2026-07-15',
      p_granularidad: 'dia',
    })
    expect(res).toEqual(datos)
  })

  it('obtenerGastosPeriodo llama la RPC y retorna total + gastos', async () => {
    const datos = {
      total: 315000,
      gastos: [{ tipo: 'fijo', nombre: 'Arriendo', detalle: null, monto: 300000, fecha: '2026-07-01' }],
    }
    rpc.mockResolvedValue({ data: datos, error: null })
    const res = await obtenerGastosPeriodo('2026-07-01', '2026-07-15')
    expect(rpc).toHaveBeenCalledWith('obtener_gastos_periodo', {
      p_desde: '2026-07-01',
      p_hasta: '2026-07-15',
    })
    expect(res).toEqual(datos)
  })

  it('lanza si la RPC retorna error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'No autorizado para ver reportes' } })
    await expect(obtenerVentasPorSubperiodo('2026-07-01', '2026-07-15', 'dia')).rejects.toThrow(
      'No autorizado para ver reportes'
    )
  })
})

describe('mes calendario del Menú', () => {
  it('este mes va del día 1 hasta hoy; los anteriores, completos', () => {
    expect(rangoDeMes(0, AHORA)).toEqual({ desde: '2026-07-01', hasta: '2026-07-15', granularidad: 'dia' })
    expect(rangoDeMes(1, AHORA)).toEqual({ desde: '2026-06-01', hasta: '2026-06-30', granularidad: 'dia' })
    expect(rangoDeMes(7, AHORA)).toEqual({ desde: '2025-12-01', hasta: '2025-12-31', granularidad: 'dia' })
    expect(rangoDeMes(5, AHORA).hasta).toBe('2026-02-28')
  })

  it('nombre del mes y del día', () => {
    expect(tituloMes('2026-10-01')).toBe('Octubre 2026')
    expect(etiquetaDia('2026-10-14')).toBe('mié 14 oct')
  })

  it('casillas de lunes a domingo, completando semanas', () => {
    // octubre de 2026 empieza en jueves: 3 vacías antes, 31 días, 1 vacía al final
    const celdas = celdasDelMes('2026-10-01')
    expect(celdas.length).toBe(35)
    expect(celdas.slice(0, 4)).toEqual([null, null, null, '2026-10-01'])
    expect(celdas[33]).toBe('2026-10-31')
    expect(celdas[34]).toBeNull()
    // febrero de 2027 empieza en lunes y cabe justo en 4 semanas
    expect(celdasDelMes('2027-02-01')).toHaveLength(28)
  })
})
