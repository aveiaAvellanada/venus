import {
  agruparPorReferencia,
  cantidadConUnidad,
  colorAHex,
  colorInicial,
  columnasGrid,
  columnasTallas,
  contarModelos,
  FILTROS_VACIOS,
  filtrarModelos,
  filtroActivo,
  resumenColor,
  tarjetasFiltradas,
  tarjetasPorColor,
} from './productos'
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

  it('con incluirInactivos:true, conserva las variantes inactivas y marca el modelo', () => {
    const modelos = agruparPorReferencia(
      [
        fila({ referencia: '9999', activo: true, talla: '38' }),
        fila({ referencia: '9999', activo: false, talla: '40' }),
      ],
      { incluirInactivos: true }
    )
    expect(modelos).toHaveLength(1)
    expect(modelos[0].variantes).toHaveLength(2)
    expect(modelos[0].activo).toBe(true) // al menos una variante activa
  })

  it('modelo con todas las variantes inactivas: activo=false', () => {
    const modelos = agruparPorReferencia(
      [fila({ referencia: '8888', activo: false, talla: '38' })],
      { incluirInactivos: true }
    )
    expect(modelos[0].activo).toBe(false)
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

describe('tarjetas por color', () => {
  const modelos = agruparPorReferencia(
    [
      fila({ talla: '40', color: 'Negro', precio_minimo: 150000, precio_maximo: 220000, stock_actual: 0 }),
      fila({ talla: '41', color: 'Negro', precio_minimo: 160000, precio_maximo: 230000, stock_actual: 0 }),
      fila({ talla: '39', color: 'Blanco', precio_minimo: 140000, precio_maximo: 200000, foto_url: 'http://b.jpg' }),
      fila({ referencia: '3310', descripcion: 'Croydon Urbano', marca: 'Croydon', categoria: 'Clasico', color: null, precio_minimo: 95000, precio_maximo: 95000 }),
      fila({ referencia: '7777', descripcion: 'Viejo', marca: 'Bosi', activo: false }),
    ],
    { incluirInactivos: true }
  )

  it('una tarjeta por modelo + color, con precio y agotado del color', () => {
    const tarjetas = tarjetasPorColor(modelos)
    const nike = tarjetas.filter((t) => t.modelo.referencia === '4521')
    expect(nike.map((t) => t.color)).toEqual(['Negro', 'Blanco'])
    expect(nike[0]).toMatchObject({ precioMin: 150000, precioMax: 230000, agotado: true, foto: null, numColores: 2 })
    expect(nike[1]).toMatchObject({ precioMin: 140000, precioMax: 200000, agotado: false, foto: 'http://b.jpg' })
    const croydon = tarjetas.find((t) => t.modelo.referencia === '3310')!
    expect(croydon).toMatchObject({ color: '', numColores: 1 })
  })

  it('resumenColor y colorInicial: abre en el primer color con stock', () => {
    const nike = modelos.find((m) => m.referencia === '4521')!
    expect(resumenColor(nike, 'Blanco').agotado).toBe(false)
    expect(colorInicial(nike)).toBe('Blanco')
  })

  it('filtros: descontinuados, categorías múltiples, marca y precio por tarjeta', () => {
    expect(tarjetasFiltradas(modelos, '', FILTROS_VACIOS)).toHaveLength(3)
    expect(tarjetasFiltradas(modelos, '', { ...FILTROS_VACIOS, verDescontinuados: true })).toHaveLength(4)
    expect(
      tarjetasFiltradas(modelos, '', { ...FILTROS_VACIOS, categorias: ['Deportivo', 'Clasico'] })
    ).toHaveLength(3)
    expect(tarjetasFiltradas(modelos, '', { ...FILTROS_VACIOS, marcas: ['Croydon'] })).toHaveLength(1)
    // $145.000: pasa Blanco (mín 140.000) y Croydon; Negro (mín 150.000) no
    expect(
      tarjetasFiltradas(modelos, '', { ...FILTROS_VACIOS, precioMax: 145000 }).map((t) => t.color)
    ).toEqual(['Blanco', ''])
    // la búsqueda sigue encontrando por referencia
    expect(tarjetasFiltradas(modelos, '3310', FILTROS_VACIOS)).toHaveLength(1)
  })

  it('filtroActivo y conteos', () => {
    expect(filtroActivo(FILTROS_VACIOS)).toBe(false)
    expect(filtroActivo({ ...FILTROS_VACIOS, precioMax: 1 })).toBe(true)
    expect(filtroActivo({ ...FILTROS_VACIOS, verDescontinuados: true })).toBe(true)
    expect(contarModelos(modelos, false, (m) => m.marca === 'Bosi')).toBe(0)
    expect(contarModelos(modelos, true, (m) => m.marca === 'Bosi')).toBe(1)
  })
})

describe('grid responsivo', () => {
  it('columnas por ancho del contenedor', () => {
    expect(columnasGrid(390)).toBe(2)
    expect(columnasGrid(559)).toBe(2)
    expect(columnasGrid(560)).toBe(3)
    expect(columnasGrid(820)).toBe(4)
    expect(columnasGrid(1100)).toBe(5)
    expect(columnasGrid(1400)).toBe(6)
  })

  it('tallas: mínimo 5 por fila en celular', () => {
    expect(columnasTallas(350)).toBeGreaterThanOrEqual(5)
    expect(columnasTallas(300)).toBe(5)
    expect(columnasTallas(0)).toBe(1)
  })
})

describe('cantidadConUnidad', () => {
  it('pluraliza la unidad de Granja', () => {
    expect(cantidadConUnidad(1, 'libra')).toBe('1 libra')
    expect(cantidadConUnidad(2, 'cubeta')).toBe('2 cubetas')
    expect(cantidadConUnidad(0.5, 'libra')).toBe('0,5 libras')
    expect(cantidadConUnidad(3, 'unidad')).toBe('3 unidades')
    expect(cantidadConUnidad(2, 'kg')).toBe('2 kg')
  })
})
