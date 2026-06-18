# Reportes Automáticos (M13 v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir M13 v1: al cerrar la caja, enviar un resumen del día por correo (automático, Edge Function + Resend, con dry-run sin key) y por WhatsApp asistido (link pre-armado), con configuración solo-dueño y deduplicación.

**Architecture:** Una migración con 2 tablas (`reporte_config` solo-dueño, `reporte_envios` log con dedupe) + un RPC `obtener_reporte_diario(p_fecha)` que arma datos y `mensaje` formateado. Una Edge Function `enviar-reporte-diario` (Deno, service role) que envía el correo y registra. En la app: `lib/reporteDiario.ts` (pura `construirLinkWhatsapp` + acceso a datos), un hook al cerrar caja, y una pantalla de config dueño-only.

**Tech Stack:** Supabase (PostgreSQL 17, RPC plpgsql, Edge Functions Deno), Resend (correo), React Native + Expo SDK 54, TypeScript estricto, jest.

**Spec:** `docs/superpowers/specs/2026-06-17-reportes-automaticos-design.md`
**Rama:** `feat/m13-reportes-automaticos` (creada; spec commiteado). **No mergear a `main` sin aprobación humana.**

## Global Constraints

- TypeScript estricto: `npx tsc --noEmit` → **0 errores**. Todo en español en la UI.
- COP formateado. En SQL: helper `private.fmt_cop(numeric)`. En la app: `'$' + Math.round(n).toLocaleString('es-CO')`.
- Estados de venta contados: `('completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total')`. Fechas en `America/Bogota`.
- `reporte_config`/`reporte_envios`: **solo dueño** (RLS `private.is_owner()`); `reporte_envios` escritura solo `service_role`. RPC `obtener_reporte_diario`: `SECURITY DEFINER`, `grant authenticated`, sin gate de rol.
- Dedupe: índice único parcial `(fecha, canal) where ok` (los fallos `ok=false` se pueden reintentar; solo un envío exitoso por día/canal).
- Edge Function con verificación de JWT activa; usa `SUPABASE_SERVICE_ROLE_KEY`; envía solo si `RESEND_API_KEY` está, si no **dry-run**.
- Migraciones: aplicar con MCP `apply_migration`; tras aplicar, **renombrar el archivo local a la versión asignada** y regenerar `lib/database.types.ts`.
- Smoke contra BD real → fechas en año aislado (2052) y/o aserciones por pertenencia (lección M11).
- Un commit por tarea; mensajes terminan con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/<ts>_m13_reportes_automaticos.sql` (nuevo) | 2 tablas + `fmt_cop` + RPC `obtener_reporte_diario` |
| `supabase/tests/smoke_test_reporte_diario.sql` (gitignored) | Smoke en transacción con rollback |
| `supabase/functions/enviar-reporte-diario/index.ts` (nuevo) | Edge Function de envío de correo |
| `lib/database.types.ts` (regenerar vía MCP) | Tipos generados |
| `lib/reporteDiario.ts` (nuevo) | Pura `construirLinkWhatsapp` + acceso a datos |
| `lib/reporteDiario.test.ts` (nuevo) | Tests jest de la pura |
| `app/(app)/reportes/config.tsx` (nuevo) | Pantalla de configuración (solo dueño) |
| `app/(app)/reportes/_layout.tsx` (modificar) | Añadir `<Stack.Screen name="config">` |
| `app/(app)/reportes/index.tsx` (modificar) | Botón a config (solo dueño) |
| `app/(app)/caja/cierre.tsx` (modificar) | Hook post-cierre: disparar correo + botón WhatsApp |
| `lib/reporteDiario_ui.test.tsx` (nuevo) | Tests de UI (config + hook de cierre) |

---

## Task 1: Migración (tablas + fmt_cop + RPC obtener_reporte_diario)

**Files:** Create `supabase/migrations/<ts>_m13_reportes_automaticos.sql` (`<ts>` con `date +%Y%m%d%H%M%S`)

**Interfaces:**
- Produces: tablas `public.reporte_config`, `public.reporte_envios`; `private.fmt_cop(numeric)`; RPC `public.obtener_reporte_diario(p_fecha date) returns json`.

- [ ] **Step 1: Confirmar columnas (MCP execute_sql)** — verificar, ajustar si difiere:
```sql
select table_name, column_name from information_schema.columns
where table_schema='public' and table_name in ('cierres_caja','productos_calzado','venta_items','metodos_pago_venta','ventas','devoluciones')
  and column_name in ('fecha','diferencia','estado','stock_actual','stock_minimo','descripcion','talla','activo','producto_calzado_id','descripcion_snapshot','cantidad','metodo','monto','venta_id','created_at','monto_devuelto','monto_cobrado','metodo_reembolso','metodo_cobro')
order by table_name, column_name;
```
Esperado: cierres_caja(fecha,diferencia,estado); productos_calzado(stock_actual,stock_minimo,descripcion,talla,activo); venta_items(producto_calzado_id,descripcion_snapshot,cantidad); metodos_pago_venta(metodo,monto,venta_id); ventas(estado,created_at); devoluciones(monto_devuelto,monto_cobrado,metodo_reembolso,metodo_cobro,venta_id). Confirmar también que existe `private.is_owner()` y el trigger de auditoría `private.set_audit_fields()`.

- [ ] **Step 2: Escribir la migración**, contenido exacto:

```sql
-- M13 Reportes Automáticos: config + log de envíos + RPC del reporte diario. v1.

-- Helper de formato COP (deterministe: ',' es separador de grupo literal en to_char)
create or replace function private.fmt_cop(p numeric)
returns text language sql immutable set search_path = '' as $$
  select '$' || replace(to_char(round(coalesce(p,0)), 'FM999,999,999'), ',', '.')
$$;

-- Config (singleton, solo dueño)
create table if not exists public.reporte_config (
  id            uuid primary key default gen_random_uuid(),
  whatsapp_on   boolean not null default true,
  correo_on     boolean not null default false,
  correo_destino text,
  hora_envio    time,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.users(id) on delete set null
);

-- Log de envíos (dedupe)
create table if not exists public.reporte_envios (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null,
  canal       text not null check (canal in ('correo','whatsapp')),
  enviado_at  timestamptz not null default now(),
  ok          boolean not null,
  detalle     text
);
-- Solo un envío EXITOSO por (fecha, canal); los fallos se pueden reintentar
create unique index if not exists reporte_envios_unico_ok on public.reporte_envios (fecha, canal) where ok;

-- Auditoría updated_by/updated_at en config
drop trigger if exists trg_reporte_config_audit on public.reporte_config;
create trigger trg_reporte_config_audit before insert or update on public.reporte_config
  for each row execute function private.set_audit_fields();
drop trigger if exists trg_reporte_config_updated_at on public.reporte_config;
create trigger trg_reporte_config_updated_at before update on public.reporte_config
  for each row execute function private.set_updated_at();

-- RLS
alter table public.reporte_config enable row level security;
alter table public.reporte_envios enable row level security;

create policy reporte_config_sel on public.reporte_config for select to authenticated using (private.is_owner());
create policy reporte_config_upd on public.reporte_config for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy reporte_envios_sel on public.reporte_envios for select to authenticated using (private.is_owner());

revoke insert, update, delete on public.reporte_config from authenticated;
revoke insert, update, delete on public.reporte_envios from authenticated;
grant select on public.reporte_config to authenticated;
grant update on public.reporte_config to authenticated;
grant select on public.reporte_envios to authenticated;
grant select, insert, update, delete on public.reporte_config to service_role;
grant select, insert, update, delete on public.reporte_envios to service_role;

-- Sembrar la fila única de config
insert into public.reporte_config (whatsapp_on, correo_on) values (true, false);

-- RPC del reporte diario
create or replace function public.obtener_reporte_diario(p_fecha date)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
  v_ef numeric := 0; v_ne numeric := 0; v_da numeric := 0; v_num int := 0; v_total numeric;
  v_mas_vendido text; v_stock text[]; v_stock_txt text;
  v_dif numeric; v_cuadro boolean; v_caja_existe boolean;
  v_caja_linea text; v_mensaje text;
begin
  -- Totales del día (brutos por método)
  select coalesce(sum(case when m.metodo='efectivo' then m.monto else 0 end),0),
         coalesce(sum(case when m.metodo='nequi' then m.monto else 0 end),0),
         coalesce(sum(case when m.metodo='daviplata' then m.monto else 0 end),0)
  into v_ef, v_ne, v_da
  from public.metodos_pago_venta m join public.ventas v on v.id=m.venta_id
  where v.estado=any(v_estados) and (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  -- Netear devoluciones por método (por fecha de venta)
  select v_ef - coalesce(sum(case when metodo_reembolso='efectivo' then monto_devuelto else 0 end),0) + coalesce(sum(case when metodo_cobro='efectivo' then monto_cobrado else 0 end),0),
         v_ne - coalesce(sum(case when metodo_reembolso='nequi' then monto_devuelto else 0 end),0) + coalesce(sum(case when metodo_cobro='nequi' then monto_cobrado else 0 end),0),
         v_da - coalesce(sum(case when metodo_reembolso='daviplata' then monto_devuelto else 0 end),0) + coalesce(sum(case when metodo_cobro='daviplata' then monto_cobrado else 0 end),0)
  into v_ef, v_ne, v_da
  from public.devoluciones d join public.ventas v on v.id=d.venta_id
  where (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  v_total := v_ef + v_ne + v_da;

  select count(*) into v_num from public.ventas v
  where v.estado=any(v_estados) and (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  -- Más vendido (por unidades) del día
  select vi.descripcion_snapshot into v_mas_vendido
  from public.venta_items vi join public.ventas v on v.id=vi.venta_id
  where v.estado=any(v_estados) and (v.created_at at time zone 'America/Bogota')::date = p_fecha
  group by vi.descripcion_snapshot order by sum(vi.cantidad) desc limit 1;

  -- Stock bajo (calzado activo), máx 5 para el mensaje
  select array_agg(t.txt) into v_stock from (
    select pc.descripcion || coalesce(' · talla ' || pc.talla, '') as txt
    from public.productos_calzado pc
    where pc.activo = true and pc.stock_actual <= pc.stock_minimo
    order by pc.descripcion limit 5
  ) t;
  v_stock := coalesce(v_stock, array[]::text[]);
  v_stock_txt := case when array_length(v_stock,1) is null then 'ninguno' else array_to_string(v_stock, ', ') end;

  -- Caja del día
  select (c.diferencia = 0), c.diferencia, true into v_cuadro, v_dif, v_caja_existe
  from public.cierres_caja c where c.fecha = p_fecha order by c.cierre_at desc nulls last limit 1;
  if v_caja_existe is null then
    v_caja_existe := false; v_caja_linea := '🔓 Caja sin cerrar';
  elsif v_cuadro then
    v_caja_linea := '✅ Caja cuadró';
  else
    v_caja_linea := '⚠️ Diferencia de ' || private.fmt_cop(v_dif);
  end if;

  v_mensaje :=
    '📊 Venus — Resumen del día' || E'\n' ||
    '📅 ' || to_char(p_fecha, 'YYYY-MM-DD') || E'\n\n' ||
    '💰 Total vendido: ' || private.fmt_cop(v_total) || E'\n' ||
    '🛍️ Ventas: ' || v_num || E'\n' ||
    '💵 Efectivo: ' || private.fmt_cop(v_ef) || E'\n' ||
    '📱 Nequi: ' || private.fmt_cop(v_ne) || E'\n' ||
    '📱 Daviplata: ' || private.fmt_cop(v_da) || E'\n\n' ||
    '👟 Más vendido: ' || coalesce(v_mas_vendido, 'ninguno') || E'\n' ||
    '⚠️ Stock bajo: ' || v_stock_txt || E'\n\n' ||
    v_caja_linea;

  return json_build_object(
    'fecha', to_char(p_fecha,'YYYY-MM-DD'),
    'total_vendido', v_total, 'num_ventas', v_num,
    'efectivo', v_ef, 'nequi', v_ne, 'daviplata', v_da,
    'mas_vendido', v_mas_vendido,
    'stock_bajo', to_json(v_stock),
    'caja_cuadro', case when v_caja_existe then v_cuadro else null end,
    'diferencia', case when v_caja_existe then v_dif else null end,
    'mensaje', v_mensaje
  );
end;
$$;

revoke all on function public.obtener_reporte_diario(date) from public;
grant execute on function public.obtener_reporte_diario(date) to authenticated;
```

- [ ] **Step 3: Commit** (solo la migración)
```bash
git add supabase/migrations/*_m13_reportes_automaticos.sql
git commit -m "feat(m13): migración — reporte_config + reporte_envios + RPC obtener_reporte_diario

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Smoke test SQL y correrlo vía MCP

**Files:** Create `supabase/tests/smoke_test_reporte_diario.sql` (gitignored)

- [ ] **Step 1: Escribir el smoke** — `begin; ... rollback;`. Embeber `private.fmt_cop` y el RPC `obtener_reporte_diario` (el RPC depende de las tablas reales solo para `cierres_caja`/`productos_calzado`, que ya existen; las tablas nuevas se crean en la TX para probar su RLS/unique). Helper `_smoke_assert`, `public._smoke_log`, centinela `REPORTE_DIARIO_OK_ROLLBACK`. **Fechas año 2052.** Escenarios:
  1. Crear las tablas `reporte_config`/`reporte_envios` + índice único parcial dentro de la TX (copia del DDL de Task 1) — o, más simple, NO recrearlas y asumir que Task 3 ya las aplicó; pero como Task 2 corre **antes** de aplicar, **incluir el DDL** de las tablas + RPC + fmt_cop al inicio de la TX.
  2. Setup: dueño + empleado. Producto P1 (`'Bota Smoke'`, talla 38, activo, stock_actual=0 stock_minimo=1 → stock bajo). Bajo claim empleado: venta 2052-05-10 (2× P1 @ 50000, efectivo 100000). Cierre de caja 2052-05-10 con `diferencia=0`.
  3. `obtener_reporte_diario('2052-05-10')`: `total_vendido=100000`, `num_ventas=1`, `efectivo=100000`, `mas_vendido='Bota Smoke'`, `stock_bajo` contiene 'Bota Smoke', `caja_cuadro=true`, `diferencia=0`; y `mensaje` contiene `'Total vendido: $100.000'` y `'✅ Caja cuadró'`.
  4. **fmt_cop:** `private.fmt_cop(1500000) = '$1.500.000'`, `private.fmt_cop(0) = '$0'`.
  5. **RLS:** bajo claim empleado, `select` a `reporte_config` devuelve 0 filas (owner-only); bajo claim dueño, 1 fila.
  6. **Dedupe:** insertar `reporte_envios(fecha,'correo',ok=true)` dos veces para 2052-05-10 ⇒ el segundo viola el índice único parcial (capturar excepción `unique`). Un `ok=false` adicional NO viola (parcial).
  Termina con `REPORTE_DIARIO_OK_ROLLBACK`.

  > AVISO: el seed de `reporte_config` en el DDL inserta una fila; el `select` RLS de empleado debe dar 0 y el de dueño 1. Para la prueba de dedupe insertar como superuser (la TX corre como tal salvo `set local role`).

- [ ] **Step 2: Correr vía MCP** `execute_sql`. Esperado: `REPORTE_DIARIO_OK_ROLLBACK` y pasos `OK`. No avanzar hasta verde.

---

## Task 3: Aplicar al remoto, regenerar tipos, commit

- [ ] **Step 1:** `apply_migration` (name `m13_reportes_automaticos`, cuerpo de la migración). Verificar:
```sql
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='obtener_reporte_diario') as rpc,
  (select count(*) from information_schema.tables where table_schema='public' and table_name in ('reporte_config','reporte_envios')) as tablas,
  (select count(*) from public.reporte_config) as filas_config;
```
Esperado `rpc=1, tablas=2, filas_config=1`. Anotar la versión asignada; **renombrar el archivo local a esa versión**.
- [ ] **Step 2:** `generate_typescript_types` → sobrescribir `lib/database.types.ts`. Confirmar `reporte_config`, `reporte_envios`, `obtener_reporte_diario`.
- [ ] **Step 3:** `npx tsc --noEmit` → 0.
- [ ] **Step 4: Commit**
```bash
git add lib/database.types.ts supabase/migrations/
git commit -m "feat(m13): aplicar tablas + RPC al remoto + regenerar tipos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `lib/reporteDiario.ts` — lógica pura (TDD)

**Files:** Create `lib/reporteDiario.ts`, `lib/reporteDiario.test.ts`

**Interfaces:**
- Produces: `construirLinkWhatsapp(telefono: string | null, mensaje: string): string`.

- [ ] **Step 1: Tests que fallan** — `lib/reporteDiario.test.ts`:
```ts
jest.mock('./supabase', () => ({ supabase: {} }))

import { construirLinkWhatsapp } from './reporteDiario'

describe('construirLinkWhatsapp', () => {
  it('sin teléfono usa wa.me genérico con el texto codificado', () => {
    expect(construirLinkWhatsapp(null, 'Hola mundo')).toBe('https://wa.me/?text=Hola%20mundo')
  })
  it('con teléfono lo incluye en la ruta', () => {
    expect(construirLinkWhatsapp('573001234567', 'Hola')).toBe('https://wa.me/573001234567?text=Hola')
  })
  it('codifica saltos de línea y emojis', () => {
    expect(construirLinkWhatsapp(null, 'a\nb')).toBe('https://wa.me/?text=a%0Ab')
  })
})
```

- [ ] **Step 2: Run** `npx jest lib/reporteDiario.test.ts` → FAIL.

- [ ] **Step 3: Implementar** `lib/reporteDiario.ts` (solo la pura por ahora):
```ts
export function construirLinkWhatsapp(telefono: string | null, mensaje: string): string {
  const base = telefono ? `https://wa.me/${telefono}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(mensaje)}`
}
```

- [ ] **Step 4: Run** → PASS (3 verdes). **Step 5: Commit**
```bash
git add lib/reporteDiario.ts lib/reporteDiario.test.ts
git commit -m "feat(m13): lógica pura (construirLinkWhatsapp) + tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `lib/reporteDiario.ts` — acceso a datos

**Files:** Modify `lib/reporteDiario.ts`

**Interfaces:**
- Consumes: RPC `obtener_reporte_diario`, tabla `reporte_config`, Edge Function `enviar-reporte-diario`.
- Produces: `obtenerReporteDiario(fecha)`, `obtenerReporteConfig()`, `guardarReporteConfig(cfg)`, `dispararReporteCorreo(fecha)`, tipos `ReporteDiario`, `ReporteConfig`.

- [ ] **Step 1:** Añadir a `lib/reporteDiario.ts`:
```ts
import { supabase } from './supabase'

export type ReporteDiario = {
  fecha: string
  total_vendido: number
  num_ventas: number
  efectivo: number
  nequi: number
  daviplata: number
  mas_vendido: string | null
  stock_bajo: string[]
  caja_cuadro: boolean | null
  diferencia: number | null
  mensaje: string
}

export type ReporteConfig = {
  whatsapp_on: boolean
  correo_on: boolean
  correo_destino: string | null
  hora_envio: string | null
}

export async function obtenerReporteDiario(fecha: string): Promise<ReporteDiario> {
  const { data, error } = await supabase.rpc('obtener_reporte_diario', { p_fecha: fecha })
  if (error) throw error
  return data as unknown as ReporteDiario
}

export async function obtenerReporteConfig(): Promise<ReporteConfig | null> {
  const { data, error } = await supabase
    .from('reporte_config')
    .select('whatsapp_on, correo_on, correo_destino, hora_envio')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function guardarReporteConfig(cfg: {
  whatsapp_on: boolean
  correo_on: boolean
  correo_destino: string | null
}): Promise<void> {
  // Singleton: actualiza la única fila existente
  const { data: row, error: selErr } = await supabase.from('reporte_config').select('id').limit(1).single()
  if (selErr) throw selErr
  const { error } = await supabase.from('reporte_config').update(cfg).eq('id', row.id)
  if (error) throw error
}

export async function dispararReporteCorreo(fecha: string): Promise<void> {
  // Fire-and-forget desde el caller; aquí solo invoca. Errores los maneja el caller.
  const { error } = await supabase.functions.invoke('enviar-reporte-diario', { body: { fecha } })
  if (error) throw error
}
```

- [ ] **Step 2:** `npx tsc --noEmit` → 0; `npx jest lib/reporteDiario.test.ts` → 3 verdes. **Step 3: Commit**
```bash
git add lib/reporteDiario.ts
git commit -m "feat(m13): acceso a datos (reporte diario, config, disparo de correo)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Edge Function `enviar-reporte-diario`

**Files:** Create `supabase/functions/enviar-reporte-diario/index.ts`

- [ ] **Step 1:** Escribir la función, contenido exacto:
```ts
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
```

- [ ] **Step 2: Desplegar (orquestador, MCP)** `deploy_edge_function` (name `enviar-reporte-diario`, el archivo anterior). 
- [ ] **Step 3: Probar en dry-run sin contaminar** — con la config sembrada (`correo_on=false`), invocar la función (vía `supabase.functions.invoke` desde un script o `curl` con un JWT, o desde la app en Task 8). Esperado: `{ skipped: 'correo_off' }` (no inserta en `reporte_envios`). El camino de envío real se valida cuando se configure `RESEND_API_KEY` y `correo_on=true` (fuera de v1 automatizada). Documentar en el commit que el envío real depende del secreto.
- [ ] **Step 4: Commit**
```bash
git add supabase/functions/enviar-reporte-diario/index.ts
git commit -m "feat(m13): Edge Function enviar-reporte-diario (Resend + dedupe + dry-run)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: UI — pantalla de configuración (solo dueño)

**Files:** Create `app/(app)/reportes/config.tsx`; Modify `app/(app)/reportes/_layout.tsx`, `app/(app)/reportes/index.tsx`

**Interfaces:**
- Consumes: `obtenerReporteConfig`, `guardarReporteConfig` de `lib/reporteDiario`; `useAuth` de `lib/auth`.

- [ ] **Step 1: `_layout.tsx`** — añadir screen:
```tsx
      <Stack.Screen name="config" options={{ title: 'Reportes automáticos' }} />
```

- [ ] **Step 2: `index.tsx`** — botón a config visible solo para dueño. Tras obtener `perfil` (`useAuth` ya importado), dentro del ScrollView (después del botón de períodos):
```tsx
          {perfil?.rol === 'dueno' && (
            <TouchableOpacity
              testID="btn-config-reportes"
              style={styles.linkPeriodos}
              onPress={() => router.push('/reportes/config')}
            >
              <Ionicons name="notifications-outline" size={16} color="#1d4ed8" />
              <Text style={styles.linkPeriodosText}>Configurar reportes automáticos</Text>
              <Ionicons name="chevron-forward" size={16} color="#1d4ed8" />
            </TouchableOpacity>
          )}
```
(El dashboard ya tiene `const { perfil } = useAuth()` y `const router = useRouter()`.)

- [ ] **Step 3: `config.tsx`** — pantalla solo-dueño:
  - Imports: RN (`View,Text,Switch,TextInput,TouchableOpacity,ActivityIndicator,StyleSheet,SafeAreaView,Alert`), `useFocusEffect` de `expo-router`, `Ionicons`, `useAuth` de `../../../lib/auth`, `obtenerReporteConfig`/`guardarReporteConfig`/`type ReporteConfig` de `../../../lib/reporteDiario`.
  - Gate: `const { perfil } = useAuth()`; si `perfil?.rol !== 'dueno'` → `return <Redirect href="/reportes" />` (importar `Redirect` de expo-router).
  - Estado: `whatsappOn`, `correoOn`, `correoDestino`, `loading`, `saving`. `useFocusEffect` carga `obtenerReporteConfig()` y rellena.
  - UI: `Switch` para WhatsApp (`testID="sw-whatsapp"`) y Correo (`testID="sw-correo"`); `TextInput` correo destino (`testID="input-correo"`); botón Guardar (`testID="btn-guardar-config"`) que llama `guardarReporteConfig({ whatsapp_on, correo_on, correo_destino })` y muestra `Alert` de éxito/error. Validación: si `correoOn` y `correoDestino` vacío/sin '@' → Alert 'Ingresa un correo válido' y no guarda.
  - Nota informativa en la pantalla: "El correo automático requiere configurar la clave del proveedor de envío." (texto fijo).

- [ ] **Step 4:** `npx tsc --noEmit` → 0; `npm test` → todas verdes. **Step 5: Commit**
```bash
git add "app/(app)/reportes/config.tsx" "app/(app)/reportes/_layout.tsx" "app/(app)/reportes/index.tsx"
git commit -m "feat(m13): UI de configuración de reportes automáticos (solo dueño)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Hook al cerrar caja (correo + WhatsApp asistido)

**Files:** Modify `app/(app)/caja/cierre.tsx`

**Interfaces:**
- Consumes: `dispararReporteCorreo`, `obtenerReporteDiario`, `construirLinkWhatsapp` de `lib/reporteDiario`; `Linking` de react-native.

- [ ] **Step 1:** En `cierre.tsx`, importar `Linking` (de 'react-native') y `dispararReporteCorreo, obtenerReporteDiario, construirLinkWhatsapp` de `'../../../lib/reporteDiario'`. Tras el `await cerrarCaja({...})` exitoso (donde hoy hace `Alert.alert('Caja Cerrada', ...)`), reemplazar por:
```tsx
      await cerrarCaja({ efectivo_contado, diferencia, nota })

      const hoy = new Date()
      const fechaISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

      // Disparo del correo automático (fire-and-forget; no bloquea el cierre)
      dispararReporteCorreo(fechaISO).catch((e) => console.warn('Reporte por correo no disparado:', e))

      // WhatsApp asistido: arma el link con el mensaje del día
      let waLink: string | null = null
      try {
        const rep = await obtenerReporteDiario(fechaISO)
        waLink = construirLinkWhatsapp(null, rep.mensaje)
      } catch (e) {
        console.warn('No se pudo armar el WhatsApp:', e)
      }

      Alert.alert(
        'Caja cerrada',
        'La caja se cerró exitosamente.',
        waLink
          ? [
              { text: 'Enviar por WhatsApp', onPress: () => { Linking.openURL(waLink!); router.replace('/caja') } },
              { text: 'Listo', onPress: () => router.replace('/caja') },
            ]
          : [{ text: 'OK', onPress: () => router.replace('/caja') }]
      )
```

- [ ] **Step 2:** `npx tsc --noEmit` → 0; `npm test` → todas verdes. **Step 3: Commit**
```bash
git add "app/(app)/caja/cierre.tsx"
git commit -m "feat(m13): al cerrar caja, dispara correo + ofrece WhatsApp asistido

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Tests de UI

**Files:** Create `lib/reporteDiario_ui.test.tsx`

- [ ] **Step 1:** Andamiaje de mocks (patrón de `lib/reportes_ui.test.tsx`): AsyncStorage, supabase (`{ from: jest.fn(), rpc: jest.fn(), functions: { invoke: jest.fn() } }`), `@expo/vector-icons`, `expo-router` (con `useFocusEffect`, `Redirect`, `useRouter`). Mock `lib/auth` (`useAuth`, `useRequireModulo`). Mock `lib/reporteDiario` conservando la pura (`construirLinkWhatsapp`) y mockeando `obtenerReporteConfig`/`guardarReporteConfig`/`obtenerReporteDiario`/`dispararReporteCorreo`. Importar pantallas tras los mocks. Cubrir:
  1. **Config gating:** con `useAuth` rol `'admin'`, `ConfigScreen` redirige (no renderiza el botón Guardar / no llama `obtenerReporteConfig`).
  2. **Config guardar:** con rol `'dueno'` y `obtenerReporteConfig` mockeado, tocar `btn-guardar-config` invoca `guardarReporteConfig` con los valores actuales.
  3. **Config validación:** con `correoOn=true` y correo vacío, tocar Guardar NO invoca `guardarReporteConfig` (muestra alerta).
- [ ] **Step 2:** `npx jest lib/reporteDiario_ui.test.tsx` → verde; `npm test` → todas verdes; `npx tsc --noEmit` → 0. **Step 3: Commit**
```bash
git add lib/reporteDiario_ui.test.tsx
git commit -m "test(m13): tests de UI de configuración de reportes automáticos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Verificación de regresión
- [ ] `npx tsc --noEmit && npm test` → tsc 0, todas verdes.
- [ ] Re-correr `smoke_test_reporte_diario.sql` vía MCP → `REPORTE_DIARIO_OK_ROLLBACK`.
- [ ] Read-only vía MCP (claim dueño real): `select public.obtener_reporte_diario((now() at time zone 'America/Bogota')::date);` devuelve el JSON con `mensaje`.
- [ ] Confirmar la Edge Function desplegada: MCP `list_edge_functions` incluye `enviar-reporte-diario`.

## Task 11: Code review y cierre
- [ ] **Code review** (superpowers:requesting-code-review) sobre `main..feat/m13-reportes-automaticos`. Foco: RLS dueño-only de `reporte_config`/`reporte_envios`, dedupe (índice único parcial `where ok`), que el envío real esté condicionado al secreto (dry-run seguro), no bloquear el cierre de caja ante fallo del reporte, y que ningún no-dueño lea la config.
- [ ] Actualizar `openspec/changes/tasks.json` y la memoria `sp9-balance-reportes-state.md`.
- [ ] **Presentar al humano para decisión de merge** (superpowers:finishing-a-development-branch). **No auto-mergear.** Nota: 2 ultrareviews gratis disponibles — M13 es buen candidato.

---

## Self-Review (writing-plans)
- **Cobertura del spec:** §2.1 mensaje → RPC (Task 1); §2.2 config → tabla+UI (Tasks 1,7); §2.3 dedupe → índice parcial (Task 1) + Edge Function (Task 6); §2.4 permisos → RLS (Task 1), gates UI (Tasks 7,8); §3 BD → Tasks 1-3; §4 Edge Function → Task 6; §5 app (pura, datos, hook cierre, config) → Tasks 4,5,7,8; §6 pruebas → Tasks 2,4,9,10. Sin huecos. v2 (cron) explícitamente fuera.
- **Sin placeholders:** SQL, Edge Function y pura con código completo; UI/hook con estructura concreta, `testID`s y patrón de pantallas existentes.
- **Consistencia de tipos:** firma `obtener_reporte_diario(date)` idéntica en migración/grant/smoke/`obtenerReporteDiario`; `ReporteDiario`/`ReporteConfig` espejan los contratos; `construirLinkWhatsapp` con la misma firma en Task 4 (def) y Task 8 (uso); nombres de funciones de datos consistentes entre Tasks 5,7,8,9.
- **Orden serial:** BD (1-3) → pura/datos (4-5) → Edge Function (6) → UI/hook (7-8) → tests (9) → verificación (10) → review (11). Esquema y Edge Function (infra) los aplica/despliega el orquestador (AGENTS.md §5.1).
- **Riesgo conocido:** envío real de correo depende de `RESEND_API_KEY` (externo); v1 verificable en dry-run. Documentado en spec §1 y Task 6.
