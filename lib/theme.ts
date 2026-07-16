// Tokens del rediseño Venus — fuente única de verdad visual.
// Valores exactos de redisign-visual.md §1–§5. No usar hex sueltos fuera de aquí.

export type ModoTema = 'claro' | 'oscuro' | 'sistema'

export interface Paleta {
  primario: string
  primarioPress: string
  primarioSoft: string
  sobrePrimario: string
  acento: string
  acentoSoft: string
  fondo: string
  superficie: string
  superficie2: string
  borde: string
  bordeFuerte: string
  texto: string
  texto2: string
  texto3: string
  textoDeshabilitado: string
  exito: string
  exitoSoft: string
  exitoTexto: string
  peligro: string
  peligroSoft: string
  peligroTexto: string
  advertencia: string
  advertenciaSoft: string
  advertenciaTexto: string
  overlay: string
  gradienteHero: [string, string]
  sombraFab: string
}

export const paletaClara: Paleta = {
  primario: '#1E66F5',
  primarioPress: '#1747C8',
  primarioSoft: '#EBF1FE',
  sobrePrimario: '#FFFFFF',
  acento: '#F59E0B',
  acentoSoft: '#FEF3C7',
  fondo: '#FFFFFF',
  superficie: '#F6F8FC',
  superficie2: '#EEF2F9',
  borde: '#E2E8F0',
  bordeFuerte: '#CBD5E1',
  texto: '#0B1220',
  texto2: '#475569',
  texto3: '#64748B',
  textoDeshabilitado: '#94A3B8',
  exito: '#16A34A',
  exitoSoft: '#E7F6EC',
  exitoTexto: '#15803D',
  peligro: '#DC2626',
  peligroSoft: '#FDECEC',
  peligroTexto: '#B91C1C',
  advertencia: '#D97706',
  advertenciaSoft: '#FEF3C7',
  advertenciaTexto: '#92400E',
  overlay: 'rgba(11,18,32,0.5)',
  gradienteHero: ['#1E66F5', '#1747C8'],
  sombraFab: 'rgba(30,102,245,0.38)',
}

export const paletaOscura: Paleta = {
  primario: '#4C82F7',
  primarioPress: '#6D9AF9',
  primarioSoft: '#16264A',
  sobrePrimario: '#FFFFFF',
  acento: '#F5B840',
  acentoSoft: '#3A2A10',
  fondo: '#0B1220',
  superficie: '#121C30',
  superficie2: '#1A2740',
  borde: '#26334D',
  bordeFuerte: '#33425F',
  texto: '#F2F6FC',
  texto2: '#A9B4C6',
  texto3: '#8291A9',
  textoDeshabilitado: '#5B6A83',
  exito: '#3FBF6F',
  exitoSoft: '#0F2E1C',
  exitoTexto: '#7BDCA0',
  peligro: '#F07171',
  peligroSoft: '#3A1520',
  peligroTexto: '#F5A3A3',
  advertencia: '#F2A93B',
  advertenciaSoft: '#3A2A10',
  advertenciaTexto: '#F7C87E',
  overlay: 'rgba(0,0,0,0.6)',
  gradienteHero: ['#1D3A75', '#142850'],
  sombraFab: 'rgba(76,130,247,0.5)',
}

// Con fuentes custom, cada peso es una familia (Android ignora fontWeight).
export const fuentes = {
  regular: 'PlusJakartaSans_400Regular',
  media: 'PlusJakartaSans_500Medium',
  semi: 'PlusJakartaSans_600SemiBold',
  negrita: 'PlusJakartaSans_700Bold',
  extra: 'PlusJakartaSans_800ExtraBold',
} as const

export const tipografia = {
  displayXL: { fontSize: 40, lineHeight: 48, fontFamily: fuentes.extra, letterSpacing: -0.8 },
  display: { fontSize: 32, lineHeight: 38, fontFamily: fuentes.extra, letterSpacing: -0.5 },
  h1: { fontSize: 28, lineHeight: 34, fontFamily: fuentes.extra, letterSpacing: -0.4 },
  h2: { fontSize: 22, lineHeight: 28, fontFamily: fuentes.negrita },
  h3: { fontSize: 18, lineHeight: 24, fontFamily: fuentes.negrita },
  cuerpoLg: { fontSize: 17, lineHeight: 24, fontFamily: fuentes.semi },
  cuerpo: { fontSize: 15, lineHeight: 22, fontFamily: fuentes.media },
  etiqueta: { fontSize: 13, lineHeight: 18, fontFamily: fuentes.semi },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fuentes.semi },
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fuentes.negrita,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
} as const

// Dinero SIEMPRE tabular: <Text style={[tipografia.h3, tabular]}>
export const tabular = { fontVariant: ['tabular-nums'] as ['tabular-nums'] }

export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 } as const

export const radio = { sm: 12, md: 16, lg: 20, xl: 28, full: 999 } as const

export const motion = {
  rapido: 120,
  base: 200,
  lento: 300,
  sheet: 350,
  easeEnter: [0.22, 1, 0.36, 1] as const,
  easeMove: [0.25, 1, 0.5, 1] as const,
  easeSheet: [0.32, 0.72, 0, 1] as const,
  springPress: { damping: 18, stiffness: 320 },
  springLayout: { damping: 22, stiffness: 260 },
  escalaPress: 0.97,
} as const
