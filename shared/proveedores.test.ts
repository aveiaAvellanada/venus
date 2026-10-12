import { enlaceWhatsApp } from './proveedores'

describe('enlaceWhatsApp', () => {
  it('celular de 10 dígitos lleva +57; con indicativo queda igual; con mensaje lo codifica', () => {
    expect(enlaceWhatsApp('315 123 4567')).toBe('https://wa.me/573151234567')
    expect(enlaceWhatsApp('+57 300-987-6543', 'Hola, ¿cómo va?')).toBe(
      'https://wa.me/573009876543?text=Hola%2C%20%C2%BFc%C3%B3mo%20va%3F')
  })
  it('sin teléfono o sin dígitos no hay enlace', () => {
    expect(enlaceWhatsApp(null)).toBe('')
    expect(enlaceWhatsApp('sin número')).toBe('')
  })
})
