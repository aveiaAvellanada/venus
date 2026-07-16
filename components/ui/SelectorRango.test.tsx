import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('@react-native-community/datetimepicker', () => () => null)

jest.useFakeTimers()

import { TemaProvider } from '../../lib/tema'
import { SelectorRango } from './SelectorRango'

type Nodo = { props: { onPress?: () => void; accessibilityLabel?: string } }

async function montar(ui: React.ReactElement) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>)
  })
  return arbol
}

const botones = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root.findAllByProps({ accessibilityRole: 'button' }).filter((n: Nodo) => n.props.onPress)

describe('SelectorRango', () => {
  it('abre la hoja y Aplicar entrega fechas YYYY-MM-DD con desde <= hasta', async () => {
    const onAplicar = jest.fn()
    const arbol = await montar(<SelectorRango activo={false} onAplicar={onAplicar} />)

    const chip = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Rango ▾')!
    await act(async () => chip.props.onPress!())

    const aplicar = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Aplicar')!
    await act(async () => aplicar.props.onPress!())

    expect(onAplicar).toHaveBeenCalledTimes(1)
    const [desde, hasta] = onAplicar.mock.calls[0] as [string, string]
    expect(desde).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(desde <= hasta).toBe(true)
  })
})
