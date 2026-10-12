import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import type { ProductoCalzado } from '../../lib/inventario'
import { costosPorProducto, listarCalzado } from '../../lib/datos/inventario'
import { listarProveedores } from '../../lib/datos/proveedores'
import { cargarInventario } from '../../lib/datos/carga'
import { descargarExcel, leerArchivoExcel } from '../../lib/excel'
import { Carga } from './Carga'

vi.mock('../../lib/datos/inventario', () => ({ listarCalzado: vi.fn(), costosPorProducto: vi.fn() }))
vi.mock('../../lib/datos/proveedores', () => ({ listarProveedores: vi.fn() }))
vi.mock('../../lib/datos/carga', () => ({ cargarInventario: vi.fn() }))
vi.mock('../../lib/excel', () => ({ leerArchivoExcel: vi.fn(), descargarExcel: vi.fn() }))

const p = (o: Partial<ProductoCalzado>): ProductoCalzado => ({
  id: 'a38', referencia: 'TR-1', descripcion: 'Tennis Running', marca: 'Kalzado', color: 'Negro', categoria: 'Tennis',
  talla: '38', precio_minimo: 90000, precio_maximo: 120000, stock_actual: 3, stock_minimo: 1, activo: true, proveedor_id: null, ...o,
})
const fila = (o: Record<string, unknown>) => ({
  categoria: 'Tennis', descripcion: 'Tennis Running', marca: 'Kalzado', referencia: 'TR-1', color: 'Negro', talla: 38,
  precio_minimo: 90000, precio_maximo: 120000, costo: 60000, stock: 3, ...o,
})

beforeEach(() => {
  vi.mocked(listarCalzado).mockResolvedValue([p({}), p({ id: 'a39', talla: '39' })])
  vi.mocked(costosPorProducto).mockResolvedValue(new Map([['a38', { ultimo: 60000, promedio: 60000 }]]))
  vi.mocked(listarProveedores).mockResolvedValue([
    { id: 'pv1', nombre: 'Calzado Andino', nit_cedula: null, telefono: null, ciudad: null, notas: null, activo: true },
  ])
  vi.mocked(cargarInventario).mockResolvedValue({ creados: 1, actualizados: 1, sin_cambios: 1 })
})

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter><Carga /></MemoryRouter>
    </QueryClientProvider>,
  )
}

const excel = (nombre = 'inventario.xlsx') => new File(['x'], nombre)

async function subir(filas: Record<string, unknown>[]) {
  vi.mocked(leerArchivoExcel).mockResolvedValue(filas)
  await userEvent.upload(screen.getByLabelText('Archivo de Excel'), excel())
}

describe('Carga masiva', () => {
  it('muestra la revisión y guarda todo junto, con el proveedor de las nuevas', async () => {
    pintar()
    await screen.findByText('Así funciona')
    await subir([
      fila({}),
      fila({ talla: 39, precio_minimo: 95000, precio_maximo: 125000, stock: 10 }),
      fila({ talla: 40, stock: 6 }),
    ])

    expect(await screen.findByText('Archivo: inventario.xlsx ·', { exact: false })).toBeInTheDocument()
    const tabla = screen.getByRole('table')
    expect(within(tabla).getByText('Precio $90.000–$120.000 → $95.000–$125.000')).toBeInTheDocument()
    expect(within(tabla).getByText('archivo: 10')).toBeInTheDocument()
    expect(screen.getByText(/1 talla que ya existe trae otro stock/)).toBeInTheDocument()
    expect(screen.getByText('6 pares entran al stock')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Nuevas' }))
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'pv1')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar 2 tallas' }))

    expect(await screen.findByText('Inventario guardado.')).toBeInTheDocument()
    const [filas, proveedor] = vi.mocked(cargarInventario).mock.calls[0]
    expect(proveedor).toBe('pv1')
    expect(filas).toHaveLength(3)
    expect(filas[2]).toMatchObject({ fila: 4, talla: '40', stock: 6, costo: 60000 })
  })

  it('con errores lista cada fila y no deja guardar', async () => {
    pintar()
    await screen.findByText('Así funciona')
    await subir([fila({ talla: 40 }), fila({ categoria: 'Sandalias', talla: 41 }), fila({ talla: 40 })])

    const alerta = await screen.findByText(/2 filas tienen errores/)
    const lista = alerta.closest('section')!
    expect(within(lista).getByText(/Categoría inválida o no encontrada: Sandalias/)).toBeInTheDocument()
    expect(within(lista).getByText(/Esa talla ya viene en la fila 2/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Guardar/ })).toBeDisabled()
  })

  it('si el archivo es igual al inventario no hay nada que guardar', async () => {
    pintar()
    await screen.findByText('Así funciona')
    await subir([fila({}), fila({ talla: 39 })])
    expect(await screen.findByText('Nada que guardar: el archivo es igual al inventario.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Guardar/ })).toBeDisabled()
  })

  it('rechaza lo que no es Excel y muestra el error de la base al guardar', async () => {
    pintar()
    await screen.findByText('Así funciona')
    await userEvent.upload(screen.getByLabelText('Archivo de Excel'), excel('fotos.zip'), { applyAccept: false })
    expect(await screen.findByText('Elige un archivo de Excel (.xlsx o .xls).')).toBeInTheDocument()

    vi.mocked(cargarInventario).mockRejectedValue(new Error('Fila 2: no tienes permiso para cambiar precios.'))
    await subir([fila({ precio_maximo: 130000 })])
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar 1 talla' }))
    expect(await screen.findByText('Fila 2: no tienes permiso para cambiar precios.')).toBeInTheDocument()
  })

  it('descarga el inventario con el formato de la plantilla y el último costo', async () => {
    pintar()
    const boton = await screen.findByRole('button', { name: 'Descargar inventario' })
    await waitFor(() => expect(boton).toBeEnabled())
    await userEvent.click(boton)
    await waitFor(() => expect(boton).toBeEnabled())
    const [nombre, hojas] = vi.mocked(descargarExcel).mock.calls[0]
    expect(nombre).toMatch(/^inventario-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(hojas[0].filas[1]).toEqual(['Tennis', 'Tennis Running', 'Kalzado', 'TR-1', '38', 'Negro', 90000, 120000, 60000, 3])
    expect(hojas[1].nombre).toBe('Instrucciones')
  })
})
