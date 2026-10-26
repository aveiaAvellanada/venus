import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { hoyEn } from '@shared/fechas'
import type { ProductoCalzado } from '../../lib/inventario'
import { costosPorProducto, listarCalzado, referenciaParaModelo } from '../../lib/datos/inventario'
import { listarProveedores, subirDocumento } from '../../lib/datos/proveedores'
import { fijarFotos, listarCompras, obtenerCompra, registrarCompra } from '../../lib/datos/compras'
import { subirFotoCatalogo } from '../../lib/datos/fotos'
import { Compras } from './Compras'
import { DetalleCompra } from './DetalleCompra'
import { NuevaCompra } from './NuevaCompra'

vi.mock('../../lib/datos/inventario', () => ({ listarCalzado: vi.fn(), costosPorProducto: vi.fn(), referenciaParaModelo: vi.fn() }))
vi.mock('../../lib/datos/proveedores', async (original) => ({
  ...(await original<typeof import('../../lib/datos/proveedores')>()),
  listarProveedores: vi.fn(),
  subirDocumento: vi.fn(),
  documentosDelProveedor: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../lib/datos/compras', () => ({
  listarCompras: vi.fn(), obtenerCompra: vi.fn(), registrarCompra: vi.fn(), fijarFotos: vi.fn(),
}))
vi.mock('../../lib/datos/fotos', () => ({ subirFotoCatalogo: vi.fn() }))
vi.mock('../../lib/imagen', async (original) => ({
  ...(await original<typeof import('../../lib/imagen')>()),
  comprimirFoto: vi.fn().mockResolvedValue(new Blob(['jpg'], { type: 'image/jpeg' })),
  procesarFotoProducto: vi.fn().mockResolvedValue({ grande: new Blob(['g']), mini: new Blob(['m']), extension: 'webp' }),
}))

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
  vi.mocked(listarCalzado).mockResolvedValue([
    p({ id: 'a38' }), p({ id: 'a39', talla: '39' }),
    p({ id: 'v1', referencia: 'BV-2', marca: 'Verlon', color: 'Rojo y blanco', talla: '40' }),
  ])
  vi.mocked(subirFotoCatalogo).mockImplementation(async (nombre) => `https://fotos/catalogo/${nombre}.webp?v=1`)
  vi.mocked(fijarFotos).mockResolvedValue()
  vi.mocked(referenciaParaModelo).mockResolvedValue('TEN-VERL-007')
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

async function ponerFoto(fila: number) {
  await userEvent.upload(screen.getByLabelText(`Foto de la fila ${fila}`), new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Encuadrar foto' })).getByRole('button', { name: 'Usar foto' }))
  await screen.findAllByText('Foto nueva')
}

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
  it('reconoce un zapato existente por su descripción y marca: trae su referencia, precios y último costo', async () => {
    pintar('/compras/nueva')
    // La referencia no se escribe.
    expect(await screen.findByLabelText('Referencia de la fila 1')).toHaveTextContent('Se pone sola')
    expect(screen.queryByRole('textbox', { name: 'Referencia de la fila 1' })).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Descripción de la fila 1'), 'tennis running')
    await userEvent.tab()
    // Hay dos "Tennis Running" (Kalzado y Verlon): sin la marca no se adivina.
    expect(screen.getByLabelText('Referencia de la fila 1')).toHaveTextContent('Se pone sola')
    await userEvent.type(screen.getByLabelText('Marca de la fila 1'), 'kalzado')
    await userEvent.type(screen.getByLabelText('Color de la fila 1'), 'negro')
    await userEvent.tab()
    expect(screen.getByLabelText('Referencia de la fila 1')).toHaveTextContent('TR-1')
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
    // Un zapato nuevo no se guarda sin foto.
    await ponerFoto(1)
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
    await userEvent.type(await screen.findByLabelText('Descripción de la fila 1'), 'BORRADOR-1')
    unmount()
    pintar('/compras/nueva')
    expect(await screen.findByLabelText('Descripción de la fila 1')).toHaveValue('BORRADOR-1')
  })

  it('marca y color: se eligen de lo ya creado o se escribe uno nuevo, hasta dos colores', async () => {
    pintar('/compras/nueva')
    await screen.findByLabelText('Referencia de la fila 1')
    const opciones = (id: string) => [...document.querySelectorAll(`#${id} option`)].map((o) => o.getAttribute('value'))
    expect(opciones('opciones-marca')).toEqual(['Kalzado', 'Verlon'])
    // El primer color ofrece los de dos colores ya usados y los sueltos; el segundo, solo sueltos.
    expect(opciones('opciones-color')[0]).toBe('Rojo y blanco')
    expect(opciones('opciones-color')).toContain('Negro')
    expect(opciones('opciones-color-simple')).not.toContain('Rojo y blanco')
    expect(screen.getByLabelText('Segundo color de la fila 1')).toBeDisabled()

    // Elegir o escribir "Rojo y blanco" lo reparte en los dos campos al salir.
    await userEvent.type(screen.getByLabelText('Color de la fila 1'), 'Rojo y blanco')
    expect(screen.getByLabelText('Color de la fila 1')).toHaveValue('Rojo y blanco')
    await userEvent.tab()
    expect(screen.getByLabelText('Color de la fila 1')).toHaveValue('Rojo')
    expect(screen.getByLabelText('Segundo color de la fila 1')).toHaveValue('blanco')
    // Uno nuevo, nunca visto, también vale.
    await userEvent.clear(screen.getByLabelText('Segundo color de la fila 1'))
    await userEvent.type(screen.getByLabelText('Segundo color de la fila 1'), 'Fucsia neón')
    expect(screen.getByLabelText('Color de la fila 1')).toHaveValue('Rojo')
    expect(screen.getByLabelText('Segundo color de la fila 1')).toHaveValue('Fucsia neón')
  })

  it('"Otro color" copia la referencia con sus precios, sin color ni cantidades, y cada color guarda su foto', async () => {
    vi.mocked(referenciaParaModelo).mockClear()
    pintar('/compras/nueva')
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Proveedor *' }), 'p1')
    await userEvent.type(screen.getByLabelText('Color de la fila 1'), 'Negro')
    await userEvent.type(screen.getByLabelText('Descripción de la fila 1'), 'Tennis nuevo')
    await userEvent.type(screen.getByLabelText('Marca de la fila 1'), 'Verlon')
    await userEvent.selectOptions(screen.getByLabelText('Categoría de la fila 1'), 'Tennis')
    await userEvent.type(screen.getByLabelText('Costo tallas 20–45 de la fila 1'), '50000')
    await userEvent.type(screen.getByLabelText('Precio mínimo tallas 20–45 de la fila 1'), '80000')
    await userEvent.type(screen.getByLabelText('Precio máximo tallas 20–45 de la fila 1'), '100000')
    await userEvent.type(screen.getByLabelText('Talla 38 de la fila 1'), '2')
    await userEvent.upload(screen.getByLabelText('Foto de la fila 1'), new File(['x'], 'negro.jpg', { type: 'image/jpeg' }))
    const encuadre = screen.getByRole('dialog', { name: 'Encuadrar foto' })
    expect(within(encuadre).getByText('la referencia nueva y el color')).toBeInTheDocument()
    await userEvent.click(within(encuadre).getByRole('button', { name: 'Usar foto' }))
    expect(await screen.findByText('Foto nueva')).toBeInTheDocument()
    // Un zapato nuevo aparta su referencia para nombrar la foto.
    expect(referenciaParaModelo).toHaveBeenCalledWith('Tennis nuevo', 'Verlon', 'Tennis')
    expect(subirFotoCatalogo).toHaveBeenCalledWith('ten-verl-007-negro', expect.objectContaining({ extension: 'webp' }))
    expect(screen.getByLabelText('Referencia de la fila 1')).toHaveTextContent('TEN-VERL-007')

    await userEvent.click(screen.getByRole('button', { name: 'Otro color' }))
    expect(screen.getByLabelText('Color de la fila 2')).toHaveFocus()
    expect(screen.getByLabelText('Color de la fila 2')).toHaveValue('')
    expect(screen.getByLabelText('Referencia de la fila 2')).toHaveTextContent('TEN-VERL-007')
    expect(screen.getByLabelText('Descripción de la fila 2')).toHaveValue('Tennis nuevo')
    expect(screen.getByLabelText('Marca de la fila 2')).toHaveValue('Verlon')
    expect(screen.getByLabelText('Categoría de la fila 2')).toHaveValue('Tennis')
    expect(screen.getByLabelText('Precio mínimo tallas 20–45 de la fila 2')).toHaveValue('80000')
    expect(screen.getByLabelText('Talla 38 de la fila 2')).toHaveValue('')
    expect(screen.getAllByText('Sin foto')).toHaveLength(1)

    await userEvent.keyboard('Azul')
    await userEvent.type(screen.getByLabelText('Talla 39 de la fila 2'), '3')
    // Sin la foto del azul no deja guardar.
    await userEvent.click(screen.getByRole('button', { name: 'Revisar y guardar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Falta la foto de TEN-VERL-007 Azul: es obligatoria para crear un zapato.')
    await ponerFoto(2)
    // Es el mismo zapato: no aparta otra referencia.
    expect(referenciaParaModelo).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Revisar y guardar' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Guardar y subir stock' }))
    const [factura] = vi.mocked(registrarCompra).mock.lastCall!
    expect(factura.filas.map((f) => [f.referencia, f.color, f.foto])).toEqual([
      ['TEN-VERL-007', 'Negro', 'https://fotos/catalogo/ten-verl-007-negro.webp?v=1'],
      ['TEN-VERL-007', 'Azul', 'https://fotos/catalogo/ten-verl-007-azul.webp?v=1'],
    ])
    expect(fijarFotos).toHaveBeenCalledWith('c9', factura)
  })

  it('otro color del mismo zapato escrito en otra fila (sin "Otro color") queda con la misma referencia', async () => {
    vi.mocked(referenciaParaModelo).mockClear()
    pintar('/compras/nueva')
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Proveedor *' }), 'p1')
    for (const [n, color] of [[1, 'Negro'], [2, 'Azul']] as const) {
      if (n === 2) await userEvent.click(screen.getByRole('button', { name: 'Agregar referencia' }))
      await userEvent.type(screen.getByLabelText(`Color de la fila ${n}`), color)
      await userEvent.type(screen.getByLabelText(`Descripción de la fila ${n}`), 'Ilario V')
      await userEvent.type(screen.getByLabelText(`Marca de la fila ${n}`), 'Verlon')
      await userEvent.selectOptions(screen.getByLabelText(`Categoría de la fila ${n}`), 'Escolar')
      await userEvent.tab()
      await ponerFoto(n)
    }
    expect(referenciaParaModelo).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Referencia de la fila 2')).toHaveTextContent('TEN-VERL-007')
    expect(subirFotoCatalogo).toHaveBeenLastCalledWith('ten-verl-007-azul', expect.anything())
  })
})
