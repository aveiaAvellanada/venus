import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { ActivityIndicator } from 'react-native'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

import { TemaProvider } from '../../lib/tema'
import { paletaClara } from '../../lib/theme'
import { Boton } from './Boton'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

const aplanar = (estilo: unknown): Record<string, unknown> =>
  Object.assign({}, ...([estilo].flat(Infinity).filter(Boolean) as object[]))

describe('Boton', () => {
  it('primario: fondo primario, texto sobrePrimario, alto 56', async () => {
    const arbol = await montar(<Boton titulo="Abrir Caja" onPress={() => {}} />)
    const btn = arbol.root.findByProps({ accessibilityRole: 'button' })
    const estilo = aplanar(btn.props.style)
    expect(estilo.backgroundColor).toBe(paletaClara.primario)
    expect(estilo.height).toBe(56)
    expect(arbol.root.findByProps({ children: 'Abrir Caja' })).toBeTruthy()
  })

  it('secundario y peligro usan sus tokens', async () => {
    const a = await montar(<Boton titulo="Editar" variante="secundario" onPress={() => {}} />)
    expect(aplanar(a.root.findByProps({ accessibilityRole: 'button' }).props.style).backgroundColor)
      .toBe(paletaClara.primarioSoft)
    const b = await montar(<Boton titulo="Cerrar caja" variante="peligro" onPress={() => {}} />)
    expect(aplanar(b.root.findByProps({ accessibilityRole: 'button' }).props.style).backgroundColor)
      .toBe(paletaClara.peligro)
  })

  it('cargando: spinner visible, onPress bloqueado, estado accesible', async () => {
    const onPress = jest.fn()
    const arbol = await montar(<Boton titulo="Guardar" cargando onPress={onPress} />)
    expect(arbol.root.findAllByType(ActivityIndicator)).toHaveLength(1)
    const btn = arbol.root.findByProps({ accessibilityRole: 'button' })
    expect(btn.props.accessibilityState).toEqual({ disabled: true, busy: true })
    btn.props.onPress?.()
    expect(onPress).not.toHaveBeenCalled()
  })

  it('deshabilitado: opacity 0.45 y sin onPress', async () => {
    const onPress = jest.fn()
    const arbol = await montar(<Boton titulo="Confirmar" deshabilitado onPress={onPress} />)
    const btn = arbol.root.findByProps({ accessibilityRole: 'button' })
    expect(aplanar(btn.props.style).opacity).toBe(0.45)
    btn.props.onPress?.()
    expect(onPress).not.toHaveBeenCalled()
  })
})
