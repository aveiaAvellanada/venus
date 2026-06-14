export interface UsuarioPicker {
  nombre: string
  email: string
}

// Lista fija para el picker pre-login (RLS bloquea leer public.users sin sesión).
// Agregar un usuario = agregarlo aquí + crearlo en Supabase Auth.
export const USUARIOS: UsuarioPicker[] = [
  { nombre: 'Andrés Artunduaga', email: 'venusdelcaqueta@gmail.com' },
  { nombre: 'Camilo Artunduaga', email: 'artuneleven1@gmail.com' },
  { nombre: 'Beatriz Bueno',     email: 'beatrizbueno1979@gmail.com' },
]
