import {
  MODULOS, PERMISOS, PLANTILLAS, esDueno, modulosPara, puedeAcceder, resumenPermisos, tienePermiso,
  type ConPermisos,
} from './permisos'

const DUENO: ConPermisos = { rol: 'dueno', permisos: [] }
const OPERATIVO: ConPermisos = { rol: 'empleado', permisos: PLANTILLAS.operativo.permisos }
const ADMINISTRATIVO: ConPermisos = { rol: 'empleado', permisos: PLANTILLAS.administrativo.permisos }
const SIN_PERMISOS: ConPermisos = { rol: 'empleado', permisos: [] }

describe('permisos', () => {
  test('el catálogo coincide con private.permisos_validos() de la base', () => {
    // Si cambias uno, cambia el otro (20261009150000_permisos_por_usuario.sql).
    expect(PERMISOS.map((p) => p.id)).toEqual([
      'ventas', 'devoluciones', 'inventario', 'recibir_mercancia', 'caja', 'gastos',
      'proveedores', 'gastos_fijos', 'reportes', 'carga_inicial',
      'costos', 'deudas', 'balance',
    ])
  })

  test('el dueño tiene todos los permisos y ve los 14 módulos', () => {
    for (const p of PERMISOS) expect(tienePermiso(DUENO, p.id)).toBe(true)
    expect(modulosPara(DUENO)).toHaveLength(14)
    expect(esDueno(DUENO)).toBe(true)
  })

  test('un empleado solo tiene lo que se le entregó', () => {
    const luisa: ConPermisos = { rol: 'empleado', permisos: ['ventas', 'caja'] }
    expect(tienePermiso(luisa, 'ventas')).toBe(true)
    expect(tienePermiso(luisa, 'devoluciones')).toBe(false)
    expect(modulosPara(luisa).map((m) => m.id).sort()).toEqual(['caja', 'granja', 'inventario-calzado', 'ventas'])
  })

  test('sin perfil no hay acceso a nada', () => {
    expect(tienePermiso(null, 'ventas')).toBe(false)
    expect(puedeAcceder(null, 'ventas')).toBe(false)
  })

  test('la plantilla operativa ve los 7 módulos operativos', () => {
    expect(modulosPara(OPERATIVO).map((m) => m.id).sort()).toEqual(
      ['caja', 'devoluciones', 'gastos-variables', 'granja', 'inventario-calzado', 'recibir-mercancia', 'ventas'].sort()
    )
  })

  test('la administrativa suma proveedores, gastos fijos, reportes y carga inicial', () => {
    for (const id of ['proveedores', 'gastos-fijos', 'reportes', 'carga-inicial']) {
      expect(puedeAcceder(ADMINISTRATIVO, id)).toBe(true)
      expect(puedeAcceder(OPERATIVO, id)).toBe(false)
    }
  })

  test('empleados y análisis IA son del dueño aunque el empleado tenga todos los permisos', () => {
    const todo: ConPermisos = { rol: 'empleado', permisos: PERMISOS.map((p) => p.id) }
    for (const id of ['gestion-empleado', 'analisis-ia']) {
      expect(puedeAcceder(DUENO, id)).toBe(true)
      expect(puedeAcceder(todo, id)).toBe(false)
    }
    expect(puedeAcceder(todo, 'balance')).toBe(true)
    expect(esDueno(todo)).toBe(false)
  })

  test('finanzas no viene en ninguna plantilla: el dueño la entrega a propósito', () => {
    for (const p of ['costos', 'deudas', 'balance'] as const) {
      expect(tienePermiso(ADMINISTRATIVO, p)).toBe(false)
    }
  })

  test('productos (inventario y Granja) se ven sin permisos para poder vender', () => {
    expect(puedeAcceder(SIN_PERMISOS, 'inventario-calzado')).toBe(true)
    expect(puedeAcceder(SIN_PERMISOS, 'ventas')).toBe(false)
  })

  test('resumen: nombre de la plantilla si coincide exacto', () => {
    expect(resumenPermisos(DUENO)).toBe('Dueño')
    expect(resumenPermisos(OPERATIVO)).toBe('Operativo')
    expect(resumenPermisos({ rol: 'empleado', permisos: [...ADMINISTRATIVO.permisos].reverse() })).toBe('Administrativo')
    expect(resumenPermisos({ rol: 'empleado', permisos: ['ventas'] })).toBe('Personalizado')
    expect(resumenPermisos(SIN_PERMISOS)).toBe('Sin permisos')
  })

  test.each([
    ['ventas', '/ventas/nueva'],
    ['proveedores', '/proveedores'],
    ['caja', '/caja'],
    ['inventario-calzado', '/productos'],
    ['granja', '/productos'],
    ['gastos-variables', '/gastos'],
    ['gastos-fijos', '/gastos/fijos'],
    ['carga-inicial', '/inventario/carga'],
  ])('%s conserva su ruta dedicada', (id, ruta) => {
    expect(MODULOS.find((m) => m.id === id)?.ruta).toBe(ruta)
  })

  test('no hay ids de módulo duplicados', () => {
    const ids = MODULOS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
