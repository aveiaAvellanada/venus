# Venus — Contexto técnico de la aplicación

> Documento de referencia técnica. Describe qué es Venus y con qué herramientas,
> lenguajes y tecnologías está construida cada capa. Para el comportamiento de
> producto, la fuente de verdad es `docs/Venus_PRD_v4.0.md`.

---

## 1. Qué es

Venus es una **aplicación móvil Android** para gestionar la tienda de calzado
familiar "Venus" (Florencia, Caquetá, Colombia). Reemplaza el cuaderno físico
de la tienda por un sistema digital con **auditoría de cada acción** (quién hizo
qué y cuándo).

- **Tipo:** app móvil nativa (vía React Native/Expo), online-first.
- **Plataforma objetivo:** Android (iOS no se construye en esta versión, aunque
  el stack lo permitiría).
- **Idioma:** todo el producto y el código de dominio está en español.
- **Modelo de negocio:** un solo local, ~5 usuarios reales con 3 niveles de rol.

El sistema cubre 15 módulos funcionales: ventas, devoluciones, inventario de
calzado, "Granja" (productos sin stock), recibir mercancía, proveedores, caja,
empleados, gastos fijos/variables, balance, reportes y dashboard, reportes
automáticos por correo/WhatsApp, análisis IA de temporadas y carga inicial de
inventario.

---

## 2. Arquitectura en capas (visión rápida)

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENTE MÓVIL (React Native + Expo, TypeScript estricto)     │
│                                                                │
│   app/      → pantallas y navegación (expo-router)            │
│   lib/      → lógica de dominio + acceso a datos + utilidades │
│   (estado de auth vía React Context en lib/auth.tsx)          │
└───────────────┬──────────────────────────────────────────────┘
                │  @supabase/supabase-js (HTTPS / PostgREST / RPC)
                │
┌───────────────▼──────────────────────────────────────────────┐
│  SUPABASE (backend gestionado)                                 │
│                                                                │
│   PostgreSQL 17  → tablas, RLS en todas, funciones RPC,       │
│                    triggers de auditoría, vistas               │
│   Auth           → email + PIN, sesiones JWT                   │
│   Storage        → fotos de productos y comprobantes           │
│   Edge Functions → Deno/TS (reporte diario por correo)        │
└────────────────────────────────────────────────────────────────┘
                │
                └──► Resend API (envío de correo del reporte diario)
```

La regla arquitectónica del proyecto: **lógica pura y testeable** (ej.
`lib/carrito.ts`, `lib/balance.ts`, `lib/busqueda.ts`) separada del **acceso a
datos** (llamadas a Supabase) y de la **UI** (componentes en `app/`).

---

## 3. Capa cliente (frontend móvil)

### Lenguaje
- **TypeScript en modo estricto** (`tsconfig.json` extiende `expo/tsconfig.base`
  con `"strict": true`). El typecheck (`tsc --noEmit`) es parte del health check.
- `env.d.ts` versionado provee los tipos de `process.env.EXPO_PUBLIC_*` para que
  `tsc` resuelva sin tener que correr Expo antes (el `expo-env.d.ts` autogenerado
  está en `.gitignore`).

### Framework y runtime
- **React Native 0.86.3** sobre **React 19.2.3**.
- **Expo SDK 57** (managed workflow). Scripts: `expo start`, `--android`,
  `--ios`, `--web`.
- **expo-router ~6** → navegación basada en archivos (file-based routing).

### Estructura de navegación (`app/`)
Rutas agrupadas por grupos de expo-router:

- `app/_layout.tsx` — raíz; monta el `AuthProvider`.
- `app/(auth)/` — flujo no autenticado (`login.tsx`).
- `app/(app)/` — área autenticada. Cada módulo es una subcarpeta con su
  `_layout.tsx` y pantallas:
  - `ventas/` (index, nueva)
  - `devoluciones/` (index, nueva)
  - `inventario/calzado/` y `inventario/granja/` (index, editor, `[id]`)
  - `inventario/carga.tsx` (carga inicial Excel/IA)
  - `recibir-mercancia/` (index, nueva, `[id]`)
  - `proveedores/` (index, editor, `[id]`)
  - `caja/` (index, cierre, historial)
  - `empleados/` (index, `[id]`)
  - `gastos/` (index, fijos, fijos-editor, pagar)
  - `balance/`, `reportes/` (index, config, periodos)
  - `modulo/[id].tsx` — pantalla genérica "en construcción" para módulos sin
    ruta propia (ej. Análisis IA / M14 todavía no construido).

### Librerías clave del cliente
| Librería | Uso |
|---|---|
| `@supabase/supabase-js ^2.108` | Cliente del backend (DB, Auth, Storage, RPC). |
| `@react-native-async-storage/async-storage` | Persistencia de la sesión de Supabase Auth. |
| `react-native-url-polyfill` | Polyfill de `URL` requerido por supabase-js en RN. |
| `expo-image-picker` + `expo-image-manipulator` | Tomar/elegir fotos y **comprimirlas a ≤500KB** antes de subir. |
| `expo-document-picker` + `xlsx` | Lectura de plantilla Excel para carga inicial de inventario. |
| `expo-sqlite` | Dependencia presente (base para offline-first diferido). |
| `@expo/vector-icons` | Iconografía. |
| `react-native-gesture-handler`, `react-native-screens`, `react-native-safe-area-context`, `expo-status-bar`, `expo-linking`, `expo-constants` | Infraestructura estándar de navegación/UI de Expo. |

### Estado y autenticación en cliente
- `lib/auth.tsx` — `AuthProvider` basado en **React Context**. Mantiene la
  `session` de Supabase y el `perfil` (`{ id, nombre, rol, activo }`) leído de
  `public.users`. Es **fail-closed**: una cuenta `activo = false` se trata como
  perfil nulo (sin acceso).
- Login por **email + PIN**.
- Cliente Supabase configurado en `lib/supabase.ts` con `autoRefreshToken`,
  `persistSession` (en AsyncStorage) y `detectSessionInUrl: false`.

### Capa de dominio / datos (`lib/`)
Cada módulo tiene su archivo de lógica + datos, y muchos tienen tests al lado:

- **Lógica pura testeada:** `carrito.ts`, `balance.ts`, `busqueda.ts`
  (`orIlike()` — escape seguro de búsquedas PostgREST contra inyección),
  `permisos.ts`, `reporteDiario.ts`, `reportes.ts`.
- **Acceso a datos:** `ventas.ts`, `devoluciones.ts`, `inventario.ts`,
  `proveedores.ts`, `empleados.ts`, `gastos.ts`, `caja.ts`, `usuarios.ts`.
- **Utilidades:** `storage.ts` y `imagenes.ts` (compresión adaptativa de
  imágenes; en RN hay que subir como `Uint8Array`, no `Blob`), `excel.ts`
  (lectura de Excel para carga inicial), `database.types.ts` (tipos generados
  desde el esquema de Supabase).
- `permisos.ts` define los 3 roles (`dueno | admin | empleado`), la lista de
  `MODULOS` con sus `roles` y `ruta`, y los helpers `modulosPara(rol)` /
  `puedeAcceder(rol, id)`. La home arma los accesos directos a partir de esta
  tabla.

---

## 4. Capa backend (Supabase)

Backend gestionado por **Supabase**. Configuración local en `supabase/config.toml`;
migraciones versionadas en `supabase/migrations/`.

### Base de datos — PostgreSQL 17
- **RLS (Row Level Security) activado en todas las tablas.** El control de acceso
  por rol vive en la base, no solo en el cliente.
- Esquema `private` con **helpers de rol** usados por las políticas RLS:
  `private.user_role`, `is_owner`, `is_admin`, `is_employee`, `is_staff_admin`.
- Helper de fecha local `private.hoy_bogota()` (zona horaria America/Bogotá) y
  formateo de moneda `private.fmt_cop`.
- **Auditoría** vía triggers: `set_audit_fields`, `set_registrado_por`,
  `set_updated_at`; las tablas llevan `created_by`/`registrado_por` y hay una
  migración que hace **inviolable** el `created_by`. Disparadores adicionales
  para historial de precios (`log_precio_calzado`, `log_precio_varios`),
  ajuste/incremento de stock en compras y recálculo de saldos.

#### Tablas principales (~24)
Usuarios y auth: `users`.
Catálogo/inventario: `productos_calzado`, `productos_varios` (Granja),
`historial_precios_calzado`, `historial_precios_varios`.
Ventas: `ventas`, `venta_items`, `metodos_pago_venta`, `devoluciones`,
`devolucion_items`.
Compras/proveedores: `proveedores`, `proveedor_cuentas_bancarias`, `compras`,
`compra_items`, `compra_pagos`, `compra_documentos`.
Caja y gastos: `cierres_caja`, `gastos_fijos`, `gastos_fijos_pagos`,
`gastos_variables`.
Empleados: `empleado_config`, `empleado_dias_trabajados`, `empleado_pagos`.
Datos para análisis IA: `clima_registro`.

#### Funciones RPC (lógica de negocio en la DB, esquema `public`)
Las operaciones críticas se ejecutan como **funciones RPC** (transaccionales,
con gating de rol) en vez de inserts directos:
- `registrar_venta` — confirma una venta (carrito + pagos mixtos + precio por item).
- `registrar_devolucion` — devolución total/parcial/cambio; restituye stock de
  calzado; maneja diferencia de precio en cambios.
- `guardar_producto_calzado` — alta/edición de calzado con gate de rol.
- `obtener_balance`, `obtener_dashboard_dueno` — finanzas (solo dueño).
- `obtener_reporte_diario`, `obtener_reporte_periodo`, `obtener_resumen_dia` —
  reportes (neteo por fecha de venta).
- `obtener_dias_trabajados`, `obtener_deuda_proveedor`.

### Auth
- **Supabase Auth** con login email + PIN. Sesiones JWT persistidas en el
  cliente vía AsyncStorage. Las cuentas viven en Supabase Auth + `public.users`.
- Solo el dueño (Andrés) puede crear/desactivar empleados (M8.2 "crear cuenta
  Auth desde la app" está diferido).

### Storage
- Buckets de Supabase Storage para **fotos de productos** y **comprobantes** de
  gastos/compras. Las imágenes se comprimen a ≤500KB antes de subir.
- Nota técnica RN: subir un `Blob` falla ("Network failed"); hay que leer el
  archivo como `Uint8Array`/arraybuffer y subir eso (`lib/storage.ts`,
  `lib/imagenes.ts`).

### Edge Functions (Deno + TypeScript)
- `supabase/functions/enviar-reporte-diario/index.ts` — función serverless en
  **Deno** que genera el reporte diario llamando al RPC `obtener_reporte_diario`
  y lo envía por **correo a través de la API de Resend**. Usa el
  `service_role_key`, respeta la config (`reporte_config`) e idempotencia
  (`reporte_envios`, no reenvía si ya se mandó).

### Migraciones
~23 migraciones SQL versionadas, desde `init_venus_schema` hasta los módulos
M2 (devoluciones), M8 (empleados), M11 (balance), M12 (dashboard) y M13
(reportes automáticos). Las migraciones son la fuente de verdad del esquema;
los tipos TS (`lib/database.types.ts`) se generan a partir de él.

---

## 5. Servicios externos
- **Supabase** — base de datos, auth, storage y edge functions (PostgreSQL 17).
- **Resend** — proveedor de email para el reporte diario (vía Edge Function).
- **WhatsApp** — enlaces directos (`wa.me`) para contactar proveedores y para el
  resumen diario (apertura del chat, no API empresarial).

### Variables de entorno
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- (En el lado servidor/Edge: `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`.)

---

## 6. Pruebas y calidad

### Tests del cliente — Jest
- **Jest ~29.7** con preset **`jest-expo`** (`@types/jest`, `jest-expo`).
- 16 archivos de test en `lib/`. Dos tipos:
  - **Unitarios de lógica pura:** `carrito.test.ts`, `balance.test.ts`,
    `busqueda.test.ts`, `permisos.test.ts`, `devoluciones.test.ts`,
    `empleados.test.ts`, `reportes.test.ts`, `reporteDiario.test.ts`.
  - **Tests de UI/integración:** `*_ui.test.tsx` (balance, devoluciones,
    empleados, proveedores, recibir_mercancia, reportes, reporteDiario) y
    `proveedores_e2e.test.ts` (con un `mockDb` en memoria).
- Comando: `npm test`.

### Tests del backend — SQL smoke tests
- `supabase/tests/smoke_test_*.sql` — pruebas de humo de RLS/RPC por módulo
  (balance, dashboard, devoluciones, empleados, proveedores, reporte diario,
  reporte por periodo). Importante: deben sembrar `auth.users` antes que
  `public.users`.

### Health check del proyecto
1. `tsc --noEmit` (typecheck estricto, exit 0).
2. `npm test` (suite verde).

---

## 7. Tooling, docs y flujo de trabajo
- **Control de versiones:** Git (rama principal `main`); flujo de ramas por
  feature mergeadas con `--no-ff`.
- **Gestor de paquetes:** npm (`package-lock.json`).
- **Documentación del proyecto:** `docs/Venus_PRD_v4.0.md` (PRD maestro),
  `CLAUDE.md` (guía para el asistente), `AGENTS.md`, `openspec/` (specs y
  `tasks.json`), `PROJECT.md`, `TEST_INFRA.md` / `TEST_READY.md`,
  `ORIGINAL_REQUEST.md`.
- **Sembrado de datos:** `supabase/seeds/` (inventario demo, cuenta admin Sandra).

---

## 8. Resumen del stack por capa

| Capa | Tecnología |
|---|---|
| Lenguaje (todo el proyecto) | TypeScript estricto |
| UI / móvil | React Native 0.86 + React 19.2 + Expo SDK 57 |
| Navegación | expo-router 6 (file-based) |
| Estado de auth | React Context (`lib/auth.tsx`) |
| Cliente backend | `@supabase/supabase-js` |
| Persistencia de sesión | AsyncStorage |
| Imágenes / archivos | expo-image-picker, expo-image-manipulator, expo-document-picker, xlsx |
| Base de datos | PostgreSQL 17 (Supabase) con RLS en todas las tablas |
| Lógica de negocio servidor | Funciones RPC en PostgreSQL + triggers de auditoría |
| Autenticación | Supabase Auth (email + PIN, JWT) |
| Almacenamiento de archivos | Supabase Storage (fotos ≤500KB, comprobantes) |
| Serverless | Edge Functions en Deno/TypeScript |
| Email | Resend API |
| Mensajería | enlaces WhatsApp (`wa.me`) |
| Tests cliente | Jest + jest-expo |
| Tests backend | smoke tests SQL |
| Build / dev | Expo CLI |
| VCS / paquetes | Git + npm |

---

## 9. Lo que NO se construye en esta versión
Facturación electrónica DIAN, e-commerce/catálogo por WhatsApp, nómina
electrónica, contabilidad formal, múltiples sucursales, app iOS, panel web,
ventas a crédito con intereses, y **offline-first** (diferido — de ahí que
`expo-sqlite` esté presente pero sin uso productivo todavía).
