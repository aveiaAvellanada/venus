import React from 'react'
import { Text } from 'react-native'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// El punto pulsante de Badge usa withRepeat infinito; con timers reales jest
// nunca termina. Recomendación oficial de Reanimated para tests.
jest.useFakeTimers()

import { TemaProvider } from '../../lib/tema'
import { paletaClara } from '../../lib/theme'
import { Tarjeta } from './Tarjeta'
import { TarjetaMetrica } from './TarjetaMetrica'
import { Badge } from './Badge'
import { CirculoIcono } from './CirculoIcono'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

const aplanar = (estilo: unknown): Record<string, unknown> =>
  Object.assign({}, ...([estilo].flat(Infinity).filter(Boolean) as object[]))

function IconoFalso(props: { color?: string; size?: number }) {
  return <Text testID="icono-falso">{`${props.color}|${props.size}`}</Text>
}

describe('Tarjeta y compañía', () => {
  it('Tarjeta: superficie + borde + radio 16', async () => {
    const arbol = await montar(
      <Tarjeta>
        <Text>hola</Text>
      </Tarjeta>
    )
    const estilo = aplanar(arbol.root.findByProps({ testID: 'tarjeta' }).props.style)
    expect(estilo.backgroundColor).toBe(paletaClara.superficie)
    expect(estilo.borderColor).toBe(paletaClara.borde)
    expect(estilo.borderRadius).toBe(16)
  })

  it('TarjetaMetrica muestra etiqueta y valor tabular', async () => {
    const arbol = await montar(
      <TarjetaMetrica etiqueta="Total vendido" valor="$1.250.000" sub="18 ventas" />
    )
    expect(arbol.root.findByProps({ children: 'Total vendido' })).toBeTruthy()
    const valor = arbol.root.findByProps({ children: '$1.250.000' })
    expect(aplanar(valor.props.style).fontVariant).toEqual(['tabular-nums'])
  })

  it('Badge exito y peligro usan tokens soft/texto', async () => {
    const a = await montar(<Badge texto="ABIERTA" tipo="exito" punto />)
    const badgeA = aplanar(a.root.findByProps({ testID: 'badge' }).props.style)
    expect(badgeA.backgroundColor).toBe(paletaClara.exitoSoft)
    const b = await montar(<Badge texto="CERRADA" tipo="peligro" />)
    const badgeB = aplanar(b.root.findByProps({ testID: 'badge' }).props.style)
    expect(badgeB.backgroundColor).toBe(paletaClara.peligroSoft)
  })

  it('CirculoIcono clona el icono con color del tono y size', async () => {
    const arbol = await montar(
      <CirculoIcono tono="exito">
        <IconoFalso />
      </CirculoIcono>
    )
    expect(arbol.root.findByProps({ testID: 'icono-falso' }).props.children)
      .toBe(`${paletaClara.exito}|21`)
  })
})
