import { validarFilas } from './excel'

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
