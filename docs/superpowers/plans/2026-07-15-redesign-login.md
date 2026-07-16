# Rediseño Venus — Paso 4: Login con teclado PIN propio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el `TextInput` del PIN por el teclado numérico propio (spec §6.12) con auto-envío al 4º dígito, shake en error y selector de usuario con avatares (spec §7.1). La lógica de `iniciarSesion(email, pin)` NO cambia.

**Architecture:** Nuevo componente `components/ui/TecladoPin.tsx` (presentacional: puntos + grid 3×4, controlado por props). `app/(auth)/login.tsx` se rediseña con tokens y componentes ui; mantiene sus dos pasos (¿Quién eres? → PIN) y el mismo contrato con `lib/auth`/`lib/usuarios`.

**Tech Stack:** Reanimated 4 (pop de puntos, shake), expo-haptics, lucide-react-native (Delete), tokens de `lib/theme.ts`.

## Global Constraints

- Los mismos de las fases anteriores (TS estricto, mocks por archivo, `jest.useFakeTimers()` con Reanimated, español, tokens).
- Receta 9 del motion system: dígito llena su punto con pop 1→1.25→1; PIN incorrecto = shake ±8px (3 ciclos) + puntos `peligro` + haptic error + auto-limpiar a los 600ms.
- Auto-envío al completar 4 dígitos, sin botón "Entrar". Sin teclado del sistema en toda la pantalla.
- Commits terminan con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Rama
- [ ] `git checkout main && git pull && git checkout -b feat/redesign-login`
- [ ] Commit del plan.

### Task 2: `components/ui/TecladoPin.tsx` (TDD)

**Files:** Create `components/ui/TecladoPin.tsx`, `components/ui/TecladoPin.test.tsx`; Modify `components/ui/index.ts` (export).

**Interfaces:**
- Produces: `TecladoPin({ valor: string; onDigito: (d: string) => void; onBorrar: () => void; error?: boolean; deshabilitado?: boolean })`
  - 4 puntos de 16dp arriba: vacío = borde 2px `bordeFuerte`; lleno = fill `primario` (o `peligro` si `error`), pop scale al llenarse.
  - Grid 3×4: teclas 1–9, hueco, 0, borrar (icono `Delete` 24). Teclas circulares 72dp, texto `display`/600; pressed = bg `primarioSoft` + scale 0.95; `deshabilitado` = opacity 0.45 y sin onPress.
  - `error` = shake del contenedor de puntos + haptic `notificationAsync(Error)`.
- Consumes: tokens, `useTema`.

**Steps:**
- [ ] Test que falla: (a) renderiza 10 teclas de dígito + borrar (roles button, labels '1'…'0', 'Borrar'); (b) tocar '5' llama `onDigito('5')` y Borrar llama `onBorrar`; (c) con `valor="12"` hay 2 puntos llenos (testID `pin-punto-lleno`) y 2 vacíos (`pin-punto-vacio`); (d) `deshabilitado` no dispara `onDigito`.
- [ ] FAIL → implementar → PASS → commit `feat(ui): TecladoPin con puntos animados y shake de error`.

### Task 3: Rediseño de `app/(auth)/login.tsx` (TDD)

**Files:** Modify `app/(auth)/login.tsx`; Test `lib/login_ui.test.tsx` (nuevo).

**Interfaces:**
- Paso 1: título `h1` "¿Quién eres?" + una tarjeta-fila por usuario de `USUARIOS` (avatar 44 `primarioSoft` con inicial + nombre `h3`, chevron), entrada con stagger `FadeInDown` (receta 5).
- Paso 2: avatar 56 + "Hola, {primer nombre}" `h2` + caption "Escribe tu clave para entrar" + `TecladoPin` + mensaje de error `caption peligroTexto` + enlace "← Cambiar usuario" (fantasma, arriba) + "¿Se te olvidó tu clave?" (abajo → `Alert` "Pídele a Andrés que te asigne una nueva").
- Comportamiento: `pin` estado local solo-dígitos máx 4; al llegar a 4 → `iniciarSesion(usuario.email, pin)` automático; si error → `error=true` en teclado + mensaje + limpiar pin a los 600ms; `cargando` deshabilita el teclado; cambiar usuario resetea todo.

**Steps:**
- [ ] Test que falla (`lib/login_ui.test.tsx`, mocks patrón repo + mock `../lib/auth` con `iniciarSesion` configurable + fake timers): (a) paso 1 muestra "¿Quién eres?" y los nombres de `USUARIOS`; (b) elegir un usuario muestra "Hola, {nombre}" y el teclado; (c) teclear 4 dígitos llama `iniciarSesion(email, '1234')` automáticamente; (d) si `iniciarSesion` resuelve `{ error: 'PIN incorrecto' }`, el mensaje aparece y tras avanzar 600ms el pin queda vacío (4 puntos vacíos); (e) "Cambiar usuario" vuelve al paso 1.
- [ ] FAIL → implementar → PASS + `npx tsc --noEmit` → commit `feat(ui): login rediseñado con TecladoPin y auto-envío`.

### Task 4: Verificación final
- [ ] `npx tsc --noEmit` + `npx jest` completos en verde.
- [ ] Smoke en dispositivo si hay uno conectado.
- [ ] Cierre con superpowers:finishing-a-development-branch.

## Self-Review
1. **Cobertura §6.12/§7.1:** puntos, grid, pop, shake, haptic, auto-envío, stagger paso 1, cambiar usuario, olvidé clave ✓. Auto-envío sustituye el botón Entrar ✓. `iniciarSesion` intacto ✓.
2. **Placeholders:** comportamiento completo especificado; código en ejecución con tokens.
3. **Tipos:** `TecladoPin` props definidas arriba; `USUARIOS`/`UsuarioPicker` existentes.
