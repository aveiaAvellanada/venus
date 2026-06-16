import { MODULOS, modulosPara, puedeAcceder } from './permisos'

describe('permisos', () => {
  test('el dueño ve los 14 módulos', () => {
    expect(modulosPara('dueno')).toHaveLength(14)
  })

  test('el admin ve 11 módulos (todos menos los del dueño)', () => {
    const ids = modulosPara('admin').map(m => m.id)
    expect(ids).toHaveLength(11)
    for (const prohibido of ['gestion-empleado', 'balance', 'analisis-ia']) {
      expect(ids).not.toContain(prohibido)
    }
  })

  test('el empleado ve exactamente los 7 módulos operativos', () => {
    const ids = modulosPara('empleado').map(m => m.id).sort()
    expect(ids).toEqual(
      ['caja', 'devoluciones', 'gastos-variables', 'granja', 'inventario-calzado', 'recibir-mercancia', 'ventas'].sort()
    )
  })

  test('solo el dueño ve finanzas y gestión', () => {
    for (const id of ['balance', 'gestion-empleado', 'analisis-ia']) {
      expect(puedeAcceder('dueno', id)).toBe(true)
      expect(puedeAcceder('admin', id)).toBe(false)
      expect(puedeAcceder('empleado', id)).toBe(false)
    }
  })

  test('admin gestiona proveedores, gastos fijos, reportes y carga inicial; el empleado no', () => {
    for (const id of ['proveedores', 'gastos-fijos', 'reportes', 'carga-inicial']) {
      expect(puedeAcceder('admin', id)).toBe(true)
      expect(puedeAcceder('empleado', id)).toBe(false)
    }
  })

  test('devoluciones es visible para los tres roles', () => {
    expect(puedeAcceder('dueno', 'devoluciones')).toBe(true)
    expect(puedeAcceder('admin', 'devoluciones')).toBe(true)
    expect(puedeAcceder('empleado', 'devoluciones')).toBe(true)
  })

  test('ventas conserva su ruta dedicada', () => {
    expect(MODULOS.find(m => m.id === 'ventas')?.ruta).toBe('/ventas')
  })

  test('proveedores conserva su ruta dedicada', () => {
    expect(MODULOS.find(m => m.id === 'proveedores')?.ruta).toBe('/proveedores')
  })

  test('caja conserva su ruta dedicada', () => {
    expect(MODULOS.find(m => m.id === 'caja')?.ruta).toBe('/caja')
  })

  test('inventario-calzado conserva su ruta dedicada', () => {
    expect(MODULOS.find(m => m.id === 'inventario-calzado')?.ruta).toBe('/inventario/calzado')
  })

  test('granja conserva su ruta dedicada', () => {
    expect(MODULOS.find(m => m.id === 'granja')?.ruta).toBe('/inventario/granja')
  })

  test('gastos-variables conserva su ruta dedicada', () => {
    expect(MODULOS.find(m => m.id === 'gastos-variables')?.ruta).toBe('/gastos')
  })

  test('gastos-fijos conserva su ruta dedicada', () => {
    expect(MODULOS.find(m => m.id === 'gastos-fijos')?.ruta).toBe('/gastos/fijos')
  })

  test('carga-inicial conserva su ruta dedicada', () => {
    expect(MODULOS.find(m => m.id === 'carga-inicial')?.ruta).toBe('/inventario/carga')
  })

  test('no hay ids de módulo duplicados', () => {
    const ids = MODULOS.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
