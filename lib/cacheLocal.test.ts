import AsyncStorage from '@react-native-async-storage/async-storage'
import { borrarCache, conCache, fijarUsuarioCache } from './cacheLocal'
import { esErrorDeRed, sinRed } from './conexion'

beforeEach(async () => {
  await AsyncStorage.clear()
  fijarUsuarioCache('ana')
})

describe('lo último leído, guardado en el teléfono', () => {
  it('con red devuelve lo nuevo y lo guarda; sin red devuelve lo guardado', async () => {
    await expect(conCache('calzado', async () => [1, 2])).resolves.toEqual([1, 2])
    await new Promise((r) => setTimeout(r, 0))
    const sinSenal = async () => { throw { message: 'TypeError: Network request failed' } }
    await expect(conCache('calzado', sinSenal)).resolves.toEqual([1, 2])
  })

  it('un error del servidor (no de red) no se tapa con lo guardado', async () => {
    await conCache('calzado', async () => [1])
    await new Promise((r) => setTimeout(r, 0))
    await expect(conCache('calzado', async () => { throw new Error('permission denied') })).rejects.toThrow('permission denied')
  })

  it('es por persona y se borra al salir', async () => {
    await conCache('calzado', async () => ['de ana'])
    await new Promise((r) => setTimeout(r, 0))
    fijarUsuarioCache('beto')
    const sinSenal = async () => { throw new TypeError('Network request failed') }
    await expect(conCache('calzado', sinSenal)).rejects.toThrow('Network request failed')
    fijarUsuarioCache('ana')
    await borrarCache('ana')
    await expect(conCache('calzado', sinSenal)).rejects.toThrow('Network request failed')
  })

  it('si la red no contesta a tiempo, usa lo guardado', async () => {
    await conCache('ventas', async () => ['v1'])
    await new Promise((r) => setTimeout(r, 0))
    await expect(conCache('ventas', () => new Promise(() => {}), { tiempoLimiteMs: 20 })).resolves.toEqual(['v1'])
  })

  it('las lecturas por fecha se guardan juntas y solo las últimas 3', async () => {
    const sinSenal = async () => { throw new TypeError('Network request failed') }
    for (const dia of ['26', '27', '28', '29']) {
      await conCache(dia, async () => [`ventas del ${dia}`], { familia: 'ventas' })
      await new Promise((r) => setTimeout(r, 5))
    }
    await expect(conCache('29', sinSenal, { familia: 'ventas' })).resolves.toEqual(['ventas del 29'])
    await expect(conCache('27', sinSenal, { familia: 'ventas' })).resolves.toEqual(['ventas del 27'])
    await expect(conCache('26', sinSenal, { familia: 'ventas' })).rejects.toThrow('Network request failed')
    expect(Object.keys(JSON.parse((await AsyncStorage.getItem('venus.cache.ana.ventas'))!))).toHaveLength(3)
  })
})

describe('conexión', () => {
  it.each([
    [{ message: 'TypeError: Network request failed' }, true],
    [{ name: 'AuthRetryableFetchError', message: '' }, true],
    [new Error('AbortError: Aborted'), true],
    [new Error('timeout'), true],
    [new Error('La caja de hoy no está abierta'), false],
    [{ message: 'permission denied for table ventas' }, false],
  ])('esErrorDeRed(%p) = %p', (e, esperado) => {
    expect(esErrorDeRed(e)).toBe(esperado)
  })

  it('sinRed solo cuando el teléfono lo sabe', () => {
    expect(sinRed({ isConnected: false, isInternetReachable: undefined })).toBe(true)
    expect(sinRed({ isConnected: true, isInternetReachable: false })).toBe(true)
    expect(sinRed({ isConnected: true, isInternetReachable: undefined })).toBe(false)
    expect(sinRed({ isConnected: undefined, isInternetReachable: undefined })).toBe(false)
  })
})
