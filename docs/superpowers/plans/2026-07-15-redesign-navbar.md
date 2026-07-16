# Rediseño Venus — Paso 3: TabBar + reestructura a 4 tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el nav bar inferior de 5 slots (Menú · Movimientos · [+] · Productos · Perfil) con FAB central a Nueva Venta, y reestructurar las rutas a 4 tabs — manteniendo TODOS los módulos existentes accesibles (las pantallas internas se rediseñan en pasos posteriores).

**Architecture:** `app/(app)/_layout.tsx` sigue siendo el Stack con guard de sesión. Se crea el grupo `app/(app)/(tabs)/` con un `Tabs` de expo-router y tabBar custom (`components/ui/TabBar.tsx`, spec §6.1). El home actual (`app/(app)/index.tsx`) se convierte en `(tabs)/index.tsx` (Menú). Las rutas de módulos existentes quedan como hermanas del grupo (tabs) en el Stack: los detalles se apilan POR ENCIMA del tab bar y ninguna URL cambia. Los tabs Movimientos/Productos/Perfil son pantallas transicionales con accesos (FilaLista) a los flujos existentes; Perfil incluye el toggle de tema FUNCIONAL.

**Tech Stack:** expo-router Tabs (react-navigation bottom-tabs), Reanimated 4, lucide-react-native, expo-linear-gradient, expo-haptics, components/ui de la fase fundamentos.

## Global Constraints

- Igual que la fase fundamentos: TypeScript estricto, tests jest-expo con mocks por archivo, español, tokens de `lib/theme.ts`, sin hex sueltos.
- `jest.useFakeTimers()` en todo test que monte componentes con Reanimated.
- Tests de pantallas en `lib/*_ui.test.tsx` (convención del repo); tests de componentes junto al componente.
- Ninguna ruta existente cambia de URL; nada de tocar pantallas de módulos.
- Mapa de distribución (redisign.md Parte E): Menú → Proveedores, Reportes, Balance, Análisis IA + badge Caja. Movimientos → Ventas/Devoluciones/Gastos. Productos → Calzado/Granja/Recibir/Carga. Perfil → Tema, Caja config (dueño), Empleados (dueño), Cerrar sesión.
- Roles: dueno='Dueño', admin='Administrativa', empleado='Operativo'. Filtrar con `puedeAcceder(rol, id)` de `lib/permisos.ts`.
- Commits terminan con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Rama

- [ ] `git checkout main && git pull && git checkout -b feat/redesign-navbar`
- [ ] Commit del plan: `git add docs/superpowers/plans/2026-07-15-redesign-navbar.md && git commit -m "docs(redesign): plan paso 3 — TabBar + 4 tabs"`

### Task 2: `components/ui/TabBar.tsx` (TDD)

**Files:** Create `components/ui/TabBar.tsx`, `components/ui/TabBar.test.tsx`

**Interfaces:**
- Produces: `TabBar(props: BottomTabBarProps)` (tipo de `@react-navigation/bottom-tabs`). Orden fijo de rutas: `index`, `movimientos`, `productos`, `perfil` — el FAB se inserta visualmente entre `movimientos` y `productos`. FAB → `router.push('/ventas/nueva')` + haptic light.
- Config por ruta (icono Lucide + label): index→LayoutGrid "Menú", movimientos→ArrowLeftRight "Movimientos", productos→Footprints "Productos", perfil→CircleUserRound "Perfil".

**Steps:**
- [ ] Test que falla (`components/ui/TabBar.test.tsx`): mocks de AsyncStorage + fake timers + mock `expo-router` (useRouter). Construir props mínimas `{ state: { index: 0, routes: [{key:'index-1',name:'index'},{key:'mov-1',name:'movimientos'},{key:'prod-1',name:'productos'},{key:'perfil-1',name:'perfil'}] }, navigation: { navigate: jest.fn(), emit: jest.fn(() => ({ defaultPrevented: false })) } }`. Asserts: (a) 4 tabs con `accessibilityRole:'tab'` y labels Menú/Movimientos/Productos/Perfil; (b) tab activo con `accessibilityState.selected === true`; (c) tocar el tab "productos" llama `navigation.navigate('productos')`; (d) el FAB (accessibilityLabel "Nueva venta") llama `router.push('/ventas/nueva')`.
- [ ] Verificar FAIL (Cannot find module './TabBar').
- [ ] Implementar: contenedor `flexDirection:'row'`, `paddingBottom: insets.bottom` (useSafeAreaInsets), alto de fila 64, bg `paleta.fondo`, borde superior 1px `paleta.borde`. Cada tab: Pressable flex:1 con icono 24 (activo `paleta.primario` + scale spring 1→1.12→1 vía shared value en useEffect; inactivo `paleta.texto3`) y label `tipografia.micro`. FAB: Presionable escala 0.92, círculo 60 con `LinearGradient` `paleta.gradienteHero`, icono Plus 28 blanco, `marginTop: -24`, sombra `shadowColor: paleta.primario, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: {0,6}, elevation: 8`; `onPress`: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{})` + `router.push('/ventas/nueva')`. Navegación de tab: patrón estándar `navigation.emit({type:'tabPress',...})` + `navigation.navigate(route.name)` si no está enfocado ni prevented.
- [ ] Verificar PASS.
- [ ] Commit `feat(ui): TabBar de 5 slots con FAB central a Nueva Venta`.

### Task 3: Grupo (tabs) + Menú (TDD)

**Files:** Create `app/(app)/(tabs)/_layout.tsx`, `app/(app)/(tabs)/index.tsx` (nuevo Menú); Delete `app/(app)/index.tsx`; Test `lib/tabs_menu_ui.test.tsx`

**Interfaces:**
- `(tabs)/_layout.tsx`: `<Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>` con 4 `Tabs.Screen` (index, movimientos, productos, perfil).
- Menú: header "Hola, {nombre}" (h2) + badge caja presionable (→ `/caja`): ABIERTA (exito, punto) / CERRADA (peligro) / SIN ABRIR (neutro), cargado con `obtenerCajaHoy()` en `useFocusEffect`; filas (FilaLista + CirculoIcono): Proveedores (Truck), Reportes (ChartColumn), Balance (Scale), Análisis IA (Sparkles, tono acento → `/modulo/analisis-ia`), filtradas con `puedeAcceder`.

**Steps:**
- [ ] Test que falla (`lib/tabs_menu_ui.test.tsx`): patrón de mocks del repo (AsyncStorage, fake timers, expo-router con useRouter/useFocusEffect, `./supabase` y `../lib/supabase`, `../lib/caja` → `obtenerCajaHoy: jest.fn().mockResolvedValue(null)`, `../lib/auth` → useAuth con perfil configurable). Asserts: (a) dueño ve saludo y las 4 filas; (b) empleado NO ve Proveedores/Reportes/Balance/Análisis IA; (c) badge dice "SIN ABRIR" con caja null y "ABIERTA" cuando obtenerCajaHoy resuelve `{ estado: 'abierta' }`; (d) tocar el badge llama `router.push('/caja')`.
- [ ] Verificar FAIL.
- [ ] Implementar `_layout.tsx` y el nuevo Menú con tokens (`fondo`, padding `espacio.xl`, ScrollView). Borrar `app/(app)/index.tsx`.
- [ ] Verificar PASS + `npx tsc --noEmit`.
- [ ] Commit `feat(ui): grupo (tabs) + Menú con badge de caja y accesos por rol`.

### Task 4: Tabs Movimientos y Productos (TDD)

**Files:** Create `app/(app)/(tabs)/movimientos.tsx`, `app/(app)/(tabs)/productos.tsx`; Test `lib/tabs_secciones_ui.test.tsx`

**Interfaces:**
- Movimientos: título h1 + `ControlSegmentado ['Ventas','Devoluciones','Gastos']` (estado local). Vistas: Ventas → "Nueva venta" (ShoppingCart→`/ventas/nueva`), "Ventas del día" (Wallet→`/ventas`); Devoluciones → "Registrar devolución" (Undo2→`/devoluciones/nueva`), "Historial de devoluciones" (→`/devoluciones`); Gastos → "Gastos variables" (ReceiptText→`/gastos`), "Gastos fijos" (CalendarClock→`/gastos/fijos`, solo `puedeAcceder(rol,'gastos-fijos')`).
- Productos: título h1 + filas "Calzado" (Footprints→`/inventario/calzado`), "Granja" (Egg→`/inventario/granja`) + sección INGRESAR MERCANCÍA (micro): "Recibir mercancía" (PackagePlus→`/recibir-mercancia`), "Carga inicial" (Camera→`/inventario/carga`, solo `puedeAcceder(rol,'carga-inicial')`).

**Steps:**
- [ ] Test que falla: mismos mocks; asserts: (a) Movimientos arranca en vista Ventas y "Nueva venta" navega a `/ventas/nueva`; (b) cambiar el segmentado a índice 2 muestra "Gastos variables" y oculta "Nueva venta"; (c) empleado no ve "Gastos fijos"; (d) Productos: "Calzado" navega a `/inventario/calzado` y empleado sí ve "Recibir mercancía" pero no "Carga inicial".
- [ ] Verificar FAIL → implementar → PASS.
- [ ] Commit `feat(ui): tabs Movimientos (toggle 3) y Productos con accesos por rol`.

### Task 5: Tab Perfil (TDD)

**Files:** Create `app/(app)/(tabs)/perfil.tsx`; Test `lib/tabs_perfil_ui.test.tsx`

**Interfaces:**
- Avatar 72 (`primarioSoft`, inicial h1) + nombre h2 + `Badge` rol neutro (Dueño/Administrativa/Operativo).
- Tarjeta APARIENCIA: label "Tema" + `ControlSegmentado ['Claro','Oscuro','Sistema']` conectado a `useTema().modo/setModo` (mapa índice↔modo).
- Filas (según rol): "Automatización de caja" (Wallet→`/caja/config`, dueño), "Empleados" (Users→`/empleados`, dueño).
- "Cerrar sesión" (LogOut, colores peligro) con `Alert.alert` de confirmación → `cerrarSesion()`.

**Steps:**
- [ ] Test que falla: asserts: (a) muestra nombre y badge "DUEÑO" para dueño; (b) segmentado de tema en "Sistema" por defecto y al tocar "Oscuro" persiste `venus.tema = 'oscuro'` (AsyncStorage mock); (c) empleado no ve filas de Caja config/Empleados; (d) fila Cerrar sesión existe.
- [ ] Verificar FAIL → implementar → PASS.
- [ ] Commit `feat(ui): tab Perfil con toggle de tema funcional y cierre de sesión`.

### Task 6: Verificación final

- [ ] `npx tsc --noEmit` limpio.
- [ ] `npx jest` — suite completa en verde.
- [ ] Smoke en dispositivo si hay uno conectado (`npx expo start --android`): tabs navegan, FAB abre Nueva Venta, tema oscuro desde Perfil pinta los tabs.
- [ ] Cierre con superpowers:finishing-a-development-branch.

## Self-Review

1. **Cobertura:** Parte A (nav bar 5 slots, FAB→Nueva Venta, caja como badge en Menú) ✓; Parte E transicional (todos los módulos reachable: ventas/devoluciones/gastos → Movimientos; calzado/granja/recibir/carga → Productos; proveedores/reportes/balance/IA → Menú; caja→badge; caja config/empleados/tema → Perfil; salir → Perfil) ✓. Módulo `modulo/[id]` y todas las URLs intactas ✓.
2. **Placeholders:** los detalles de estilo se derivan de la spec §6.1/§7 y los componentes ya construidos; el código exacto se escribe en ejecución con los tokens (sin TBD de comportamiento).
3. **Tipos:** `BottomTabBarProps` de `@react-navigation/bottom-tabs` (dependencia transitiva de expo-router); `useTema()` según fase fundamentos.
