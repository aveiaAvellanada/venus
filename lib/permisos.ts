export type Rol = 'dueno' | 'empleado'

export interface Modulo {
  id: string
  titulo: string
  icono: string
  roles: Rol[]
}

export const MODULOS: Modulo[] = [
  { id: 'ventas',             titulo: 'Ventas',             icono: '🛒', roles: ['dueno', 'empleado'] },
  { id: 'inventario-calzado', titulo: 'Inventario calzado', icono: '👟', roles: ['dueno', 'empleado'] },
  { id: 'inventario-varios',  titulo: 'Productos varios',   icono: '📦', roles: ['dueno', 'empleado'] },
  { id: 'recibir-mercancia',  titulo: 'Recibir mercancía',  icono: '📥', roles: ['dueno', 'empleado'] },
  { id: 'cierre-caja',        titulo: 'Cierre de caja',     icono: '🧾', roles: ['dueno', 'empleado'] },
  { id: 'proveedores',        titulo: 'Proveedores',        icono: '🚚', roles: ['dueno'] },
  { id: 'gestion-empleado',   titulo: 'Empleado',           icono: '👤', roles: ['dueno'] },
  { id: 'reportes',           titulo: 'Reportes',           icono: '📊', roles: ['dueno'] },
  { id: 'analisis-ia',        titulo: 'Análisis IA',        icono: '🤖', roles: ['dueno'] },
  { id: 'gastos-fijos',       titulo: 'Gastos fijos',       icono: '📌', roles: ['dueno'] },
  { id: 'gastos-variables',   titulo: 'Gastos variables',   icono: '💸', roles: ['dueno'] },
  { id: 'balance',            titulo: 'Balance',            icono: '⚖️', roles: ['dueno'] },
  { id: 'carga-inicial',      titulo: 'Carga inicial',      icono: '📷', roles: ['dueno'] },
]

export const modulosPara = (rol: Rol): Modulo[] =>
  MODULOS.filter(m => m.roles.includes(rol))

export const puedeAcceder = (rol: Rol, id: string): boolean =>
  MODULOS.find(m => m.id === id)?.roles.includes(rol) ?? false
