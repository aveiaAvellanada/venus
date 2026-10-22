import { render, screen } from '@testing-library/react'
import { ConColor } from './ui'

const mitades = () => screen.getAllByTestId('punto-color-mitad').map((m) => m.style.backgroundColor)

describe('PuntoColor', () => {
  it('un color llena el círculo', () => {
    render(<ConColor color="Negro" />)
    expect(mitades()).toEqual(['rgb(28, 28, 30)'])
    expect(screen.getByText('Negro')).toBeInTheDocument()
  })

  it('dos colores parten el círculo: el primero a la izquierda', () => {
    render(<ConColor color="Rojo y blanco" />)
    expect(mitades()).toEqual(['rgb(220, 38, 38)', 'rgb(255, 255, 255)'])
    expect(screen.getByText('Rojo y blanco')).toBeInTheDocument()
  })
})
