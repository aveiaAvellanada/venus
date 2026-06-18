export function construirLinkWhatsapp(telefono: string | null, mensaje: string): string {
  const base = telefono ? `https://wa.me/${telefono}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(mensaje)}`
}
