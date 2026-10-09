import { PLANTILLAS, type Permiso, type Rol } from './permisos'

// Solo para tests: perfiles armados como los crea el dueño. 'administrativo' y
// 'operativo' son empleados con esas plantillas (antes: roles 'admin'/'empleado').
export type TipoPerfilPrueba = 'dueno' | 'administrativo' | 'operativo'

export function perfilPrueba(tipo: TipoPerfilPrueba, nombre = 'Prueba Uno', permisos?: Permiso[]) {
  const rol: Rol = tipo === 'dueno' ? 'dueno' : 'empleado'
  return {
    id: `id-${tipo}`,
    nombre,
    usuario: tipo,
    rol,
    permisos: permisos ?? (tipo === 'dueno' ? [] : [...PLANTILLAS[tipo].permisos]),
    activo: true,
    debeCambiarPin: false,
  }
}
