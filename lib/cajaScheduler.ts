export type AccionCaja = 'abrir' | 'cerrar_blando' | 'nada'

export interface CajaConfigDec {
  modo_automatico: boolean
  hora_apertura: string | null
  hora_cierre: string | null
}

export interface CajaHoyDec {
  estado: 'abierta' | 'cerrada'
}

export type DiaSemana = 'domingo' | 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado'

// Indexado igual que Date.getDay(): 0=domingo .. 6=sábado.
export const DIAS_SEMANA: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

export interface HorarioDia {
  apertura: string | null
  cierre: string | null
}

export type HorarioSemanal = Partial<Record<DiaSemana, HorarioDia>>

export function diaSemanaDeFecha(fecha: Date): DiaSemana {
  return DIAS_SEMANA[fecha.getDay()]
}

export function horarioDelDia(horario: HorarioSemanal, dia: DiaSemana): HorarioDia {
  return horario[dia] ?? { apertura: null, cierre: null }
}

const hhmm = (t: string) => t.slice(0, 5)

export function decidirAccionCaja(
  cfg: CajaConfigDec,
  ahoraHHMM: string,
  cajaHoy: CajaHoyDec | null,
): AccionCaja {
  if (!cfg.modo_automatico || !cfg.hora_apertura || !cfg.hora_cierre) return 'nada'
  const ahora = hhmm(ahoraHHMM)
  const apertura = hhmm(cfg.hora_apertura)
  const cierre = hhmm(cfg.hora_cierre)

  if (ahora >= cierre) {
    return cajaHoy?.estado === 'abierta' ? 'cerrar_blando' : 'nada'
  }
  if (ahora >= apertura) {
    return cajaHoy ? 'nada' : 'abrir'
  }
  return 'nada'
}
