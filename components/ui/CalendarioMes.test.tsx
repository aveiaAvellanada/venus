import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('../../lib/supabase', () => ({ supabase: { rpc: jest.fn() } }))

import { TemaProvider } from '../../lib/tema'
import { CalendarioMes } from './CalendarioMes'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

type Nodo = { props: { onPress?: () => void; accessibilityLabel?: string; disabled?: boolean } }

const DATOS = [
  { inicio: '2026-10-01', total: 145000, num_ventas: 2 },
  { inicio: '2026-10-14', total: 965000, num_ventas: 3 },
]

const textos = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root.findAll((n: { type: unknown }) => n.type === 'Text').map((n: { props: { children: unknown } }) =>
    [n.props.children].flat(3).filter((c) => typeof c === 'string' || typeof c === 'number').join(''))

const boton = (arbol: ReturnType<typeof renderer.create>, etiqueta: string): Nodo =>
  arbol.root.findAll((n: Nodo) => n.props.accessibilityLabel === etiqueta && !!n.props.onPress)[0]

describe('CalendarioMes', () => {
  it('nombra el mes arriba y numera cada día', async () => {
    const arbol = await montar(
      <CalendarioMes primerDia="2026-10-01" datos={DATOS} hoy="2026-10-22" onAnterior={jest.fn()} />
    )
    const t = textos(arbol)
    expect(t).toContain('Octubre 2026')
    for (const dia of ['1', '14', '22', '31']) expect(t).toContain(dia)
    expect(t).toContain('Toca un día para ver lo vendido')
  })

  it('tocar un día muestra lo vendido y los días futuros no se tocan', async () => {
    const arbol = await montar(
      <CalendarioMes primerDia="2026-10-01" datos={DATOS} hoy="2026-10-22" onAnterior={jest.fn()} />
    )
    await act(async () => boton(arbol, 'mié 14 oct: $965.000').props.onPress!())
    const t = textos(arbol)
    expect(t).toContain('mié 14 oct ·  · 3 ventas')
    expect(t).toContain('$965.000')
    const futuro = arbol.root.findAll((n: Nodo) => n.props.accessibilityLabel === 'sáb 31 oct: $0')[0]
    expect(futuro.props.disabled).toBe(true)
  })

  it('flechas: siempre hacia atrás; hacia adelante solo si no es el mes en curso', async () => {
    const anterior = jest.fn()
    const arbol = await montar(
      <CalendarioMes primerDia="2026-10-01" datos={DATOS} hoy="2026-10-22" onAnterior={anterior} />
    )
    await act(async () => boton(arbol, 'Mes anterior').props.onPress!())
    expect(anterior).toHaveBeenCalled()
    const siguiente = arbol.root.findAll((n: Nodo) => n.props.accessibilityLabel === 'Mes siguiente')[0]
    expect(siguiente.props.disabled).toBe(true)
  })

  it('sin ventas en el mes lo dice', async () => {
    const arbol = await montar(
      <CalendarioMes primerDia="2026-09-01" datos={[]} hoy="2026-10-22" onAnterior={jest.fn()} onSiguiente={jest.fn()} />
    )
    expect(textos(arbol)).toContain('Sin ventas en este mes')
  })
})
