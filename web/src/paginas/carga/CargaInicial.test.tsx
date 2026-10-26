import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import type { ProductoCalzado } from '../../lib/inventario'
import { listarCalzado, referenciaParaModelo } from '../../lib/datos/inventario'
import { cargarInventario } from '../../lib/datos/carga'
import { subirFotoCatalogo } from '../../lib/datos/fotos'
import { procesarFotoProducto } from '../../lib/imagen'
import { CargaInicial } from './CargaInicial'

vi.mock('../../lib/datos/inventario', () => ({ listarCalzado: vi.fn(), referenciaParaModelo: vi.fn() }))
vi.mock('../../lib/datos/carga', () => ({ cargarInventario: vi.fn() }))
vi.mock('../../lib/datos/fotos', () => ({ subirFotoCatalogo: vi.fn() }))
vi.mock('../../lib/imagen', async (original) => ({
  ...(await original<typeof import('../../lib/imagen')>()),
  procesarFotoProducto: vi.fn().mockResolvedValue({ grande: new Blob(['g']), mini: new Blob(['m']), extension: 'webp' }),
}))

const p = (o: Partial<ProductoCalzado>): ProductoCalzado => ({
  id: 'x', referencia: 'TR-1', descripcion: 'Tennis Running', marca: 'Kalzado', color: 'Negro', categoria: 'Tennis',
  talla: '38', precio_minimo: 90000, precio_maximo: 120000, stock_actual: 3, stock_minimo: 1, activo: true, proveedor_id: null, ...o,
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(listarCalzado).mockResolvedValue([p({ id: 'a38' })])
  vi.mocked(cargarInventario).mockResolvedValue({ creados: 5, actualizados: 0, sin_cambios: 0 })
  vi.mocked(referenciaParaModelo).mockResolvedValue('CHA-MANI-001')
  vi.mocked(subirFotoCatalogo).mockImplementation(async (nombre) => `https://fotos/catalogo/${nombre}.webp?v=1`)
})

function pintar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter><CargaInicial /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Carga inicial', () => {
  it('carga un zapato nuevo con sus tallas, precio y foto nombrada con la referencia que se aparta y el color', async () => {
    pintar()
    const foto = await screen.findByLabelText('Foto de la fila 1')
    // Sin descripción ni categoría todavía no hay con qué armar la referencia de la foto.
    expect(foto).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Color de la fila 1'), 'Rojo')
    await userEvent.type(screen.getByLabelText('Descripción de la fila 1'), 'Diana Gold')
    await userEvent.type(screen.getByLabelText('Marca de la fila 1'), 'Manisol')
    await userEvent.selectOptions(screen.getByLabelText('Categoría de la fila 1'), 'Chanclas')
    // Sin costo en la carga inicial: solo precios.
    expect(screen.queryByLabelText('Costo tallas 20–45 de la fila 1')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Precio mínimo tallas 20–45 de la fila 1'), '30000')
    for (const [talla, n] of [['35', '4'], ['36', '4'], ['37', '10'], ['38', '10'], ['39', '4']]) {
      await userEvent.type(screen.getByLabelText(`Talla ${talla} de la fila 1`), n)
    }

    await userEvent.upload(foto, new File(['x'], 'IMG_1234.jpg', { type: 'image/jpeg' }))
    const encuadre = screen.getByRole('dialog', { name: 'Encuadrar foto' })
    expect(within(encuadre).getByText('la referencia nueva y el color')).toBeInTheDocument()
    await userEvent.click(within(encuadre).getByRole('button', { name: 'Usar foto' }))
    expect(await screen.findByText('Foto nueva')).toBeInTheDocument()
    expect(procesarFotoProducto).toHaveBeenCalled()
    expect(referenciaParaModelo).toHaveBeenCalledWith('Diana Gold', 'Manisol', 'Chanclas')
    expect(subirFotoCatalogo).toHaveBeenCalledWith('cha-mani-001-rojo', expect.objectContaining({ extension: 'webp' }))
    expect(screen.getByText(/1 referencia · 5 tallas nuevas ·/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Revisar y guardar' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Confirmar carga' })).getByRole('button', { name: 'Guardar en el inventario' }))
    const [filas, proveedor] = vi.mocked(cargarInventario).mock.lastCall!
    expect(proveedor).toBeNull()
    expect(filas).toHaveLength(5)
    expect(filas[0]).toEqual(expect.objectContaining({
      referencia: 'CHA-MANI-001', color: 'Rojo', descripcion: 'Diana Gold', marca: 'Manisol', categoria: 'Chanclas',
      talla: '35', stock: 4, precio_minimo: 30000, foto_url: 'https://fotos/catalogo/cha-mani-001-rojo.webp?v=1',
    }))
    expect(await screen.findByRole('status')).toHaveTextContent('Guardado: 5 tallas nuevas')
    // Queda lista para la siguiente tanda y sin borrador.
    expect(screen.getByLabelText('Descripción de la fila 1')).toHaveValue('')
    expect(screen.getByLabelText('Referencia de la fila 1')).toHaveTextContent('Se pone sola')
    expect(JSON.parse(localStorage.getItem('panel-carga-inicial-borrador')!)).toHaveLength(1)
  })

  it('lo ya cargado se ve en gris con su stock y no se vuelve a cargar', async () => {
    pintar()
    await userEvent.type(await screen.findByLabelText('Descripción de la fila 1'), 'Tennis running')
    await userEvent.type(screen.getByLabelText('Color de la fila 1'), 'negro')
    await userEvent.tab()
    expect(screen.getByLabelText('Referencia de la fila 1')).toHaveTextContent('TR-1')
    expect(screen.getByLabelText('Marca de la fila 1')).toHaveValue('Kalzado')
    const t38 = screen.getByLabelText('Talla 38 de la fila 1')
    expect(t38).toHaveValue('3')
    expect(t38).toHaveAttribute('readonly')
    await userEvent.type(t38, '9')
    expect(t38).toHaveValue('3')
    await userEvent.type(screen.getByLabelText('Talla 39 de la fila 1'), '2')

    await userEvent.click(screen.getByRole('button', { name: 'Revisar y guardar' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar en el inventario' }))
    const [filas] = vi.mocked(cargarInventario).mock.lastCall!
    expect(filas).toEqual([expect.objectContaining({ referencia: 'TR-1', color: 'Negro', talla: '39', stock: 2, precio_minimo: 90000, precio_maximo: 120000 })])
  })

  it('no deja guardar si falta algo y dice qué', async () => {
    pintar()
    await userEvent.type(await screen.findByLabelText('Talla 40 de la fila 1'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Revisar y guardar' }))
    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent('Falta la descripción de la fila 1.')
    expect(alerta).toHaveTextContent('Falta la categoría de la fila 1.')
    expect(alerta).toHaveTextContent('Falta el precio mínimo de la fila 1 (tallas 20–45).')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cargarInventario).not.toHaveBeenCalled()
  })
})
