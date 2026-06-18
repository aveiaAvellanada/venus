jest.mock('./supabase', () => ({ supabase: {} }))

import { construirLinkWhatsapp } from './reporteDiario'

describe('construirLinkWhatsapp', () => {
  it('sin teléfono usa wa.me genérico con el texto codificado', () => {
    expect(construirLinkWhatsapp(null, 'Hola mundo')).toBe('https://wa.me/?text=Hola%20mundo')
  })
  it('con teléfono lo incluye en la ruta', () => {
    expect(construirLinkWhatsapp('573001234567', 'Hola')).toBe('https://wa.me/573001234567?text=Hola')
  })
  it('codifica saltos de línea', () => {
    expect(construirLinkWhatsapp(null, 'a\nb')).toBe('https://wa.me/?text=a%0Ab')
  })
})
