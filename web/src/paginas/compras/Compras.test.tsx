import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { hoyEn } from '@shared/fechas'
import type { ProductoCalzado } from '../../lib/inventario'
import { costosPorProducto, listarCalzado } from '../../lib/datos/inventario'
import { listarProveedores, subirDocumento } from '../../lib/datos/proveedores'
import { listarCompras, obtenerCompra, registrarCompra } from '../../lib/datos/compras'
import { Compras } from './Compras'
import { DetalleCompra } from './DetalleCompra'
import { NuevaCompra } from './NuevaCompra'

vi.mock('../../lib/datos/inventario', () => ({ listarCalzado: vi.fn(), costosPorProducto: vi.fn() }))
vi.mock('../../lib/datos/proveedores', async (original) => ({
  ...(await original<typeof import('../../lib/datos/proveedores')>()),
  listarProveedores: vi.fn(),
  subirDocumento: vi.fn(),
  documentosDelProveedor: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../lib/datos/compras', () => ({ listarCompras: vi.fn(), obtenerCompra: vi.fn(), registrarCompra: vi.fn() }))

const HOY = hoyEn()
const p = (o: Partial<ProductoCalzado>): ProductoCalzado => ({
  id: 'x', referencia: 'TR-1', descripcion: 'Tennis Running', marca: 'Kalzado', color: 'Negro', categoria: 'Tennis',
  talla: '38', precio_minimo: 90000, precio_maximo: 120000, stock_actual: 3, stock_minimo: 1, activo: true, proveedor_id: null, ...o,
})

beforeEach(() => {
  localStorage.clear()
  vi.mocked(listarProveedores).mockResolvedValue([
    { id: 'p1', nombre: 'Calzado Andino', nit_cedula: null, telefono: null, ciudad: null, notas: null, activo: true },
  ])
  vi.mocked(listarCalzado).mockResolvedValue([p({ id: 'a38' }), p({ id: 'a39', talla: '39' })])
  vi.mocked(costosPorProducto).mockResolvedValue(new Map([['a38', { ultimo: 60000, promedio: 60000 }]]))
  vi.mocked(registrarCompra).mockResolvedValue({ compra_id: 'c9', repetida: false })
  vi.mocked(obtenerCompra).mockResolvedValue(null)
  vi.mocked(listarCompras).mockResolvedValue([
    { id: 'c1', proveedor_id: 'p1', proveedor: 'Calzado Andino', estado: 'completada', condicion_pago: 'credito', total: 500000,
      saldo_pendiente: 300000, fecha_vencimiento: HOY, numero_factura: 'FV-77', fecha_factura: HOY, created_at: `${HOY}T15:00:00Z` },
    { id: 'c2', proveedor_id: 'p2', proveedor: 'Botas del Sur', estado: 'completada', condicion_pago: 'contado', total: 120000,
      saldo_pendiente: 0, fecha_vencimiento: null, numero_factura: null, fecha_factura: HOY, created_at: `${HOY}T15:00:00Z` },
  ])
})

function pintar(ruta: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/compras" element={<Compras />} />
          <Route path="/compras/nueva" element={<NuevaCompra />} />
          <Route path="/compras/:id" element={<DetalleCompra />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Lista de compras', () => {
  it('muestra totales y filtra las que tienen saldo', async () => {
    pintar('/compras')
    expect(await screen.findByText('FV-77')).toBeInTheDocument()
    expect(screen.getByText('$620.000')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Con saldo' }))
    expect(screen.queryByRole('cell', { name: 'Botas del Sur' })).not.toBeInTheDocument()
    expect(screen.getAllByText('$300.000').length).toBeGreaterThan(0)
  })
})

describe('Nueva compra', () => {
  it('reconoce una referencia existente: trae datos, precios y último costo', async () => {
    pintar('/compras/nueva')
    const ref = await screen.findByLabelText('Referencia de la fila 1')
    await userEvent.type(ref, 'tr-1')
    await userEvent.type(screen.getByLabelText('Color de la fila 1'), 'negro')
    await userEvent.tab()
    expect(screen.getByLabelText('Descripción de la fila 1')).toHaveValue('Tennis Running')
    expect(screen.getByLabelText('Referencia de la fila 1')).toHaveValue('TR-1')
    expect(screen.getByLabelText('Precio mínimo tallas 20–45 de la fila 1')).toHaveValue('90.000')
    expect(screen.getByLabelText('Costo tallas 20–45 de la fila 1')).toHaveValue('60.000')
    expect(screen.getByText('En inventario')).toBeInTheDocument()
  })

  it('no deja guardar incompleta y dice qué falta', async () => {
    pintar('/compras/nueva')
    await userEvent.type(await screen.findByLabelText('Talla 40 de la fila 1'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Revisar y guardar' }))
    const alerta = screen.getByRole('alert')
    expect(within(alerta).getByText('Elige el proveedor.')).toBeInTheDocument()
    expect(within(alerta).getByText('Falta la descripción de la fila 1.')).toBeInTheDocument()
    expect(within(alerta).getByText('Falta el costo de la fila 1 (tallas 20–45).')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('precio por rango de tallas, Enter baja a la fila siguiente y guarda con una clave', async () => {
    pintar('/compras/nueva')
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Proveedor *' }), 'p1')
    await userEvent.type(screen.getByLabelText('Número de factura'), 'FV-1001')
    await userEvent.type(screen.getByLabelText('Referencia de la fila 1'), 'ES-9')
    await userEvent.type(screen.getByLabelText('Descripción de la fila 1'), 'Escolar')
    await userEvent.selectOptions(screen.getByLabelText('Categoría de la fila 1'), 'Escolar')
    await userEvent.type(screen.getByLabelText('Costo tallas 20–45 de la fila 1'), '30.000')
    await userEvent.type(screen.getByLabelText('Precio mínimo tallas 20–45 de la fila 1'), '45000')
    await userEvent.type(screen.getByLabelText('Precio máximo tallas 20–45 de la fila 1'), '55000')
    await userEvent.selectOptions(screen.getByLabelText('Dividir tallas 20–45 de la fila 1'), '34')
    const costoGrandes = screen.getByLabelText('Costo tallas 34–45 de la fila 1')
    await userEvent.clear(costoGrandes)
    await userEvent.type(costoGrandes, '38000')
    await userEvent.type(screen.getByLabelText('Talla 24 de la fila 1'), '4')
    await userEvent.type(screen.getByLabelText('Talla 36 de la fila 1'), '2{Enter}')
    // Enter en la última fila agrega otra y se para en la misma talla
    expect(screen.getByLabelText('Talla 36 de la fila 2')).toHaveFocus()
    expect(screen.getAllByText('$196.000').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: 'Revisar y guardar' }))
    const dialogo = screen.getByRole('dialog', { name: 'Confirmar compra' })
    expect(within(dialogo).getByText('2 tallas nuevas se crean')).toBeInTheDocument()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar y subir stock' }))
    const [factura, clave] = vi.mocked(registrarCompra).mock.calls[0]
    expect(clave).toEqual(expect.any(String))
    expect(factura).toMatchObject({ proveedorId: 'p1', numeroFactura: 'FV-1001', condicion: 'contado' })
    expect(subirDocumento).not.toHaveBeenCalled()
    expect(localStorage.getItem('panel-compra-borrador')).toBeNull()
  })

  it('el borrador queda en el navegador y vuelve al abrir otra vez', async () => {
    const { unmount } = pintar('/compras/nueva')
    await userEvent.type(await screen.findByLabelText('Referencia de la fila 1'), 'BORRADOR-1')
    unmount()
    pintar('/compras/nueva')
    expect(await screen.findByLabelText('Referencia de la fila 1')).toHaveValue('BORRADOR-1')
  })
})
