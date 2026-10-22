import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { Alert, Image } from 'react-native'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'c1' }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

// Cuenta las lecturas del producto: el editor debe cargarlo una sola vez.
let mockLecturasProducto = 0
const PRODUCTO = {
  id: 'c1', descripcion: 'Zeus alto', marca: 'Venus', referencia: 'DEMO-ZEUS-ALTO', categoria: 'Tennis',
  talla: '26', color: 'Azul', precio_minimo: 50000, precio_maximo: 55000, stock_actual: 5,
  stock_minimo: 1, foto_url: null, proveedor_id: null, activo: true, garantia_dias: null,
}
jest.mock('./supabase', () => ({
  supabase: {
    from: (tabla: string) => {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'not', 'order', 'limit']) builder[m] = () => builder
      builder.single = async () => {
        if (tabla === 'productos_calzado') {
          mockLecturasProducto++
          return { data: PRODUCTO, error: null }
        }
        return { data: null, error: null }
      }
      return builder
    },
  },
}))

const mockUseAuth = jest.fn()
jest.mock('./auth', () => ({
  useAuth: () => mockUseAuth(),
  useRequireModulo: () => null,
}))

jest.mock('./inventario', () => ({ guardarCalzado: jest.fn() }))
jest.mock('./tramos', () => ({ claveReferencia: (r: string) => r.trim().toLowerCase() || null, fijarGarantiaReferencia: jest.fn() }))
jest.mock('../components/PreciosPorTalla', () => ({ PreciosPorTalla: () => null }))

const URL_SUBIDA = 'https://dummy-url.supabase.co/storage/v1/object/public/productos/azul.jpg'
jest.mock('./imagenes', () => ({ comprimirYSubirImagen: jest.fn(async () => URL_SUBIDA) }))
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///azul.jpg' }] })),
  launchCameraAsync: jest.fn(),
}))

import { TemaProvider } from './tema'
import { ToastProvider } from '../components/ui'
import CalzadoEditorScreen from '../app/(app)/inventario/calzado/editor'
import { perfilPrueba } from './perfilPrueba'

// Cada llamada arma un objeto nuevo, como hace recargarPerfil al volver a la app.
const conPerfilNuevo = () => mockUseAuth.mockReturnValue({ perfil: perfilPrueba('dueno') })

const arbolEditor = () => (
  <TemaProvider>
    <ToastProvider>
      <CalzadoEditorScreen />
    </ToastProvider>
  </TemaProvider>
)

const fotosMostradas = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root.findAllByType(Image).map((n: { props: { source?: { uri?: string } } }) => n.props.source?.uri)

describe('Editor de calzado: volver de la cámara o la galería', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLecturasProducto = 0
    conPerfilNuevo()
  })

  it('no vuelve a leer el producto cuando se relee el perfil', async () => {
    let arbol!: ReturnType<typeof renderer.create>
    await act(async () => {
      arbol = renderer.create(arbolEditor())
    })
    expect(mockLecturasProducto).toBe(1)

    conPerfilNuevo()
    await act(async () => {
      arbol.update(arbolEditor())
    })
    expect(mockLecturasProducto).toBe(1)
  })

  it('conserva la foto recién subida aunque se relea el perfil', async () => {
    let arbol!: ReturnType<typeof renderer.create>
    await act(async () => {
      arbol = renderer.create(arbolEditor())
    })

    // Elegir "Galería" en el diálogo de la foto.
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botones) => {
      botones?.find((b) => b.text === 'Galería')?.onPress?.()
    })
    const botonFoto = arbol.root.findAllByProps({ accessibilityLabel: 'Añadir foto' }).find((n: { props: { onPress?: () => void } }) => n.props.onPress)!
    await act(async () => {
      botonFoto.props.onPress()
    })
    expect(fotosMostradas(arbol)).toContain(URL_SUBIDA)

    // Al volver de la galería la app relee el perfil (objeto nuevo).
    conPerfilNuevo()
    await act(async () => {
      arbol.update(arbolEditor())
    })
    expect(fotosMostradas(arbol)).toContain(URL_SUBIDA)
  })
})
