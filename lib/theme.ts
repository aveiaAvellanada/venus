// Tokens del rediseño Venus — fuente única de verdad visual.
// Valores de redisign-visual.md §1–§5 (colores: docs/rediseno-productos/README.md §1).
// No usar hex sueltos fuera de aquí.

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
  // Superficie oscura fija en ambos temas (hero, barra "Agregar al carrito",
  // píldoras "Ir al carrito" / "Mostrar artículos") y lo que va encima.
  superficieOscura: string
  sobreOscura: string
  sobreOscuraSuave: string
  veloOscura: string
  sombra: string
  gradienteHero: [string, string]
  sombraFab: string
}

// Paleta monocroma (docs/rediseno-productos/README.md §1): negros, grises y
// blancos. Los colores de producto (colorAHex) son datos, no tema.
export const paletaClara: Paleta = {
  primario: '#111111',
  primarioPress: '#000000',
  primarioSoft: '#F0F0F1',
  sobrePrimario: '#FFFFFF',
  acento: '#6B6B72',
  acentoSoft: '#EDEDEF',
  fondo: '#FFFFFF',
  superficie: '#F6F6F7',
  superficie2: '#EDEDEF',
  borde: '#E4E4E7',
  bordeFuerte: '#CFCFD4',
  texto: '#0E0E10',
  texto2: '#4B4B52',
  texto3: '#6B6B72',
  textoDeshabilitado: '#A1A1A8',
  exito: '#3F3F46',
  exitoSoft: '#EDEDEF',
  exitoTexto: '#27272A',
  peligro: '#18181B',
  peligroSoft: '#E4E4E7',
  peligroTexto: '#18181B',
  advertencia: '#D97706',
  advertenciaSoft: '#FEF3C7',
  advertenciaTexto: '#92400E',
  overlay: 'rgba(14,14,16,0.5)',
  superficieOscura: '#1F1F22',
  sobreOscura: '#FFFFFF',
  sobreOscuraSuave: 'rgba(255,255,255,0.7)',
  veloOscura: 'rgba(255,255,255,0.18)',
  sombra: '#0E0E10',
  gradienteHero: ['#1F1F22', '#111111'],
  sombraFab: 'rgba(14,14,16,0.32)',
}

export const paletaOscura: Paleta = {
  primario: '#F4F4F5',
  primarioPress: '#FFFFFF',
  primarioSoft: '#2A2A2E',
  sobrePrimario: '#0E0E10',
  acento: '#A1A1A8',
  acentoSoft: '#232326',
  fondo: '#0E0E10',
  superficie: '#151517',
  superficie2: '#202023',
  borde: '#2D2D31',
  bordeFuerte: '#3A3A40',
  texto: '#F4F4F5',
  texto2: '#B4B4BA',
  texto3: '#8A8A91',
  textoDeshabilitado: '#5C5C63',
  exito: '#C4C4CA',
  exitoSoft: '#1F1F22',
  exitoTexto: '#D4D4D8',
  peligro: '#F4F4F5',
  peligroSoft: '#2A2A2E',
  peligroTexto: '#F4F4F5',
  advertencia: '#F2A93B',
  advertenciaSoft: '#3A2A10',
  advertenciaTexto: '#F7C87E',
  overlay: 'rgba(0,0,0,0.6)',
  superficieOscura: '#2A2A2E',
  sobreOscura: '#FFFFFF',
  sobreOscuraSuave: 'rgba(255,255,255,0.7)',
  veloOscura: 'rgba(255,255,255,0.14)',
  sombra: '#000000',
  gradienteHero: ['#2A2A2E', '#1F1F22'],
  sombraFab: 'rgba(0,0,0,0.5)',
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
