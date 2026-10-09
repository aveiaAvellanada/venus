import { filtroCalzado, limpiarTermino } from './busqueda'

describe('búsqueda de productos', () => {
  it('quita lo que rompe el filtro de PostgREST', () => {
    expect(limpiarTermino('bota, (negra) "38" 100%*')).toBe('bota negra 38 100')
  })

  it('recorta espacios y largo', () => {
    expect(limpiarTermino('   tennis    blanco  ')).toBe('tennis blanco')
    expect(limpiarTermino('x'.repeat(60))).toHaveLength(40)
  })

  it('busca en descripción, referencia, marca, color y categoría', () => {
    expect(filtroCalzado('nike')).toBe(
      'descripcion.ilike.%nike%,referencia.ilike.%nike%,marca.ilike.%nike%,color.ilike.%nike%,categoria.ilike.%nike%',
    )
  })
})
