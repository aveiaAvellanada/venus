import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { useSesion } from '../lib/auth'
import { alertasDelDueno, cajaDelDia, productosConStockBajo, resumenDelDia } from '../lib/datos/inicio'
import { Inicio } from './Inicio'

vi.mock('../lib/auth', () => ({ useSesion: vi.fn() }))
vi.mock('../lib/datos/inicio', () => ({
  resumenDelDia: vi.fn(),
  alertasDelDueno: vi.fn(),
  productosConStockBajo: vi.fn(),
  cajaDelDia: vi.fn(),
}))

const resumen = (total: number, ventas: number, efectivo = 0, nequi = 0) => ({
  total_general: total, total_ventas: ventas, total_efectivo: efectivo, total_nequi: nequi, total_bre_b: 0, total_otro: 0,
})

beforeEach(() => {
  // 9 oct 2026, 10:00 a. m. en Bogotá
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-09T15:00:00Z'))
  vi.mocked(useSesion).mockReturnValue({
    estado: { tipo: 'dentro', perfil: { id: '1', nombre: 'Andrés Artunduaga', usuario: 'andres', rol: 'dueno', activo: true, debe_cambiar_pin: false } },
    entrar: vi.fn(),
    salir: vi.fn(),
  })
  vi.mocked(resumenDelDia).mockImplementation(async (fecha) =>
    fecha === '2026-10-09' ? resumen(1250000, 10, 800000, 450000) : resumen(1000000, 8))
  vi.mocked(cajaDelDia).mockResolvedValue({
    estado: 'abierta', apertura_at: '2026-10-09T13:02:00Z', cierre_at: null, base_inicial: 100000, diferencia: null,
  })
  vi.mocked(productosConStockBajo).mockResolvedValue([
    { id: 'p1', descripcion: 'Bota caucho', talla: '38', stock_actual: 0, stock_minimo: 2 },
  ])
  vi.mocked(alertasDelDueno).mockResolvedValue({
    proveedores_por_vencer: [{ proveedor: 'Calzado del Sur', fecha_vencimiento: '2026-10-07', saldo: 300000, vencida: true }],
    empleados_sin_actividad: [{ id: 'e1', nombre: 'Beatriz Bueno' }],
  })
})

afterEach(() => vi.useRealTimers())

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter><Inicio /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Inicio', () => {
  it('saluda por la hora del negocio y muestra la fecha de hoy', async () => {
    pintar()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Buenos días, Andrés')
    expect(screen.getByText(/Viernes, 9 de octubre/)).toBeInTheDocument()
  })

  it('ventas de hoy contra ayer', async () => {
    pintar()
    expect(await screen.findByText('$1.250.000')).toBeInTheDocument()
    expect(await screen.findByText('+25 %')).toBeInTheDocument()
    expect(screen.getByText(/frente a ayer \(\$1\.000\.000\)/)).toBeInTheDocument()
    expect(screen.getByText('Promedio por venta: $125.000')).toBeInTheDocument()
  })

  it('reparto por método de pago con el monto escrito', async () => {
    pintar()
    const metodos = within((await screen.findByText('Por método de pago')).closest('section')!)
    expect(await metodos.findByTitle('Efectivo: $800.000')).toHaveTextContent('64 %')
    expect(metodos.getByTitle('Nequi: $450.000')).toHaveTextContent('36 %')
  })

  it('caja abierta con hora y base', async () => {
    pintar()
    expect(await screen.findByText('Abierta')).toBeInTheDocument()
    expect(screen.getByText(/Desde las 8:02/)).toHaveTextContent('base $100.000')
  })

  it('alertas: agotados, pagos vencidos y empleados sin actividad', async () => {
    pintar()
    expect(await screen.findByText('Agotado')).toBeInTheDocument()
    expect(await screen.findByText('Calzado del Sur')).toBeInTheDocument()
    expect(screen.getByText('Vencida')).toBeInTheDocument()
    expect(screen.getByText('Beatriz Bueno')).toBeInTheDocument()
  })
})
