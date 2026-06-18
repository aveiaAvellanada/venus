import { createClient } from 'jsr:@supabase/supabase-js@2'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const hoyBogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
      .toISOString().slice(0, 10)
    const fecha: string = (body.fecha as string) ?? hoyBogota

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: cfg } = await admin.from('reporte_config').select('*').limit(1).single()
    if (!cfg?.correo_on) return json({ skipped: 'correo_off' })
    if (!cfg.correo_destino) return json({ skipped: 'sin_destino' })

    const { data: prev } = await admin
      .from('reporte_envios').select('id')
      .eq('fecha', fecha).eq('canal', 'correo').eq('ok', true).maybeSingle()
    if (prev) return json({ skipped: 'ya_enviado' })

    const { data: rep, error: repErr } = await admin.rpc('obtener_reporte_diario', { p_fecha: fecha })
    if (repErr) throw repErr
    const mensaje = (rep as { mensaje: string }).mensaje

    const apiKey = Deno.env.get('RESEND_API_KEY')
    let ok = true
    let detalle = 'dry-run'
    if (apiKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Venus <onboarding@resend.dev>',
          to: [cfg.correo_destino],
          subject: `Venus — Resumen del día ${fecha}`,
          text: mensaje,
        }),
      })
      ok = res.ok
      detalle = ok ? 'enviado' : `error ${res.status}`
    }
    await admin.from('reporte_envios').insert({ fecha, canal: 'correo', ok, detalle })
    return json({ ok, detalle, fecha })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
