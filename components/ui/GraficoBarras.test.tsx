import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('../../lib/supabase', () => ({ supabase: { rpc: jest.fn() } }))

jest.useFakeTimers()

import { TemaProvider } from '../../lib/tema'
import { GraficoBarras } from './GraficoBarras'
import { ContadorDinero } from './ContadorDinero'

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

type Nodo = { props: { onPress?: () => void; accessibilityLabel?: string } }

const DATOS = [
  { inicio: '2026-06-14', total: 145000, num_ventas: 2 },
  { inicio: '2026-06-15', total: 0, num_ventas: 0 },
  { inicio: '2026-06-16', total: 965000, num_ventas: 2 },
]

describe('GraficoBarras', () => {
  it('renderiza un label por bucket', async () => {
    const arbol = await montar(<GraficoBarras datos={DATOS} granularidad="dia" />)
    for (const label of ['dom', 'lun', 'mar']) {
      expect(arbol.root.findAllByProps({ children: label }).length).toBeGreaterThan(0)
    }
  })

  it('tocar una barra muestra el tooltip con el valor exacto', async () => {
    const arbol = await montar(<GraficoBarras datos={DATOS} granularidad="dia" />)
    const barras = arbol.root
      .findAllByProps({ accessibilityRole: 'button' })
      .filter((n: Nodo) => n.props.onPress)
    expect(barras).toHaveLength(3)
    await act(async () => barras[2].props.onPress!())
    expect(arbol.root.findAllByProps({ children: '$965.000' }).length).toBeGreaterThan(0)
  })

  it('todo en cero muestra el estado vacío', async () => {
    const ceros = DATOS.map((d) => ({ ...d, total: 0 }))
    const arbol = await montar(<GraficoBarras datos={ceros} granularidad="dia" />)
    expect(arbol.root.findAllByProps({ children: 'Sin ventas en este período' }).length).toBeGreaterThan(0)
  })
})

describe('ContadorDinero', () => {
  it('renderiza el valor formateado', async () => {
    const arbol = await montar(<ContadorDinero valor={1250000} />)
    const input = arbol.root.findAllByProps({ editable: false })
    expect(input.length).toBeGreaterThan(0)
    const props = input[0].props as { value?: string; text?: string }
    expect(props.value ?? props.text).toBe('$1.250.000')
  })
})
