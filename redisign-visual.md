# Venus — Especificación Visual del Rediseño v1.0

> **Documento de diseño visual e interacción.** Es la continuación de
> `redisign.md` (decisiones de navegación/estructura) y reemplaza la propuesta
> de convergencia de `design.md` (auditoría del sistema actual). Aquí está TODO
> lo necesario para implementar el rediseño: tokens, componentes, pantallas,
> iconos, animaciones y modo oscuro.
>
> **Decisiones de dirección (2026-07-15):**
> - Paleta: **Azul Venus evolucionado** (mantiene identidad `#1E66F5`, refinada).
> - Tipografía: **Plus Jakarta Sans** (una sola familia, 5 pesos).
> - Temas: **claro y oscuro desde el día 1** (toggle en Perfil).
> - Iconos: **Lucide** (`lucide-react-native`), adiós emojis estructurales.

---

## 0. Principios (heredados y elevados)

1. **Grande y táctil.** Objetivo táctil mínimo 48×48dp. Botones primarios de 56dp
   de alto. Pensada para usarse de pie, rápido, con una mano.
2. **Claridad sobre densidad.** Una tarjeta = una idea. Jerarquía por tamaño y
   peso, no por decoración.
3. **Color con significado.** Azul = acción/navegación. Verde = entra/cuadra.
   Rojo = sale/falta/peligro. Dorado = destacado/insight. Nunca color solo:
   siempre acompañado de icono, signo o texto.
4. **Movimiento con propósito.** Toda animación responde a una acción del
   usuario (feedback, continuidad espacial u orientación). Nada decorativo en
   flujos de alta frecuencia. `prefers-reduced-motion` respetado siempre.
5. **Español directo.** "¿Cuánto efectivo hay en gaveta?" sigue siendo la voz.

---

## 1. Tokens de color

Todos los componentes consumen **tokens semánticos** (nunca hex sueltos).
Fuente única: `lib/theme.ts`.

### 1.1 Tema claro

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#1E66F5` | Botones primarios, tabs activos, links |
| `primaryPress` | `#1747C8` | Estado presionado del primario |
| `primarySoft` | `#EBF1FE` | Fondos de chips, contenedores de icono, fila seleccionada |
| `onPrimary` | `#FFFFFF` | Texto/icono sobre primario |
| `accent` | `#F59E0B` | Destacados, insight IA, estrella "más vendido" |
| `accentSoft` | `#FEF3C7` | Fondo de destacados |
| `bg` | `#FFFFFF` | Fondo base de pantalla |
| `surface` | `#F6F8FC` | Tarjetas, inputs, tiles |
| `surface2` | `#EEF2F9` | Superficie anidada (chip sobre tarjeta) |
| `border` | `#E2E8F0` | Bordes y divisores |
| `borderStrong` | `#CBD5E1` | Bordes de inputs enfocables |
| `text` | `#0B1220` | Texto principal, montos |
| `text2` | `#475569` | Texto secundario |
| `text3` | `#64748B` | Labels, captions |
| `textDisabled` | `#94A3B8` | Deshabilitado / placeholder |
| `success` | `#16A34A` | Montos que entran, badge ABIERTA |
| `successSoft` | `#E7F6EC` | Fondo éxito |
| `successText` | `#15803D` | Texto sobre successSoft |
| `danger` | `#DC2626` | Salidas, faltante, eliminar, cerrar sesión |
| `dangerSoft` | `#FDECEC` | Fondo peligro, badge CERRADA |
| `dangerText` | `#B91C1C` | Texto sobre dangerSoft |
| `warning` | `#D97706` | Vencimientos, alertas |
| `warningSoft` | `#FEF3C7` | Fondo advertencia |
| `warningText` | `#92400E` | Texto sobre warningSoft |
| `overlay` | `rgba(11,18,32,0.5)` | Scrim de modales/sheets |

### 1.2 Tema oscuro

Desaturado y elevado por superficies (nunca inversión directa, nunca negro puro).

| Token | Hex | Nota |
|---|---|---|
| `primary` | `#4C82F7` | Aclarado para contraste sobre fondo oscuro |
| `primaryPress` | `#6D9AF9` | |
| `primarySoft` | `#16264A` | |
| `onPrimary` | `#FFFFFF` | |
| `accent` | `#F5B840` | |
| `accentSoft` | `#3A2A10` | |
| `bg` | `#0B1220` | |
| `surface` | `#121C30` | Tarjetas: superficie más clara = más elevación |
| `surface2` | `#1A2740` | |
| `border` | `#26334D` | Visible sobre surface, no solo en claro |
| `borderStrong` | `#33425F` | |
| `text` | `#F2F6FC` | |
| `text2` | `#A9B4C6` | |
| `text3` | `#8291A9` | |
| `textDisabled` | `#5B6A83` | |
| `success` / `successSoft` / `successText` | `#3FBF6F` / `#0F2E1C` / `#7BDCA0` | |
| `danger` / `dangerSoft` / `dangerText` | `#F07171` / `#3A1520` / `#F5A3A3` | |
| `warning` / `warningSoft` / `warningText` | `#F2A93B` / `#3A2A10` / `#F7C87E` | |
| `overlay` | `rgba(0,0,0,0.6)` | Scrim más fuerte en oscuro |

**Reglas de tema:**
- El toggle vive en Perfil: `Claro / Oscuro / Sistema` (segmented). Persistir en
  AsyncStorage; default `Sistema`.
- En oscuro las sombras casi desaparecen: la elevación se expresa con
  `surface` → `surface2` y bordes.
- `StatusBar`: `dark-content` en claro, `light-content` en oscuro.
- Al cambiar de tema, **sin transiciones animadas** (cambio instantáneo) para
  evitar el flash de mil propiedades animando a la vez.
- El hero del dashboard usa gradiente `#1E66F5 → #1747C8` en claro y
  `#1D3A75 → #142850` en oscuro (texto blanco en ambos).

### 1.3 Pares de contraste verificados (AA)

- `text` sobre `bg`/`surface`: >15:1 ✓
- `onPrimary` sobre `primary` claro (`#1E66F5`): 4.6:1 ✓ (usar ≥15px/600)
- `text3` sobre `surface` claro: 4.6:1 ✓ (mínimo 12px/600, nunca más claro que `#64748B`)
- `successText` sobre `successSoft`, `dangerText` sobre `dangerSoft`: >5:1 ✓
- Oscuro: `text2` sobre `surface`: >7:1 ✓; `primary #4C82F7` sobre `bg`: >4.5:1 ✓

---

## 2. Tipografía

**Familia:** Plus Jakarta Sans (`@expo-google-fonts/plus-jakarta-sans`).
Pesos cargados: 400, 500, 600, 700, 800. Fallback: sistema mientras carga
(`expo-splash-screen` retiene el splash hasta `useFonts` listo).

| Token | Tamaño/Alto | Peso | Uso |
|---|---|---|---|
| `displayXL` | 40/48 | 800 | Total del dashboard, monto contado en caja |
| `display` | 32/38 | 800 | Totales de sección, PIN |
| `h1` | 28/34 | 800 | Título de pantalla |
| `h2` | 22/28 | 700 | Saludo, título de tarjeta grande |
| `h3` | 18/24 | 700 | Título de fila, nombre de producto |
| `bodyLg` | 17/24 | 600 | Texto de botón, monto en fila |
| `body` | 15/22 | 500 | Texto general |
| `label` | 13/18 | 600 | Labels de input, sublabels |
| `caption` | 12/16 | 600 | Metadatos (hora, método, ref) |
| `micro` | 11/14 | 700, uppercase, tracking +0.5 | Labels de tabs, "TOTAL VENDIDO", badges |

**Reglas:**
- **Dinero SIEMPRE con `fontVariant: ['tabular-nums']`** (evita saltos de layout
  en count-up y alinea columnas). Formato `'$' + n.toLocaleString('es-CO')`.
- Cuerpo mínimo 15px; caption mínimo 12px y siempre ≥600 de peso.
- Máximo 2 pesos distintos por tarjeta (jerarquía limpia).

---

## 3. Espaciado, radios, elevación

**Espaciado (base 4):** `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48`
- Padding de pantalla: **20** (formularios largos: 24).
- Gap entre tarjetas: 12. Gap entre secciones: 24. Gap interno de tarjeta: 12–16.
- La última tarjeta scrolleable lleva `paddingBottom: 96 + insets.bottom` (no
  quedar bajo el nav bar).

**Radios:** `sm 12` (chips, inputs) · `md 16` (botones, tarjetas) · `lg 20`
(tarjetas hero, tiles) · `xl 28` (esquinas superiores de sheets) · `full 999`
(pills, FAB, avatar).

**Elevación (3 niveles, sobrios):**

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `e0` | sin sombra, borde 1px `border` | igual | tarjetas por defecto (diseño plano) |
| `e1` | `shadowColor #0B1220, opacity 0.06, radius 12, offset (0,4)` + `elevation: 3` | solo borde | header sticky al scrollear, dropdown |
| `e2` | `shadowColor primary, opacity 0.35, radius 14, offset (0,6)` + `elevation: 8` | `opacity 0.5` | **FAB central del nav bar** |
| `e3` | `shadowColor #0B1220, opacity 0.14, radius 24, offset (0,-8)` + `elevation: 12` | borde superior + surface2 | sheets/modales |

---

## 4. Iconografía

**Set único: [Lucide](https://lucide.dev)** (`lucide-react-native` +
`react-native-svg`). Stroke **2**, esquinas redondeadas — combina con Plus
Jakarta Sans. **Cero emojis como iconos estructurales.**

**Tamaños token:** `16` (inline/caption) · `20` (filas, chips) · `24` (tabs,
acciones) · `28` (headers de módulo).

**Contenedor de icono** (patrón que reemplaza la calidez del emoji): círculo o
squircle de 44–48dp, fondo soft semántico, icono 24 en el color pleno:

```
( 🔵 ShoppingCart )  = circle 48, bg primarySoft, icon primary
( 🟢 Wallet )        = circle 48, bg successSoft, icon success
( 🔴 Undo2 )         = circle 48, bg dangerSoft,  icon danger
```

### Mapa de iconos por concepto

| Concepto | Icono Lucide | | Concepto | Icono Lucide |
|---|---|---|---|---|
| Menú (tab) | `LayoutGrid` | | Movimientos (tab) | `ArrowLeftRight` |
| Nueva venta (FAB) | `Plus` | | Productos (tab) | `Footprints` |
| Perfil (tab) | `CircleUserRound` | | Ventas | `ShoppingCart` |
| Devoluciones | `Undo2` | | Gastos | `ReceiptText` |
| Caja | `Wallet` | | Granja | `Egg` |
| Recibir mercancía | `PackagePlus` | | Carga inicial | `Camera` |
| Proveedores | `Truck` | | Gastos fijos | `CalendarClock` |
| Reportes | `ChartColumn` | | Balance | `Scale` |
| Empleados | `Users` | | Análisis IA | `Sparkles` |
| Efectivo | `Banknote` | | Nequi/Bre-B/Otro | `Smartphone` / `Zap` / `CreditCard` |
| Buscar | `Search` | | Filtro período | `CalendarDays` |
| Cliente | `UserRound` | | WhatsApp | `MessageCircle` |
| Editar | `Pencil` | | Eliminar | `Trash2` |
| Cerrar sesión | `LogOut` | | Tema | `SunMoon` |
| Éxito | `CircleCheck` | | Error | `CircleAlert` |
| Chevron fila | `ChevronRight` | | Atrás | `ArrowLeft` |
| Ver PIN | `Eye` / `EyeOff` | | Nota | `StickyNote` |

Regla: **un solo estilo (outline) por nivel de jerarquía**; la versión "filled"
solo para el tab activo (ver §6.1).

---

## 5. Motion system

Tokens en `lib/theme.ts → motion`. Implementación: **Reanimated 3** (UI thread).
"Hover" en móvil = **estado presionado**: todo lo tocable reacciona en <100ms.

### 5.1 Tokens

| Token | Valor | Uso |
|---|---|---|
| `fast` | 120ms | Press feedback, icon swap |
| `base` | 200ms | Chips, toggles, crossfades |
| `slow` | 300ms | Entradas de tarjetas, gráfico |
| `sheet` | 350ms | Modales/sheets |
| `easeEnter` | `Easing.bezier(0.22, 1, 0.36, 1)` | Entradas y transforms |
| `easeMove` | `Easing.bezier(0.25, 1, 0.5, 1)` | Slides, indicadores |
| `easeSheet` | `Easing.bezier(0.32, 0.72, 0, 1)` | Sheets (curva iOS) |
| `springPress` | `{ damping: 18, stiffness: 320 }` | Escala al presionar |
| `springLayout` | `{ damping: 22, stiffness: 260 }` | Indicadores, sheets, chips talla |

**Salidas siempre más cortas que entradas (~70%).** Animar solo `transform` y
`opacity` (+ color en feedback). Nunca `width/height/top/left`.

### 5.2 Recetario (comportamientos canónicos)

1. **Press de botón/tarjeta:** `scale 1 → 0.97` con `springPress` en
   `onPressIn`, vuelve en `onPressOut`. FAB central: `0.92`. Filas de lista:
   solo cambio de fondo a `surface2` (sin escala, evita jitter en scroll).
2. **Count-up de dinero:** al cambiar período en dashboard, el total anima de 0
   → valor con `withTiming(500ms, easeMove)` sobre un shared value + texto
   derivado. Solo en cambio explícito de período, no en re-render.
3. **Toggle segmentado (Movimientos, Calzado/Granja, Tema):** pill indicador
   deslizante con `springLayout`; el contenido hace slide direccional 24px +
   fade 200ms (izquierda→derecha según índice destino).
4. **Tab bar:** al activar un tab, icono `scale 1 → 1.12 → 1` (spring) y
   crossfade outline→filled 120ms. Sin animación de navegación entre tabs
   (cambio instantáneo de pantalla, estándar Android).
5. **Stagger de listas:** primeras 8 filas entran con
   `FadeInDown.duration(220).delay(index * 40)` **solo en la primera carga** de
   la pantalla; nunca al re-filtrar (re-filtrado = crossfade 150ms).
6. **Gráfico de barras:** cada barra crece con `scaleY 0 → 1` (origin bottom),
   300ms `easeEnter`, stagger 30ms. Al cambiar período, retarget (no reinicia).
7. **Skeleton:** bloques `surface2` con pulso de opacidad 0.5 ↔ 1, loop 1000ms.
   Aparece si la carga supera 300ms; se va con fade 150ms.
8. **Sheets/modales:** suben desde abajo con `easeSheet` 350ms + scrim fade
   (0 → overlay) 250ms. Cierre: 250ms. Swipe-down para cerrar con
   seguimiento 1:1 del dedo (sin easing durante el drag; spring al soltar).
   Confirmar antes de descartar si hay cambios sin guardar.
9. **PIN:** cada dígito llena su punto con `scale 1 → 1.25 → 1` (120ms). PIN
   incorrecto: shake horizontal (`translateX` spring ±8px, 3 ciclos) + puntos a
   `danger` + haptic `notificationError`; se limpia solo a los 600ms.
10. **Éxito de venta/cierre:** overlay con `CircleCheck` que entra
    `scale 0.6 → 1` con spring + fondo `successSoft` flash 400ms + haptic
    `notificationSuccess`. Se autodescarta a los 1.2s.
11. **Badge de caja ABIERTA:** punto verde con pulso sutil de opacidad
    (1 ↔ 0.5, 2s, loop). Único loop permitido en la app; se pausa si la
    pantalla no está enfocada.
12. **Navegación push (detalles):** `slide_from_right` 250ms (expo-router
    default Android). Volver restaura scroll y filtros.

### 5.3 Reduced motion

`useReducedMotion()` de Reanimated: si está activo → sin transforms (escala,
slides, shake, count-up muestran el estado final), se conservan solo fades
≤150ms. El pulso del badge de caja se desactiva.

---

## 6. Librería de componentes (`components/ui/`)

Todos consumen `useTheme()`. Props en español, consistentes con el código.

### 6.1 `TabBar` (nav bar inferior) — la pieza central

- Altura 64 + `insets.bottom`. Fondo `bg`, borde superior 1px `border`
  (oscuro: `surface` + borde).
- 5 slots: `Menú · Movimientos · [+] · Productos · Perfil`.
- Tab: icono 24 + label `micro`. Activo: `primary` (icono filled con
  `fill=primarySoft` + stroke primary); inactivo: `text3`.
- **FAB central:** círculo 60dp, gradiente `primary → primaryPress`, icono
  `Plus` 28 blanco, sobresale 24dp por encima de la barra, elevación `e2`.
  Press: scale 0.92 + haptic light. → navega a Nueva Venta.
- Área táctil de cada slot ≥ 48dp. `accessibilityRole="tab"`,
  `accessibilityState={{selected}}`, `accessibilityLabel` en español.

### 6.2 `Boton`
- Variantes: `primario` (bg primary/texto onPrimary), `peligro` (bg danger),
  `secundario` (bg primarySoft/texto primary), `fantasma` (texto primary, sin
  fondo). Tamaños: `lg` 56dp (default, CTA de pantalla), `md` 48dp.
- Radio `md 16`. Texto `bodyLg`. Icono opcional 20 a la izquierda.
- Estados: press (receta 1 + color a `primaryPress`), `cargando`
  (ActivityIndicator onPrimary, botón deshabilitado, ancho estable),
  `deshabilitado` (opacity 0.45).

### 6.3 `Tarjeta` / `TarjetaMetrica`
- `Tarjeta`: `surface`, radio `md–lg`, borde 1px `border`, padding 16.
  `onPress` opcional → press receta 1.
- `TarjetaMetrica`: label `micro text3` arriba + valor `display/h2` tabular +
  sublabel `caption`. Variante `mini` (grid de métodos de pago: icono 20 +
  label caption + monto `bodyLg/700`).

### 6.4 `Badge`
- Pill radio full, padding 6×12, texto `micro`.
- Semánticos: `exito` (successSoft/successText — ABIERTA, COMPLETADA),
  `peligro` (CERRADA, CANCELADA), `advertencia` (PARCIAL, vencimientos),
  `neutro` (surface2/text2 — CAMBIO, FIJO/VARIABLE).
- Con punto de estado opcional (receta 11 para caja).

### 6.5 `Chip` (filtros de período y categoría)
- Pill 36dp de alto, padding 8×16, texto `label`.
- Inactivo: `surface` + borde. Activo: `primary` bg + onPrimary (crossfade
  200ms). Scroll horizontal sin indicador, gap 8, snap suave.
- `Rango ▾` abre sheet con date-range picker.

### 6.6 `Input`
- 52dp, radio `sm 12`, bg `surface`, borde 1px `borderStrong`; focus: borde 2px
  `primary` (transición 150ms) — el focus ring nunca se elimina.
- Label `label` SIEMPRE visible arriba (nunca placeholder-only). Error: borde
  `danger` + mensaje `caption dangerText` debajo del campo + shake sutil.
  Validar en blur, no por tecla.
- Variante `gigante` (montos): 64dp, texto `display` centrado tabular, teclado
  `number-pad`. Variante `busqueda`: icono Search 20 + clear button.

### 6.7 `ControlSegmentado`
- Contenedor `surface2` radio full padding 4; pill indicador `bg` (claro) /
  `surface` (oscuro) con sombra e1, texto activo `primary/700`, inactivo
  `text2`. Motion receta 3. Usos: `[Ventas][Devoluciones][Gastos]`,
  `[Calzado][Granja]`, tema en Perfil.

### 6.8 `FilaLista`
- 64dp mínimo: contenedor de icono 44 + columna (título `h3`/`bodyLg`,
  subtítulo `caption`) + derecha (monto tabular / Badge / `ChevronRight` 20
  `text3`).
- Press: bg → `surface2` 120ms. Divisor hairline `border` inset 76 (alineado al
  texto, no al icono).

### 6.9 `Sheet`
- Radio superior `xl 28`, handle 36×4 `borderStrong` centrado arriba, título
  `h2`, scrim `overlay`. Motion receta 8. Cierre: handle-drag, scrim tap, botón
  X 44dp. Para: rango de fechas, calculadora de cierre, confirmaciones,
  detalle rápido.

### 6.10 `Toast`
- Flotante sobre el nav bar (bottom 88), radio `md`, bg `text` (claro) /
  `surface2` (oscuro), texto `body` en `bg`/`text`. Icono semántico 20.
  Entra slide-up+fade 200ms, autodescarta 3.5s, salida fade 150ms.
  No roba foco; `accessibilityLiveRegion="polite"`.

### 6.11 `Esqueleto`, `EstadoVacio`
- `Esqueleto`: receta 7; variantes fila, tarjeta, métrica, gráfico.
- `EstadoVacio`: icono 48 `text3` en contenedor `surface2` + título `h3` +
  cuerpo `body text2` + CTA opcional. Ej: "Aún no hay ventas hoy · Toca [+]
  para registrar la primera".

### 6.12 `TecladoPin`
- Grid 3×4, teclas circulares 72dp, dígito `display/600`. Press: bg
  `primarySoft` radial 120ms + scale 0.95. Tecla borrar `Delete` 24.
  4 puntos de 16dp arriba (vacío: borde `borderStrong`; lleno: `primary`
  fill — receta 9). Auto-envío al 4º dígito.

### 6.13 `ChipTalla` y `PillColor`
- `ChipTalla`: 56×64dp radio `sm`. Talla `h3` arriba, divisor hairline, stock
  `caption` abajo. Estados: normal (`surface` + borde) · seleccionada (borde
  2px `primary` + bg `primarySoft` + pop spring 1 → 1.06 → 1) · sin stock
  (opacity 0.38, deshabilitada pero visible, `accessibilityState disabled`).
- `PillColor`: pill con swatch circular 16 + nombre. Selección igual que talla.

### 6.14 `GraficoBarras`
- Barras `primary` radio superior 4, barra del período activo `primary`, resto
  `primarySoft` con borde. Labels eje `caption text3`, sin gridlines verticales,
  horizontales hairline `border`. Tap en barra → tooltip pill con valor exacto
  (área táctil ≥44dp por barra). Motion receta 6. Vacío → `EstadoVacio` compacto.

---

## 7. Pantallas

### 7.1 Login (Parte F)

- **Paso 1 — ¿Quién eres?**: título `h1`, tarjetas de usuario 64dp con avatar
  circular 44 (inicial `h3/800` sobre `primarySoft`) + nombre `h3`. Stagger
  receta 5.
- **Paso 2 — PIN**: avatar + "Hola, {nombre}" `h2`, `TecladoPin` (§6.12),
  microcopy `body text2`. Error → receta 9. Enlace "Cambiar usuario" `fantasma`
  arriba-izquierda, "¿Se te olvidó tu clave?" abajo `primary`.
- Fondo `bg` limpio. Sin teclado del sistema en toda la pantalla.

### 7.2 Menú — Dashboard (Parte B)

Orden vertical (ScrollView + pull-to-refresh tinte `primary`):

1. **Header**: "Hola, {nombre}" `h2` + fecha `caption text3`. Derecha: badge de
   caja (`Wallet` 16 + "ABIERTA" con punto pulsante) → tap abre módulo Caja.
   Al scrollear >8px el header se vuelve sticky con elevación `e1`.
2. **Chips de período**: Hoy · Semana · Mes · Año · Rango ▾ (§6.5).
3. **Tarjeta hero** (radio `lg`, gradiente primary→primaryPress, texto blanco):
   label micro "TOTAL VENDIDO" (blanco 70%), monto `displayXL` tabular blanco
   (count-up receta 2), chip delta (`▲ 12%` sobre blanco translúcido
   `rgba(255,255,255,0.18)`, verde/rojo del texto según signo + flecha, nunca
   solo color), "18 ventas" `caption` blanco 70%.
4. **Grid de métodos** (3 col, `TarjetaMetrica mini`): Efectivo `Banknote` ·
   Nequi `Smartphone` · Bre-B `Zap` (+ "Otro" si hay monto).
5. **Tarjeta gráfico**: título `h3` "Ventas por día" + `GraficoBarras` (⚠️ gap
   backend: agregación por sub-período, ver redisign.md).
6. **Tarjeta gastos del período**: filas mixtas fijo/variable con `Badge
   neutro` (FIJO/VARIABLE) + monto tabular, footer "Total gastos" `bodyLg/700`
   `danger` (⚠️ gap backend).
7. **Accesos del menú** (`FilaLista` con contenedor de icono): Proveedores ·
   Reportes · Balance 🔒dueño · Análisis IA 🔒dueño (con `Sparkles` en
   `accentSoft`). Filtrados por rol — lo no permitido **no se muestra**.

Carga: skeleton de hero + grid + gráfico (receta 7).

### 7.3 Movimientos (Parte C)

- `ControlSegmentado` `[Ventas][Devoluciones][Gastos]` fijo arriba + chips de
  período compartidos (estado persiste entre vistas).
- **Resumen contextual** bajo el toggle: "HOY · $1.250.000 · 18 ventas"
  (`micro text3` + montos `bodyLg/700`).
- **Vista Ventas**: mini gráfico de la semana + `FilaLista` por venta: icono
  del método (44, `primarySoft`), "Venta #102" `h3` + "2:14 PM · Efectivo"
  `caption`, monto `bodyLg/700` tabular + chevron.
- **Vista Devoluciones** (⚠️ gap: `listarDevoluciones(período)`): fila = "Venta
  #102" + `Badge` (PARCIAL advertencia / TOTAL peligro / CAMBIO neutro) +
  monto devuelto/cobrado + hora.
- **Vista Gastos**: filas con `Badge neutro` FIJO/VARIABLE + categoría, total
  del período al pie. FAB contextual "+" secundario (48dp, `primarySoft`)
  para gasto variable.

**Detalle de venta** (push): tarjetas apiladas — encabezado (número `h1`,
badge estado, fecha/vendedor `caption`), cliente (si hay), items
(`FilaLista` sin press: producto + talla/color snapshot + `cant × precio` →
subtotal tabular), pago (total `display`, desglose por método, efectivo
recibido y cambio), nota (`StickyNote` + itálica), historial de corrección.
CTA final `Boton peligro` variante suave (dangerSoft/dangerText):
"↩ Hacer devolución" → selección de items con checks + stepper cantidad.

### 7.4 Productos (Parte D)

- Header: título + `Input busqueda` + chips de categoría.
- Toggle `[Calzado][Granja]` (§6.7).
- Acciones "Recibir mercancía" (`PackagePlus`) y "Carga inicial" (`Camera`)
  como 2 tarjetas-botón compactas bajo el header (según rol).
- **Card de producto** (agrupado por referencia, un card por modelo): foto
  72×72 radio `sm` (placeholder `Footprints` sobre `surface2`), nombre `h3`,
  "Adidas · Ref 4521 · 3 colores" `caption`, rango de precio `bodyLg/700
  primary`. AGOTADO total → foto en escala de grises + `Badge peligro`.
- **Detalle de producto (pantalla unificada ver/vender)**: foto 4:3 radio
  `lg`, nombre `h2`, marca·ref `caption`, precio `display` (rango si varía
  por variante), `PillColor` row, grid de `ChipTalla` (5 por fila),
  CTA sticky "Agregar al carrito" (`Boton primario lg`) deshabilitado hasta
  seleccionar talla+color. Al agregar: haptic light + `Toast` éxito
  ("Agregado: talla 40 · Negro") + volver a la lista. Badge contador del
  carrito en el header (`ShoppingCart` + pill `danger` con número, pop spring
  al incrementar). Botón `Pencil` en header según rol (dueño/admin).
- **Granja**: misma lista sin tallas/stock; el precio se pide al vender
  (input `gigante` en sheet).

### 7.5 Nueva Venta (FAB)

Flujo existente restilizado con la librería: búsqueda → detalle unificado
(§7.4) → carrito (filas con stepper, precio editable dentro del rango
mín/máx con validación inline) → pagos (chips de método + montos que deben
sumar exacto; diferencia mostrada en vivo `danger`/`success`) → confirmación
(receta 10).

### 7.6 Perfil (Parte E)

- Header: avatar 72 (`primarySoft` + inicial `h1`), nombre `h2`, `Badge
  neutro` con rol ("Dueño" / "Administrativa" / "Operativo").
- Secciones (`FilaLista` agrupadas en tarjetas con título `micro text3`):
  - **Apariencia**: Tema `[Claro][Oscuro][Sistema]` (§6.7).
  - **Caja**: automatización (hora de apertura/cierre, toggle correo) — ⏳
    detalle fino pendiente (redisign.md #3).
  - **Equipo** (solo dueño): Empleados (`Users`).
  - **Sesión**: "Cerrar sesión" (`LogOut` icono y texto `danger`, separado
    visualmente de lo demás, con confirmación).

---

## 8. Accesibilidad (checklist de entrega)

- [ ] Todo tocable ≥48dp (`hitSlop` si el visual es menor).
- [ ] `accessibilityLabel`/`Role`/`State` en español en cada control; orden de
      lectura = orden visual.
- [ ] Contraste: pares de §1.3; texto terciario nunca más claro que `text3`.
- [ ] Nunca solo color: signo `+/−`, iconos y texto acompañan (delta del hero,
      diferencia de caja, badges).
- [ ] `useReducedMotion` aplicado (§5.3).
- [ ] Dynamic Type: layouts toleran +2 tamaños sin truncar montos (los montos
      pueden reducirse con `adjustsFontSizeToFit` en el hero).
- [ ] Teclados semánticos (`number-pad` para montos, `phone-pad` teléfonos).
- [ ] Ambos temas QA-dos por pantalla (no inferir el oscuro).

---

## 9. Implementación

### 9.1 Dependencias nuevas

```bash
npx expo install expo-font @expo-google-fonts/plus-jakarta-sans \
  react-native-svg expo-haptics expo-linear-gradient
npm i lucide-react-native
# react-native-reanimated ya viene con Expo SDK 54
```

### 9.2 Estructura

```
lib/theme.ts          ← tokens (colores claro/oscuro, tipo, spacing, radius,
                         elevación, motion) + ThemeProvider + useTheme()
components/ui/        ← §6: TabBar, Boton, Tarjeta, Badge, Chip, Input,
                         ControlSegmentado, FilaLista, Sheet, Toast,
                         Esqueleto, EstadoVacio, TecladoPin, ChipTalla,
                         PillColor, GraficoBarras
app/(app)/_layout.tsx ← Tabs de expo-router con tabBar custom (§6.1)
```

### 9.3 Orden de migración (sin romper la app)

1. `lib/theme.ts` + fuentes + ThemeProvider (con persistencia del tema).
2. `components/ui/` (§6) con sus tests de lógica pura donde aplique.
3. Nav bar + reestructura de rutas a los 4 tabs (redisign.md Parte A/E).
4. Login con TecladoPin (Parte F — aislada, bajo riesgo).
5. Dashboard (Parte B) — requiere cerrar los ⚠️ gaps de backend en paralelo.
6. Movimientos (Parte C) + `listarDevoluciones`.
7. Productos agrupados + detalle unificado (Parte D).
8. Nueva Venta restilizada + Perfil + barrido de pantallas restantes.
9. QA de ambos temas + accesibilidad (checklist §8) en dispositivo real.

### 9.4 Gaps de backend (heredados de redisign.md, sin cambios)

1. Agregación de ventas por sub-período (gráfico del dashboard).
2. Gastos por período (fijos + variables mezclados).
3. `listarDevoluciones(período)`.
