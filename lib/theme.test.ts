import { paletaClara, paletaOscura, tipografia, espacio, radio, motion, fuentes } from './theme'

const esHex = (v: string) => /^#[0-9A-F]{6}$/i.test(v)

describe('tokens de tema', () => {
  it('ambas paletas tienen exactamente las mismas claves', () => {
    expect(Object.keys(paletaOscura).sort()).toEqual(Object.keys(paletaClara).sort())
  })

  it('los colores son hex válidos (excepto overlay y gradiente)', () => {
    for (const p of [paletaClara, paletaOscura]) {
      for (const [k, v] of Object.entries(p)) {
        if (k === 'overlay' || k === 'gradienteHero' || k === 'sombraFab') continue
        expect({ [k]: esHex(v as string) }).toEqual({ [k]: true })
      }
    }
  })

  it('valores canónicos de la spec §1', () => {
    expect(paletaClara.primario).toBe('#1E66F5')
    expect(paletaClara.superficie).toBe('#F6F8FC')
    expect(paletaClara.texto).toBe('#0B1220')
    expect(paletaOscura.primario).toBe('#4C82F7')
    expect(paletaOscura.fondo).toBe('#0B1220')
    expect(paletaOscura.superficie).toBe('#121C30')
  })

  it('tipografía: escala y familias por peso (sin fontWeight)', () => {
    expect(tipografia.displayXL.fontSize).toBe(40)
    expect(tipografia.micro.fontSize).toBe(11)
    expect(tipografia.h2.fontFamily).toBe(fuentes.negrita)
    for (const t of Object.values(tipografia)) {
      expect((t as { fontWeight?: string }).fontWeight).toBeUndefined()
    }
  })

  it('espaciado base 4, radios y motion de la spec §3/§5', () => {
    expect(Object.values(espacio)).toEqual([4, 8, 12, 16, 20, 24, 32])
    expect(radio).toEqual({ sm: 12, md: 16, lg: 20, xl: 28, full: 999 })
    expect(motion.springPress).toEqual({ damping: 18, stiffness: 320 })
    expect(motion.escalaPress).toBe(0.97)
  })
})
