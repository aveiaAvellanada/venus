import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ProductoCalzado } from '../../lib/inventario'
import { costosPorProducto, listarCalzado } from '../../lib/datos/inventario'
import { listarConteos, obtenerConteo, registrarConteo } from '../../lib/datos/conteo'
import { Conteos } from './Conteos'
import { DetalleConteo } from './DetalleConteo'
import { NuevoConteo } from './NuevoConteo'

vi.mock('../../lib/datos/inventario', () => ({
  listarCalzado: vi.fn(),
  costosPorProducto: vi.fn(),
}))
vi.mock('../../lib/datos/conteo', () => ({
  listarConteos: vi.fn(),
  obtenerConteo: vi.fn(),
  registrarConteo: vi.fn(),
}))

const p = (o: Partial<ProductoCalzado>): ProductoCalzado => ({
  id: 'x', referencia: 'TA-1', descripcion: 'Tennis A', marca: 'Bosi', color: 'Negro', categoria: 'Tennis',
  talla: '38', precio_minimo: 80000, precio_maximo: 100000, stock_actual: 5, stock_minimo: 1, activo: true,
  proveedor_id: null, ...o,
})

beforeEach(() => {
  localStorage.clear()
  vi.mocked(listarCalzado).mockResolvedValue([
    p({ id: 't38' }),
    p({ id: 't39', talla: '39', stock_actual: 2 }),
    p({ id: 'b40', referencia: 'BC-7', descripcion: 'Bota caucho', categoria: 'Botas caucho', marca: 'Andina', color: 'Verde', talla: '40', stock_actual: 6 }),
    p({ id: 'viejo', talla: '41', activo: false, stock_actual: 9 }),
  ])
  vi.mocked(costosPorProducto).mockResolvedValue(new Map([['t38', { ultimo: 50000, promedio: 50000 }]]))
})

function pintar(ruta: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/conteo" element={<Conteos />} />
          <Route path="/conteo/nuevo" element={<NuevoConteo />} />
          <Route path="/conteo/:id" element={<DetalleConteo />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const campo = (nombre: RegExp) => screen.getByRole('textbox', { name: nombre })

describe('Nuevo conteo', () => {
  it('compara lo contado con el sistema y Enter pasa a la siguiente talla', async () => {
    pintar('/conteo/nuevo')
    await userEvent.type(await screen.findByLabelText('Contado de TA-1 Negro talla 38'), '3{Enter}')
    expect(campo(/TA-1 Negro talla 39/)).toHaveFocus()
    await userEvent.keyboard('2')
    const fila = screen.getByRole('region', { name: 'TA-1 Negro' })
    expect(within(fila).getByText('−2')).toBeInTheDocument()
    expect(within(fila).getByText('✓')).toBeInTheDocument()
    // Las tallas inactivas no se cuentan.
    expect(screen.queryByLabelText(/talla 41/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisar y confirmar' }).previousElementSibling)
      .toHaveTextContent('2 tallas contadas · 1 sin contar · 1 con diferencia · −2 faltantes')
  })

  it('pide el motivo antes de ajustar y manda lo que se vio al contar', async () => {
    vi.mocked(registrarConteo).mockResolvedValue({ aplicado: true, repetido: false, conteo_id: 'c1' })
    vi.mocked(obtenerConteo).mockResolvedValue(null)
    pintar('/conteo/nuevo')
    await userEvent.selectOptions(await screen.findByLabelText('Categoría a contar'), 'Tennis')
    expect(screen.queryByText(/BC-7/)).not.toBeInTheDocument()
    await userEvent.type(campo(/TA-1 Negro talla 38/), '3')
    await userEvent.type(campo(/TA-1 Negro talla 39/), '3')
    // Con algo contado, el alcance queda fijo.
    expect(screen.getByLabelText('Categoría a contar')).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Revisar y confirmar' }))
    const dialogo = screen.getByRole('dialog', { name: 'Confirmar conteo' })
    expect(within(dialogo).getByText('faltan $100.000')).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Ajustar 2 tallas' }))
    expect(within(dialogo).getByText('TA-1 Negro talla 38: elige el motivo de la diferencia.')).toBeInTheDocument()
    expect(registrarConteo).not.toHaveBeenCalled()

    await userEvent.selectOptions(within(dialogo).getByLabelText('Motivo para todas'), 'perdida')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar' }))
    // Pérdida no explica un sobrante: ese queda sin motivo.
    expect(within(dialogo).getByLabelText('Motivo de TA-1 Negro talla 38')).toHaveValue('perdida')
    expect(within(dialogo).getByLabelText('Motivo de TA-1 Negro talla 39')).toHaveValue('')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Motivo de TA-1 Negro talla 39'), 'error')
    await userEvent.type(within(dialogo).getByLabelText('Nota del conteo'), 'Fin de mes')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Ajustar 2 tallas' }))

    expect(registrarConteo).toHaveBeenCalledWith({
      alcance: 'Tennis',
      nota: 'Fin de mes',
      items: [
        { producto_id: 't38', sistema: 5, contado: 3, motivo: 'perdida', nota: null },
        { producto_id: 't39', sistema: 2, contado: 3, motivo: 'error', nota: null },
      ],
    }, expect.any(String))
    expect(await screen.findByText('Este conteo no existe.')).toBeInTheDocument()
    expect(localStorage.getItem('panel-conteo-borrador')).toBeNull()
  })

  it('si el stock cambió mientras se contaba, marca esas tallas y no guarda', async () => {
    vi.mocked(registrarConteo).mockResolvedValue({
      aplicado: false, cambiados: [{ producto_id: 't38', sistema_antes: 5, sistema_ahora: 4 }],
    })
    pintar('/conteo/nuevo')
    await userEvent.type(await screen.findByLabelText('Contado de TA-1 Negro talla 38'), '5')
    await userEvent.click(screen.getByRole('button', { name: 'Revisar y confirmar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar conteo sin diferencias' }))
    expect(await screen.findByText(/cambió el stock de 1 talla/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Recontar')).toBeInTheDocument()
    expect(screen.getByText('sist. 4')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mantener lo contado' }))
    expect(within(screen.getByRole('region', { name: 'TA-1 Negro' })).getByText('+1')).toBeInTheDocument()
  })

  it('"Todo coincide" llena la referencia con el sistema y el borrador sobrevive', async () => {
    pintar('/conteo/nuevo')
    const fila = await screen.findByRole('region', { name: 'TA-1 Negro' })
    await userEvent.click(within(fila).getByRole('button', { name: /Todo coincide/ }))
    expect(campo(/TA-1 Negro talla 38/)).toHaveValue('5')
    expect(campo(/TA-1 Negro talla 39/)).toHaveValue('2')
    expect(JSON.parse(localStorage.getItem('panel-conteo-borrador')!).contados.t39).toMatchObject({ contado: '2', sistema: 2 })
  })
})

describe('Conteos y detalle', () => {
  const conteo = {
    id: 'c1', alcance: 'Tennis', nota: 'Fin de mes', tallas_contadas: 2, tallas_ajustadas: 1,
    unidades_sobrantes: 0, unidades_faltantes: 2, created_at: '2026-10-22T15:00:00Z', autor: 'Andrés',
  }

  it('la lista muestra cada conteo con sus diferencias', async () => {
    vi.mocked(listarConteos).mockResolvedValue([conteo])
    pintar('/conteo')
    const fila = (await screen.findByText('Andrés')).closest('tr')!
    expect(within(fila).getByText('Tennis')).toBeInTheDocument()
    expect(within(fila).getByText('−2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo conteo' })).toBeInTheDocument()
  })

  it('el detalle muestra lo ajustado con su motivo y, si se pide, lo que coincidió', async () => {
    vi.mocked(obtenerConteo).mockResolvedValue({
      ...conteo,
      items: [
        { id: 'i1', producto_id: 't38', sistema: 5, contado: 3, diferencia: -2, motivo: 'perdida', nota: 'Vitrina',
          producto: { referencia: 'TA-1', descripcion: 'Tennis A', marca: 'Bosi', color: 'Negro', talla: '38', categoria: 'Tennis' } },
        { id: 'i2', producto_id: 't39', sistema: 2, contado: 2, diferencia: 0, motivo: null, nota: null,
          producto: { referencia: 'TA-1', descripcion: 'Tennis A', marca: 'Bosi', color: 'Negro', talla: '39', categoria: 'Tennis' } },
      ],
    })
    pintar('/conteo/c1')
    expect(await screen.findByRole('heading', { name: 'Conteo · Tennis' })).toBeInTheDocument()
    expect(screen.getByText('Pérdida o robo')).toBeInTheDocument()
    expect(screen.getByText('Vitrina')).toBeInTheDocument()
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Ver también las que coincidieron'))
    expect(screen.getByText('✓')).toBeInTheDocument()
  })
})
