// components/ui/SliderPrecio.test.tsx
import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import Slider from '@react-native-community/slider'
import { TemaProvider } from '../../lib/tema'
import { SliderPrecio } from './SliderPrecio'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.useFakeTimers()

async function montar(props: { valor: number; minimo: number; maximo: number; onCambio: (v: number) => void }) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <SliderPrecio {...props} />
      </TemaProvider>
    )
  })
  return arbol
}

describe('SliderPrecio', () => {
  it('muestra el valor actual y los límites min/max formateados', async () => {
    const arbol = await montar({ valor: 180000, minimo: 150000, maximo: 220000, onCambio: jest.fn() })
    const textos = arbol.root.findAllByType(require('react-native').Text)
      .map((t: any) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)))
    expect(textos.join(' ')).toContain('$180.000')
    expect(textos.join(' ')).toContain('$150.000')
    expect(textos.join(' ')).toContain('$220.000')
  })

  it('el Slider usa minimo/maximo/paso y dispara onCambio', async () => {
    const onCambio = jest.fn()
    const arbol = await montar({ valor: 180000, minimo: 150000, maximo: 220000, onCambio })
    const slider = arbol.root.findByType(Slider)
    expect(slider.props.minimumValue).toBe(150000)
    expect(slider.props.maximumValue).toBe(220000)
    expect(slider.props.step).toBe(1000)
    act(() => slider.props.onValueChange(200000))
    expect(onCambio).toHaveBeenCalledWith(200000)
  })

  it('pinta el precio en rojo cuando el valor está bajo el mínimo', async () => {
    const arbol = await montar({ valor: 100000, minimo: 150000, maximo: 220000, onCambio: jest.fn() })
    const { paletaClara } = require('../../lib/theme')
    const rojo = arbol.root.findAll((n: any) => {
      if (n.type !== require('react-native').Text) return false
      const style = Array.isArray(n.props.style) ? Object.assign({}, ...n.props.style.filter(Boolean)) : n.props.style
      return style?.color === paletaClara.peligroTexto
    })
    expect(rojo.length).toBeGreaterThan(0)
  })
})
