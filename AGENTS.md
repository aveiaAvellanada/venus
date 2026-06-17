# AGENTS.md — Guía universal del proyecto Venus

> Archivo universal para agentes (Claude Code, Antigravity CLI y cualquier otro).
> Léelo antes de tocar el código. La fuente de verdad del producto es
> `docs/Venus_PRD_v4.0.md`; las decisiones técnicas viven en
> `docs/superpowers/specs/` (diseño) y `docs/superpowers/plans/` (planes de tareas).
> `CLAUDE.md` es el resumen operativo para Claude Code y manda en convenciones.

---

## 1. Qué es Venus

App **Android** (React Native / Expo) para gestionar la tienda de calzado familiar
**"Venus"** en Florencia, Caquetá, Colombia. Reemplaza un cuaderno físico con un
sistema digital simple, ágil y con **auditoría de cada acción**. Online-first en
esta versión (offline-first diferido).

### Usuarios reales (cuentas provisionadas en `public.users` + Supabase Auth)

| Persona | Email | Rol (`users.rol`) | Resumen de permisos |
|---|---|---|---|
| **Andrés Artunduaga** (dueño) | venusdelcaqueta@gmail.com | `dueno` | Ve TODO: costos, márgenes, balance, deudas, pagos a empleados, auditoría completa. Único que crea/desactiva empleados. |
| **Sandra Cardona** (administrativa) | sandracardona.venus2026@gmail.com | `admin` | Casi todo MENOS finanzas (no ve costos/márgenes/balance/pagos a empleados/deudas; no gestiona empleados). Sí proveedores, gastos fijos y reportes históricos. |
| **Camilo Artunduaga** | artuneleven1@gmail.com | `empleado` | Operativo. |
| **Beatriz Bueno** | beatrizbueno1979@gmail.com | `empleado` | Operativo. |
| **Nikol Artunduaga** | (email pendiente) | `empleado` | Operativo (sin seed aún). |

> ⚠️ El dueño es **Andrés Artunduaga**. Algunos specs antiguos lo llaman "Don Carlos"
> por error: usar siempre **Andrés**.

**Empleado operativo** (Camilo/Beatriz/Nikol): ventas, devoluciones, inventario de
calzado y Granja (ver y editar), recibir mercancía, gastos variables (con
autorización), caja (abrir/cerrar). **No** ven finanzas ni gestionan
proveedores/gastos fijos/empleados.

**Regla de oro de permisos:** los empleados tienen casi todos los permisos.
**Solo Andrés ve finanzas, costos y márgenes** (más balance, pagos a empleados,
deudas con proveedores y gestión de usuarios). Sandra es el nivel intermedio
(`admin`, administrativa sin finanzas). Detalle fino en el PRD v4.0 §2.

---

## 2. Stack tecnológico

- **React Native + Expo SDK 54** (TypeScript estricto). NO actualizar el SDK sin
  pedirlo (Expo Go del dispositivo de prueba corre SDK 54).
- **expo-router** (navegación basada en archivos, en `app/`).
- **Supabase**: PostgreSQL 17, Auth, Storage. **RLS activado en todas las tablas.**
  - Cliente: `lib/supabase.ts`. Tipos generados: `lib/database.types.ts`.
  - Project ref: `xqspsaghukeynlizbjvc`.
  - Lógica de autorización centralizada en el esquema `private` (funciones
    `SECURITY DEFINER`: `is_owner`, `is_admin`, `is_staff_admin`, `is_employee`,
    `user_role`, `hoy_bogota`).
- **jest** para lógica pura (ej. `lib/carrito.ts` + `lib/carrito.test.ts`).
- Variables de entorno: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

---

## 3. Los 15 módulos (PRD v4.0)

1. **Nueva Venta** — zapatos y Granja; carrito, regateo con precio mín/máx, pagos
   simples o mixtos, efectivo recibido y cambio, cliente opcional (con cédula), nota
   de venta. Ventas Separadas / pago parcial = v2.
2. **Devoluciones** — total, parcial o cambio de producto; restituye stock de
   calzado (Granja no); todo auditado.
3. **Inventario de Calzado** — 7 categorías fijas (Chanclas, Escolar, Botas caucho,
   Deportivo, Tennis, Clásico, Otros); precio mín/máx; búsqueda en tiempo real;
   "¿Agregar otro similar?".
4. **Granja** (antes Productos Varios) — productos que no son zapatos; **sin stock**;
   precio se ingresa en el momento de la venta; cálculo por unidad de medida.
5. **Recibir Mercancía** — entrada de mercancía; puede crear producto nuevo sin salir
   del flujo; sube stock de calzado. Empleado registra recepción; finanzas solo
   Andrés/Sandra.
6. **Proveedores** — datos, cuentas bancarias, documentos, deudas; botón WhatsApp
   directo. (Andrés y Sandra.)
7. **Caja** (antes Cierre de Caja) — apertura/cierre del día (manual; automático
   configurable después).
8. **Gestión de Empleados** — Andrés crea/desactiva empleados, sueldos, días
   trabajados, pagos. (Solo Andrés.)
9. **Gastos Fijos** — recurrentes con alertas de vencimiento y comprobantes.
   (Andrés y Sandra.)
10. **Gastos Variables** — imprevistos por categoría (transporte/reparaciones/
    insumos/otros). (Andrés y Sandra; otros con autorización.)
11. **Balance** — ingresos netos − egresos; proyección del mes; histórico.
    (Solo Andrés.)
12. **Reportes y Dashboard** — visión del negocio (Andrés; Sandra sin costos).
13. **Reportes Automáticos** — resumen diario al cierre por WhatsApp (siempre) y
    correo (opcional). Requiere infra de notificaciones (Edge Functions).
14. **Análisis IA Temporadas** — recomendaciones de compra cruzando ventas, festivos
    y clima. (Solo Andrés; requiere 3+ meses de datos.)
15. **Carga Inicial del Inventario** — plantilla Excel (fase 1) e IA con cámara
    (fase 2). (Andrés y Sandra.)

---

## 4. Reglas de negocio críticas

- Una venta confirmada **NUNCA** se elimina; solo se corrige con nota o se procesa
  una devolución.
- El inventario de calzado **NUNCA** queda en negativo; los agotados siguen visibles
  como AGOTADO (no se borran).
- **Granja no maneja stock** y su precio se define en el momento de la venta
  (no hay precio guardado; `precio_sugerido` solo autocompleta).
- **Regateo libre:** cada zapato tiene precio mínimo y máximo, pero el vendedor puede
  cobrar **cualquier** precio (el rango es informativo, no restrictivo). El precio
  final pagado queda guardado por item, junto con un snapshot del rango, para que
  Andrés audite ventas bajo el mínimo.
- Los pagos deben sumar **EXACTAMENTE** el total para confirmar; pagos mixtos
  permitidos (ej. efectivo + Nequi).
- Devoluciones: no se puede devolver más de lo vendido; Granja no restituye stock;
  todo auditado.
- Ventas separadas (v2): descuentan stock al separar; nombre y teléfono del cliente
  obligatorios; solo Andrés cancela una separación.
- **Auditoría completa:** toda acción registra quién la hizo y cuándo. Las tablas
  llevan `created_by`/`updated_by` (el trigger los fija desde `auth.uid()` en INSERT
  de forma **inviolable**: el cliente no puede falsificar la autoría).
- Las fotos se comprimen a máximo 500KB antes de subir a Storage.

---

## 5. Flujo de trabajo (agente único: Antigravity)

Desde el 2026-06-16 el proyecto lo lleva **un solo agente: Antigravity CLI** (con
su herramienta de agentes / teamwork). Asume el **ciclo completo**. El estado vivo
está en `openspec/changes/tasks.json`: **léelo al empezar y actualízalo al terminar**
(`rama_activa`, `ultimo_agente`, `sp_completados`, `sp_pendientes`, `tareas_pendientes`).

Antigravity es responsable de todo:
- **Diseño:** escribe **specs** en `docs/superpowers/specs/` y **planes** en
  `docs/superpowers/plans/` antes de construir (brainstorming → plan → build).
- **Construcción:** UI (`app/`), lógica de datos (`lib/`), hooks, componentes y
  **tests** (jest). Un commit por tarea; marca cada tarea `[x]` en su plan.
- **Base de datos:** es el dueño de las **migraciones SQL / RLS / RPC**. Las crea en
  `supabase/migrations/` (timestamp creciente, `drop ... if exists`), las **aplica al
  Supabase remoto** (`xqspsaghukeynlizbjvc`) vía el MCP de Supabase (o el CLI),
  **regenera `lib/database.types.ts`** y corre **smoke tests SQL** (centinela
  `*_OK_ROLLBACK`, en transacción con `rollback`).
- **Integración:** trabaja en rama de feature, se **autorevisa**, **mergea a `main`**
  con `--no-ff` y hace `push`.
- **Estado:** mantiene `tasks.json` y los sub-proyectos (SP-N).

### Checklist obligatorio antes de CADA merge a `main`
1. `npx tsc --noEmit` → **0 errores**.
2. `npm test` → **verde**.
3. Si tocó el esquema: migración aplicada al remoto + smoke test SQL `*_OK_ROLLBACK`
   + `lib/database.types.ts` regenerado.
4. Sin scratch en el árbol (`supabase/.temp/`, `smoke_test*.sql`, `payload_smoke.json`,
   `coverage/`, `PROJECT.md`, `TEST_*.md` — ya en `.gitignore`).
5. **RLS es la frontera de seguridad real:** finanzas/costos/márgenes/**deuda de
   proveedores**/pagos a empleados se gatean al **dueño** tanto en RLS/RPC como en UI;
   nunca confíes solo en el gating de la UI.

> ⚠️ Al no haber un segundo revisor, **extrema el rigor**: tests + smoke + lectura del
> propio diff antes de mergear. Considera correr una revisión asistida (p. ej.
> `/code-review`) de vez en cuando.

---

## 6. Convenciones de código

- **TypeScript estricto** en todo el proyecto. `npx tsc --noEmit` debe quedar en 0
  (el repo versiona `env.d.ts`, un shim que referencia `expo/types` para que `tsc`
  resuelva `process.env` sin correr expo antes; `expo-env.d.ts` está en `.gitignore`).
- `lib/` para utilidades compartidas y acceso a datos. **Lógica pura y testeable
  separada del acceso a datos y de la UI** (ej. `lib/carrito.ts` con `carrito.test.ts`).
- `app/` para rutas (expo-router); pantallas dentro de los grupos de ruta
  (`(app)`, `(auth)`).
- `hooks/` para custom hooks.
- **Todo en español en la UI.**
- **TDD** para lógica pura: test que falla → implementación mínima → verde → commit.
- **Un commit por tarea**; mensajes claros. Co-autoría de Claude termina con
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **No** commitear basura: temporales (`supabase/.temp/`), `coverage/`, archivos de
  scratch (`smoke_test*.sql`, `payload_smoke.json`, `PROJECT.md`, `TEST_*.md`) no van
  al repo.
- **Migraciones:** archivo en `supabase/migrations/<YYYYMMDDHHMMSS>_<nombre>.sql` con
  timestamp creciente, `drop ... if exists` para idempotencia, y aplicar con MCP
  `apply_migration`. Tras cambios de esquema, regenerar `lib/database.types.ts`.
- **RLS es la frontera de seguridad real:** nunca confíes solo en el gating de la UI.

---

## 7. Qué NO construir en esta versión

- Facturación electrónica DIAN
- E-commerce o catálogo por WhatsApp
- Nómina electrónica
- Contabilidad formal
- Múltiples sucursales
- App para iOS
- Panel web
- Ventas a crédito formal con intereses
- Offline-first (diferido)

---

*Fuente de verdad: `docs/Venus_PRD_v4.0.md`. Convenciones Claude Code: `CLAUDE.md`.
Estado de tareas: `openspec/changes/tasks.json`.*
