process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://dummy-url.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'dummy-key'

import { Platform } from 'react-native'

// Manipulador de imágenes de mentira: anota recortes y tamaños, y cada foto
// guardada queda en un archivo cuyo nombre dice su lado, formato y calidad.
let mockOriginal = { width: 4000, height: 3000 }
let mockFallaWebp = false
const mockOperaciones: string[] = []
const mockGuardadas: { lado: number; format: string; compress: number }[] = []
const mockSueltas: number[] = []
jest.mock('expo-image-manipulator', () => {
  const imagen = (width: number, height: number) => ({
    width,
    height,
    release: () => mockSueltas.push(width),
    saveAsync: async (o: { format: string; compress: number }) => {
      if (o.format === 'webp' && mockFallaWebp) throw new Error('WebP no disponible')
      mockGuardadas.push({ lado: width, ...o })
      return { uri: `file:///foto?lado=${width}&formato=${o.format}&calidad=${o.compress}`, width, height }
    },
  })
  return {
    SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
    ImageManipulator: {
      manipulate: (fuente: string | { width: number; height: number }) => {
        let { width, height } = typeof fuente === 'string' ? mockOriginal : fuente
        const contexto = {
          crop: (r: { originX: number; originY: number; width: number; height: number }) => {
            mockOperaciones.push(`recorte ${r.originX},${r.originY} ${r.width}×${r.height}`)
            ;({ width, height } = r)
            return contexto
          },
          resize: (t: { width: number; height: number }) => {
            mockOperaciones.push(`tamaño ${t.width}×${t.height}`)
            ;({ width, height } = t)
            return contexto
          },
          renderAsync: async () => imagen(width, height),
        }
        return contexto
      },
    },
  }
})

// Bytes de cada archivo guardado según su lado, formato y calidad.
const mockPeso = jest.fn((_lado: number, _formato: string, _calidad: number) => 120 * 1024)
jest.mock('./storage', () => ({
  bytesDesdeUriLocal: async (uri: string) => {
    const q = new URLSearchParams(uri.split('?')[1])
    return new Uint8Array(mockPeso(Number(q.get('lado')), q.get('formato')!, Number(q.get('calidad'))))
  },
}))

const mockUpload = jest.fn()
jest.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        upload: (...args: unknown[]) => mockUpload(bucket, ...args),
        getPublicUrl: (ruta: string) => ({ data: { publicUrl: `https://dummy-url.supabase.co/storage/v1/object/public/${bucket}/${ruta}` } }),
      }),
    },
  },
}))

import { formatoFotoCatalogo, ladoFinal, LIMITE_BYTES, procesarFotoCalzado, recorteCentrado, subirFotoCalzado } from './imagenes'

const WEBP = formatoFotoCatalogo('android')
const JPEG = formatoFotoCatalogo('ios')

beforeEach(() => {
  mockOriginal = { width: 4000, height: 3000 }
  mockFallaWebp = false
  mockOperaciones.length = 0
  mockGuardadas.length = 0
  mockSueltas.length = 0
  mockPeso.mockImplementation(() => 120 * 1024)
  mockUpload.mockReset()
  mockUpload.mockResolvedValue({ data: {}, error: null })
})

describe('recorte y tamaño', () => {
  it('el cuadrado más grande, centrado', () => {
    expect(recorteCentrado(4000, 3000)).toEqual({ originX: 500, originY: 0, width: 3000, height: 3000 })
    expect(recorteCentrado(3000, 4000)).toEqual({ originX: 0, originY: 500, width: 3000, height: 3000 })
    expect(recorteCentrado(1080, 1080)).toEqual({ originX: 0, originY: 0, width: 1080, height: 1080 })
    expect(recorteCentrado(101, 100)).toEqual({ originX: 0, originY: 0, width: 100, height: 100 })
  })

  it('no agranda una foto pequeña', () => {
    expect(ladoFinal(3000, 1080)).toBe(1080)
    expect(ladoFinal(800, 1080)).toBe(800)
    expect(ladoFinal(0, 400)).toBe(1)
  })
})

describe('formato', () => {
  it('WebP en Android si está disponible; si no, JPEG con .jpg', () => {
    expect(WEBP).toEqual({ formato: 'webp', extension: 'webp', tipo: 'image/webp' })
    expect(formatoFotoCatalogo('android', {})).toEqual({ formato: 'jpeg', extension: 'jpg', tipo: 'image/jpeg' })
    expect(JPEG.extension).toBe('jpg')
  })
})

describe('procesarFotoCalzado', () => {
  it('recorta en cuadrado y deja la grande de 1080 y la miniatura de 400', async () => {
    const fotos = await procesarFotoCalzado('file:///zapato.jpg', WEBP)
    expect(mockOperaciones).toEqual(['recorte 500,0 3000×3000', 'tamaño 1080×1080', 'tamaño 400×400'])
    expect(mockGuardadas).toEqual([
      { lado: 1080, format: 'webp', compress: 0.82 },
      { lado: 400, format: 'webp', compress: 0.75 },
    ])
    expect(fotos.formato.extension).toBe('webp')
    expect(fotos.grande.length).toBeLessThanOrEqual(LIMITE_BYTES)
    // Suelta todas las imágenes en memoria (original, cuadrado, grande y miniatura).
    expect(mockSueltas.sort((a, b) => a - b)).toEqual([400, 1080, 3000, 4000])
  })

  it('una foto más pequeña que 1080 no se agranda', async () => {
    mockOriginal = { width: 600, height: 800 }
    await procesarFotoCalzado('file:///zapato.jpg', WEBP)
    expect(mockOperaciones).toEqual(['recorte 0,100 600×600', 'tamaño 600×600', 'tamaño 400×400'])
  })

  it('baja la calidad hasta quedar en 500 KB', async () => {
    mockPeso.mockImplementation((lado, _f, calidad) => (lado === 1080 && calidad > 0.65 ? 600 * 1024 : 300 * 1024))
    const fotos = await procesarFotoCalzado('file:///zapato.jpg', WEBP)
    expect(mockGuardadas.map((g) => `${g.lado}@${g.compress}`)).toEqual(['1080@0.82', '1080@0.72', '1080@0.62', '400@0.62'])
    expect(fotos.grande.length).toBe(300 * 1024)
  })

  it('si no baja de 500 KB, no la sube', async () => {
    mockPeso.mockImplementation(() => 700 * 1024)
    await expect(procesarFotoCalzado('file:///zapato.jpg', WEBP)).rejects.toThrow('500 KB')
  })

  it('si el WebP falla, la hace en JPEG', async () => {
    mockFallaWebp = true
    const fotos = await procesarFotoCalzado('file:///zapato.jpg', WEBP)
    expect(fotos.formato).toEqual(JPEG)
    expect(mockGuardadas.map((g) => g.format)).toEqual(['jpeg', 'jpeg'])
  })
})

describe('subirFotoCalzado', () => {
  const plataforma = Platform.OS
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: plataforma, configurable: true })
  })

  it('sin nombre (sin referencia ni descripción) no se puede poner', async () => {
    await expect(subirFotoCalzado('file:///zapato.jpg', null)).rejects.toThrow('descripción')
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('en Android sube la grande y la miniatura en WebP con su nombre fijo, reemplazando y con caché de un año', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
    jest.spyOn(Date, 'now').mockReturnValue(1761500000000)
    const url = await subirFotoCalzado('file:///zapato.jpg', 'dg-1-rojo')
    const opciones = { upsert: true, cacheControl: '31536000', contentType: 'image/webp' }
    expect(mockUpload).toHaveBeenCalledWith('productos', 'catalogo/dg-1-rojo.webp', expect.any(Uint8Array), opciones)
    expect(mockUpload).toHaveBeenCalledWith('productos', 'catalogo/dg-1-rojo-mini.webp', expect.any(Uint8Array), opciones)
    expect(url).toBe('https://dummy-url.supabase.co/storage/v1/object/public/productos/catalogo/dg-1-rojo.webp?v=1761500000000')
    jest.mocked(Date.now).mockRestore()
  })

  it('fuera de Android va en JPEG con extensión .jpg', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    const url = await subirFotoCalzado('file:///zapato.jpg', 'dg-1-rojo')
    expect(mockUpload).toHaveBeenCalledWith('productos', 'catalogo/dg-1-rojo-mini.jpg', expect.any(Uint8Array), expect.objectContaining({ contentType: 'image/jpeg' }))
    expect(url).toMatch(/\/catalogo\/dg-1-rojo\.jpg\?v=\d+$/)
  })

  it('si falla la subida, avisa', async () => {
    mockUpload.mockResolvedValueOnce({ data: null, error: { message: 'sin permiso' } })
    await expect(subirFotoCalzado('file:///zapato.jpg', 'dg-1-rojo')).rejects.toThrow('sin permiso')
  })
})
