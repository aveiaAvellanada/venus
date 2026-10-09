// Permisos por persona. El dueño (rol 'dueno') tiene todo y es el único que
// crea empleados y les entrega permisos; cada empleado puede exactamente lo que
// diga su lista. El catálogo es el cuadro de permisos del PRD v4.0 §2 y debe
// coincidir con private.permisos_validos() en la base (la RLS manda).

export type Rol = 'dueno' | 'empleado'

export type Permiso =
  | 'ventas'
  | 'devoluciones'
  | 'inventario'
  | 'recibir_mercancia'
  | 'caja'
  | 'gastos'
  | 'proveedores'
  | 'gastos_fijos'
  | 'reportes'
  | 'carga_inicial'
  | 'costos'
  | 'deudas'
  | 'balance'

export type GrupoPermiso = 'operacion' | 'administracion' | 'finanzas'

export interface DefinicionPermiso {
  id: Permiso
  titulo: string
  descripcion: string
  grupo: GrupoPermiso
}

export const PERMISOS: DefinicionPermiso[] = [
  { id: 'ventas', titulo: 'Ventas', descripcion: 'Vender calzado y Granja.', grupo: 'operacion' },
  { id: 'devoluciones', titulo: 'Devoluciones y cambios', descripcion: 'Devolver dinero o cambiar productos.', grupo: 'operacion' },
  { id: 'inventario', titulo: 'Inventario', descripcion: 'Crear y editar calzado y Granja, cambiar precios.', grupo: 'operacion' },
  { id: 'recibir_mercancia', titulo: 'Recibir mercancía', descripcion: 'Registrar la mercancía que llega (sin costos).', grupo: 'operacion' },
  { id: 'caja', titulo: 'Caja', descripcion: 'Abrir, cerrar y reabrir la caja del día.', grupo: 'operacion' },
  { id: 'gastos', titulo: 'Registrar gastos', descripcion: 'Gastos del día, incluidos los pagados con plata del cajón.', grupo: 'operacion' },
  { id: 'proveedores', titulo: 'Proveedores', descripcion: 'Datos, cuentas y documentos; ver todas las llegadas pendientes.', grupo: 'administracion' },
  { id: 'gastos_fijos', titulo: 'Gastos fijos', descripcion: 'Arriendo, servicios y demás; ver y corregir todos los gastos.', grupo: 'administracion' },
  { id: 'reportes', titulo: 'Reportes e historial', descripcion: 'Reportes por período, ventas y cierres de días anteriores.', grupo: 'administracion' },
  { id: 'carga_inicial', titulo: 'Carga inicial', descripcion: 'Cargar el inventario desde la plantilla de Excel.', grupo: 'administracion' },
  { id: 'costos', titulo: 'Costos de compra', descripcion: 'Ver y registrar cuánto cuesta la mercancía.', grupo: 'finanzas' },
  { id: 'deudas', titulo: 'Deudas con proveedores', descripcion: 'Ver deudas y registrar pagos a proveedores.', grupo: 'finanzas' },
  { id: 'balance', titulo: 'Balance', descripcion: 'Ingresos, egresos y ganancia del negocio.', grupo: 'finanzas' },
]

export const TITULO_GRUPO: Record<GrupoPermiso, string> = {
  operacion: 'Operación diaria',
  administracion: 'Administración',
  finanzas: 'Finanzas',
}

// Puntos de partida al crear un empleado; el dueño los ajusta después.
export const PLANTILLAS: Record<'operativo' | 'administrativo', { titulo: string; permisos: Permiso[] }> = {
  operativo: {
    titulo: 'Operativo',
    permisos: ['ventas', 'devoluciones', 'inventario', 'recibir_mercancia', 'caja', 'gastos'],
  },
  administrativo: {
    titulo: 'Administrativo',
    permisos: [
      'ventas', 'devoluciones', 'inventario', 'recibir_mercancia', 'caja', 'gastos',
      'proveedores', 'gastos_fijos', 'reportes', 'carga_inicial',
    ],
  },
}

export interface ConPermisos {
  rol: Rol
  permisos: readonly string[]
}

export const esDueno = (p: ConPermisos | null | undefined): boolean => p?.rol === 'dueno'

export const tienePermiso = (p: ConPermisos | null | undefined, permiso: Permiso): boolean =>
  !!p && (p.rol === 'dueno' || p.permisos.includes(permiso))

// Nombre corto para mostrar: la plantilla si coincide exacto, si no "Personalizado".
export function resumenPermisos(p: ConPermisos): string {
  if (p.rol === 'dueno') return 'Dueño'
  const actuales = [...p.permisos].sort().join(',')
  for (const plantilla of Object.values(PLANTILLAS)) {
    if ([...plantilla.permisos].sort().join(',') === actuales) return plantilla.titulo
  }
  return p.permisos.length === 0 ? 'Sin permisos' : 'Personalizado'
}
