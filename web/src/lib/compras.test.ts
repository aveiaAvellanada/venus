import {
  avisosFactura, dividirRango, erroresFactura, filaVacia, payloadFactura, rangoDeTalla, rangosDesdeExistentes,
  redondearPrecio, resumenFactura, subtotalFila, TALLAS, unirRango, type Factura, type FilaFactura,
  fotoDeFila, otroColor, partesColor, unirColores,
} from './compras'

const HOY = '2026-10-12'
const factura = (filas: FilaFactura[], o: Partial<Factura> = {}): Factura => ({
  proveedorId: 'p1', numeroFactura: 'FV-1', fechaFactura: HOY, condicion: 'contado', fechaVencimiento: '', notas: '', filas, ...o,
})
const fila = (o: Partial<FilaFactura>): FilaFactura => ({ ...filaVacia('f1'), ...o })

describe('tallas y redondeo', () => {
  it('de la 20 a la 45; precios a $1.000', () => {
    expect(TALLAS[0]).toBe('20')
    expect(TALLAS[TALLAS.length - 1]).toBe('45')
    expect(TALLAS).toHaveLength(26)
    expect(redondearPrecio(87400)).toBe(87000)
    expect(redondearPrecio(87500)).toBe(88000)
  })
})

describe('rangos de precio por tallas', () => {
  it('dividir parte el rango en la talla elegida y unir lo deshace', () => {
    let f = fila({ rangos: [{ desde: '20', hasta: '45', costo: '30000', minimo: '45000', maximo: '55000' }] })
    f = dividirRango(f, '27')
    expect(f.rangos.map((r) => `${r.desde}-${r.hasta}`)).toEqual(['20-26', '27-45'])
    expect(f.rangos[1]).toMatchObject({ costo: '30000', minimo: '45000' })
    f = dividirRango(f, '36')
    expect(f.rangos.map((r) => `${r.desde}-${r.hasta}`)).toEqual(['20-26', '27-35', '36-45'])
    expect(dividirRango(f, '27')).toBe(f) // ya empieza ahí
    expect(rangoDeTalla(f, '30')?.desde).toBe('27')
    f = unirRango(f, 1)
    expect(f.rangos.map((r) => `${r.desde}-${r.hasta}`)).toEqual(['20-35', '36-45'])
    f = unirRango(f, 0)
    expect(f.rangos.map((r) => `${r.desde}-${r.hasta}`)).toEqual(['20-45'])
  })

  it('desde lo que ya existe: tallas seguidas con el mismo precio forman un rango que cubre 20–45', () => {
    const existentes = {
      '24': { id: 'a', precio_minimo: 45000, precio_maximo: 55000 },
      '25': { id: 'b', precio_minimo: 45000, precio_maximo: 55000 },
      '34': { id: 'c', precio_minimo: 60000, precio_maximo: 70000 },
      '35': { id: 'd', precio_minimo: 60000, precio_maximo: 70000 },
    }
    const rangos = rangosDesdeExistentes(existentes, new Map([['a', { ultimo: 30000 }], ['d', { ultimo: 38000 }]]))
    expect(rangos).toEqual([
      { desde: '20', hasta: '33', costo: '30.000', minimo: '45.000', maximo: '55.000' },
      { desde: '34', hasta: '45', costo: '38.000', minimo: '60.000', maximo: '70.000' },
    ])
    expect(rangosDesdeExistentes({})).toEqual([{ desde: '20', hasta: '45', costo: '', minimo: '', maximo: '' }])
  })
})

describe('totales y lo que se manda', () => {
  const escolar = fila({
    referencia: 'ES-9', descripcion: 'Escolar', categoria: 'Escolar', color: 'Negro', marca: 'Bosi',
    existentes: { '24': { id: 'e24', precio_minimo: 45000, precio_maximo: 55000 } },
    cantidades: { '24': '4', '36': '2', '30': '' },
    rangos: [
      { desde: '20', hasta: '33', costo: '30.000', minimo: '45.000', maximo: '55.000' },
      { desde: '34', hasta: '45', costo: '38.000', minimo: '60.000', maximo: '70.000' },
    ],
  })

  it('subtotal con el costo de cada rango; resumen con tallas nuevas y precios cambiados', () => {
    expect(subtotalFila(escolar)).toBe(4 * 30000 + 2 * 38000)
    const cambio = { ...escolar, rangos: [{ ...escolar.rangos[0], minimo: '46.000' }, escolar.rangos[1]] }
    expect(resumenFactura(factura([escolar]))).toEqual({ unidades: 6, total: 196000, referencias: 1, tallasNuevas: 1, preciosCambiados: 0 })
    expect(resumenFactura(factura([cambio])).preciosCambiados).toBe(1)
  })

  it('payload: talla existente por id; nueva con sus datos; crédito con vencimiento', () => {
    const p = payloadFactura(factura([escolar], { condicion: 'credito', fechaVencimiento: '2026-11-11', numeroFactura: '  ' }))
    expect(p).toMatchObject({ proveedor_id: 'p1', numero_factura: undefined, condicion_pago: 'credito', fecha_vencimiento: '2026-11-11' })
    expect(p.items).toEqual([
      { producto_id: 'e24', talla: '24', cantidad: 4, costo_unitario: 30000, precio_minimo: 45000, precio_maximo: 55000 },
      { referencia: 'ES-9', descripcion: 'Escolar', marca: 'Bosi', categoria: 'Escolar', color: 'Negro',
        talla: '36', cantidad: 2, costo_unitario: 38000, precio_minimo: 60000, precio_maximo: 70000 },
    ])
    expect(payloadFactura(factura([escolar], { fechaVencimiento: '2026-11-11' })).fecha_vencimiento).toBeUndefined()
  })
})

describe('validación', () => {
  it('pide proveedor, cantidades, vencimiento a crédito y fecha no futura', () => {
    expect(erroresFactura(factura([filaVacia('x')], { proveedorId: '' }), HOY)).toEqual([
      'Elige el proveedor.', 'Escribe la cantidad de al menos una talla.',
    ])
    const f = fila({ referencia: 'A', descripcion: 'A', categoria: 'Otros', cantidades: { '40': '1' },
      rangos: [{ desde: '20', hasta: '45', costo: '1000', minimo: '2000', maximo: '3000' }] })
    expect(erroresFactura(factura([f], { condicion: 'credito' }), HOY)).toEqual(['Una compra a crédito necesita la fecha de vencimiento.'])
    expect(erroresFactura(factura([f], { fechaFactura: '2026-10-13' }), HOY)).toContain('La fecha de la factura no puede faltar ni ser futura.')
    expect(erroresFactura(factura([f]), HOY)).toEqual([])
  })

  it('por fila: datos de lo nuevo, costo y precios del rango usado, cantidades enteras', () => {
    const f = fila({ referencia: 'NV-1', cantidades: { '40': '1', '41': '1,5' },
      rangos: [{ desde: '20', hasta: '45', costo: '', minimo: '9000', maximo: '8000' }] })
    expect(erroresFactura(factura([f]), HOY)).toEqual([
      'En NV-1 hay cantidades que no son números enteros.',
      'Falta la descripción de NV-1.',
      'Falta la categoría de NV-1.',
      'Falta el costo de NV-1 (tallas 20–45).',
      'En NV-1 (tallas 20–45) el precio mínimo pasa del máximo.',
    ])
  })

  it('avisa sin número de factura o con el mínimo por debajo del costo, sin bloquear', () => {
    const f = fila({ referencia: 'B', cantidades: { '40': '1' }, rangos: [{ desde: '20', hasta: '45', costo: '50000', minimo: '40000', maximo: '60000' }] })
    expect(avisosFactura(factura([f], { numeroFactura: '' }))).toEqual([
      'Sin número de factura: sirve para la facturación futura.',
      'En B el precio mínimo queda por debajo del costo.',
    ])
  })
})

describe('dos colores', () => {
  const rango = [{ desde: '20', hasta: '45', costo: '1000', minimo: '2000', maximo: '3000' }]

  it('lo nuevo se registra como "Rojo y blanco" aunque se escriba "rojo/blanco"', () => {
    const f = fila({ referencia: 'Z', descripcion: 'Z', categoria: 'Otros', color: 'rojo/blanco', cantidades: { '40': '1' }, rangos: rango })
    expect(payloadFactura(factura([f])).items[0].color).toBe('Rojo y blanco')
  })

  it('más de dos colores no se puede guardar', () => {
    const f = fila({ referencia: 'Z', descripcion: 'Z', categoria: 'Otros', color: 'rojo, blanco, azul', cantidades: { '40': '1' }, rangos: rango })
    expect(erroresFactura(factura([f]), HOY)).toEqual(['En Z: Un zapato tiene máximo dos colores (ej. "Rojo y blanco").'])
  })
})

describe('otro color, foto y dos colores', () => {
  it('otroColor copia todo menos color, cantidades, tallas existentes y foto', () => {
    const fila = {
      ...filaVacia('a'), referencia: 'NV-5', descripcion: 'Tennis', marca: 'Verlon', categoria: 'Tennis', color: 'Negro',
      cantidades: { '38': '2' }, foto: 'https://f/1.jpg',
      existentes: { '38': { id: 'x', precio_minimo: 1, precio_maximo: 2 } },
      rangos: [{ desde: '20', hasta: '45', costo: '50.000', minimo: '80.000', maximo: '100.000' }],
    }
    const copia = otroColor(fila, 'b')
    expect(copia).toEqual({ ...fila, id: 'b', color: '', cantidades: {}, existentes: {}, foto: '' })
    expect(copia.rangos).not.toBe(fila.rangos)
  })

  it('la foto que se ve: la nueva o la que ya tenía ese color', () => {
    const fila = { ...filaVacia('a'), existentes: { '38': { id: 'x', precio_minimo: 1, precio_maximo: 2, foto_url: 'https://f/vieja.jpg' } } }
    expect(fotoDeFila(fila)).toBe('https://f/vieja.jpg')
    expect(fotoDeFila({ ...fila, foto: 'https://f/nueva.jpg' })).toBe('https://f/nueva.jpg')
    expect(fotoDeFila(filaVacia('b'))).toBeNull()
  })

  it('el color se parte en dos campos y se une sin perder lo que se escribe', () => {
    expect(partesColor('Rojo y blanco')).toEqual(['Rojo', 'blanco'])
    expect(partesColor('Azul ')).toEqual(['Azul ', ''])
    expect(partesColor('Azul rey y gris')).toEqual(['Azul rey', 'gris'])
    expect(unirColores('Rojo', 'blanco')).toBe('Rojo y blanco')
    expect(unirColores('Rojo', ' ')).toBe('Rojo')
    expect(partesColor(unirColores('Verde', 'neón '))).toEqual(['Verde', 'neón '])
  })
})

describe('precio máximo opcional', () => {
  const sinMax = [{ desde: '20', hasta: '45', costo: '50.000', minimo: '80.000', maximo: '' }]
  const existentes = { '38': { id: 'a38', precio_minimo: 80000, precio_maximo: null } }

  it('sin máximo no es un error ni un cambio de precio, y va como null', () => {
    const f = factura([{ ...filaVacia('a'), referencia: 'SM-1', descripcion: 'Sin máximo', categoria: 'Tennis', color: 'Gris',
      existentes, cantidades: { '38': '1' }, rangos: sinMax }])
    expect(erroresFactura(f, HOY)).toEqual([])
    expect(resumenFactura(f).preciosCambiados).toBe(0)
    expect(payloadFactura(f).items[0]).toMatchObject({ producto_id: 'a38', precio_maximo: null })
    expect(rangosDesdeExistentes(existentes)[0].maximo).toBe('')
  })

  it('si hay máximo no puede ser menor que el mínimo', () => {
    const f = factura([{ ...filaVacia('a'), referencia: 'SM-1', descripcion: 'X', categoria: 'Tennis', color: 'Gris',
      cantidades: { '38': '1' }, rangos: [{ ...sinMax[0], maximo: '70.000' }] }])
    expect(erroresFactura(f, HOY)).toEqual(['En SM-1 Gris (tallas 20–45) el precio mínimo pasa del máximo.'])
  })
})
