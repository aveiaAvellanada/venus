# Venus — Sistema de Diseño y UI/UX

> Documento visual del producto. Describe la identidad, los tokens (color,
> tipografía, espaciado), los componentes, los patrones de pantalla y las
> oportunidades de consistencia. Basado en la UI real (`app/`), 33 pantallas.
>
> **Hallazgo transversal:** el proyecto **no tiene un tema ni librería de
> componentes compartida** — cada pantalla declara su propio `StyleSheet`. Eso
> da agilidad pero produce deriva visual (varias familias de azul, grises y
> rojos conviviendo). Este documento describe lo que hay **y** propone el sistema
> al que conviene converger.

---

## 1. Identidad y principios

Venus es una app **móvil Android** para una tienda de calzado familiar, usada por
personas no técnicas en el día a día del mostrador. El diseño responde a eso:

- **Grande y táctil.** Botones altos (`paddingVertical` 18–24), texto de 16–24,
  números de dinero de 32–40. Pensado para usar rápido, de pie, con una mano.
- **Directo, en español, sin jerga.** Títulos como "¿Quién eres?", "¿Cuánto
  efectivo hay en gaveta?". El lenguaje guía la acción.
- **Claridad sobre densidad.** Una tarjeta = una idea. Mucho espacio en blanco,
  fondos claros, jerarquía por tamaño y peso, no por bordes recargados.
- **Color con significado.** Verde = entra/cuadra, rojo = sale/falta/peligro,
  azul = acción primaria/neutra. Estados de caja con badge ABIERTA/CERRADA.
- **Mobile-first, vertical.** `orientation: portrait`, `userInterfaceStyle:
  light` (sin modo oscuro en esta versión).

---

## 2. Paleta de color

### 2.1 Colores en uso (por frecuencia real)

**Azules (acción primaria) — hay deriva, conviene unificar:**

| Hex | Uso | Nota |
|---|---|---|
| `#3B82F6` | El más usado (blue-500 de Tailwind) | candidato a **primario canónico** |
| `#1E66F5` | Caja, login, varios (azul Catppuccin) | 2ª familia |
| `#007AFF` | Azul iOS | 3ª familia |
| `#1D4ED8` / `#1E66F5` | Estados presionados / acentos | |
| `#EFF5FF` / `#EFF6FF` / `#BFDBFE` | Fondos azules suaves (tiles, chips) | |

**Neutros (texto y superficies) — escala tipo Tailwind slate/gray:**

| Hex | Uso |
|---|---|
| `#111827` / `#0F172A` | Texto principal (casi negro) |
| `#374151` / `#4B5563` | Texto secundario |
| `#6B7280` / `#64748B` | Texto terciario / labels |
| `#9CA3AF` / `#8E8E93` | Placeholder / deshabilitado |
| `#E5E7EB` / `#E2E8F0` / `#D1D5DB` | Bordes y divisores |
| `#F3F4F6` / `#F9FAFB` / `#F8FAFC` / `#F1F5F9` | Fondos de tarjeta / superficie |
| `#FFFFFF` | Fondo base de casi todas las pantallas |

**Semánticos:**

| Intención | Hex | Uso |
|---|---|---|
| Éxito / entra / cuadra | `#10B981` `#16A34A` `#15803D` `#1E7A34` | montos positivos, badge ABIERTA, sobrante |
| Fondo éxito | `#F0FDF4` `#DCFCE7` `#E3F2E8` | cajas de sobrante / confirmación |
| Peligro / sale / falta | `#EF4444` `#DC2626` `#D20F39` `#B91C1C` | "Salir", errores, faltante, eliminar |
| Fondo peligro | `#FEF2F2` `#FDECEF` | caja de faltante, badge CERRADA |
| Advertencia | `#92400E` (texto) | alertas de vencimiento |

### 2.2 Paleta canónica propuesta (a converger)

```
Primario        #1E66F5  (elegir UNO de los azules y usarlo en todo)
Primario-press  #1D4ED8
Primario-soft   #EFF5FF   fondos de tiles/chips
Texto-fuerte    #0F172A
Texto-medio     #475569
Texto-suave     #64748B
Borde           #E2E8F0
Superficie      #F8FAFC
Fondo           #FFFFFF
Éxito           #16A34A   / soft #F0FDF4
Peligro         #DC2626   / soft #FEF2F2
Advertencia     #D97706   / soft #FEF3C7
```

> **Recomendación #1:** crear `lib/theme.ts` con estos tokens y reemplazar los
> hex sueltos. Hoy hay 3 azules y 4 rojos compitiendo.

---

## 3. Tipografía

Fuente del sistema (no hay fuente custom cargada). Jerarquía por **tamaño + peso**.

| Rol | Tamaño | Peso | Ejemplo |
|---|---|---|---|
| Display / dinero gigante | 32–40 (hasta 48–80 en casos) | 800 | total de caja, PIN, monto contado |
| Título de pantalla | 24–32 | 700–800 | "¿Quién eres?", "Calculadora de Cierre" |
| Subtítulo / saludo | 18–22 | 600–700 | "Hola, Andrés" |
| Cuerpo / botón | 15–18 | 600–700 | labels, texto de botón |
| Secundario | 13–14 | 500–600 | sublabels, ayudas |
| Microcopy / badge | 11–12 | 600–800 | "ABIERTA", notas |

Pesos en uso: **600** (107×, el dominante), **700** (72×), **800** (19×), 500 (13×).

> **Recomendación #2:** estandarizar a una escala fija (12 / 14 / 16 / 18 / 22 /
> 28 / 40) — hoy aparecen 20+ tamaños distintos.

---

## 4. Espaciado, radio y elevación

- **Padding de pantalla:** 16–24 (24 es el más común para formularios).
- **Gap entre elementos:** 12–16.
- **Radio de borde:** `8` / `10` / `12` (controles), `16` (botones/tarjetas),
  `20` (tiles de home), `70`/`30` (avatares/círculos). → converger a 12 / 16 / 20.
- **Tarjetas:** fondo `#F8FAFC`, borde 1px `#E2E8F0`, radio 16–20. Sombra casi
  nula (diseño plano, se apoya en fondo + borde).
- **Botones:** altura por `paddingVertical` 18–24; ancho completo en acciones
  primarias; radio 16.

---

## 5. Componentes (patrones repetidos)

Aunque no estén extraídos como componentes, estos patrones se repiten y deberían
volverse reutilizables:

### 5.1 Botón primario (gigante)
Fondo azul, texto blanco 18–24/700, radio 16, ancho completo. Estado deshabilitado
con `opacity: 0.7`. Muestra `<ActivityIndicator color="#fff">` mientras carga.

```
┌───────────────────────────────────┐
│           Abrir Caja del Día       │   ← azul, texto blanco, alto
└───────────────────────────────────┘
```

### 5.2 Botón peligro
Idéntico patrón con fondo rojo (`#D20F39`/`#DC2626`). Usado en "Cerrar caja",
eliminar, "Salir".

### 5.3 Tarjeta de información / métrica
Fondo `#F8FAFC`, borde, radio 16–20. Label en mayúsculas pequeño (`#64748B`) +
valor grande (28–40/800). Variante "mini" en grids de 3 (efectivo/Nequi/Daviplata).

### 5.4 Badge de estado
Pastilla con `paddingVertical 6 / paddingHorizontal 12`, radio 12, texto 12–14/800.
Verde (`#E3F2E8`/`#1E7A34`) = ABIERTA; rojo (`#FDECEF`/`#D20F39`) = CERRADA.

### 5.5 Input
Borde 1–2px, radio 12–16, padding 14–16. Variante "gigante" centrada (PIN, monto)
con texto 32–40. Teclado contextual (`number-pad`, `numbers-and-punctuation`).

### 5.6 Caja de diferencia semántica
Cambia de fondo y color de texto según el signo: gris (cuadre), verde (sobrante),
rojo (faltante). Exige nota cuando hay diferencia.

### 5.7 Tile de módulo (home)
Cuadrado (`aspectRatio: 1`, `width: 47%`), fondo `#EFF5FF`, radio 20, emoji 48 +
título 18/600 centrado.

> **Recomendación #3:** extraer `components/` con `Boton`, `Tarjeta`, `Badge`,
> `Input`, `Pantalla` (wrapper con padding/título). Reduciría ~1.000 líneas de
> estilos duplicados y elimina la deriva de color de raíz.

---

## 6. Iconografía

**Dos sistemas conviven:**
- **Emoji** para los módulos del home y badges (🛒 Ventas, ↩️ Devoluciones,
  👟 Inventario, 🥚 Granja, 📥 Recibir, 🧾 Caja, 💸 Gastos, 🚚 Proveedores,
  📌 Gastos fijos, 📊 Reportes, 📷 Carga, 👤 Empleados, ⚖️ Balance, 🤖 IA).
  Definidos en `lib/permisos.ts`. Aportan calidez y lectura rápida.
- **`@expo/vector-icons`** en ~10 pantallas de detalle (inventario, empleados,
  recibir mercancía, reportes) para acciones e ítems de lista.

> **Recomendación #4:** mantener emoji en el home (es un acierto de calidez para
> el usuario) pero unificar los íconos de acción a un solo set vectorial.

---

## 7. Patrones de pantalla (recorrido visual)

### 7.1 Login — `app/(auth)/login.tsx`
Dos pasos, foco total:

```
   ¿Quién eres?                         Andrés
                                     Escribe tu PIN
 ┌─────────────────┐               ┌───────────────┐
 │     Andrés      │               │   • • • •     │  ← input gigante
 └─────────────────┘               └───────────────┘
 ┌─────────────────┐               ┌───────────────┐
 │     Sandra      │               │     Entrar     │  ← primario
 └─────────────────┘               └───────────────┘
 ┌─────────────────┐                 ← Cambiar usuario
 │     Camilo      │
 └─────────────────┘
```
Selector de usuario por nombre (no escribir email) → PIN numérico oculto. Botón
"Entrar" deshabilitado hasta 4 dígitos. Errores en rojo, centrados.

### 7.2 Home — `app/(app)/index.tsx`
Saludo personalizado + "Salir" en rojo. Grid de 2 columnas con tiles cuadrados
filtrados por rol (`modulosPara(rol)`):

```
  Hola, Andrés                         Salir
 ┌───────────┐  ┌───────────┐
 │    🛒     │  │    ↩️     │
 │  Ventas   │  │Devoluciones│
 └───────────┘  └───────────┘
 ┌───────────┐  ┌───────────┐
 │    👟     │  │    🥚     │
 │Inventario │  │  Granja   │
 └───────────┘  └───────────┘
        ... (según permisos del rol)
```

### 7.3 Caja — `app/(app)/caja/`
Dashboard según estado:

```
        Dashboard de Caja
            [ ABIERTA ]              ← badge verde
 ┌─────────────────────────────┐
 │        TOTAL GENERAL         │
 │          $1.250.000          │    ← número gigante
 │        18 ventas en total    │
 └─────────────────────────────┘
 ┌────────┐ ┌────────┐ ┌────────┐
 │Efectivo│ │ Nequi  │ │Daviplata│   ← grid mini
 └────────┘ └────────┘ └────────┘
 ┌─────────────────────────────┐
 │       Ir a Cerrar Caja       │     ← rojo
 └─────────────────────────────┘
```
Cuando está cerrada: "Resumen Final de Caja", badge CERRADA y botón **"Abrir caja
de nuevo"**. La **Calculadora de Cierre** (modal) muestra el efectivo esperado,
pide el contado e indica la diferencia con color semántico, exigiendo nota si no
cuadra. Header con accesos **Config** (dueño) e **Historial** (dueño+admin).

### 7.4 Listas (inventario, proveedores, empleados, gastos)
Búsqueda en tiempo real arriba, lista de tarjetas, FAB o botón "+", y editores en
pantalla aparte o modal. Estados claros de AGOTADO, vencimiento, etc.

### 7.5 Formularios (editores, nueva venta, recibir mercancía)
Inputs grandes etiquetados, validación con `Alert`, botón primario de guardar al
fondo, spinner en carga. Dinero siempre formateado `'$' + n.toLocaleString('es-CO')`.

---

## 8. Microcopy y formato

- **Dinero:** `'$' + n.toLocaleString('es-CO')` → `$1.250.000` (punto de miles).
- **Tono:** segunda persona, cercano ("¿Cuánto efectivo hay en gaveta?",
  "Explica por qué sobra o falta dinero...").
- **Feedback:** `Alert` nativo para confirmaciones y errores; spinners en línea
  para cargas; `RefreshControl` (pull-to-refresh) en dashboards.
- **Estados vacíos:** texto centrado gris ("No hay registros de caja.").

---

## 9. Accesibilidad y ergonomía

**Bien resuelto:** objetivos táctiles grandes, `hitSlop` en enlaces pequeños,
contraste alto del texto principal, teclados numéricos para montos/PIN.

**A mejorar:**
- Contraste de texto terciario `#9CA3AF` sobre blanco roza el mínimo AA en tamaños
  pequeños.
- No hay modo oscuro (`userInterfaceStyle: light` fijo).
- Depender de color para diferencia (sobrante/faltante) — añadir signo `+/−` (ya
  se hace en algunos sitios) y/o etiqueta textual en todos.

---

## 10. Resumen de oportunidades (priorizado)

1. **`lib/theme.ts` con tokens** (color, tipografía, espaciado) y migrar los hex
   sueltos → elimina la deriva de 3 azules / 4 rojos.
2. **`components/` compartidos** (`Boton`, `Tarjeta`, `Badge`, `Input`,
   `Pantalla`) → menos duplicación, consistencia automática.
3. **Escala tipográfica y de radios fija** (hoy 20+ tamaños, 8+ radios).
4. **Unificar íconos de acción** a un set vectorial; conservar emoji en el home.
5. **Pasos de accesibilidad**: contraste mínimo, no depender solo de color.

> Nada de esto bloquea el producto: la UI actual es funcional, cálida y adecuada
> para el usuario. Estas son mejoras de **consistencia y mantenibilidad** para
> cuando se quiera pulir la capa visual de forma sistemática.
