import { createClient } from 'jsr:@supabase/supabase-js@2'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Réplica de la regla pura testeada en lib/cajaScheduler.ts (runtime Deno separado).
type Accion = 'abrir' | 'cerrar_blando' | 'nada'
const hhmm = (t: string) => t.slice(0, 5)
function decidirAccionCaja(
  cfg: { modo_automatico: boolean; hora_apertura: string | null; hora_cierre: string | null },
  ahora: string,
  caja: { estado: string } | null,
): Accion {
  if (!cfg.modo_automatico || !cfg.hora_apertura || !cfg.hora_cierre) return 'nada'
  const a = hhmm(ahora), ap = hhmm(cfg.hora_apertura), ci = hhmm(cfg.hora_cierre)
  if (a >= ci) return caja?.estado === 'abierta' ? 'cerrar_blando' : 'nada'
  if (a >= ap) return caja ? 'nada' : 'abrir'
  return 'nada'
}

Deno.serve(async () => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, key)

    const ahoraBogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const fecha = ahoraBogota.toLocaleDateString('en-CA') // YYYY-MM-DD
    const horaHHMM = ahoraBogota.toTimeString().slice(0, 5) // HH:MM

    const { data: cfg } = await admin.from('caja_config').select('*').limit(1).single()
    if (!cfg) return json({ skipped: 'sin_config' })

    const { data: caja } = await admin.from('cierres_caja').select('*').eq('fecha', fecha).maybeSingle()
    const accion = decidirAccionCaja(cfg, horaHHMM, caja)

    if (accion === 'abrir') {
      const { error } = await admin.from('cierres_caja').insert({
        fecha, estado: 'abierta', modo: 'automatico', apertura_at: new Date().toISOString(),
        total_ventas: 0, total_general: 0, total_efectivo: 0, total_nequi: 0, total_daviplata: 0,
      })
      if (error) throw error
      return json({ accion: 'abierta', fecha })
    }

    if (accion === 'cerrar_blando') {
      const { data: r } = await admin.rpc('obtener_resumen_dia', { p_fecha: fecha })
      const res = (r ?? {}) as Record<string, number>
      const { error } = await admin.from('cierres_caja').update({
        estado: 'cerrada', cierre_at: new Date().toISOString(),
        total_ventas: Number(res.total_ventas ?? 0), total_general: Number(res.total_general ?? 0),
        total_efectivo: Number(res.total_efectivo ?? 0), total_nequi: Number(res.total_nequi ?? 0),
        total_daviplata: Number(res.total_daviplata ?? 0),
        efectivo_contado: null, diferencia: null, diferencia_nota: null,
      }).eq('id', caja!.id)
      if (error) throw error

      // Dispara el correo del reporte (idempotente por reporte_envios). Fire-and-forget.
      fetch(`${url}/functions/v1/enviar-reporte-diario`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha }),
      }).catch((e) => console.warn('reporte no disparado:', e))

      return json({ accion: 'cerrada_blando', fecha })
    }

    return json({ accion: 'nada', fecha, hora: horaHHMM })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
