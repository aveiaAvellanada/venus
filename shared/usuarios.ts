// Ya no hay personas fijas en el código: el dueño crea cada cuenta con un
// usuario y un PIN. Supabase Auth necesita un correo, así que se deriva del
// usuario con un dominio reservado (.invalid nunca recibe correo).
export const DOMINIO_USUARIOS = 'venus.invalid'

export const normalizarUsuario = (usuario: string): string => usuario.trim().toLowerCase()

// Mismo formato que el CHECK users_usuario_formato y que crear_empleado.
export const usuarioValido = (usuario: string): boolean =>
  /^[a-z0-9][a-z0-9._-]{2,19}$/.test(normalizarUsuario(usuario))

export const correoDeUsuario = (usuario: string): string =>
  `${normalizarUsuario(usuario)}@${DOMINIO_USUARIOS}`

export const pinValido = (pin: string): boolean => /^[0-9]{6}$/.test(pin)

// Repetido (000000), en orden (123456, 987654) o con patrón (121212, 123123):
// lo primero que alguien prueba. Debe coincidir con private.validar_pin.
export const pinDebil = (pin: string): boolean =>
  /^(\d{2})\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin) ||
  '0123456789'.includes(pin) || '9876543210'.includes(pin)

export const MENSAJE_PIN_DEBIL = 'Ese PIN es muy fácil de adivinar (repetido o en orden). Elige otro.'
