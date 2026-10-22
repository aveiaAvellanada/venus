import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectorTema } from './SelectorTema'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.tema
})

describe('SelectorTema', () => {
  it('por defecto sigue al sistema', () => {
    render(<SelectorTema />)
    expect(screen.getByRole('radio', { name: 'Sistema' })).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement.dataset.tema).toBeUndefined()
  })

  it('claro u oscuro se aplican a la página y se recuerdan', async () => {
    render(<SelectorTema />)
    await userEvent.click(screen.getByRole('radio', { name: 'Claro' }))
    expect(document.documentElement.dataset.tema).toBe('claro')
    expect(localStorage.getItem('panel-tema')).toBe('claro')
    await userEvent.click(screen.getByRole('radio', { name: 'Oscuro' }))
    expect(document.documentElement.dataset.tema).toBe('oscuro')
    await userEvent.click(screen.getByRole('radio', { name: 'Sistema' }))
    expect(document.documentElement.dataset.tema).toBeUndefined()
    expect(localStorage.getItem('panel-tema')).toBeNull()
  })

  it('arranca con el tema guardado', () => {
    localStorage.setItem('panel-tema', 'oscuro')
    render(<SelectorTema />)
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true')
  })
})
