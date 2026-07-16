# Rediseño Venus — Paso 5a: Backend del dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los 2 gaps de backend del dashboard (redisign.md Parte B): agregación de ventas por sub-período (gráfico de barras) y gastos del período (fijos + variables mezclados), con sus wrappers tipados en `lib/dashboard.ts`.

**Architecture:** Una migración con 2 RPCs `security definer` gateadas con `private.is_staff_admin()` (mismo patrón que `obtener_reporte_periodo`): los empleados operativos no ven históricos (PRD §2), su dashboard usará `obtener_resumen_dia` (ya existe). Buckets vacíos se rellenan en SQL con `generate_series` para que el gráfico siempre tenga barras. `lib/dashboard.ts` expone wrappers + el helper puro `rangoParaPeriodo` (Hoy/Semana/Mes/Año → desde/hasta/granularidad) que usará la UI del paso 5b.

**Tech Stack:** Postgres 17 (plpgsql, RPC via PostgREST), Supabase CLI vía npx (v2.109), jest para lib.

## Global Constraints

- Métodos de pago vigentes: `efectivo | nequi | bre_b | otro` (post-merge Bre-B).
- Total neto = pagos de ventas en estados `['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total']` − reembolsos + cobros de devoluciones, **por fecha de la venta** en America/Bogota (idéntico a `obtener_reporte_periodo`).
- RPCs: `security definer set search_path = ''`, `revoke all ... from public` + `grant execute ... to authenticated`, gate `private.is_staff_admin()`.
- Aplicación al remoto: NUNCA `db push` a ciegas — la historia de migraciones del remoto no coincide con los timestamps de los archivos (memoria sp2-sp6). Verificar existencia de objetos primero; aplicar SQL nuevo directamente y dejar el archivo en el repo como fuente.
- Commits terminan con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Rama + migración SQL

**Files:** Create `supabase/migrations/20260716000000_dashboard_rpcs.sql`

**Interfaces (produce):**
- `public.obtener_ventas_por_subperiodo(p_desde date, p_hasta date, p_granularidad text)` → `json` array `[{ "inicio": "YYYY-MM-DD", "total": numeric, "num_ventas": int }]`
  - `p_granularidad ∈ ('dia','semana','mes')`; si no, `raise exception`.
  - Buckets con `generate_series` + `date_trunc` (semana ISO lunes, mes calendario); incluye buckets en cero.
- `public.obtener_gastos_periodo(p_desde date, p_hasta date)` → `json` `{ "total": numeric, "gastos": [{ "tipo": "fijo"|"variable", "nombre": text, "detalle": text|null, "monto": numeric, "fecha": "YYYY-MM-DD" }] }`
  - fijo: `gastos_fijos_pagos.fecha_pago/monto_pagado` + `gastos_fijos.nombre`; detalle = `periodo`.
  - variable: `gastos_variables.fecha/monto/descripcion`; detalle = `categoria`.
  - Ordenado por fecha desc; ambos gateados con `is_staff_admin`.

**Steps:**
- [ ] `git checkout main && git pull && git checkout -b feat/dashboard-backend`
- [ ] Escribir la migración (SQL completo en ejecución con el patrón de `20260618025450_m12it2_reporte_periodo.sql`).
- [ ] Commit `feat(dashboard): RPCs de ventas por sub-período y gastos del período` (migración + plan).

### Task 2: `lib/dashboard.ts` (TDD)

**Files:** Create `lib/dashboard.ts`, `lib/dashboard.test.ts`

**Interfaces (produce):**
- `type Periodo = 'hoy' | 'semana' | 'mes' | 'anio'`
- `rangoParaPeriodo(periodo: Periodo, hoy?: Date): { desde: string; hasta: string; granularidad: 'dia' | 'semana' | 'mes' }` — puro: hoy→(hoy,hoy,dia); semana→últimos 7 días incl. hoy, dia; mes→últimos 30 días, dia; anio→últimos 12 meses desde el día 1 del mes hace 11 meses, mes. Fechas en `YYYY-MM-DD` de America/Bogota.
- `obtenerVentasPorSubperiodo(desde, hasta, granularidad)` → `Promise<{ inicio: string; total: number; num_ventas: number }[]>` (rpc + throw on error)
- `obtenerGastosPeriodo(desde, hasta)` → `Promise<{ total: number; gastos: { tipo: 'fijo'|'variable'; nombre: string; detalle: string|null; monto: number; fecha: string }[] }>`

**Steps:**
- [ ] Test que falla: (a) `rangoParaPeriodo('hoy', new Date('2026-07-15T20:00:00-05:00'))` → `{desde:'2026-07-15', hasta:'2026-07-15', granularidad:'dia'}`; (b) semana → desde 2026-07-09, 7 días; (c) anio → granularidad mes y desde 2025-08-01; (d) wrappers llaman `supabase.rpc` con los nombres/args correctos y lanzan si `error` (mock del patrón `reportes.test.ts`).
- [ ] FAIL → implementar → PASS + tsc → commit `feat(dashboard): lib/dashboard con rangos de período y wrappers RPC`.

### Task 3: Aplicar al remoto y verificar

- [ ] Login CLI: el usuario corre `! npx supabase login` (o exporta `SUPABASE_ACCESS_TOKEN`).
- [ ] `npx supabase link --project-ref xqspsaghukeynlizbjvc` (ref de config.toml).
- [ ] **Verificar estado previo:** `npx supabase migration list --linked`; comprobar con `supabase db query` si `obtener_ventas_por_subperiodo` ya existe y si las migraciones bre_b/marca están aplicadas (deberían, según memoria; si NO están: aplicarlas primero tras verificar objetos).
- [ ] Aplicar la migración nueva directamente (`db query -f`), registrar en historia si el mecanismo del proyecto lo permite sin dañar la historia existente.
- [ ] **Smoke real:** llamar ambas RPCs con un rango real (`db query`) autenticado como service/postgres — verifica sintaxis y formas de retorno; y `get_advisors`/`db advisors` si disponible.
- [ ] Commit de cualquier ajuste + cierre con finishing-a-development-branch.

## Self-Review
1. **Cobertura:** gap gráfico ✓ (RPC 1 + rango UI), gap gastos ✓ (RPC 2). `listarDevoluciones` explícitamente fuera (paso 6). Permisos alineados al PRD (empleado sin históricos) ✓.
2. **Placeholders:** SQL/TS en ejecución siguiendo patrón citado; formas de retorno definidas aquí.
3. **Tipos:** wrappers retornan las formas exactas del JSON de las RPCs.
