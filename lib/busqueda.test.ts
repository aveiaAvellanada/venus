import { orIlike } from './busqueda'

describe('orIlike', () => {
  it('arma la cadena .or() de ilike para varias columnas', () => {
    expect(orIlike(['descripcion', 'referencia'], 'bota')).toBe(
      'descripcion.ilike.%bota%,referencia.ilike.%bota%'
    )
  })

  it('formato simple esperado por PostgREST', () => {
    expect(orIlike(['nombre', 'nit_cedula'], 'mede')).toBe(
      'nombre.ilike.%mede%,nit_cedula.ilike.%mede%'
    )
  })

  it('quita comas (no parten el filtro)', () => {
    expect(orIlike(['nombre'], 'a,b')).toBe('nombre.ilike.%ab%')
  })

  it('quita paréntesis', () => {
    expect(orIlike(['n'], 'x)y(')).toBe('n.ilike.%xy%')
  })

  it('quita comillas y backslash', () => {
    expect(orIlike(['nombre'], 'a"b\\c')).toBe('nombre.ilike.%abc%')
  })

  it('preserva letras, números y espacios normales', () => {
    expect(orIlike(['n'], 'Tenis Cali 38')).toBe('n.ilike.%Tenis Cali 38%')
  })
})
