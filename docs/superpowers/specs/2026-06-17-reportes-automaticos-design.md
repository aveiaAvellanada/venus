# Especificación de Diseño: Reportes Automáticos (M13) — v1

> Diseño aprobado el 2026-06-17. Lo recibe y configura **Andrés (dueño)**.
> Primer módulo con **infraestructura de Edge Functions** en Venus.
> **Alcance v1:** correo automático al cierre + WhatsApp asistido + configuración.
> **v2 (diseñado, no construido):** cron de hora fija.

## 1. Introducción y Objetivos

**Reportes Automáticos (M13)** envía un resumen del día al cerrar la caja: por **correo**
(automático, vía Edge Function + proveedor) y por **WhatsApp asistido** (la app abre un
mensaje pre-armado que la persona toca para enviar). Reutiliza los datos que ya produce el
sistema; la novedad es la **entrega**.

**Decisiones de producto (tomadas en brainstorming):**
- WhatsApp 100% automático (Cloud API de Meta) queda fuera de v1 por el trámite externo
  (cuenta Business verificada + plantilla aprobada). v1 usa **WhatsApp asistido**.
- El correo automático real depende de una **API key de proveedor** (Resend) como secreto.
  Sin la key, la Edge Function corre en **dry-run** (registra sin enviar).
- Disparo en v1: **al cerrar la caja**. El **cron de hora fija** se difiere a v2 (la tabla
  `reporte_config` ya incluye `hora_envio` para soportarlo sin migración futura).

## 2. Reglas de negocio

### 2.1 Contenido del mensaje (plantilla PRD §3.13.1)
Para una fecha dada (zona `America/Bogota`):
```
📊 Venus — Resumen del día
📅 [fecha]

💰 Total vendido: $XXX.XXX
🛍️ Ventas: N
💵 Efectivo: $XXX
📱 Nequi: $XXX
📱 Daviplata: $XXX

👟 Más vendido: [producto]
⚠️ Stock bajo: [lista o "ninguno"]

✅ Caja cuadró  /  ⚠️ Diferencia de $X
```
- Totales (total vendido, nº ventas, efectivo/Nequi/Daviplata): de la lógica de
  `obtener_resumen_dia` (netos de devoluciones por fecha de venta).
- **Más vendido:** producto con más unidades vendidas ese día (de `venta_items`).
- **Stock bajo:** calzado activo con `stock_actual <= stock_minimo` (lista corta; "ninguno"
  si vacía).
- **Caja:** del `cierres_caja` del día — "Caja cuadró" si `diferencia = 0`, si no
  "Diferencia de $X".
- El **texto se arma en el RPC** (`mensaje`) para que correo y WhatsApp usen una sola
  fuente (DRY entre el runtime Deno de la Edge Function y la app React Native).

### 2.2 Configuración (`reporte_config`, solo dueño)
- `whatsapp_on` (bool, default **true**), `correo_on` (bool, default **false**),
  `correo_destino` (text), `hora_envio` (time, null = solo al cierre; reservado para v2).
- Singleton (una sola fila). Solo Andrés la ve y edita (RLS owner-only).

### 2.3 Deduplicación (`reporte_envios`)
- Log de envíos con `unique(fecha, canal)`. La Edge Function no reenvía el correo si ya
  hay un envío `ok` de hoy. (Protege contra doble cierre el mismo día y, en v2, contra el
  solapamiento cierre/cron.)

### 2.4 Permisos
- `reporte_config` y `reporte_envios`: **solo dueño** por RLS (datos de configuración y
  auditoría de envíos).
- RPC `obtener_reporte_diario`: `SECURITY DEFINER`, `grant authenticated` **sin gate de
  rol** — el contenido (totales del día, stock, caja) ya es operativo y visible vía Caja /
  `obtener_resumen_dia`; permite que cualquiera que cierre caja dispare el envío.
- La Edge Function corre con **service role** (lee config, envía, registra), invocada con
  JWT verificado (no `--no-verify-jwt`).

## 3. Capa de Base de Datos

Migración nueva: 2 tablas + 1 RPC.

### 3.1 `reporte_config` (singleton, owner RLS)
Columnas: `id` (uuid pk default gen_random_uuid, pero se usa una sola fila sembrada),
`whatsapp_on` bool not null default true, `correo_on` bool not null default false,
`correo_destino` text, `hora_envio` time, `updated_at` timestamptz, `updated_by` uuid.
RLS: `select`/`update` solo dueño (`private.is_owner()`); sin `insert`/`delete` para
clientes (se siembra una fila en la migración). Trigger de auditoría `updated_by`/`updated_at`.

### 3.2 `reporte_envios` (log de dedupe, owner RLS read)
Columnas: `id` uuid pk, `fecha` date not null, `canal` text not null
`check (canal in ('correo','whatsapp'))`, `enviado_at` timestamptz default now(), `ok`
bool not null, `detalle` text. **`unique(fecha, canal)`**. RLS: `select` solo dueño;
`insert`/`update` solo `service_role` (la Edge Function). Sin acceso de escritura a
`authenticated`.

### 3.3 RPC `obtener_reporte_diario(p_fecha date) returns json`
`SECURITY DEFINER`, `set search_path = ''`, `grant authenticated`. Devuelve:
```json
{
  "fecha": "YYYY-MM-DD",
  "total_vendido": n, "num_ventas": n,
  "efectivo": n, "nequi": n, "daviplata": n,
  "mas_vendido": "texto" | null,
  "stock_bajo": ["texto", ...],
  "caja_cuadro": bool | null,
  "diferencia": n | null,
  "mensaje": "texto multilínea con la plantilla §2.1"
}
```
`caja_cuadro`/`diferencia` son `null` si no hay cierre de caja ese día. Smoke con centinela
`REPORTE_DIARIO_OK_ROLLBACK`.

## 4. Edge Function `enviar-reporte-diario`

Carpeta `supabase/functions/enviar-reporte-diario/`. Deno + cliente service-role.
- **Input:** `{ fecha: "YYYY-MM-DD" }` (default: hoy en Bogota).
- **Lógica:** lee `reporte_config`; si `!correo_on` → `{skipped:'correo_off'}`. Si existe
  `reporte_envios(fecha,'correo')` con `ok` → `{skipped:'ya_enviado'}`. Llama
  `obtener_reporte_diario(fecha)`; si `RESEND_API_KEY` está → `POST https://api.resend.com/emails`
  (`to=correo_destino`, asunto "Venus — Resumen del día [fecha]", cuerpo = `mensaje`);
  si no → **dry-run**. Inserta `reporte_envios(fecha,'correo',ok,detalle)`. Devuelve el
  resultado.
- Verificación de JWT activada (solo usuarios autenticados la invocan).
- **Despliegue:** vía MCP `deploy_edge_function`. Prueba en dry-run (sin key).

## 5. Capa de app

- **`lib/reporteDiario.ts`** (nuevo):
  - Pura: `construirLinkWhatsapp(telefono: string | null, mensaje: string): string`
    (arma `https://wa.me/?text=...` o `https://wa.me/<tel>?text=...`, con `encodeURIComponent`).
    Con `lib/reporteDiario.test.ts` (jest TDD).
  - Acceso a datos: `obtenerReporteDiario(fecha)` (RPC), `obtenerReporteConfig()` /
    `guardarReporteConfig(...)` (tabla, solo dueño), `dispararReporteCorreo(fecha)`
    (invoca la Edge Function vía `supabase.functions.invoke`).
- **Hook al cerrar caja:** en el flujo de cierre (`lib/caja.ts` / la pantalla de Caja),
  tras cerrar con éxito: invocar `dispararReporteCorreo(hoy)` (fire-and-forget, errores no
  bloquean el cierre) y mostrar **siempre** un botón **"Enviar resumen por WhatsApp"** que
  arma el link con el `mensaje` del RPC `obtener_reporte_diario` (autenticado) y lo abre con
  `Linking.openURL`. El botón se muestra **a quien cierre** (operativo incluido), porque es
  una acción manual; **no** se gatea leyendo `reporte_config` (owner-only) en su sesión.
  El flag `whatsapp_on` se almacena/edita en la config y queda reservado para el envío
  automático futuro.
- **Pantalla de configuración** `app/(app)/reportes/config.tsx` (solo dueño): toggles de
  WhatsApp/correo + campo de correo destino; botón visible solo para Andrés en el dashboard
  de `/reportes` que navega aquí. Gate: `perfil.rol === 'dueno'` (redirige si no).

## 6. Estrategia de Pruebas
1. **Smoke SQL** (MCP, rollback, año aislado, centinela `REPORTE_DIARIO_OK_ROLLBACK`):
   sembrar ventas + cierre del día; verificar que `obtener_reporte_diario` arma `total`,
   `mas_vendido`, `stock_bajo`, `caja_cuadro/diferencia` y el `mensaje`; verificar RLS
   dueño-only de `reporte_config`; y que `unique(fecha,'correo')` bloquea el segundo insert.
2. **Edge Function:** desplegar vía MCP; invocar en **dry-run** (sin `RESEND_API_KEY`) y
   confirmar que registra `reporte_envios` y respeta el dedupe y `correo_on=false`.
3. **Jest puro** (`lib/reporteDiario.test.ts`): `construirLinkWhatsapp` (con y sin teléfono,
   encoding del mensaje).
4. **Jest UI:** pantalla de config (gating dueño, guardar toca `guardarReporteConfig`);
   botón de WhatsApp al cierre (abre el link cuando `whatsapp_on`).
5. **Regresión:** `npx tsc --noEmit` 0 · `npm test` verde.

## 7. Fuera de alcance
- **v2:** cron de hora fija (pg_cron + pg_net) usando `reporte_config.hora_envio`.
- WhatsApp 100% automático (Cloud API de Meta, plantillas).
- Adjuntos/PDF; reportes por rango en el correo (eso es M12).
- Análisis IA (M14).
