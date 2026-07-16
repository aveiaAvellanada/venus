import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.useFakeTimers()

import { TemaProvider } from '../../lib/tema'
import { EstadoVacio } from './EstadoVacio'
import { Esqueleto } from './Esqueleto'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

describe('EstadoVacio', () => {
  it('muestra título, mensaje y acción que responde', async () => {
    const onAccion = jest.fn()
    const arbol = await montar(
      <EstadoVacio
        titulo="Aún no hay ventas hoy"
        mensaje="Toca + para registrar la primera"
        textoAccion="Nueva venta"
        onAccion={onAccion}
      />
    )
    expect(arbol.root.findByProps({ children: 'Aún no hay ventas hoy' })).toBeTruthy()
    arbol.root.findByProps({ accessibilityRole: 'button' }).props.onPress()
    expect(onAccion).toHaveBeenCalled()
  })

  it('sin acción no renderiza botón', async () => {
    const arbol = await montar(<EstadoVacio titulo="No hay registros de caja." />)
    expect(
      arbol.root.findAllByProps({ accessibilityRole: 'button' }).filter((n: { props: { onPress?: unknown } }) => n.props.onPress)
    ).toHaveLength(0)
  })
})

describe('Esqueleto', () => {
  it('renderiza con dimensiones dadas', async () => {
    const arbol = await montar(<Esqueleto ancho={120} alto={16} />)
    expect(arbol.root.findByProps({ testID: 'esqueleto' })).toBeTruthy()
  })
})
