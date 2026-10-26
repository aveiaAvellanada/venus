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

jest.mock('./inventario', () => ({ guardarCalzado: jest.fn(async () => undefined) }))
jest.mock('./tramos', () => ({ claveReferencia: (r: string) => r.trim().toLowerCase() || null, fijarGarantiaReferencia: jest.fn() }))
jest.mock('../components/PreciosPorTalla', () => ({ PreciosPorTalla: () => null }))

const FOTO_ELEGIDA = 'file:///azul.jpg'
const URL_SUBIDA = 'https://dummy-url.supabase.co/storage/v1/object/public/productos/catalogo/demo-zeus-alto-azul.webp?v=1'
jest.mock('./imagenes', () => ({ subirFotoCalzado: jest.fn(async () => URL_SUBIDA) }))
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: FOTO_ELEGIDA }] })),
  launchCameraAsync: jest.fn(),
}))

import { TemaProvider } from './tema'
import { ToastProvider } from '../components/ui'
import CalzadoEditorScreen from '../app/(app)/inventario/calzado/editor'
import { perfilPrueba } from './perfilPrueba'
import { guardarCalzado } from './inventario'
import { subirFotoCalzado } from './imagenes'

// Cada llamada arma un objeto nuevo, como hace recargarPerfil al volver a la app.
const conPerfilNuevo = () => mockUseAuth.mockReturnValue({ perfil: perfilPrueba('dueno') })

// Se desmontan al terminar: el toast deja un temporizador vivo.
let montados: ReturnType<typeof renderer.create>[] = []
afterEach(() => {
  act(() => montados.forEach((a) => a.unmount()))
  montados = []
})
const crear = (elemento: React.ReactElement) => {
  const arbol = renderer.create(elemento)
  montados.push(arbol)
  return arbol
}

const arbolEditor = () => (
  <TemaProvider>
    <ToastProvider>
      <CalzadoEditorScreen />
    </ToastProvider>
  </TemaProvider>
)

// Elegir "Galería" en el diálogo de la foto.
async function elegirDeGaleria(arbol: ReturnType<typeof renderer.create>) {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botones) => {
    botones?.find((b) => b.text === 'Galería')?.onPress?.()
  })
  const botonFoto = arbol.root.findAllByProps({ accessibilityLabel: 'Añadir foto' }).find((n: { props: { onPress?: () => void } }) => n.props.onPress)!
  await act(async () => {
    botonFoto.props.onPress()
  })
}

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
      arbol = crear(arbolEditor())
    })
    expect(mockLecturasProducto).toBe(1)

    conPerfilNuevo()
    await act(async () => {
      arbol.update(arbolEditor())
    })
    expect(mockLecturasProducto).toBe(1)
  })

  it('conserva la foto recién elegida aunque se relea el perfil', async () => {
    let arbol!: ReturnType<typeof renderer.create>
    await act(async () => {
      arbol = crear(arbolEditor())
    })
    await elegirDeGaleria(arbol)
    expect(fotosMostradas(arbol)).toContain(FOTO_ELEGIDA)
    // Se sube al guardar, con el nombre que quede.
    expect(subirFotoCalzado).not.toHaveBeenCalled()

    // Al volver de la galería la app relee el perfil (objeto nuevo).
    conPerfilNuevo()
    await act(async () => {
      arbol.update(arbolEditor())
    })
    expect(fotosMostradas(arbol)).toContain(FOTO_ELEGIDA)
  })
})

describe('Editor de calzado: foto con nombre de referencia y color', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    conPerfilNuevo()
  })

  it('al guardar sube la foto con el nombre de la referencia y el color, y guarda su URL', async () => {
    let arbol!: ReturnType<typeof renderer.create>
    await act(async () => {
      arbol = crear(arbolEditor())
    })
    await elegirDeGaleria(arbol)

    const guardar = arbol.root.findAll((n: { props: { titulo?: string; onPress?: () => void } }) => n.props.titulo === 'Actualizar producto' && !!n.props.onPress)[0]
    await act(async () => {
      await guardar.props.onPress()
    })
    expect(subirFotoCalzado).toHaveBeenCalledWith(FOTO_ELEGIDA, 'demo-zeus-alto-azul')
    expect(guardarCalzado).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', foto_url: URL_SUBIDA }))
  })

  it('si no se pudo subir la foto, no guarda el producto', async () => {
    jest.mocked(subirFotoCalzado).mockRejectedValueOnce(new Error('sin señal'))
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    let arbol!: ReturnType<typeof renderer.create>
    await act(async () => {
      arbol = crear(arbolEditor())
    })
    await elegirDeGaleria(arbol)

    const guardar = arbol.root.findAll((n: { props: { titulo?: string; onPress?: () => void } }) => n.props.titulo === 'Actualizar producto' && !!n.props.onPress)[0]
    await act(async () => {
      await guardar.props.onPress()
    })
    expect(guardarCalzado).not.toHaveBeenCalled()
  })
})
