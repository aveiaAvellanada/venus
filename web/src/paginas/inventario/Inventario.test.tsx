import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import type { ProductoCalzado } from '../../lib/inventario'
import { actualizarTalla, cambiarPrecios, costosPorProducto, listarCalzado } from '../../lib/datos/inventario'
import { construirRegla } from './CambiarPrecios'
import { Inventario } from './Inventario'

vi.mock('../../lib/datos/inventario', () => ({
  listarCalzado: vi.fn(),
  costosPorProducto: vi.fn(),
  cambiarPrecios: vi.fn(),
  actualizarTalla: vi.fn(),
}))

const p = (o: Partial<ProductoCalzado>): ProductoCalzado => ({
  id: 'x', referencia: 'TR-1', descripcion: 'Tennis Running', marca: 'Kalzado', color: 'Negro', categoria: 'Tennis',
  talla: '38', precio_minimo: 90000, precio_maximo: 120000, stock_actual: 3, stock_minimo: 1, activo: true,
  proveedor_id: null, ...o,
})

beforeEach(() => {
  vi.mocked(listarCalzado).mockResolvedValue([
    p({ id: 'a38' }),
    p({ id: 'a39', talla: '39', stock_actual: 0 }),
    p({ id: 'b40', referencia: 'BC-7', descripcion: 'Bota caucho', categoria: 'Botas caucho', marca: 'Andina', color: 'Verde', talla: '40', precio_minimo: 40000, precio_maximo: 50000, stock_actual: 6 }),
  ])
  vi.mocked(costosPorProducto).mockResolvedValue(new Map([['a38', { ultimo: 60000, promedio: 58000 }]]))
  vi.mocked(actualizarTalla).mockResolvedValue()
})

function pintar(ruta = '/inventario') {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}><Inventario /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Inventario', () => {
  it('una fila por referencia con sus tallas, precio, costo y margen', async () => {
    pintar()
    const fila = (await screen.findByText(/TR-1 · Tennis Running/)).closest('tr')!
    expect(within(fila).getByText('38: 3')).toBeInTheDocument()
    expect(within(fila).getByText('39: 0')).toBeInTheDocument()
    expect(within(fila).getByText('$90.000 – $120.000')).toBeInTheDocument()
    expect(within(fila).getByText('$60.000')).toBeInTheDocument()
    expect(within(fila).getByText('50 %')).toBeInTheDocument()
    expect(screen.getByText(/2 referencias · 9 pares en stock/)).toBeInTheDocument()
  })

  it('sin permiso de costos no muestra costo ni margen', async () => {
    vi.mocked(costosPorProducto).mockRejectedValue(new Error('No tienes permiso para ver costos.'))
    pintar()
    await screen.findByText(/TR-1 · Tennis Running/)
    expect(screen.queryByRole('columnheader', { name: 'Margen' })).not.toBeInTheDocument()
  })

  it('llega filtrado desde la búsqueda global y filtra por texto sin tildes', async () => {
    pintar('/inventario?buscar=bota')
    expect(await screen.findByText(/BC-7 · Bota caucho/)).toBeInTheDocument()
    expect(screen.queryByText(/TR-1/)).not.toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Buscar en el inventario'))
    await userEvent.type(screen.getByLabelText('Buscar en el inventario'), 'TENNÍS')
    expect(screen.getByText(/TR-1 · Tennis Running/)).toBeInTheDocument()
  })

  it('el detalle guarda el stock mínimo al salir del campo', async () => {
    pintar()
    await userEvent.click(await screen.findByRole('button', { name: /TR-1 · Tennis Running/ }))
    const campo = screen.getByLabelText('Stock mínimo talla 39')
    await userEvent.clear(campo)
    await userEvent.type(campo, '2')
    await userEvent.tab()
    expect(actualizarTalla).toHaveBeenCalledWith('a39', { stock_minimo: 2 })
  })

  it('seleccionar, ver la vista previa y aplicar un cambio de precios', async () => {
    vi.mocked(cambiarPrecios).mockImplementation(async (ids, _regla, aplicar) => ({
      aplicado: aplicar,
      invalidos: 0,
      cambiados: aplicar ? ids.length : undefined,
      filas: ids.map((id) => ({
        id, referencia: 'TR-1', descripcion: 'Tennis Running', talla: id.slice(1), color: 'Negro',
        min_antes: 90000, max_antes: 120000, min_nuevo: 99000, max_nuevo: 132000, valido: true,
      })),
    }))
    pintar()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Seleccionar TR-1' }))
    expect(screen.getByText('1 referencia · 2 tallas')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar precios' }))
    const dialogo = screen.getByRole('dialog', { name: /Cambiar precios de 2 tallas/ })
    await userEvent.type(within(dialogo).getByLabelText(/Porcentaje/), '10')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Ver cómo quedan' }))
    expect(await within(dialogo).findAllByText('$99.000 – $132.000')).toHaveLength(2)
    expect(cambiarPrecios).toHaveBeenLastCalledWith(
      ['a38', 'a39'], { tipo: 'porcentaje', valor: 10, campos: 'ambos', redondeo: 1000, motivo: undefined }, false)
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar a 2 tallas' }))
    expect(cambiarPrecios).toHaveBeenLastCalledWith(['a38', 'a39'], expect.objectContaining({ valor: 10 }), true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('no deja aplicar si algún mínimo queda mayor que el máximo', async () => {
    vi.mocked(cambiarPrecios).mockResolvedValue({
      aplicado: false, invalidos: 1,
      filas: [{ id: 'b40', referencia: 'BC-7', descripcion: 'Bota caucho', talla: '40', color: 'Verde', min_antes: 40000, max_antes: 50000, min_nuevo: 60000, max_nuevo: 50000, valido: false }],
    })
    pintar()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Seleccionar BC-7' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar precios' }))
    const dialogo = screen.getByRole('dialog')
    await userEvent.click(within(dialogo).getByText('Precio fijo'))
    await userEvent.selectOptions(within(dialogo).getByLabelText('Aplicar a'), 'minimo')
    await userEvent.type(within(dialogo).getByLabelText('Precio mínimo'), '60.000')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Ver cómo quedan' }))
    expect(await within(dialogo).findByText('1 con mínimo mayor que el máximo')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: /Aplicar a/ })).toBeDisabled()
  })
})

describe('construirRegla', () => {
  const base = { valor: '', minimo: '', maximo: '', campos: 'ambos' as const, redondeo: 0, motivo: '' }
  it('porcentaje acepta decimales con punto o coma; pesos usa el punto de miles', () => {
    expect(construirRegla({ ...base, tipo: 'porcentaje', valor: '2.5' })).toMatchObject({ valor: 2.5 })
    expect(construirRegla({ ...base, tipo: 'porcentaje', valor: '2,5' })).toMatchObject({ valor: 2.5 })
    expect(construirRegla({ ...base, tipo: 'suma', valor: '5.000' })).toMatchObject({ valor: 5000 })
    expect(construirRegla({ ...base, tipo: 'fijo', minimo: '80.000', maximo: '100.000' })).toMatchObject({ minimo: 80000, maximo: 100000 })
  })
  it('incompleta o en cero no arma regla', () => {
    expect(construirRegla({ ...base, tipo: 'porcentaje', valor: '0' })).toBeNull()
    expect(construirRegla({ ...base, tipo: 'fijo', minimo: '80000' })).toBeNull()
    expect(construirRegla({ ...base, tipo: 'fijo', campos: 'minimo', minimo: '80000' })).toEqual(
      { tipo: 'fijo', campos: 'minimo', redondeo: 0, motivo: undefined, minimo: 80000 })
  })
})
