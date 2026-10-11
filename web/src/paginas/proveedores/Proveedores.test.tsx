import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { hoyEn, sumarDias } from '@shared/fechas'
import type { CompraResumen, Proveedor } from '../../lib/proveedores'
import {
  comprasConSaldo, comprasDelProveedor, cuentasDelProveedor, documentosDelProveedor, guardarCuenta, guardarProveedor,
  itemsDelProveedor, listarProveedores, obtenerProveedor, pagosDelProveedor, registrarPago,
} from '../../lib/datos/proveedores'
import { Proveedores } from './Proveedores'
import { FichaProveedor } from './FichaProveedor'

vi.mock('../../lib/datos/proveedores', async (original) => ({
  ...(await original<typeof import('../../lib/datos/proveedores')>()),
  listarProveedores: vi.fn(),
  comprasConSaldo: vi.fn(),
  obtenerProveedor: vi.fn(),
  guardarProveedor: vi.fn(),
  comprasDelProveedor: vi.fn(),
  pagosDelProveedor: vi.fn(),
  itemsDelProveedor: vi.fn(),
  registrarPago: vi.fn(),
  cuentasDelProveedor: vi.fn(),
  guardarCuenta: vi.fn(),
  eliminarCuenta: vi.fn(),
  documentosDelProveedor: vi.fn(),
}))

const HOY = hoyEn()
const prov = (o: Partial<Proveedor>): Proveedor => ({
  id: 'p1', nombre: 'Calzado Andino', nit_cedula: '900123', telefono: '3151234567', ciudad: 'Neiva', notas: null, activo: true, ...o,
})
const compra = (o: Partial<CompraResumen>): CompraResumen => ({
  id: 'c1', proveedor_id: 'p1', estado: 'completada', condicion_pago: 'credito', total: 500000, monto_pagado: 200000,
  saldo_pendiente: 300000, fecha_vencimiento: sumarDias(HOY, -3), notas: null, created_at: '2026-09-15T15:00:00Z', ...o,
})

beforeEach(() => {
  vi.mocked(listarProveedores).mockResolvedValue([
    prov({}),
    prov({ id: 'p2', nombre: 'Botas del Sur', telefono: null, nit_cedula: null, ciudad: 'Florencia' }),
    prov({ id: 'p3', nombre: 'Viejo SAS', activo: false }),
  ])
  vi.mocked(comprasConSaldo).mockResolvedValue([
    compra({}),
    compra({ id: 'c2', proveedor_id: 'p2', saldo_pendiente: 80000, fecha_vencimiento: sumarDias(HOY, 20) }),
  ])
  vi.mocked(obtenerProveedor).mockResolvedValue(prov({ notas: 'Visita los martes' }))
  vi.mocked(comprasDelProveedor).mockResolvedValue([
    compra({}),
    compra({ id: 'c3', condicion_pago: 'contado', total: 120000, monto_pagado: 120000, saldo_pendiente: 0, fecha_vencimiento: null, created_at: '2026-08-01T15:00:00Z' }),
    compra({ id: 'c4', estado: 'pendiente_revision', condicion_pago: null, total: null, monto_pagado: 0, saldo_pendiente: 0, fecha_vencimiento: null }),
  ])
  vi.mocked(pagosDelProveedor).mockResolvedValue([
    { id: 'pg1', compra_id: 'c1', monto: 200000, fecha: '2026-09-20', notas: 'Transferencia' },
  ])
  vi.mocked(itemsDelProveedor).mockResolvedValue([
    { compra_id: 'c3', fecha: '2026-08-01', referencia: 'TR-1', descripcion: 'Tennis Running', color: 'Negro', talla: '38', cantidad: 4, costo_unitario: 60000 },
    { compra_id: 'c1', fecha: '2026-09-15', referencia: 'TR-1', descripcion: 'Tennis Running', color: 'Negro', talla: '39', cantidad: 6, costo_unitario: 66000 },
  ])
  vi.mocked(cuentasDelProveedor).mockResolvedValue([
    { id: 'k1', banco: 'Bancolombia', tipo_cuenta: 'ahorros', numero_cuenta: '12345678901', titular: 'Calzado Andino SAS' },
  ])
  vi.mocked(documentosDelProveedor).mockResolvedValue([])
  vi.mocked(registrarPago).mockResolvedValue(0)
  vi.mocked(guardarCuenta).mockResolvedValue()
})

function pintar(ruta: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/proveedores/:id" element={<FichaProveedor />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Lista de proveedores', () => {
  it('muestra la deuda total, lo vencido y cada proveedor con su próximo vencimiento', async () => {
    pintar('/proveedores')
    const fila = (await screen.findByRole('link', { name: 'Calzado Andino' })).closest('tr')!
    expect(within(fila).getByText('$300.000')).toBeInTheDocument()
    expect(within(fila).getByText('vencida hace 3 días')).toBeInTheDocument()
    expect(within(fila).getByRole('link', { name: 'WhatsApp a Calzado Andino' })).toHaveAttribute('href', 'https://wa.me/573151234567')
    expect(screen.getByText('$380.000')).toBeInTheDocument() // deuda total
    expect(screen.queryByText('Viejo SAS')).not.toBeInTheDocument() // inactivo
  })

  it('filtra vencidos e inactivos y busca sin tildes', async () => {
    pintar('/proveedores')
    await screen.findByRole('link', { name: 'Calzado Andino' })
    await userEvent.click(screen.getByRole('radio', { name: 'Vencidos' }))
    expect(screen.queryByRole('link', { name: 'Botas del Sur' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Inactivos' }))
    expect(screen.getByRole('link', { name: 'Viejo SAS' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Activos' }))
    await userEvent.type(screen.getByLabelText('Buscar proveedores'), 'FLORÉNCIA')
    expect(screen.getByRole('link', { name: 'Botas del Sur' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Calzado Andino' })).not.toBeInTheDocument()
  })

  it('sin permiso de deudas, la lista sigue sin deuda ni vencimientos', async () => {
    vi.mocked(comprasConSaldo).mockRejectedValue(new Error('permiso'))
    pintar('/proveedores')
    await screen.findByRole('link', { name: 'Calzado Andino' })
    expect(screen.queryByRole('columnheader', { name: 'Deuda' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Vencidos' })).not.toBeInTheDocument()
  })

  it('crear un proveedor lleva a su ficha', async () => {
    vi.mocked(guardarProveedor).mockResolvedValue(prov({ id: 'p9', nombre: 'Nuevo' }))
    pintar('/proveedores')
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo proveedor' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nuevo proveedor' })
    expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeDisabled()
    await userEvent.type(within(dialogo).getByLabelText('Nombre *'), '  Nuevo ')
    await userEvent.type(within(dialogo).getByLabelText('Teléfono (WhatsApp)'), '3001112233')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(guardarProveedor).toHaveBeenCalledWith(null, {
      nombre: 'Nuevo', nit_cedula: null, telefono: '3001112233', ciudad: null, notas: null, activo: true,
    })
    expect(await screen.findByRole('heading', { name: /Calzado Andino/ })).toBeInTheDocument()
  })
})

describe('Ficha del proveedor', () => {
  it('resume la deuda y lista compras con su estado y los pagos', async () => {
    pintar('/proveedores/p1')
    expect(await screen.findByRole('heading', { name: /Calzado Andino/ })).toBeInTheDocument()
    expect(screen.getByText('Visita los martes')).toBeInTheDocument()
    expect(await screen.findByText('Pendiente de costos')).toBeInTheDocument()
    expect(screen.getByText('$620.000')).toBeInTheDocument() // comprado en total (completadas)
    expect(await screen.findByText('Transferencia')).toBeInTheDocument()
    // Solo la compra a crédito con saldo se puede pagar
    expect(screen.getAllByRole('button', { name: 'Registrar pago' })).toHaveLength(1)
  })

  it('registrar un pago valida el saldo y la fecha antes de enviar', async () => {
    pintar('/proveedores/p1')
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar pago' }))
    const dialogo = screen.getByRole('dialog', { name: 'Registrar pago' })
    const monto = within(dialogo).getByLabelText('Monto')
    expect(monto).toHaveValue('300000')
    await userEvent.clear(monto)
    await userEvent.type(monto, '300001')
    expect(within(dialogo).getByText('No puede pasar del saldo ($300.000).')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: /Registrar/ })).toBeDisabled()
    await userEvent.clear(monto)
    await userEvent.type(monto, '100.000')
    await userEvent.type(within(dialogo).getByLabelText('Notas (opcional)'), 'Abono')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Registrar $100.000' }))
    expect(registrarPago).toHaveBeenCalledWith({ compraId: 'c1', monto: 100000, fecha: HOY, notas: 'Abono' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('costos por referencia: último costo, anterior y cambio', async () => {
    pintar('/proveedores/p1')
    await userEvent.click(await screen.findByRole('tab', { name: 'Costos por referencia' }))
    const fila = (await screen.findByText('TR-1 · Tennis Running')).closest('tr')!
    expect(within(fila).getByText('$66.000')).toBeInTheDocument()
    expect(within(fila).getByText('$60.000')).toBeInTheDocument()
    expect(within(fila).getByText('+10 %')).toBeInTheDocument()
  })

  it('cuentas bancarias: lista y agrega', async () => {
    pintar('/proveedores/p1')
    await userEvent.click(await screen.findByRole('tab', { name: 'Cuentas bancarias' }))
    expect(await screen.findByText('12345678901')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Agregar cuenta' }))
    const dialogo = screen.getByRole('dialog', { name: 'Nueva cuenta bancaria' })
    await userEvent.type(within(dialogo).getByLabelText('Banco *'), 'Nequi')
    await userEvent.selectOptions(within(dialogo).getByLabelText('Tipo'), 'nequi')
    await userEvent.type(within(dialogo).getByLabelText('Número *'), '3151234567')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(guardarCuenta).toHaveBeenCalledWith('p1', null, {
      banco: 'Nequi', tipo_cuenta: 'nequi', numero_cuenta: '3151234567', titular: null,
    })
  })

  it('sin permiso de costos ni deudas, la ficha muestra datos y cuentas pero no compras', async () => {
    vi.mocked(comprasDelProveedor).mockRejectedValue(new Error('permiso'))
    pintar('/proveedores/p1')
    expect(await screen.findByText(/Las compras y deudas se ven con el permiso/)).toBeInTheDocument()
    expect(screen.queryByText('Se le debe')).not.toBeInTheDocument()
  })

  it('proveedor inexistente avisa', async () => {
    vi.mocked(obtenerProveedor).mockResolvedValue(null)
    pintar('/proveedores/nope')
    expect(await screen.findByText('No encontramos este proveedor.')).toBeInTheDocument()
  })
})
