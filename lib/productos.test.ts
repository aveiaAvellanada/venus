import { agruparPorReferencia, filtrarModelos, colorAHex } from './productos'
import type { ProductoCalzado } from './inventario'

function fila(sobrescribir: Partial<ProductoCalzado>): ProductoCalzado {
  return {
    id: Math.random().toString(),
    descripcion: 'Nike Air Max',
    marca: 'Nike',
    referencia: '4521',
    categoria: 'Deportivo',
    talla: '40',
    color: 'Negro',
    precio_minimo: 150000,
    precio_maximo: 220000,
    stock_actual: 5,
    stock_minimo: 1,
    foto_url: null,
    proveedor_id: null,
    activo: true,
    created_at: '',
    created_by: null,
    updated_at: '',
    updated_by: null,
    ...sobrescribir,
  } as ProductoCalzado
}

describe('agruparPorReferencia', () => {
  it('agrupa variantes de la misma referencia en un modelo', () => {
    const modelos = agruparPorReferencia([
      fila({ talla: '40', color: 'Negro', precio_minimo: 150000, precio_maximo: 220000 }),
      fila({ talla: '39', color: 'Blanco', precio_minimo: 140000, precio_maximo: 200000, foto_url: 'http://foto.jpg' }),
      fila({ talla: '42', color: 'Negro', stock_actual: 0 }),
      fila({ referencia: '3310', descripcion: 'Croydon Urbano', marca: 'Croydon', color: 'Café' }),
    ])
    expect(modelos).toHaveLength(2)
    const nike = modelos.find((m) => m.referencia === '4521')!
    expect(nike.nombre).toBe('Nike Air Max')
    expect(nike.colores).toEqual(['Negro', 'Blanco'])
    expect(nike.precioMin).toBe(140000)
    expect(nike.precioMax).toBe(220000)
    expect(nike.agotado).toBe(false)
    expect(nike.foto).toBe('http://foto.jpg')
    expect(nike.variantes.map((v) => v.talla)).toEqual(['39', '40', '42'])
  })

  it('sin referencia agrupa por descripción; inactivas quedan fuera', () => {
    const modelos = agruparPorReferencia([
      fila({ referencia: null, descripcion: 'Chancla playa', talla: '38' }),
      fila({ referencia: null, descripcion: 'Chancla playa', talla: '40' }),
      fila({ referencia: '  ', descripcion: 'Chancla playa', talla: '39' }),
      fila({ activo: false, referencia: '9999' }),
    ])
    expect(modelos).toHaveLength(1)
    expect(modelos[0].variantes).toHaveLength(3)
  })

  it('agotado solo si TODAS las variantes están en cero', () => {
    const modelos = agruparPorReferencia([
      fila({ stock_actual: 0, talla: '39' }),
      fila({ stock_actual: 0, talla: '40' }),
    ])
    expect(modelos[0].agotado).toBe(true)
  })
})

describe('filtrarModelos', () => {
  const modelos = agruparPorReferencia([
    fila({}),
    fila({ referencia: '3310', descripcion: 'Croydon Urbano', marca: 'Croydon' }),
  ])

  it('filtra por marca, nombre o referencia (insensible a mayúsculas)', () => {
    expect(filtrarModelos(modelos, 'croy')).toHaveLength(1)
    expect(filtrarModelos(modelos, 'AIR')).toHaveLength(1)
    expect(filtrarModelos(modelos, '4521')).toHaveLength(1)
    expect(filtrarModelos(modelos, '')).toHaveLength(2)
    expect(filtrarModelos(modelos, 'zzz')).toHaveLength(0)
  })
})

describe('colorAHex', () => {
  it('mapea colores comunes y cae a gris', () => {
    expect(colorAHex('Negro')).toBe('#1C1C1E')
    expect(colorAHex('blanco')).toBe('#FFFFFF')
    expect(colorAHex('CAFÉ')).toBe('#92400E')
    expect(colorAHex('fucsia neon')).toBe('#9CA3AF')
  })
})
