import type { ProductoCalzado } from './inventario'
import {
  aplicarCambiados, borradorVacio, cambiarMotivo, cantidad, contar, enAlcance, erroresConteo, lineas,
  motivoParaTodas, payloadConteo, quitarRevisar, resumen, textoAlcance, valorDiferencias,
} from './conteo'

const p = (o: Partial<ProductoCalzado>): ProductoCalzado => ({
  id: 'x', referencia: 'TA-1', descripcion: 'Tennis A', marca: 'Bosi', color: 'Negro', categoria: 'Tennis',
  talla: '38', precio_minimo: 80000, precio_maximo: 100000, stock_actual: 5, stock_minimo: 1, activo: true,
  proveedor_id: null, ...o,
})

const t38 = p({ id: 't38' })
const t39 = p({ id: 't39', talla: '39', stock_actual: 2 })
const t40 = p({ id: 't40', talla: '40', stock_actual: 4 })
const productos = [t38, t39, t40]

describe('conteo físico', () => {
  it('alcance: tallas activas de la categoría y la marca', () => {
    expect(enAlcance(t38, 'Tennis', '')).toBe(true)
    expect(enAlcance(t38, 'Escolar', '')).toBe(false)
    expect(enAlcance(t38, '', 'Otra')).toBe(false)
    expect(enAlcance(p({ activo: false }), '', '')).toBe(false)
    expect(textoAlcance('', '')).toBe('Todo el inventario')
    expect(textoAlcance('Tennis', 'Bosi')).toBe('Tennis · marca Bosi')
    expect(textoAlcance('', 'Bosi')).toBe('marca Bosi')
  })

  it('lo contado es un entero, 0 o más', () => {
    expect(cantidad(' 3 ')).toBe(3)
    expect(cantidad('0')).toBe(0)
    expect(cantidad('-1')).toBeNull()
    expect(cantidad('2.5')).toBeNull()
    expect(cantidad('')).toBeNull()
  })

  it('contar guarda el stock que se veía al contar; borrar saca la talla', () => {
    let b = contar(borradorVacio('c'), t38, '3')
    expect(b.contados.t38).toEqual({ contado: '3', sistema: 5, motivo: '', nota: '' })
    // Si el inventario se recarga con otro stock, el que se vio al contar no cambia.
    b = contar(b, { ...t38, stock_actual: 4 }, '2')
    expect(b.contados.t38.sistema).toBe(5)
    b = contar(b, t38, '')
    expect(b.contados.t38).toBeUndefined()
  })

  it('si deja de haber diferencia se quita el motivo', () => {
    let b = contar(borradorVacio('c'), t38, '3')
    b = cambiarMotivo(b, 't38', { motivo: 'perdida' })
    expect(contar(b, t38, '4').contados.t38.motivo).toBe('perdida')
    expect(contar(b, t38, '5').contados.t38.motivo).toBe('')
  })

  it('resumen: diferencias, sobrantes, faltantes y lo que falta por contar', () => {
    let b = contar(borradorVacio('c'), t38, '3')
    b = contar(b, t39, '3')
    const r = resumen(lineas(b, productos), productos)
    expect(r).toEqual({ contadas: 2, conDiferencia: 2, sobrantes: 1, faltantes: 2, sinContar: 1, revisar: 0 })
  })

  it('errores: motivo, pérdida solo en faltantes, "Otro" con nota y número válido', () => {
    let b = contar(borradorVacio('c'), t38, '3')
    b = contar(b, t39, '3')
    b = contar(b, t40, '4')
    expect(erroresConteo(lineas(b, productos))).toEqual([
      'TA-1 Negro talla 38: elige el motivo de la diferencia.',
      'TA-1 Negro talla 39: elige el motivo de la diferencia.',
    ])
    b = cambiarMotivo(b, 't38', { motivo: 'otro' })
    b = cambiarMotivo(b, 't39', { motivo: 'perdida' })
    expect(erroresConteo(lineas(b, productos))).toEqual([
      'TA-1 Negro talla 38: con el motivo "Otro" escribe una nota.',
      'TA-1 Negro talla 39: sobran pares; pérdida o daño solo explican faltantes.',
    ])
    b = cambiarMotivo(b, 't38', { nota: 'Se prestó' })
    b = cambiarMotivo(b, 't39', { motivo: 'error' })
    b = contar(b, t40, '1,5')
    expect(erroresConteo(lineas(b, productos))).toEqual(['TA-1 Negro talla 40: lo contado debe ser un número entero, 0 o más.'])
  })

  it('un motivo para todas respeta los que ya tienen y no pone pérdida en sobrantes', () => {
    let b = contar(borradorVacio('c'), t38, '3')
    b = contar(b, t39, '3')
    b = contar(b, t40, '1')
    b = cambiarMotivo(b, 't40', { motivo: 'dano' })
    b = motivoParaTodas(b, lineas(b, productos), 'perdida')
    expect([b.contados.t38.motivo, b.contados.t39.motivo, b.contados.t40.motivo]).toEqual(['perdida', '', 'dano'])
    b = motivoParaTodas(b, lineas(b, productos), 'error')
    expect(b.contados.t39.motivo).toBe('error')
  })

  it('stock que cambió mientras se contaba: toma el de ahora y pide revisar', () => {
    let b = contar(borradorVacio('c'), t38, '3')
    b = cambiarMotivo(b, 't38', { motivo: 'perdida' })
    b = aplicarCambiados(b, [{ producto_id: 't38', sistema_antes: 5, sistema_ahora: 4 }])
    expect(b.contados.t38).toMatchObject({ sistema: 4, revisar: true })
    expect(erroresConteo(lineas(b, productos))).toEqual(['TA-1 Negro talla 38: el stock cambió mientras contabas; vuelve a contarla.'])
    expect(contar(b, t38, '3').contados.t38.revisar).toBeUndefined()
    expect(quitarRevisar(b).contados.t38.revisar).toBe(false)
  })

  it('valor a costo de lo que sobra y falta, solo con costos', () => {
    let b = contar(borradorVacio('c'), t38, '3')
    b = contar(b, t39, '3')
    const ls = lineas(b, productos)
    expect(valorDiferencias(ls, undefined)).toBeNull()
    expect(valorDiferencias(ls, new Map([['t38', { ultimo: 50000, promedio: 50000 }]])))
      .toEqual({ sobrante: 0, faltante: 100000, sinCosto: 1 })
  })

  it('payload: motivo y nota solo donde hay diferencia', () => {
    let b = { ...contar(borradorVacio('c'), t38, '3'), nota: ' Cierre de mes ' }
    b = contar(b, t40, '4')
    b = cambiarMotivo(b, 't38', { motivo: 'perdida', nota: ' ' })
    expect(payloadConteo(b, lineas(b, productos), 'Tennis')).toEqual({
      alcance: 'Tennis',
      nota: 'Cierre de mes',
      items: [
        { producto_id: 't38', sistema: 5, contado: 3, motivo: 'perdida', nota: null },
        { producto_id: 't40', sistema: 4, contado: 4, motivo: null, nota: null },
      ],
    })
  })
})
