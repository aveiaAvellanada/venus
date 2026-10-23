import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
// Alto de las barras del sistema que se prueba: 3 botones (48) o gestos (16).
let mockInsets = { top: 32, bottom: 48, left: 0, right: 0 }
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }))
const mockNavigationBar = jest.fn((_: { style: string }) => null)
jest.mock('expo-navigation-bar', () => ({ NavigationBar: (p: { style: string }) => mockNavigationBar(p) }))
let mockEnfocar: (() => (() => void) | void) | null = null
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => (() => void) | void) => { mockEnfocar = cb },
}))

import AsyncStorage from '@react-native-async-storage/async-storage'
import { TemaProvider } from '../lib/tema'
import { paletaClara, paletaOscura } from '../lib/theme'
import { BarrasSistema, usePantallaInmersiva } from './BarrasSistema'

async function montar(ui: React.ReactElement) {
  let arbol!: renderer.ReactTestRenderer
  await act(async () => { arbol = renderer.create(<TemaProvider>{ui}</TemaProvider>) })
  return arbol
}
const estilo = (arbol: renderer.ReactTestRenderer, id: string) =>
  Object.assign({}, ...[arbol.root.findAll((n) => n.props.testID === id)[0].props.style].flat())

beforeEach(async () => {
  mockNavigationBar.mockClear()
  await AsyncStorage.clear()
})

describe('BarrasSistema', () => {
  it('con navegación de 3 botones tapa toda la barra de abajo con el fondo de la app', async () => {
    mockInsets = { top: 32, bottom: 48, left: 0, right: 0 }
    const arbol = await montar(<BarrasSistema />)
    expect(estilo(arbol, 'franja-barra-navegacion')).toMatchObject({ height: 48, bottom: 0, backgroundColor: paletaClara.fondo })
    expect(estilo(arbol, 'franja-barra-estado')).toMatchObject({ height: 32, top: 0, backgroundColor: paletaClara.fondo })
    // tema claro: barra clara con botones oscuros
    expect(mockNavigationBar).toHaveBeenLastCalledWith({ style: 'light' })
  })

  it('con gestos la franja mide lo que mide la línea de gestos', async () => {
    mockInsets = { top: 28, bottom: 16, left: 0, right: 0 }
    const arbol = await montar(<BarrasSistema />)
    expect(estilo(arbol, 'franja-barra-navegacion').height).toBe(16)
    expect(estilo(arbol, 'franja-barra-estado').height).toBe(28)
  })

  it('en tema oscuro la franja es oscura y los botones del sistema claros', async () => {
    await AsyncStorage.setItem('venus.tema', 'oscuro')
    const arbol = await montar(<BarrasSistema />)
    expect(estilo(arbol, 'franja-barra-navegacion').backgroundColor).toBe(paletaOscura.fondo)
    expect(mockNavigationBar).toHaveBeenLastCalledWith({ style: 'dark' })
  })

  it('no recibe toques: lo de abajo se sigue pudiendo tocar', async () => {
    const arbol = await montar(<BarrasSistema />)
    for (const id of ['franja-barra-estado', 'franja-barra-navegacion']) {
      expect(arbol.root.findAll((n) => n.props.testID === id)[0].props.pointerEvents).toBe('none')
    }
  })

  it('dentro de una ventana no vuelve a poner el estilo de los botones', async () => {
    await montar(<BarrasSistema navegacion={false} />)
    expect(mockNavigationBar).not.toHaveBeenCalled()
  })

  it('una pantalla inmersiva (foto bajo la barra de estado) quita solo la franja de arriba mientras está enfocada', async () => {
    mockInsets = { top: 32, bottom: 48, left: 0, right: 0 }
    function Inmersiva() { usePantallaInmersiva(); return null }
    const arbol = await montar(<><BarrasSistema /><Inmersiva /></>)
    let salir: (() => void) | void
    await act(async () => { salir = mockEnfocar!() })
    expect(estilo(arbol, 'franja-barra-estado').height).toBe(0)
    expect(estilo(arbol, 'franja-barra-navegacion').height).toBe(48)
    await act(async () => { salir!() })
    expect(estilo(arbol, 'franja-barra-estado').height).toBe(32)
  })
})
