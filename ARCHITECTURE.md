# Venus — Arquitectura de la App (mapa real del código)

> Documento generado a partir del código fuente real en `app/`, `lib/` y archivos de
> configuración. No describe el PRD ni intenciones de diseño: describe **lo que el código
> hace hoy**. Donde el código no permite afirmar algo con certeza, se marca como
> **"no determinado"**.
>
> Stack: React Native + Expo SDK 54, **expo-router** (navegación basada en archivos),
> Supabase (PostgreSQL + Auth + Storage, RLS). Online-first. UI en español, Android, portrait.
>
> Convención de rutas: el grupo `(app)` y `(auth)` son *route groups* de expo-router (no
> aparecen en la URL). Cada carpeta con `_layout.tsx` define un `Stack` anidado.

---

## 1. Mapa de navegación (árbol de rutas)

Tres capas de layout encadenadas hacen de *guardia* de sesión y rol:

- `app/_layout.tsx` → `RootLayout`: monta `AuthProvider` + `Navegacion`. Muestra spinner
  mientras carga; si hay sesión pero **no** se pudo cargar el perfil, *fail-closed* (pantalla
  "No pudimos cargar tu perfil" con botón Cerrar sesión). Si todo ok → `<Stack headerShown:false>`.
- `app/(auth)/_layout.tsx` → si **hay** sesión, `Redirect → "/"`; si no, `Stack`.
- `app/(app)/_layout.tsx` → si **no** hay sesión, `Redirect → "/login"`; si sí, `Stack headerShown:false`.

```
app/_layout.tsx  (RootLayout: AuthProvider → Navegacion → Stack, sin header)
│
├── (auth)/_layout.tsx          [Stack · redirige a "/" si ya hay sesión]
│   └── login.tsx               → /login   · Pantalla de login (selector de usuario + PIN)
│
└── (app)/_layout.tsx           [Stack sin header · redirige a /login si no hay sesión]
    │
    ├── index.tsx               → /         · HOME (grid de módulos según rol)
    ├── modulo/[id].tsx         → /modulo/:id · Placeholder "En construcción" (módulos sin pantalla)
    │
    ├── ventas/                 (sin _layout propio → usa el Stack de (app))
    │   ├── index.tsx           → /ventas            · Hub de ventas del día
    │   └── nueva.tsx           → /ventas/nueva       · Flujo carrito → cobrar → confirmación
    │
    ├── devoluciones/_layout.tsx   [Stack · useRequireModulo('devoluciones')]
    │   ├── index.tsx           → /devoluciones       · Buscar venta por número
    │   └── nueva.tsx           → /devoluciones/nueva  · Registrar devolución/cambio
    │
    ├── inventario/_layout.tsx     [Stack con header]
    │   ├── calzado/index.tsx   → /inventario/calzado          · Lista de calzado (registrada)
    │   ├── calzado/[id].tsx    → /inventario/calzado/:id      · Detalle de calzado (registrada)
    │   ├── calzado/editor.tsx  → /inventario/calzado/editor   · Crear/editar calzado (NO registrada*)
    │   ├── granja/index.tsx    → /inventario/granja           · Lista Granja (NO registrada*)
    │   ├── granja/editor.tsx   → /inventario/granja/editor    · Crear/editar Granja (NO registrada*)
    │   └── carga.tsx           → /inventario/carga            · Carga masiva por Excel (NO registrada*)
    │
    ├── recibir-mercancia/_layout.tsx  [Stack · useRequireModulo('recibir-mercancia')]
    │   ├── index.tsx           → /recibir-mercancia       · Entradas pendientes de revisión
    │   ├── nueva.tsx           → /recibir-mercancia/nueva  · Registrar entrada / compra
    │   └── [id].tsx            → /recibir-mercancia/:id    · Completar info financiera (solo dueño)
    │
    ├── proveedores/_layout.tsx    [Stack · useRequireModulo('proveedores')]
    │   ├── index.tsx           → /proveedores        · Lista de proveedores
    │   ├── editor.tsx          → /proveedores/editor  · Crear/editar proveedor (modal)
    │   └── [id].tsx            → /proveedores/:id     · Detalle (datos, cuentas, deudas)
    │
    ├── caja/_layout.tsx           [Stack con header · botones Config/Historial por rol]
    │   ├── index.tsx           → /caja            · Dashboard / abrir / reabrir caja
    │   ├── cierre.tsx          → /caja/cierre      · Calculadora de cierre (modal)
    │   ├── historial.tsx       → /caja/historial   · Historial de cierres (dueño/admin)
    │   └── config.tsx          → /caja/config      · Horario automático (solo dueño)
    │
    ├── gastos/_layout.tsx         [Stack · Redirect → "/" si rol ≠ dueño]
    │   ├── index.tsx           → /gastos              · Gastos variables (tab)
    │   ├── fijos.tsx           → /gastos/fijos         · Gastos fijos (tab)
    │   ├── fijos-editor.tsx    → /gastos/fijos-editor  · Nuevo gasto fijo (modal)
    │   └── pagar.tsx           → /gastos/pagar         · Registrar pago de gasto fijo (modal)
    │
    ├── reportes/_layout.tsx       [Stack · useRequireModulo('reportes')]
    │   ├── index.tsx           → /reportes          · Dashboard del día
    │   ├── periodos.tsx        → /reportes/periodos  · Reporte por semana/mes
    │   └── config.tsx          → /reportes/config    · Reportes automáticos (solo dueño)
    │
    ├── balance/_layout.tsx        [Stack · useRequireModulo('balance')]
    │   └── index.tsx           → /balance       · Balance ingresos − egresos (solo dueño)
    │
    └── empleados/_layout.tsx      [Stack · useRequireModulo('gestion-empleado')]
        ├── index.tsx           → /empleados       · Lista de empleados (solo dueño)
        └── [id].tsx            → /empleados/:id    · Detalle: sueldo, pagos, activar/desactivar
```

`* NO registrada` = la pantalla **existe** y es navegable (expo-router enruta por archivo),
pero **no** está declarada como `<Stack.Screen>` en `inventario/_layout.tsx` (solo `calzado/index`
y `calzado/[id]` lo están). Funciona, pero hereda opciones de header por defecto.

**Presentaciones especiales (modales):** `caja/cierre` (`presentation: 'modal'`),
`proveedores/editor` (`'modal'`), `gastos/fijos-editor` y `gastos/pagar` (`'modal'`).
Además, varias pantallas abren modales **internos** vía `<Modal>` de React Native
(no son rutas): buscador de reemplazo en devoluciones; crear proveedor/calzado en
recibir-mercancía; cuenta bancaria y registrar pago en proveedores; alta de gasto variable en gastos.

---

## 2. Qué hace cada pantalla

### Autenticación

| Pantalla | Ruta | Qué muestra / acciones |
|---|---|---|
| Login | `/login` | Dos pasos: (1) selector de usuario desde lista fija `lib/usuarios.ts` (Andrés, Sandra, Camilo, Beatriz); (2) PIN numérico (4 dígitos, `secureTextEntry`). Llama `iniciarSesion(email, pin)` → `signInWithPassword`. Distingue PIN incorrecto de falta de conexión. Link "Cambiar usuario". |

### Home y placeholder

| Pantalla | Ruta | Qué muestra / acciones |
|---|---|---|
| Home | `/` | Saludo ("Hola, {primer nombre}") + botón Salir. Grid de *tiles* generado por `modulosPara(perfil.rol)`. Cada tile navega a `m.ruta` o, si no tiene, a `/modulo/{id}`. |
| Módulo placeholder | `/modulo/:id` | Para módulos sin pantalla propia. Verifica acceso con `useRequireModulo(id)`. Muestra icono + título + "En construcción" + botón Volver. Hoy solo lo alcanza **Análisis IA** (`analisis-ia`, sin `ruta`). |

### Ventas (Módulo 1)

| Pantalla | Ruta | Qué muestra / acciones |
|---|---|---|
| Ventas (hub) | `/ventas` | Resumen del día (`resumenHoy`) + lista de ventas de hoy (`listarVentasHoy`), recargada en foco. Botón "+ Nueva venta". |
| Nueva venta | `/ventas/nueva` | Máquina de estados `carrito → cobrar → confirmacion`. **Bloquea la venta si la caja no está abierta** (`obtenerCajaHoy`). Carrito con búsqueda debounced (`buscarProductos`), regateo por ítem con alerta bajo mínimo, calzado con stock vs Granja con precio/unidad en el momento. Cobro con métodos efectivo/Nequi/Daviplata (mixto), efectivo recibido y cambio; los pagos deben **cuadrar exacto** (`pagosCuadran`). Cliente opcional. Confirma con `registrarVenta`. |

### Devoluciones (Módulo 2)

| Pantalla | Ruta | Qué muestra / acciones |
|---|---|---|
| Devoluciones | `/devoluciones` | Input de número de venta + `buscarVentaParaDevolucion`. Si existe, navega a `nueva` con params; si no, "Venta no encontrada". Placeholder de historial del día (aún sin datos). |
| Nueva devolución | `/devoluciones/nueva` | Carga la venta (rechaza estados terminales). Tipo `total/parcial/cambio`. Cantidades por ítem; en **cambio** solo aplica calzado (Granja bloqueada) y abre modal para buscar calzado de reemplazo + precio, calculando diferencia. Resumen neto reembolso/cobro con método obligatorio. Confirma con `registrarDevolucion`. |

### Inventario — Calzado (Módulo 3), Granja (Módulo 4), Carga (Módulo 15)

| Pantalla | Ruta | Qué muestra / acciones |
|---|---|---|
| Calzado (lista) | `/inventario/calzado` | Búsqueda en tiempo real + chips de categoría (`Todas/Tenis/Botas/Sandalias/Casual/Deportivo`). Tarjetas con foto, precio min–max y badge de stock (alerta si ≤ mínimo). FAB "+" **oculto para empleado**. |
| Calzado (detalle) | `/inventario/calzado/:id` | Foto, atributos, precios min/máx. **Costo de compra solo si dueño** (lee `historial_precios_calzado`). Botón Editar **oculto para empleado**. |
| Calzado (editor) | `/inventario/calzado/editor` | Crear/editar producto. Foto vía cámara/galería (`comprimirYSubirImagen`). Campo costo de compra **solo dueño**. Al crear ofrece "¿Agregar otro similar?". Expulsa a empleado (`Redirect`). |
| Granja (lista) | `/inventario/granja` | Búsqueda. Tarjetas con nombre, unidad de medida y precio sugerido. **Sin stock** (Granja no maneja inventario). Editar/FAB **ocultos para empleado**. |
| Granja (editor) | `/inventario/granja/editor` | Crear/editar producto de Granja (nombre, unidad, precio sugerido, foto). Sin stock. Expulsa a empleado. |
| Carga inicial | `/inventario/carga` | **Solo dueño** (`Redirect → "/"`). Selecciona Excel (`expo-document-picker`), valida filas (`lib/excel`), muestra errores y sube en lote con `guardarCalzado`. |

### Recibir Mercancía (Módulo 5)

| Pantalla | Ruta | Qué muestra / acciones |
|---|---|---|
| Entradas | `/recibir-mercancia` | Lista de entradas `pendiente_revision`. Empleado solo ve **las suyas** (filtra por `registrada_por`); dueño/admin ven todas y abren el detalle. Solo el **dueño** ve el total (costos). FAB "+". |
| Nueva entrada | `/recibir-mercancia/nueva` | Selección de proveedor (chips) + buscar calzado / crear calzado inline (7 categorías fijas) + crear proveedor inline (**solo dueño/admin**). El **dueño** registra **compra directa** con costos/condición de pago/vencimiento (`registrarCompraDirecta`); admin/empleado registran **llegada física** sin costos (`registrarLlegadaFisica`). |
| Completar entrada | `/recibir-mercancia/:id` | **Solo dueño** (`Redirect → "/"`). Captura costo unitario por ítem, condición contado/crédito + vencimiento y notas; calcula total y llama `completarInformacionFinanciera`. |

### Proveedores (Módulo 6)

| Pantalla | Ruta | Qué muestra / acciones |
|---|---|---|
| Proveedores | `/proveedores` | Búsqueda por nombre/NIT + filtro Activos/Inactivos. Tarjetas con datos de contacto, editar rápido, FAB "+". |
| Detalle | `/proveedores/:id` | Datos generales (+WhatsApp directo), cuentas bancarias (agregar/eliminar vía modal). **Panel financiero solo dueño**: deuda consolidada, compras a crédito pendientes y registrar pago (modal), historial de pagos. |
| Editor | `/proveedores/editor` | Crear/editar proveedor (nombre, NIT, teléfono, ciudad, email — guardado dentro de `notas` —, switch activo). |

### Caja (Módulo 7)

| Pantalla | Ruta | Qué muestra / acciones |
|---|---|---|
| Caja (dashboard) | `/caja` | Si no hay caja: botón "Abrir Caja del Día" (`abrirCaja`). Si abierta: resumen en vivo (`obtenerResumenEnVivo`) + "Ir a Cerrar Caja". Si cerrada: resumen final + "Abrir caja de nuevo" (`reabrirCaja`, mismo día). Pull-to-refresh. |
| Cierre | `/caja/cierre` | Calculadora: efectivo esperado vs contado → diferencia (nota obligatoria si hay descuadre). `cerrarCaja` + dispara reporte por correo (fire-and-forget) y arma link de WhatsApp del día. |
| Historial | `/caja/historial` | **Dueño/admin** (`Redirect → /caja` si no). Lista de cierres con totales, diferencia, nota y "Cerró: {nombre}" o "Automático". |
| Config | `/caja/config` | **Solo dueño** (`Redirect → /caja`). Switch modo automático + horas apertura/cierre (HH:MM). Persiste en `caja_config`. |

### Gastos (Módulos 9 y 10)

| Pantalla | Ruta | Qué muestra / acciones |
|---|---|---|
| Gastos variables | `/gastos` | Tabs Variables/Fijos. Lista del mes (`obtenerGastosVariables`). Modal para nuevo gasto (categoría, descripción, monto, foto de factura por cámara). |
| Gastos fijos | `/gastos/fijos` | Lista de gastos fijos activos con semáforo (Pagado/Atrasado/Por vencer). Tap en uno no pagado → pantalla de pago. FAB "+". |
| Nuevo gasto fijo | `/gastos/fijos-editor` | Alta de contrato recurrente (nombre, monto aprox., día de pago 1–31, beneficiario, notas). |
| Pagar gasto fijo | `/gastos/pagar` | Recibe `id/nombre/monto` por params. Registra el pago del periodo (`registrarPagoFijo`) con foto de recibo opcional. |

> ⚠️ Todo el grupo `gastos/` está protegido por el layout con `rol === 'dueño'`. Ver §5.

### Reportes (Módulos 12 y 13) y Balance (Módulo 11)

| Pantalla | Ruta | Qué muestra / acciones |
|---|---|---|
| Reportes (dashboard) | `/reportes` | Ventas de hoy con comparación vs ayer, desglose por método, stock bajo (ambos roles). **Solo dueño**: proveedores por vencer + empleados sin actividad (`obtenerDashboardDueno`) y enlace a config de reportes automáticos. Enlace a reporte por período. |
| Reporte por período | `/reportes/periodos` | Selector Semana/Mes con navegación temporal. Total vendido + comparación, día top, top productos, calzado sin movimiento (`obtenerReportePeriodo`). |
| Reportes automáticos | `/reportes/config` | **Solo dueño** (`Redirect → /reportes`). Switches WhatsApp / correo automático + correo destino. Persiste vía `guardarReporteConfig`. |
| Balance | `/balance` | **Solo dueño** (módulo SOLO_DUENO). Selector Semana/Mes. Ganancia/pérdida, ingresos netos vs egresos, desgloses y proyección del mes en curso (`obtenerBalance`, `proyeccionMes`). |

### Empleados (Módulo 8)

| Pantalla | Ruta | Qué muestra / acciones |
|---|---|---|
| Empleados | `/empleados` | **Solo dueño**. Lista con rol (Administrativo/Operativo), sueldo, días trabajados este mes y badge activo/inactivo. |
| Detalle empleado | `/empleados/:id` | Editar nombre/sueldo/días-semana/fecha inicio; activar/desactivar; registrar pago con monto proporcional sugerido; historial de pagos. |

> **Análisis IA (Módulo 14):** definido en `permisos.ts` (solo dueño) pero **sin pantalla**.
> Cae en el placeholder `/modulo/analisis-ia` ("En construcción").

---

## 3. Relaciones entre módulos (flujos que cruzan límites)

Las pantallas comparten estado **a través de la base de datos** (Supabase) y de los
módulos de `lib/`, no de un store global en cliente. Aristas de navegación y de datos:

**Aristas de navegación (push/replace) — extraídas del código:**

- Home → cualquier módulo (`m.ruta`), o `/modulo/:id` para los que no tienen pantalla.
- Ventas: `/ventas → /ventas/nueva`. Tras vender o si la caja está cerrada → `/ventas` o **`/caja`** (replace).
- Devoluciones: `/devoluciones → /devoluciones/nueva` (params `venta`,`numero`) → `back()` al éxito.
- Inventario: lista → `:id` → `editor?id=`; editor hace `replace` a la lista. Carga → `/inventario/calzado` al terminar.
- Recibir: lista → `nueva` (→ `replace /` al guardar) y lista → `:id` (→ `replace /recibir-mercancia`).
- Proveedores: lista → `:id` y lista/detalle → `editor?id=` → `back()`.
- Caja: `/caja → /caja/cierre`; header → `/caja/config` (dueño) y `/caja/historial` (dueño/admin); cierre → `replace /caja`.
- Gastos: `/gastos ⇄ /gastos/fijos` (tabs, `replace`); fijos → `/gastos/pagar?…` y `/gastos/fijos-editor`.
- Reportes: `/reportes → /reportes/periodos` y `→ /reportes/config` (dueño).
- Empleados: `/empleados → /empleados/:id`.

**Flujos de datos que cruzan módulos (imports reales entre `lib/`):**

| Flujo cruzado | Dónde | Cómo |
|---|---|---|
| **Ventas → Caja** | `ventas/nueva.tsx` importa `lib/caja` | Antes de vender consulta `obtenerCajaHoy`; si no está abierta, **bloquea** y ofrece ir a Caja. La venta alimenta el resumen en vivo de Caja. |
| **Caja → Reportes/Comunicación** | `caja/cierre.tsx` importa `lib/reporteDiario` | Al cerrar, dispara correo (`dispararReporteCorreo`) y arma WhatsApp (`obtenerReporteDiario`, `construirLinkWhatsapp`). |
| **Devoluciones → Inventario** | `devoluciones/nueva.tsx` importa `lib/inventario` | En "cambio" busca calzado de reemplazo (`listarCalzado`); devoluciones de calzado restituyen stock (Granja no). |
| **Recibir → Inventario + Proveedores** | `recibir-mercancia/nueva.tsx` importa `lib/inventario` y `lib/proveedores` | Crea calzado nuevo inline (`guardarCalzado`), crea proveedor inline, registra compra/llegada; subir mercancía aumenta stock de calzado. |
| **Recibir → Proveedores (deuda)** | `recibir-mercancia/[id].tsx` y `proveedores/[id].tsx` | Las compras a crédito generan saldo y deuda del proveedor; el detalle de proveedor registra pagos contra esas compras. |
| **Reportes/Balance ← todo lo financiero** | `reportes/index`, `reportes/periodos`, `balance/index` | Agregan ventas, devoluciones, gastos fijos/variables, pagos a proveedores y sueldos (`lib/reportes`, `lib/balance`). `reportes/periodos` reutiliza `rangoPeriodo` de `lib/balance`. |

**Entidades compartidas en BD** (deducidas de los imports): `cierres_caja`/`caja_config`
(Caja, Ventas, Reportes), `productos_calzado`/`historial_precios_calzado` (Inventario, Ventas,
Devoluciones, Recibir, Reportes), `productos_varios` (Granja, Ventas), `proveedores`/compras/pagos
(Proveedores, Recibir, Balance), `users` (Auth, Empleados, "quién hizo qué" en Recibir/Caja).

---

## 4. Componentes compartidos

**No existe un directorio `components/` ni `hooks/` en el proyecto** (verificado: ambos
ausentes en la raíz). No hay sistema de componentes de UI reutilizables ni un tema/tokens
compartido (cada pantalla define su propio `StyleSheet.create` con colores hardcodeados).

La reutilización ocurre **a nivel de lógica**, vía `lib/`. El "componente" más compartido
es el módulo de autenticación:

| Recurso compartido | Origen | Usado por (aprox.) | Rol |
|---|---|---|---|
| `useAuth()` / `useRequireModulo()` / `AuthProvider` / `Perfil` | `lib/auth.tsx` | **~30 pantallas** (todos los módulos) | Sesión, perfil/rol y guardia de acceso por módulo |
| `MODULOS`, `modulosPara`, `puedeAcceder`, `Rol` | `lib/permisos.ts` | Home + `useRequireModulo` | Catálogo de módulos y matriz de permisos |
| `supabase` (cliente) | `lib/supabase.ts` | Pantallas que consultan directo (caja/historial, inventario detalle/editor, recibir/index, gastos/fijos…) | Acceso a datos sin pasar por una capa `lib/*` específica |
| `comprimirYSubirImagen` | `lib/imagenes.ts` | Editores de calzado y Granja | Compresión + subida de fotos a Storage |
| `lib/inventario` (`listarCalzado`, `guardarCalzado`, tipos) | `lib/inventario.ts` | Inventario, Ventas (búsqueda), Devoluciones (reemplazo), Recibir | Acceso a calzado/Granja |
| `lib/proveedores` | `lib/proveedores.ts` | Proveedores, Recibir mercancía | Proveedores, compras, cuentas, pagos |
| `pesos(n)` / formato COP | **Re-declarado localmente** en casi cada pantalla | — | `'$' + n.toLocaleString('es-CO')`. **No** está centralizado: se repite el helper. |

**Sub-componentes locales** (definidos y usados dentro de un solo archivo, no compartidos):
`LineaCarrito` (ventas/nueva), `MetodoPicker` y `BuscadorReemplazoModal` (devoluciones/nueva),
`Fila` (reportes/index, reportes/periodos y balance/index — **misma idea reimplementada 3 veces**).

> Oportunidad evidente: extraer `components/` (Tarjeta, Boton, Badge, Input, `Fila`),
> `lib/theme.ts` (tokens) y un `formatoMoneda` único. Coincide con lo documentado en `design.md`.

---

## 5. Permisos por rol

### Modelo de roles

`lib/permisos.ts` define `Rol = 'dueno' | 'admin' | 'empleado'` y tres grupos:

- `TODOS = [dueno, admin, empleado]`
- `STAFF_ADMIN = [dueno, admin]`
- `SOLO_DUENO = [dueno]`

El perfil (`lib/auth.tsx → Perfil`) trae `{ id, nombre, rol, activo }` desde `public.users`.
Cuentas reales: **Andrés** (`dueno`), **Sandra** (`admin`), **Camilo/Beatriz/Nikol** (`empleado`).
Una cuenta `activo === false` se trata como sin perfil (fail-closed, no entra).

### Matriz de acceso a módulos (según `MODULOS` en `permisos.ts`)

| Módulo (id) | `ruta` | Roles declarados | ¿Pantalla real? |
|---|---|---|---|
| `ventas` | `/ventas` | TODOS | Sí |
| `devoluciones` | `/devoluciones` | TODOS | Sí |
| `inventario-calzado` | `/inventario/calzado` | TODOS | Sí (ver §nota empleado) |
| `granja` | `/inventario/granja` | TODOS | Sí (ver §nota empleado) |
| `recibir-mercancia` | `/recibir-mercancia` | TODOS | Sí (acciones difieren por rol) |
| `caja` | `/caja` | TODOS | Sí |
| `gastos-variables` | `/gastos` | TODOS | Sí — **pero gateado a dueño** ⚠️ |
| `proveedores` | `/proveedores` | STAFF_ADMIN | Sí |
| `gastos-fijos` | `/gastos/fijos` | STAFF_ADMIN | Sí — **pero gateado a dueño** ⚠️ |
| `reportes` | `/reportes` | STAFF_ADMIN | Sí |
| `carga-inicial` | `/inventario/carga` | STAFF_ADMIN | Sí — **pero gateado a dueño** ⚠️ |
| `gestion-empleado` | `/empleados` | SOLO_DUENO | Sí |
| `balance` | `/balance` | SOLO_DUENO | Sí |
| `analisis-ia` | — | SOLO_DUENO | **No** → placeholder |

### Dónde se aplica el permiso

1. **Visibilidad de tiles en Home**: `modulosPara(rol)` filtra qué módulos ve cada usuario.
2. **Guardia por layout/pantalla**: cada módulo verifica acceso al entrar:
   - `useRequireModulo(id)` (devuelve `<Redirect href="/" />` si el rol no califica): devoluciones,
     proveedores, recibir-mercancia, reportes, balance, empleados, inventario (vía pantallas) y ventas.
   - `Redirect` manual por rol: `gastos/_layout` (`rol !== 'dueno'`), `inventario/carga`
     (`rol !== 'dueno'`), `recibir-mercancia/[id]` (`rol !== 'dueno'`), `caja/config` y
     `reportes/config` (`rol !== 'dueno'`), `caja/historial` (`dueno`/`admin`).
3. **Ocultar acciones/datos dentro de la pantalla** (mismo rol, distinta capacidad):
   - **Costo de compra y márgenes**: visibles **solo para `dueno`** en detalle/editor de calzado,
     recibir-mercancía (columna costo + panel financiero) y panel financiero de proveedores.
   - **Edición de inventario** (calzado y Granja): FAB y botón Editar **ocultos para `empleado`**;
     los editores expulsan a `empleado` → en la práctica el empleado tiene inventario **solo lectura**.
   - **Recibir mercancía**: `empleado` solo ve sus propias entradas y registra "llegada física"
     sin costos; `dueno` registra compra directa con costos; crear proveedor inline = dueño/admin.

### ⚠️ Discrepancias código ↔ `permisos.ts` / CLAUDE.md (no determinado si intencionales)

- **Gastos (variables y fijos)**: `permisos.ts` los marca TODOS / STAFF_ADMIN, pero
  `gastos/_layout.tsx` redirige a `/` a **todo el que no sea `dueno`**. Resultado real: **todo el
  módulo de Gastos es solo-dueño**. El tile "Gastos variables" se muestra a empleados, pero al
  tocarlo rebotan al Home; "Gastos fijos" se muestra a admin, que también rebota.
- **Carga inicial**: `permisos.ts` = STAFF_ADMIN, pero `inventario/carga.tsx` exige `dueno`.
  El tile aparece para Sandra (admin) pero la pantalla la rebota.
- **Inventario para empleado**: el PRD/CLAUDE.md dice que operativos pueden "ver y editar"
  calzado y Granja; el código les permite **ver** pero **no editar**.
- **`gastos/index.tsx`** no llama a `useRequireModulo`; depende exclusivamente del gate del layout.

> Estas diferencias son observaciones del estado actual del código, no recomendaciones.
> El refuerzo *server-side* real lo da la RLS de Supabase (fuera del alcance de este documento de UI).

---

## Apéndice — Notas de confianza

- Todo lo anterior proviene de leer los archivos en `app/` y `lib/permisos.ts`, `lib/auth.tsx`,
  `lib/usuarios.ts`. Las **aristas de navegación** se verificaron por `grep` de `router.push/replace`
  y `Redirect`/`href`.
- **No determinado** desde el código de la app (requeriría revisar BD/RLS/migraciones):
  el comportamiento exacto de RLS por tabla, la lógica interna de los RPC (`registrarVenta`,
  `registrarDevolucion`, `cerrarCaja`, etc.) y si las discrepancias de §5 están cubiertas por
  permisos a nivel de base de datos.
