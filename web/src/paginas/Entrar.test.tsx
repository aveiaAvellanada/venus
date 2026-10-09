import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { useSesion } from '../lib/auth'
import { Entrar } from './Entrar'

vi.mock('../lib/auth', () => ({ useSesion: vi.fn() }))

function preparar(aviso: string | null = null) {
  const entrar = vi.fn()
  vi.mocked(useSesion).mockReturnValue({ estado: { tipo: 'fuera', aviso }, entrar, salir: vi.fn() })
  render(<MemoryRouter><Entrar /></MemoryRouter>)
  return entrar
}

describe('Entrar', () => {
  it('envía usuario y PIN', async () => {
    const entrar = preparar()
    entrar.mockResolvedValue(undefined)
    await userEvent.type(screen.getByLabelText('Usuario'), 'Andres')
    await userEvent.type(screen.getByLabelText('PIN'), '482915')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(entrar).toHaveBeenCalledWith('andres', '482915')
  })

  it('el PIN solo acepta 6 números y sin ellos no deja entrar', async () => {
    preparar()
    await userEvent.type(screen.getByLabelText('Usuario'), 'andres')
    await userEvent.type(screen.getByLabelText('PIN'), '48a29')
    expect(screen.getByLabelText('PIN')).toHaveValue('4829')
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  })

  it('muestra el motivo si no puede entrar y borra el PIN', async () => {
    const entrar = preparar()
    entrar.mockRejectedValue(new Error('El panel web es solo para el dueño. Usa la app del celular.'))
    await userEvent.type(screen.getByLabelText('Usuario'), 'sandra')
    await userEvent.type(screen.getByLabelText('PIN'), '482915')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('solo para el dueño')
    expect(screen.getByLabelText('PIN')).toHaveValue('')
  })

  it('muestra el aviso con que se cerró la sesión', () => {
    preparar('Esta cuenta está desactivada.')
    expect(screen.getByRole('alert')).toHaveTextContent('desactivada')
  })
})
