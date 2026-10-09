import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { useSesion, type EstadoSesion } from '../lib/auth'
import { Rutas } from './App'

vi.mock('../lib/auth', () => ({ useSesion: vi.fn() }))
vi.mock('../lib/datos/inicio', () => ({
  resumenDelDia: vi.fn().mockResolvedValue({ total_general: 0, total_ventas: 0, total_efectivo: 0, total_nequi: 0, total_bre_b: 0, total_otro: 0 }),
  alertasDelDueno: vi.fn().mockResolvedValue({ proveedores_por_vencer: [], empleados_sin_actividad: [] }),
  productosConStockBajo: vi.fn().mockResolvedValue([]),
  cajaDelDia: vi.fn().mockResolvedValue(null),
}))
vi.mock('../lib/busqueda', async (original) => ({
  ...(await original<typeof import('../lib/busqueda')>()),
  buscarProductos: vi.fn().mockResolvedValue([]),
}))

const dentro: EstadoSesion = {
  tipo: 'dentro',
  perfil: { id: '1', nombre: 'Andrés', usuario: 'andres', rol: 'dueno', activo: true, debe_cambiar_pin: false },
}

function pintar(ruta: string, estado: EstadoSesion) {
  vi.mocked(useSesion).mockReturnValue({ estado, entrar: vi.fn(), salir: vi.fn() })
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}><Rutas /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('rutas del panel', () => {
  it('sin sesión, toda ruta lleva al login', () => {
    pintar('/inventario', { tipo: 'fuera', aviso: null })
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('las secciones que faltan dicen qué harán y en qué fase llegan', () => {
    pintar('/kardex', dentro)
    expect(screen.getByRole('heading', { name: 'Kardex' })).toBeInTheDocument()
    expect(screen.getByText('Llega en la fase 2')).toBeInTheDocument()
  })

  it('Ctrl+K abre la búsqueda y Enter lleva a la sección', async () => {
    pintar('/', dentro)
    await userEvent.keyboard('{Control>}k{/Control}')
    const buscador = await screen.findByRole('combobox', { name: 'Buscar productos o secciones' })
    await userEvent.type(buscador, 'auditoría')
    expect(await screen.findByRole('option', { name: /Historial de acciones/ })).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Historial de acciones' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('una ruta inexistente avisa', () => {
    pintar('/no-existe', dentro)
    expect(screen.getByText('Esta página no existe')).toBeInTheDocument()
  })
})
