import { MODULOS, modulosPara, puedeAcceder } from './permisos'

describe('permisos', () => {
  test('el dueño ve los 13 módulos', () => {
    expect(modulosPara('dueno')).toHaveLength(13)
  })

  test('el empleado ve exactamente 5 módulos', () => {
    const ids = modulosPara('empleado').map(m => m.id).sort()
    expect(ids).toEqual(
      ['cierre-caja', 'inventario-calzado', 'inventario-varios', 'recibir-mercancia', 'ventas'].sort()
    )
  })

  test('el empleado NO ve módulos financieros', () => {
    const idsEmpleado = modulosPara('empleado').map(m => m.id)
    for (const prohibido of ['balance', 'reportes', 'gastos-fijos', 'gastos-variables', 'analisis-ia', 'proveedores']) {
      expect(idsEmpleado).not.toContain(prohibido)
    }
  })

  test('puedeAcceder respeta el mapa', () => {
    expect(puedeAcceder('empleado', 'ventas')).toBe(true)
    expect(puedeAcceder('empleado', 'cierre-caja')).toBe(true)
    expect(puedeAcceder('empleado', 'balance')).toBe(false)
    expect(puedeAcceder('dueno', 'balance')).toBe(true)
  })

  test('puedeAcceder con id inexistente es false', () => {
    expect(puedeAcceder('dueno', 'no-existe')).toBe(false)
  })

  test('no hay ids de módulo duplicados', () => {
    const ids = MODULOS.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
