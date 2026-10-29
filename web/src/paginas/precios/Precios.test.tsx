import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Precios } from './Precios'
import { guardarPreciosReferencia, listarTallasPrecios, listarTodosLosTramos } from '../../lib/datos/precios'
import { descargarPdfPrecios } from '../../lib/pdfPrecios'
import type { TallaPrecio } from '../../lib/precios'

vi.mock('../../lib/datos/precios', () => ({
  listarTallasPrecios: vi.fn(),
  listarTodosLosTramos: vi.fn(),
  guardarPreciosReferencia: vi.fn(),
}))
vi.mock('../../lib/pdfPrecios', () => ({ descargarPdfPrecios: vi.fn() }))

let n = 0
const talla = (extra: Partial<TallaPrecio>): TallaPrecio => ({
  id: `t${n++}`, referencia: 'ESC-DAMP-001', descripcion: 'Damper diana', marca: 'Damper', color: 'Rojo',
  categoria: 'Escolar', talla: '28', precio_minimo: 1, precio_maximo: null, stock_actual: 2, activo: true,
  foto_url: null, garantia_dias: null, ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listarTallasPrecios).mockResolvedValue([
    talla({ talla: '28' }), talla({ talla: '35', color: 'Negro' }),
    talla({ referencia: 'TEN-NIKE-001', descripcion: 'Air', marca: 'Nike', categoria: 'Tennis', talla: '40', precio_minimo: 120000, precio_maximo: 150000 }),
  ])
  vi.mocked(listarTodosLosTramos).mockResolvedValue(new Map())
  vi.mocked(guardarPreciosReferencia).mockResolvedValue({ actualizados: 2, sin_tramo: 0 })
})

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={cliente}><Precios /></QueryClientProvider>)
}

const tarjeta = async (titulo: string) => (await screen.findByRole('heading', { name: titulo })).closest('li')!

describe('Precios por referencia', () => {
  it('lista por categoría y filtra las que siguen en $1', async () => {
    pintar()
    expect(await screen.findByRole('heading', { name: 'Escolar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tennis' })).toBeInTheDocument()
    expect(screen.getByText('2 referencias · 1 sin precio')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Solo las que siguen en $1'))
    expect(screen.queryByRole('heading', { name: 'Tennis' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Descargar PDF \(1 referencia\)/ })).toBeEnabled()
  })

  it('descarga el PDF con lo que se ve', async () => {
    pintar()
    await screen.findByRole('heading', { name: 'Escolar' })
    await userEvent.click(screen.getByRole('button', { name: /Descargar PDF/ }))
    expect(descargarPdfPrecios).toHaveBeenCalledWith(
      [expect.objectContaining({ etiqueta: 'Escolar' }), expect.objectContaining({ etiqueta: 'Tennis' })],
      expect.stringMatching(/^hoja-de-precios-\d{4}-\d{2}-\d{2}\.pdf$/),
    )
  })

  it('guarda los rangos con mínimo, máximo y garantía (pesos con puntos de miles)', async () => {
    pintar()
    const caja = within(await tarjeta('ESC-DAMP-001 · Damper diana'))
    // Empieza con un rango que cubre todas sus tallas.
    expect(caja.getByLabelText('Talla desde, rango 1')).toHaveValue('28')
    expect(caja.getByLabelText('Talla hasta, rango 1')).toHaveValue('35')
    await userEvent.type(caja.getByLabelText('Precio mínimo, rango 1'), '45000')
    expect(caja.getByLabelText('Precio mínimo, rango 1')).toHaveValue('45.000')
    await userEvent.type(caja.getByLabelText('Precio máximo, rango 1'), '55000')
    await userEvent.type(caja.getByLabelText('Garantía en días'), '30')
    await userEvent.click(caja.getByRole('button', { name: 'Guardar' }))
    expect(guardarPreciosReferencia).toHaveBeenCalledWith(
      'ESC-DAMP-001', [{ tallaDesde: 28, tallaHasta: 35, precioMinimo: 45000, precioMaximo: 55000 }], 30,
    )
    expect(await caja.findByText('Guardado')).toBeInTheDocument()
  })

  it('no deja guardar rangos inválidos y avisa las tallas que quedan sin rango', async () => {
    pintar()
    const caja = within(await tarjeta('ESC-DAMP-001 · Damper diana'))
    await userEvent.type(caja.getByLabelText('Precio mínimo, rango 1'), '50000')
    await userEvent.type(caja.getByLabelText('Precio máximo, rango 1'), '40000')
    expect(caja.getByText('Tramo 1: el máximo es menor que el mínimo.')).toBeInTheDocument()
    expect(caja.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    await userEvent.clear(caja.getByLabelText('Precio máximo, rango 1'))
    await userEvent.clear(caja.getByLabelText('Talla hasta, rango 1'))
    await userEvent.type(caja.getByLabelText('Talla hasta, rango 1'), '30')
    expect(caja.getByText('Sin rango (siguen igual): tallas 35')).toBeInTheDocument()
    expect(caja.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })
})
