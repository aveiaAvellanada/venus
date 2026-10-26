import { nombreDeUrlFoto, nombreFoto, rutaFoto, rutaMiniatura, textoParaArchivo, urlMiniatura } from './fotos'

const BASE = 'https://x.supabase.co/storage/v1/object/public/productos'

describe('nombre de la foto', () => {
  it('limpia el texto para usarlo como nombre de archivo', () => {
    expect(textoParaArchivo('  Diana Gold Ñandú/2 ')).toBe('diana-gold-nandu-2')
    expect(textoParaArchivo('52452601')).toBe('52452601')
    expect(textoParaArchivo('***')).toBe('')
    expect(textoParaArchivo(null)).toBe('')
  })

  it('usa la referencia y el color, o la descripción si no hay referencia', () => {
    expect(nombreFoto('52452601', 'Diana Gold', 'Rojo')).toBe('52452601-rojo')
    expect(nombreFoto('', 'Chancla Playera', 'café')).toBe('chancla-playera-cafe')
    expect(nombreFoto('TA-1', '', '')).toBe('ta-1')
    expect(nombreFoto('', '', 'Rojo')).toBeNull()
  })

  it('dos colores se nombran igual sin importar cómo se escriban', () => {
    expect(nombreFoto('BV-2', '', 'rojo/blanco')).toBe('bv-2-rojo-y-blanco')
    expect(nombreFoto('BV-2', '', 'Rojo y blanco')).toBe('bv-2-rojo-y-blanco')
  })

  it('arma las rutas de la foto y su miniatura', () => {
    expect(rutaFoto('dg-1-rojo', 'webp')).toBe('catalogo/dg-1-rojo.webp')
    expect(rutaMiniatura('dg-1-rojo', 'webp')).toBe('catalogo/dg-1-rojo-mini.webp')
  })
})

describe('urls de fotos', () => {
  it('reconoce el nombre de una foto del catálogo', () => {
    expect(nombreDeUrlFoto(`${BASE}/catalogo/dg-1-rojo.webp?v=123`)).toBe('dg-1-rojo')
    expect(nombreDeUrlFoto(`${BASE}/catalogo/dg-1-rojo.jpg`)).toBe('dg-1-rojo')
    expect(nombreDeUrlFoto(`${BASE}/catalogo/dg-1-rojo-mini.webp`)).toBeNull()
    expect(nombreDeUrlFoto(`${BASE}/1712345_ab12cd34.jpg`)).toBeNull()
    expect(nombreDeUrlFoto(null)).toBeNull()
  })

  it('la miniatura conserva la versión; las fotos viejas se usan tal cual', () => {
    expect(urlMiniatura(`${BASE}/catalogo/dg-1-rojo.webp?v=123`)).toBe(`${BASE}/catalogo/dg-1-rojo-mini.webp?v=123`)
    expect(urlMiniatura(`${BASE}/catalogo/dg-1-rojo.jpg`)).toBe(`${BASE}/catalogo/dg-1-rojo-mini.jpg`)
    expect(urlMiniatura(`${BASE}/1712345_ab12cd34.jpg`)).toBe(`${BASE}/1712345_ab12cd34.jpg`)
    expect(urlMiniatura(undefined)).toBeNull()
  })
})
