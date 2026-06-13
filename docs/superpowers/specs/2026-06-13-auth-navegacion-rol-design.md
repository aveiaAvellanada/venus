# Diseño: Autenticación + navegación con gating por rol (expo-router)

**Fecha:** 2026-06-13
**Proyecto:** Venus — app Android para la tienda de calzado familiar (Florencia, Caquetá)
**Alcance de esta fase:** Esqueleto navegable + pantallas placeholder. NO se implementan los módulos de negocio todavía.

## Objetivo

Montar expo-router sobre el proyecto (hoy template `blank-typescript`), agregar login simple para usuarios no técnicos, y enrutar por rol (`dueno` / `empleado`) usando un **mapa de permisos central** como fuente única de verdad. Validar end-to-end que el gating por rol funciona antes de construir cada módulo real.

## Decisiones tomadas (brainstorming)

| Decisión | Elección |
|---|---|
| Método de login | Picker de usuario (botones grandes) + PIN |
| PIN ↔ Auth | El PIN **es** la contraseña de Supabase (`signInWithPassword(email, pin)`) |
| Alcance | Esqueleto navegable + pantallas placeholder |
| Forma de navegación | Menú principal tipo **cuadrícula** (launcher), sin tabs |
| Estrategia de gating | **C: mapa de permisos central + guard** (una sola fuente de verdad) |
| Tests | Jest para las funciones puras de `lib/permisos.ts` |

## Contexto del proyecto (verificado)

- `public.users` tiene `rol` (string: `dueno`/`empleado`), `nombre`, `activo`, `email`, keyed por `id` = id de auth.
- `lib/supabase.ts` ya configura el cliente con AsyncStorage y `persistSession: true`.
- 3 usuarios ya provisionados en Supabase Auth + `public.users`.
- expo-router **no** está instalado. Entry actual: `index.ts` → `App.tsx`.
- RLS exige autenticación para leer `public.users` (relevante: el picker no puede consultar usuarios pre-login).

## Arquitectura

### 1. Estructura de archivos

Migración a expo-router: `main` → `expo-router/entry`, eliminar `App.tsx` e `index.ts`, agregar `scheme` en `app.json`, crear `app/`:

```
app/
  _layout.tsx              # raíz: monta AuthProvider + Stack, pantalla de carga
  (auth)/
    _layout.tsx            # <Redirect> a (app) si YA hay sesión
    index.tsx              # picker de usuarios (botones grandes) + PIN
  (app)/
    _layout.tsx            # <Redirect> a (auth) si NO hay sesión
    index.tsx              # menú cuadrícula, generado desde el mapa de permisos
    modulo/
      [id].tsx             # pantalla placeholder, protegida por useRequireModulo
lib/
  permisos.ts              # fuente única: módulos + qué rol ve cada uno
  permisos.test.ts         # tests Jest de las funciones puras
  usuarios.ts              # lista {nombre, email} para el picker (pre-auth)
  auth.tsx                 # AuthProvider + useAuth() + useRequireModulo()
  supabase.ts              # (ya existe)
```

El redirect vive en los `_layout.tsx` de cada grupo (patrón estándar expo-router con `<Redirect>`), no en lógica dispersa.

### 2. Mapa de permisos central (`lib/permisos.ts`)

Corazón del enfoque C. Una sola fuente de verdad para qué rol ve/accede cada módulo.

```ts
export type Rol = 'dueno' | 'empleado'
export interface Modulo { id: string; titulo: string; icono: string; roles: Rol[] }

export const MODULOS: Modulo[] = [
  { id: 'ventas',             titulo: 'Ventas',             icono: '🛒', roles: ['dueno','empleado'] },
  { id: 'inventario-calzado', titulo: 'Inventario calzado', icono: '👟', roles: ['dueno','empleado'] },
  { id: 'inventario-varios',  titulo: 'Productos varios',   icono: '📦', roles: ['dueno','empleado'] },
  { id: 'recibir-mercancia',  titulo: 'Recibir mercancía',  icono: '📥', roles: ['dueno','empleado'] },
  { id: 'proveedores',        titulo: 'Proveedores',        icono: '🚚', roles: ['dueno'] },
  { id: 'cierre-caja',        titulo: 'Cierre de caja',     icono: '🧾', roles: ['dueno'] },
  { id: 'empleado',           titulo: 'Empleado',           icono: '👤', roles: ['dueno'] },
  { id: 'reportes',           titulo: 'Reportes',           icono: '📊', roles: ['dueno'] },
  { id: 'analisis-ia',        titulo: 'Análisis IA',        icono: '🤖', roles: ['dueno'] },
  { id: 'gastos-fijos',       titulo: 'Gastos fijos',       icono: '📌', roles: ['dueno'] },
  { id: 'gastos-variables',   titulo: 'Gastos variables',   icono: '💸', roles: ['dueno'] },
  { id: 'balance',            titulo: 'Balance',            icono: '⚖️', roles: ['dueno'] },
  { id: 'carga-inicial',      titulo: 'Carga inicial',      icono: '📷', roles: ['dueno'] },
]

export const modulosPara = (rol: Rol): Modulo[] =>
  MODULOS.filter(m => m.roles.includes(rol))

export const puedeAcceder = (rol: Rol, id: string): boolean =>
  MODULOS.find(m => m.id === id)?.roles.includes(rol) ?? false
```

**Empleado (Andrés)** ve 4 tiles: Ventas, Inventario calzado, Productos varios, Recibir mercancía. Nunca finanzas — la regla crítica de negocio queda explícita y auditable en un solo lugar. Funciones puras → testeables.

### 3. Auth + flujo de datos (`lib/auth.tsx`)

`AuthProvider` con contexto React:

- **Estado:** `session`, `perfil` (fila de `public.users`: `rol`, `nombre`, `activo`), `cargando`.
- **Al montar:** `supabase.auth.getSession()` + suscripción a `onAuthStateChange`; cuando hay sesión, consulta `public.users` por `id` → obtiene `perfil` (incluye `rol`).
- **`iniciarSesion(email, pin)`** → `supabase.auth.signInWithPassword({ email, password: pin })`.
- **`cerrarSesion()`** → `supabase.auth.signOut()`.
- Hooks expuestos: `useAuth()` y `useRequireModulo(id)` (este último hace `<Redirect href="/(app)" />` si `!puedeAcceder(perfil.rol, id)`).

**Flujo:** `tap usuario → PIN → signInWithPassword → onAuthStateChange → fetch perfil → (auth)/_layout redirige a (app) → grid se arma con modulosPara(rol)`.

### 4. Pantallas (UI simple para no técnicos)

- **Login:** botones grandes con el nombre de cada usuario (desde `lib/usuarios.ts`), luego teclado numérico para el PIN. Alto contraste, targets grandes. Mensaje de error claro si el PIN falla.
- **Home:** cuadrícula de tiles grandes (emoji + título), uno por módulo permitido; tap → `/modulo/[id]`. Botón "Cerrar sesión".
- **Placeholder `[id]`:** corre `useRequireModulo(id)`, muestra el título grande del módulo y "En construcción".

UI con `StyleSheet` nativo (sin NativeWind por ahora — YAGNI). Principios de diseño aplicados: targets ≥56px, alto contraste, todo en español.

### 5. Picker de usuarios pre-auth (`lib/usuarios.ts`)

Como RLS bloquea leer `public.users` antes de autenticarse, el picker se alimenta de una lista en config:

```ts
export interface UsuarioPicker { nombre: string; email: string }
export const USUARIOS: UsuarioPicker[] = [ /* Don Carlos, Andrés, ... */ ]
```

Agregar un usuario futuro = agregar aquí + crear el usuario en Supabase (tarea admin). Aceptable para tienda familiar de 2-3 personas.

## Manejo de errores

- PIN incorrecto / usuario inactivo → mensaje claro en español, sin filtrar detalles técnicos.
- Sin conexión al hacer login → mensaje "Sin conexión, intenta de nuevo" (la sesión persistida permite reabrir la app offline; el login inicial requiere red).
- `perfil` no encontrado en `public.users` tras autenticar → cerrar sesión y mostrar error (estado inconsistente).

## Testing

- **Jest** para `lib/permisos.ts` (funciones puras): `modulosPara('empleado')` no incluye `balance`/`reportes`/finanzas; `modulosPara('dueno')` incluye los 13; `puedeAcceder('empleado','balance') === false`; `puedeAcceder('empleado','ventas') === true`.
- Setup: `jest` + `jest-expo` preset + `@types/jest`. Script `npm test`.
- **Verificación manual:** arrancar la app, entrar como cada rol, confirmar que el grid difiere y que navegar directo a `/modulo/balance` como empleado redirige al home.

## Fuera de alcance (esta fase)

- Implementación de cualquier módulo de negocio real (Ventas, inventario, etc.).
- Recuperación de PIN / cambio de PIN dentro de la app.
- Lógica offline-first más allá de la sesión persistida que ya da Supabase.
- Capa de PIN separada de la contraseña (se descartó por YAGNI).

## Tarea de implementación pendiente de dato

Resetear las contraseñas de los 3 usuarios ya provisionados en Supabase a PINs numéricos. Requiere que el usuario indique los PINs (o se ponen por defecto y se cambian luego).
