import { CATEGORIAS, validarFilas } from './excel'

// Fila mínima válida (las columnas obligatorias). Las claves imitan los
// encabezados ya parseados por XLSX.utils.sheet_to_json.
const filaBase = {
  categoria: 'Tennis',
  descripcion: 'Air Max',
  precio_minimo: 90000,
  precio_maximo: 120000,
  costo: 70000,
  stock: 8,
}

describe('validarFilas — talla, color y referencia', () => {
  it('extrae talla, color y referencia cuando vienen en la fila', () => {
    const { validas, errores } = validarFilas([
      { ...filaBase, talla: '38', color: 'Negro', referencia: 'NK-001' },
    ])
    expect(errores).toHaveLength(0)
    expect(validas[0].talla).toBe('38')
    expect(validas[0].color).toBe('Negro')
    expect(validas[0].referencia).toBe('NK-001')
  })

  it('acepta "ref" como encabezado alterno de referencia y normaliza números de talla', () => {
    const { validas } = validarFilas([{ ...filaBase, ref: 'AB12', talla: 38 }])
    expect(validas[0].referencia).toBe('AB12')
    expect(validas[0].talla).toBe('38')
  })

  it('deja talla/color/referencia en null cuando faltan', () => {
    const { validas } = validarFilas([{ ...filaBase }])
    expect(validas[0].talla).toBeNull()
    expect(validas[0].color).toBeNull()
    expect(validas[0].referencia).toBeNull()
  })
})

describe('CATEGORIAS — valor vs etiqueta', () => {
  // El CHECK de productos_calzado.categoria solo acepta los `valor`. Si alguno
  // llevara tilde, guardar esa categoría fallaría y su chip no filtraría nada.
  it('ningún valor lleva tilde', () => {
    for (const { valor } of CATEGORIAS) {
      expect(valor.normalize('NFD')).toBe(valor)
    }
  })

  it('los valores son exactamente los que acepta el CHECK de la DB', () => {
    expect(CATEGORIAS.map(c => c.valor)).toEqual([
      'Chanclas',
      'Escolar',
      'Botas caucho',
      'Deportivo',
      'Tennis',
      'Clasico',
      'Otros',
    ])
  })

  it('"Clasico" se muestra con tilde aunque se guarde sin ella', () => {
    const clasico = CATEGORIAS.find(c => c.valor === 'Clasico')
    expect(clasico?.etiqueta).toBe('Clásico')
  })
})

describe('validarFilas — categoría', () => {
  it('acepta "Clásico" del Excel pero devuelve el valor sin tilde que acepta la DB', () => {
    const { validas, errores } = validarFilas([{ ...filaBase, categoria: 'Clásico' }])
    expect(errores).toHaveLength(0)
    expect(validas[0].categoria).toBe('Clasico')
  })

  it('acepta "Clasico" sin tilde igual de bien', () => {
    const { validas, errores } = validarFilas([{ ...filaBase, categoria: 'Clasico' }])
    expect(errores).toHaveLength(0)
    expect(validas[0].categoria).toBe('Clasico')
  })

  it('rechaza una categoría que no existe', () => {
    const { validas, errores } = validarFilas([{ ...filaBase, categoria: 'Sandalias' }])
    expect(validas).toHaveLength(0)
    expect(errores).toHaveLength(1)
  })
})
