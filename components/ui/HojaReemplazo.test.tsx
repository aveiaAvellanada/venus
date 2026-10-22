import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('../../lib/supabase', () => ({ supabase: {} }))
jest.mock('../../lib/inventario', () => ({ listarCalzado: jest.fn() }))

jest.useFakeTimers()

import { listarCalzado } from '../../lib/inventario'
import { TemaProvider } from '../../lib/tema'
import { HojaReemplazo } from './HojaReemplazo'

const fila = (id: string, descripcion: string, referencia: string, color: string, talla: string, stock: number) => ({
  id, descripcion, referencia, color, talla, marca: 'Venus', stock_actual: stock, precio_minimo: 50000,
  precio_maximo: 60000, categoria: 'Tennis', stock_minimo: 1, created_at: '2026-06-01T00:00:00Z', activo: true,
  foto_url: null,
})

const CATALOGO = [
  fila('z1', 'Zeus alto', 'ZEUS', 'Negro', '38', 5),
  fila('z2', 'Zeus alto', 'ZEUS', 'Rojo y blanco', '38', 2),
  fila('b1', 'Bota Brahma', 'BRAHMA', 'Café', '41', 3),
]

type Nodo = renderer.ReactTestInstance

async function montar(onElegir = jest.fn()) {
  ;(listarCalzado as jest.Mock).mockResolvedValue(CATALOGO)
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <HojaReemplazo visible onCerrar={jest.fn()} onElegir={onElegir} />
      </TemaProvider>
    )
  })
  return arbol
}

// Una entrada por tarjeta (el componente y su Pressable comparten testID).
const tarjetas = (root: Nodo): Nodo[] => {
  const vistas = new Map<string, Nodo>()
  for (const n of root.findAll((x: Nodo) => typeof x.props?.testID === 'string' && x.props.testID.startsWith('resultado-reemplazo-') && !!x.props.onPress)) {
    if (!vistas.has(n.props.testID)) vistas.set(n.props.testID, n)
  }
  return [...vistas.values()]
}

describe('HojaReemplazo', () => {
  it('muestra todo el catálogo al abrir, una tarjeta por color como en Productos', async () => {
    const arbol = await montar()
    expect(tarjetas(arbol.root).map((n: Nodo) => n.props.testID)).toEqual([
      'resultado-reemplazo-ZEUS|Negro',
      'resultado-reemplazo-ZEUS|Rojo y blanco',
      'resultado-reemplazo-BRAHMA|Café',
    ])
  })

  it('escribir filtra el grid por nombre, marca o referencia', async () => {
    const arbol = await montar()
    await act(async () => { arbol.root.findByProps({ testID: 'input-buscar-reemplazo' }).props.onChangeText('brahma') })
    expect(tarjetas(arbol.root).map((n: Nodo) => n.props.testID)).toEqual(['resultado-reemplazo-BRAHMA|Café'])
  })

  it('al tocar una tarjeta queda ese color marcado y el botón dice solo "Usar este reemplazo"', async () => {
    const onElegir = jest.fn()
    const arbol = await montar(onElegir)
    const roja = tarjetas(arbol.root).find((n: Nodo) => n.props.testID === 'resultado-reemplazo-ZEUS|Rojo y blanco')!
    await act(async () => { roja.props.onPress() })
    expect(arbol.root.findAllByProps({ children: 'Talla · Rojo y blanco' }).length).toBeGreaterThan(0)

    const chip = arbol.root.findAll((n: Nodo) => n.props?.accessibilityLabel === 'Talla 38: 2 disponibles' && !!n.props.onPress)[0]
    await act(async () => { chip.props.onPress() })
    const usar = arbol.root.findAll((n: Nodo) => n.props?.accessibilityLabel === 'Usar este reemplazo' && !!n.props.onPress)[0]
    expect(usar).toBeTruthy()
    await act(async () => { usar.props.onPress() })
    expect(onElegir).toHaveBeenCalledWith(expect.objectContaining({ id: 'z2' }), 50000)
  })
})
