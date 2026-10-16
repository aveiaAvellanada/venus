import { paletaClara, paletaOscura, tipografia, espacio, radio, motion, fuentes } from './theme'

const esHex = (v: string) => /^#[0-9A-F]{6}$/i.test(v)

describe('tokens de tema', () => {
  it('ambas paletas tienen exactamente las mismas claves', () => {
    expect(Object.keys(paletaOscura).sort()).toEqual(Object.keys(paletaClara).sort())
  })

  const conTransparencia = ['overlay', 'sobreOscuraSuave', 'veloOscura', 'gradienteHero', 'sombraFab']

  it('los colores son hex válidos (excepto los que llevan transparencia y el gradiente)', () => {
    for (const p of [paletaClara, paletaOscura]) {
      for (const [k, v] of Object.entries(p)) {
        if (conTransparencia.includes(k)) continue
        expect({ [k]: esHex(v as string) }).toEqual({ [k]: true })
      }
    }
  })

  it('valores canónicos de la paleta monocroma (rediseno-productos §1)', () => {
    expect(paletaClara.primario).toBe('#111111')
    expect(paletaClara.superficie).toBe('#F6F6F7')
    expect(paletaClara.texto).toBe('#0E0E10')
    expect(paletaClara.peligro).toBe('#18181B')
    expect(paletaOscura.primario).toBe('#F4F4F5')
    expect(paletaOscura.sobrePrimario).toBe('#0E0E10')
    expect(paletaOscura.fondo).toBe('#0E0E10')
    expect(paletaOscura.superficie).toBe('#151517')
  })

  it('sin azules: gradiente y sombra en escala neutra (R = G = B)', () => {
    const neutro = (hex: string) => {
      const n = parseInt(hex.slice(1), 16)
      const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255]
      return Math.max(r, g, b) - Math.min(r, g, b) <= 8
    }
    for (const p of [paletaClara, paletaOscura]) {
      for (const k of ['primario', 'primarioSoft', 'fondo', 'superficie', 'texto', 'exito', 'peligro'] as const) {
        expect({ [k]: neutro(p[k]) }).toEqual({ [k]: true })
      }
      for (const c of p.gradienteHero) expect(neutro(c)).toBe(true)
    }
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
