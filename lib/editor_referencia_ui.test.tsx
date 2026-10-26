import React from 'react'
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import { Alert } from 'react-native'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///zapato.jpg' }] })),
}))
jest.mock('./supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }))
jest.mock('./imagenes', () => ({ comprimirBajoLimite: jest.fn(), subirFotoCalzado: jest.fn() }))
jest.mock('./storage', () => ({ bytesDesdeUriLocal: jest.fn() }))
jest.mock('./compras', () => ({
  ...jest.requireActual('./compras'),
  referenciaParaFila: jest.fn(async () => 'CHA-RIDE-004'),
  subirFotoColor: jest.fn(async () => 'https://x/catalogo/cha-ride-004-azul.webp?v=1'),
}))

import { TemaProvider } from './tema'
import { EditorReferencia, type ReferenciaConocida } from '../components/compras/EditorReferencia'
import { claveRefColor, filaVacia, referenciaParaFila, subirFotoColor, type FilaFactura } from './compras'
import { indiceModelos } from '../shared/referencias'

// En el inventario: Tennis A de Bosi (TEN-BOSI-001) en negro, tallas 38 y 39,
// y otro "Tennis A" de otra marca.
const TA: ReferenciaConocida = {
  referencia: 'TEN-BOSI-001', descripcion: 'Tennis A', marca: 'Bosi', categoria: 'Tennis', color: 'Negro',
  existentes: {
    '38': { id: 'a38', precio_minimo: 80000, precio_maximo: 100000, foto_url: null },
    '39': { id: 'a39', precio_minimo: 80000, precio_maximo: 100000, foto_url: null },
  },
}
const OTRO: ReferenciaConocida = {
  referencia: 'TEN-VERL-002', descripcion: 'Tennis A', marca: 'Verlon', categoria: 'Tennis', color: 'Blanco',
  existentes: { '40': { id: 'v40', precio_minimo: 90000, precio_maximo: null, foto_url: null } },
}
const CONOCIDAS = new Map([[claveRefColor(TA.referencia, TA.color), TA], [claveRefColor(OTRO.referencia, OTRO.color), OTRO]])
const MODELOS = indiceModelos(CONOCIDAS.values())

const onGuardar = jest.fn()
const arbolCon = (fila: FilaFactura) => (
  <TemaProvider>
    <EditorReferencia
      fila={fila}
      conCostos
      conocidas={CONOCIDAS}
      modelos={MODELOS}
      marcas={['Bosi', 'Verlon']}
      colores={['Negro', 'Blanco']}
      coloresSimples={['Negro', 'Blanco']}
      inventarioListo
      onGuardar={onGuardar}
      onOtroColor={jest.fn()}
      onQuitar={jest.fn()}
      onCerrar={jest.fn()}
    />
  </TemaProvider>
)

type Nodo = { props: Record<string, any> }
const campo = (arbol: ReturnType<typeof renderer.create>, testID: string) =>
  arbol.root.findAll((n: Nodo) => n.props.testID === testID && !!n.props.onChangeText)[0]
const escribir = async (arbol: ReturnType<typeof renderer.create>, testID: string, texto: string) => {
  await act(async () => campo(arbol, testID).props.onChangeText(texto))
  await act(async () => campo(arbol, testID).props.onBlur?.())
}
const textoReferencia = (arbol: ReturnType<typeof renderer.create>) =>
  arbol.root.findAll((n: Nodo) => n.props.testID === 'referencia')[0].props.children as string
const listo = async (arbol: ReturnType<typeof renderer.create>) => {
  await act(async () => arbol.root.findAll((n: Nodo) => n.props.titulo === 'Listo' && !!n.props.onPress)[0].props.onPress())
}

let montados: ReturnType<typeof renderer.create>[] = []
const crear = async (fila: FilaFactura) => {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => { arbol = renderer.create(arbolCon(fila)) })
  montados.push(arbol)
  return arbol
}
beforeEach(() => jest.clearAllMocks())
afterEach(() => {
  act(() => montados.forEach((a) => a.unmount()))
  montados = []
})

describe('Editor de una referencia: la referencia no se escribe', () => {
  it('no hay campo de referencia; un zapato nuevo dice que se pone sola', async () => {
    const arbol = await crear(filaVacia('f1'))
    expect(arbol.root.findAll((n: Nodo) => n.props.testID === 'input-referencia')).toHaveLength(0)
    expect(textoReferencia(arbol)).toBe('Ref. nueva: se pone sola al guardar.')
  })

  it('escribir la descripción y el color de uno que existe lo reconoce con su referencia y sus tallas', async () => {
    const arbol = await crear(filaVacia('f1'))
    await escribir(arbol, 'input-descripcion', 'tennis a')
    // Hay dos "Tennis A": sin marca no se adivina.
    expect(textoReferencia(arbol)).toBe('Ref. nueva: se pone sola al guardar.')
    await escribir(arbol, 'input-marca', 'bosi')
    await escribir(arbol, 'input-color', 'negro')
    expect(textoReferencia(arbol)).toBe('Ref. TEN-BOSI-001 · Tennis · BOSI · n.º 1')
    await listo(arbol)
    const guardada = onGuardar.mock.calls[0][0] as FilaFactura
    expect(guardada.referencia).toBe('TEN-BOSI-001')
    expect(Object.keys(guardada.existentes)).toEqual(['38', '39'])
  })

  it('otro color del mismo zapato conserva su referencia (es una talla nueva del modelo)', async () => {
    const arbol = await crear(filaVacia('f1'))
    await escribir(arbol, 'input-marca', 'Verlon')
    await escribir(arbol, 'input-descripcion', 'Tennis A')
    await escribir(arbol, 'input-color', 'Rojo')
    await listo(arbol)
    const guardada = onGuardar.mock.calls[0][0] as FilaFactura
    expect(guardada.referencia).toBe('TEN-VERL-002')
    expect(guardada.existentes).toEqual({})
  })

  it('si la descripción cambia a un zapato que no existe, suelta la referencia del anterior', async () => {
    const arbol = await crear({ ...filaVacia('f1'), referencia: 'TEN-BOSI-001', descripcion: 'Tennis A', marca: 'Bosi', color: 'Negro', existentes: TA.existentes })
    await escribir(arbol, 'input-descripcion', 'Tennis B')
    await listo(arbol)
    const guardada = onGuardar.mock.calls[0][0] as FilaFactura
    expect(guardada.referencia).toBe('')
    expect(guardada.existentes).toEqual({})
  })
})

describe('Editor de una referencia: foto de un zapato nuevo', () => {
  const pedirFoto = async (arbol: ReturnType<typeof renderer.create>) => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, botones) => {
      botones?.find((b) => b.text === 'Galería')?.onPress?.()
    })
    const boton = arbol.root.findAll((n: Nodo) => /foto de este color/.test(n.props.accessibilityLabel ?? '') && !!n.props.onPress)[0]
    await act(async () => { boton.props.onPress() })
    await act(async () => { await Promise.resolve() })
  }

  it('sin descripción ni categoría no se puede poner', async () => {
    const arbol = await crear(filaVacia('f1'))
    await pedirFoto(arbol)
    expect(Alert.alert).toHaveBeenCalledWith('Falta la descripción', expect.stringContaining('categoría'))
    expect(subirFotoColor).not.toHaveBeenCalled()
  })

  it('aparta la referencia y nombra la foto con ella', async () => {
    const fila = { ...filaVacia('f1'), descripcion: 'Chancla playa', marca: 'Rider', categoria: 'Chanclas', color: 'Azul' }
    const arbol = await crear(fila)
    await pedirFoto(arbol)
    expect(referenciaParaFila).toHaveBeenCalledWith(expect.objectContaining({ descripcion: 'Chancla playa', categoria: 'Chanclas' }))
    expect(subirFotoColor).toHaveBeenCalledWith('file:///zapato.jpg', expect.objectContaining({ referencia: 'CHA-RIDE-004' }))
    // La referencia apartada se queda aunque se vuelva a salir de la descripción.
    await escribir(arbol, 'input-descripcion', 'Chancla playa')
    await listo(arbol)
    const guardada = onGuardar.mock.calls[0][0] as FilaFactura
    expect(guardada.referencia).toBe('CHA-RIDE-004')
    expect(guardada.foto).toContain('cha-ride-004-azul')
  })
})
