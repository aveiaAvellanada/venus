// Enlace para escribirle al proveedor por WhatsApp (app del celular y panel web).
// Un número de 10 dígitos se toma como celular colombiano (+57).
export function enlaceWhatsApp(telefono: string | null | undefined, mensaje?: string): string {
  if (!telefono) return ''
  const digitos = telefono.replace(/\D/g, '')
  if (!digitos) return ''
  const numero = digitos.length === 10 ? `57${digitos}` : digitos
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`
}
