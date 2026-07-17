# Rediseño de Menú, Caja, Perfil, Gastos Fijos, Balance y Safe-Area — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 6-part redesign agreed in `docs/superpowers/specs/2026-07-16-menu-caja-perfil-redesign-design.md`: quick UI polish, a Caja rediseño (config movida a Perfil, modo con/sin diferencia, horario semanal), reorganización del Perfil, alertas de gastos fijos, filtros de Balance por año/rango, y el fix de safe-area.

**Architecture:** Todo se implementa sobre la rama actual `feat/redesign-nueva-venta`. Cambios de UI en `app/` y `components/ui/`, lógica pura nueva/extendida en `lib/`, un hook nuevo en `hooks/`, una migración SQL que altera `caja_config`, y la Edge Function `caja-scheduler` actualizada para horario por día de la semana.

**Tech Stack:** Expo Router, React Native, TypeScript estricto, Supabase (Postgres + Edge Functions Deno), Jest + react-test-renderer.

## Global Constraints

- TypeScript estricto en todo el proyecto; toda la UI en español.
- Seguir los patrones de componentes ya existentes (`Tarjeta`, `FilaLista`, `CirculoIcono`, `Presionable`, `Boton`, `CampoTexto`, `Chip`, `SelectorRango`, `useToast`) — no crear alternativas nuevas para lo mismo.
- No tocar RLS salvo lo descrito explícitamente (ninguna política cambia en este plan; solo se agregan columnas).
- Rama de trabajo: `feat/redesign-nueva-venta` (ya tiene el spec commiteado ahí — no crear una rama nueva).
- Cada task termina con `tsc --noEmit` limpio y `npm test` verde antes de commitear.
- No offline-first, no WhatsApp automático, no cambios al flujo de apertura de caja (fuera de alcance, confirmado en brainstorming).

---

## Fase A — Retoques rápidos de UI

### Task 1: Login — quitar "¿Se te olvidó tu clave?"

**Files:**
- Modify: `app/(auth)/login.tsx`

**Interfaces:** Ninguna — cambio aislado, sin consumidores.

- [ ] **Step 1: Eliminar el bloque**

En `app/(auth)/login.tsx`, dentro del `return` del segundo estado (con `usuario` ya elegido), elimina el `Pressable` completo que sigue al `</View>` de arriba:

```tsx
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="¿Se te olvidó tu clave?"
        hitSlop={12}
        onPress={() =>
          Alert.alert('¿Se te olvidó tu clave?', 'Pídele a Andrés que te asigne una nueva.')
        }
        style={{ alignSelf: 'center', paddingVertical: espacio.l }}
      >
        <Text style={[tipografia.etiqueta, { color: paleta.primario }]}>¿Se te olvidó tu clave?</Text>
      </Pressable>
    </View>
  )
}
```

Déjalo así (sin el `Pressable`, cerrando directo el `View` raíz):

```tsx
    </View>
  )
}
```

- [ ] **Step 2: Quitar el import de `Alert` si queda sin uso**

`Alert` solo se usaba en ese bloque. En el import de `react-native` (línea 2), quita `Alert` de la lista:

```tsx
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/login.tsx"
git commit -m "$(cat <<'EOF'
fix(ui): quita el enlace "¿Se te olvidó tu clave?" del login

No era un flujo real de recuperación (solo abría un Alert). El PIN lo
reasigna Andrés desde Gestión de Empleados.
EOF
)"
```

---

### Task 2: Menú principal — grilla 2x2 de métodos de pago

**Files:**
- Modify: `app/(app)/(tabs)/index.tsx`

**Interfaces:** Ninguna — cambio de presentación local a `Menu()`.

- [ ] **Step 1: Siempre incluir "Otro" en `metodosDe()`**

Busca esta función y quita el `if`:

```ts
function metodosDe(efectivo: number, nequi: number, breB: number, otro: number): Metodo[] {
  const lista: Metodo[] = [
    { clave: 'efectivo', etiqueta: 'Efectivo', monto: efectivo, Icono: Banknote },
    { clave: 'nequi', etiqueta: 'Nequi', monto: nequi, Icono: Smartphone },
    { clave: 'bre_b', etiqueta: 'Bre-B', monto: breB, Icono: Zap },
  ]
  if (otro > 0) lista.push({ clave: 'otro', etiqueta: 'Otro', monto: otro, Icono: CreditCard })
  return lista
}
```

Reemplázala por (los 4 siempre en la lista, orden Efectivo/Nequi/Bre-B/Otro):

```ts
function metodosDe(efectivo: number, nequi: number, breB: number, otro: number): Metodo[] {
  return [
    { clave: 'efectivo', etiqueta: 'Efectivo', monto: efectivo, Icono: Banknote },
    { clave: 'nequi', etiqueta: 'Nequi', monto: nequi, Icono: Smartphone },
    { clave: 'bre_b', etiqueta: 'Bre-B', monto: breB, Icono: Zap },
    { clave: 'otro', etiqueta: 'Otro', monto: otro, Icono: CreditCard },
  ]
}
```

- [ ] **Step 2: Cambiar el render a grilla 2x2**

Busca:

```tsx
            <View style={{ flexDirection: 'row', gap: espacio.s }}>
              {metodos.map((m) => (
                <TarjetaMetrica
                  key={m.clave}
                  mini
                  etiqueta={m.etiqueta}
                  valor={formatear(m.monto)}
                  icono={<m.Icono size={16} color={paleta.primario} />}
                />
              ))}
            </View>
```

Reemplázalo por:

```tsx
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: espacio.s }}>
              {metodos.map((m) => (
                <View key={m.clave} style={{ width: '48%' }}>
                  <TarjetaMetrica
                    mini
                    etiqueta={m.etiqueta}
                    valor={formatear(m.monto)}
                    icono={<m.Icono size={16} color={paleta.primario} />}
                  />
                </View>
              ))}
            </View>
```

- [ ] **Step 3: Verificar tipos y tests existentes**

Run: `npx tsc --noEmit && npm test -- index` (o el nombre real del archivo de test si existe uno para esta pantalla; si no existe, solo `npx tsc --noEmit`).
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/(tabs)/index.tsx"
git commit -m "$(cat <<'EOF'
fix(ui): tarjetas de método de pago en grilla 2x2 en el menú

Con 3 en una fila los montos en pesos colombianos (con muchos ceros)
quedaban muy apretados. Ahora son 4 siempre visibles (Efectivo/Nequi
arriba, Bre-B/Otro abajo) en vez de ocultar "Otro" cuando es cero.
EOF
)"
```

---

### Task 3: Menú principal — ocultar "Ventas por período" en Hoy

**Files:**
- Modify: `app/(app)/(tabs)/index.tsx`

**Interfaces:** Ninguna.

- [ ] **Step 1: Condicionar la tarjeta del gráfico**

Busca:

```tsx
            {esStaff ? (
              <Tarjeta>
                <View style={{ gap: espacio.m }}>
                  <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Ventas por período</Text>
                  <GraficoBarras datos={buckets} granularidad={granularidad} />
                </View>
              </Tarjeta>
            ) : null}
```

Reemplázalo por:

```tsx
            {esStaff && periodo !== 'hoy' ? (
              <Tarjeta>
                <View style={{ gap: espacio.m }}>
                  <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Ventas por período</Text>
                  <GraficoBarras datos={buckets} granularidad={granularidad} />
                </View>
              </Tarjeta>
            ) : null}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/(tabs)/index.tsx"
git commit -m "$(cat <<'EOF'
fix(ui): oculta el gráfico "Ventas por período" en la vista Hoy

El gráfico de barras solo tiene sentido para comparar subperíodos
(Semana/Mes/Año/Rango); en Hoy no hay nada que comparar.
EOF
)"
```

---

### Task 4: TabBar — quitar el difuminado del FAB de Nueva Venta

**Files:**
- Modify: `components/ui/TabBar.tsx`

**Interfaces:** Ninguna. (`components/ui/TabBar.test.tsx` no asserta sobre el estilo de sombra — no requiere cambios.)

- [ ] **Step 1: Quitar las propiedades de sombra del `Presionable` del FAB**

Busca:

```tsx
        <Presionable
          escala={0.92}
          accessibilityRole="button"
          accessibilityLabel="Nueva venta"
          onPress={abrirNuevaVenta}
          style={{
            marginTop: -24,
            width: 60,
            height: 60,
            borderRadius: radio.full,
            shadowColor: paleta.primario,
            shadowOpacity: 0.35,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
```

Reemplázalo por:

```tsx
        <Presionable
          escala={0.92}
          accessibilityRole="button"
          accessibilityLabel="Nueva venta"
          onPress={abrirNuevaVenta}
          style={{
            marginTop: -24,
            width: 60,
            height: 60,
            borderRadius: radio.full,
          }}
        >
```

- [ ] **Step 2: Correr la suite de TabBar**

Run: `npm test -- TabBar`
Expected: PASS (4/4 tests).

- [ ] **Step 3: Commit**

```bash
git add components/ui/TabBar.tsx
git commit -m "$(cat <<'EOF'
fix(ui): quita el difuminado inferior del FAB de Nueva Venta

El drop-shadow coloreado proyectado hacia abajo se veía como un brillo
no intencional debajo del botón.
EOF
)"
```

---

## Fase F — Fix de safe-area (barra de gestos Android)

### Task 5: Hook compartido `usePaddingInferior`

**Files:**
- Create: `hooks/usePaddingInferior.ts`

**Interfaces:**
- Produces: `usePaddingInferior(base: number): number` — retorna `insets.bottom + base`, para usar como `paddingBottom` en cualquier `ScrollView`/`View` de fondo de pantalla.

- [ ] **Step 1: Crear el hook**

```ts
// hooks/usePaddingInferior.ts
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Padding inferior real de cada pantalla: espaciado base + el inset del
// sistema (barra de gestos de Android, home indicator de iOS). Reemplaza
// los `paddingBottom` fijos (100 / espacio.xxxl) que no consideraban el
// inset y quedaban tapados por la barra de gestos en algunos dispositivos.
export function usePaddingInferior(base: number): number {
  const insets = useSafeAreaInsets()
  return insets.bottom + base
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/usePaddingInferior.ts
git commit -m "$(cat <<'EOF'
feat: hook usePaddingInferior para padding inferior seguro por pantalla

Encapsula insets.bottom + espaciado base para que cada pantalla derive
su paddingBottom del inset real del dispositivo en vez de un valor fijo.
EOF
)"
```

---

### Task 6: Aplicar `usePaddingInferior` en las pantallas afectadas

**Files:**
- Modify: `app/(app)/caja/config.tsx:97`
- Modify: `app/(app)/reportes/index.tsx:139`
- Modify: `app/(app)/proveedores/index.tsx:203`
- Modify: `app/(app)/caja/index.tsx` (paddingBottom del `ScrollView` de "cerrada"/reabrir — ver Task 12, que ya reescribe este archivo; si Task 12 se ejecuta después, aplica el hook ahí directamente en vez de aquí para evitar un conflicto de merge)
- Modify: `app/(app)/caja/cierre.tsx:152`
- Modify: `app/(app)/reportes/periodos.tsx:208`
- Modify: `app/(app)/recibir-mercancia/index.tsx:245`
- Modify: `app/(app)/gastos/index.tsx:159,199`
- Modify: `app/(app)/caja/historial.tsx:79`
- Modify: `app/(app)/empleados/index.tsx:163`
- Modify: `app/(app)/inventario/granja/editor.tsx:181,250`
- Modify: `app/(app)/balance/index.tsx:230` (si Task 20/21 aún no corrieron; si ya corrieron, aplica el hook sobre el archivo resultante)
- Modify: `app/(app)/recibir-mercancia/nueva.tsx:430,704,817`
- Modify: `app/(app)/empleados/[id].tsx:336`
- Modify: `app/(app)/inventario/carga.tsx:115`
- Modify: `app/(app)/proveedores/[id].tsx:323,603,717`
- Modify: `app/(app)/gastos/fijos-editor.tsx:85`
- Modify: `app/(app)/gastos/fijos.tsx:174`
- Modify: `app/(app)/devoluciones/nueva.tsx:479`
- Modify: `app/(app)/gastos/pagar.tsx:94`
- Modify: `app/(app)/inventario/calzado/editor.tsx:241,378`
- Modify: `app/(app)/inventario/calzado/[id].tsx:109,178`

**Interfaces:**
- Consumes: `usePaddingInferior(base: number): number` de `../../../hooks/usePaddingInferior` (ajusta la profundidad relativa según la carpeta del archivo — 3 niveles arriba de `app/(app)/X/` hasta la raíz, igual que los imports de `lib/theme`).

Nota general para cada archivo: (1) agregar el import del hook con la ruta relativa correcta, (2) agregar `const paddingInferior = usePaddingInferior(<valor-base>)` dentro del componente (el `<valor-base>` es el número que reemplaza — `100` o `espacio.xxxl`), (3) reemplazar el literal en `paddingBottom` por `paddingInferior`.

- [ ] **Step 1: `app/(app)/caja/config.tsx`**

Import (junto a los otros de `react-native`/hooks):
```ts
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
```
Dentro de `CajaConfig()`, junto a los demás `useState`:
```ts
const paddingInferior = usePaddingInferior(espacio.xxxl)
```
Cambia:
```tsx
contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: espacio.xxxl, gap: espacio.l }}
```
por:
```tsx
contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.l }}
```

- [ ] **Step 2: `app/(app)/reportes/index.tsx`**

Mismo patrón: import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` en el componente + cambiar `paddingBottom: espacio.xxxl` (línea 139) por `paddingBottom: paddingInferior`.

- [ ] **Step 3: `app/(app)/proveedores/index.tsx`**

Import + `const paddingInferior = usePaddingInferior(100)` + cambiar `paddingBottom: 100` (línea 203) por `paddingBottom: paddingInferior`.

- [ ] **Step 4: `app/(app)/caja/cierre.tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar `paddingBottom: espacio.xxxl` (línea 152) por `paddingBottom: paddingInferior`.

- [ ] **Step 5: `app/(app)/reportes/periodos.tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar `paddingBottom: espacio.xxxl` (línea 208) por `paddingBottom: paddingInferior`.

- [ ] **Step 6: `app/(app)/recibir-mercancia/index.tsx`**

Import + `const paddingInferior = usePaddingInferior(100)` + cambiar `paddingBottom: 100` (línea 245) por `paddingBottom: paddingInferior`.

- [ ] **Step 7: `app/(app)/gastos/index.tsx`**

Import + `const paddingInferior100 = usePaddingInferior(100)` y `const paddingInferiorXxxl = usePaddingInferior(espacio.xxxl)` (el archivo usa ambos valores en dos `ScrollView`/`FlatList` distintos — líneas 159 y 199) + cambia cada literal por su variable correspondiente.

- [ ] **Step 8: `app/(app)/caja/historial.tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar `paddingBottom: espacio.xxxl` (línea 79, dentro de `contentContainerStyle={{ ..., flexGrow: 1 }}`) por `paddingBottom: paddingInferior`.

- [ ] **Step 9: `app/(app)/empleados/index.tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar `paddingBottom: espacio.xxxl` (línea 163) por `paddingBottom: paddingInferior`.

- [ ] **Step 10: `app/(app)/inventario/granja/editor.tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar ambas ocurrencias (línea 181 dentro de `contentContainerStyle`, y línea 250 en el `View` de la barra inferior fija) por `paddingBottom: paddingInferior`.

- [ ] **Step 11: `app/(app)/recibir-mercancia/nueva.tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar las 3 ocurrencias (líneas 430, 704, 817) por `paddingBottom: paddingInferior`.

- [ ] **Step 12: `app/(app)/empleados/[id].tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar `paddingBottom: espacio.xxxl` (línea 336) por `paddingBottom: paddingInferior`.

- [ ] **Step 13: `app/(app)/inventario/carga.tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar `paddingBottom: espacio.xxxl` (línea 115) por `paddingBottom: paddingInferior`.

- [ ] **Step 14: `app/(app)/proveedores/[id].tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar las 3 ocurrencias (líneas 323, 603, 717) por `paddingBottom: paddingInferior`.

- [ ] **Step 15: `app/(app)/gastos/fijos-editor.tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar `paddingBottom: espacio.xxxl` (línea 85) por `paddingBottom: paddingInferior`.

- [ ] **Step 16: `app/(app)/gastos/fijos.tsx`**

Import + `const paddingInferior = usePaddingInferior(100)` + cambiar `paddingBottom: 100` (línea 174) por `paddingBottom: paddingInferior`. (El FAB de "Agregar gasto fijo", líneas 187-205, usa `bottom: espacio.xl` fijo para su posición absoluta, no `paddingBottom` de scroll — déjalo así, no es parte de este fix.)

- [ ] **Step 17: `app/(app)/devoluciones/nueva.tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar `paddingBottom: espacio.xxxl` (línea 479) por `paddingBottom: paddingInferior`.

- [ ] **Step 18: `app/(app)/gastos/pagar.tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar `paddingBottom: espacio.xxxl` (línea 94) por `paddingBottom: paddingInferior`.

- [ ] **Step 19: `app/(app)/inventario/calzado/editor.tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar ambas ocurrencias (línea 241 y línea 378, barra inferior fija) por `paddingBottom: paddingInferior`.

- [ ] **Step 20: `app/(app)/inventario/calzado/[id].tsx`**

Import + `const paddingInferior = usePaddingInferior(espacio.xxxl)` + cambiar ambas ocurrencias (línea 109 y línea 178, barra inferior fija) por `paddingBottom: paddingInferior`.

- [ ] **Step 21: Grep de verificación**

Run:
```bash
grep -rn "paddingBottom: 100\|paddingBottom: espacio.xxxl" app/ components/ | grep -v ".test."
```
Expected: sin resultados (o solo los que quedaron intencionalmente fuera de alcance, si los hubiera — ninguno esperado tras este task).

- [ ] **Step 22: Correr toda la suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS, sin regresiones.

- [ ] **Step 23: Commit**

```bash
git add hooks/usePaddingInferior.ts app/
git commit -m "$(cat <<'EOF'
fix(ui): usa el inset real de safe-area en vez de paddingBottom fijo

~20 pantallas usaban 100 o espacio.xxxl fijos como paddingBottom, sin
considerar insets.bottom. En dispositivos Android con barra de gestos
más alta, contenido importante quedaba tapado. Ahora todas usan
usePaddingInferior(), que suma el inset real del dispositivo.
EOF
)"
```

---

## Fase B — Rediseño de Caja

### Task 7: Migración — `horario_semanal` + `modo_cierre` en `caja_config`

**Files:**
- Create: `supabase/migrations/20260716220000_caja_config_horario_semanal_modo_cierre.sql`
- Modify: `lib/database.types.ts` (regenerado, no editado a mano)

**Interfaces:**
- Produces: columna `caja_config.horario_semanal jsonb` (shape `{ "<dia>": { "apertura": "HH:MM" | null, "cierre": "HH:MM" | null } }`, días en minúscula sin tilde: `lunes,martes,miercoles,jueves,viernes,sabado,domingo`), columna `caja_config.modo_cierre text` (`'con_diferencia' | 'sin_diferencia'`, default `'con_diferencia'`).

- [ ] **Step 1: Escribir la migración**

```sql
-- Caja: horario automático por día de la semana + modo de cierre configurable.
alter table public.caja_config
  add column if not exists horario_semanal jsonb not null default '{}'::jsonb,
  add column if not exists modo_cierre text not null default 'con_diferencia'
    check (modo_cierre in ('con_diferencia', 'sin_diferencia'));

-- Migra el horario plano existente (si estaba configurado) a los 7 días,
-- para no perder la configuración de quienes ya tenían modo automático.
update public.caja_config
set horario_semanal = (
  select jsonb_object_agg(dia, jsonb_build_object(
    'apertura', to_char(hora_apertura, 'HH24:MI'),
    'cierre', to_char(hora_cierre, 'HH24:MI')
  ))
  from unnest(array['lunes','martes','miercoles','jueves','viernes','sabado','domingo']) as dia
)
where hora_apertura is not null and hora_cierre is not null;

alter table public.caja_config
  drop column if exists hora_apertura,
  drop column if exists hora_cierre;
```

- [ ] **Step 2: Aplicar la migración**

Run: `npx supabase db push`
Expected: la migración se aplica sin error sobre el proyecto remoto vinculado.

- [ ] **Step 3: Regenerar tipos de TypeScript**

Run: `npx supabase gen types typescript --linked > lib/database.types.ts`
Expected: el tipo `caja_config` en `lib/database.types.ts` ya no tiene `hora_apertura`/`hora_cierre` y sí tiene `horario_semanal: Json` y `modo_cierre: string`.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: pueden aparecer errores en `app/(app)/caja/config.tsx` (que todavía referencia `hora_apertura`/`hora_cierre`) — se resuelven en el Task 11. Si aparecen ahí, está bien por ahora; no debe haber errores en ningún otro archivo.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260716220000_caja_config_horario_semanal_modo_cierre.sql lib/database.types.ts
git commit -m "$(cat <<'EOF'
feat(db): caja_config gana horario_semanal y modo_cierre

Reemplaza hora_apertura/hora_cierre planos por un horario por día de
la semana, y agrega el modo de cierre (con/sin diferencia) que decide
el comportamiento del botón de cerrar caja desde el menú.
EOF
)"
```

---

### Task 8: `lib/cajaScheduler.ts` — resolver horario del día

**Files:**
- Modify: `lib/cajaScheduler.ts`
- Modify: `lib/cajaScheduler.test.ts`

**Interfaces:**
- Produces: `DiaSemana` (tipo), `DIAS_SEMANA: DiaSemana[]` (indexado igual que `Date.getDay()`, domingo=0), `HorarioDia` (`{ apertura: string | null; cierre: string | null }`), `HorarioSemanal` (`Partial<Record<DiaSemana, HorarioDia>>`), `diaSemanaDeFecha(fecha: Date): DiaSemana`, `horarioDelDia(horario: HorarioSemanal, dia: DiaSemana): HorarioDia`.
- No cambia: `decidirAccionCaja` conserva su firma actual (recibe `hora_apertura`/`hora_cierre` ya resueltos para el día correspondiente — la resolución del día ocurre antes de llamarla, en el caller).

- [ ] **Step 1: Escribir los tests que fallan**

Agrega al final de `lib/cajaScheduler.test.ts`:

```ts
import { diaSemanaDeFecha, horarioDelDia, type HorarioSemanal } from './cajaScheduler'

describe('diaSemanaDeFecha', () => {
  it('mapea getDay() al nombre del día en español', () => {
    // 2026-06-17 es miércoles
    expect(diaSemanaDeFecha(new Date(2026, 5, 17))).toBe('miercoles')
    // 2026-06-14 es domingo
    expect(diaSemanaDeFecha(new Date(2026, 5, 14))).toBe('domingo')
    // 2026-06-20 es sábado
    expect(diaSemanaDeFecha(new Date(2026, 5, 20))).toBe('sabado')
  })
})

describe('horarioDelDia', () => {
  const horario: HorarioSemanal = {
    lunes: { apertura: '08:00', cierre: '19:00' },
    sabado: { apertura: '09:00', cierre: '17:00' },
  }
  it('devuelve el horario configurado del día', () => {
    expect(horarioDelDia(horario, 'lunes')).toEqual({ apertura: '08:00', cierre: '19:00' })
  })
  it('devuelve apertura/cierre null si el día no tiene horario configurado', () => {
    expect(horarioDelDia(horario, 'domingo')).toEqual({ apertura: null, cierre: null })
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- cajaScheduler`
Expected: FAIL — `diaSemanaDeFecha`/`horarioDelDia` no están definidos.

- [ ] **Step 3: Implementar**

Agrega en `lib/cajaScheduler.ts`, antes de `decidirAccionCaja`:

```ts
export type DiaSemana = 'domingo' | 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado'

// Indexado igual que Date.getDay(): 0=domingo .. 6=sábado.
export const DIAS_SEMANA: DiaSemana[] = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

export interface HorarioDia {
  apertura: string | null
  cierre: string | null
}

export type HorarioSemanal = Partial<Record<DiaSemana, HorarioDia>>

export function diaSemanaDeFecha(fecha: Date): DiaSemana {
  return DIAS_SEMANA[fecha.getDay()]
}

export function horarioDelDia(horario: HorarioSemanal, dia: DiaSemana): HorarioDia {
  return horario[dia] ?? { apertura: null, cierre: null }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- cajaScheduler`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/cajaScheduler.ts lib/cajaScheduler.test.ts
git commit -m "$(cat <<'EOF'
feat(caja): resolver horario automático por día de la semana

diaSemanaDeFecha + horarioDelDia son lógica pura y testeada; decidirAccionCaja
no cambia — sigue recibiendo el horario ya resuelto para "hoy".
EOF
)"
```

---

### Task 9: Edge Function `caja-scheduler` — usar `horario_semanal`

**Files:**
- Modify: `supabase/functions/caja-scheduler/index.ts`

**Interfaces:**
- Consumes: `caja_config.horario_semanal` (jsonb, shape de Task 7), `caja_config.modo_automatico`.

- [ ] **Step 1: Reemplazar la resolución de horario**

Busca:

```ts
    const { data: cfg } = await admin.from('caja_config').select('*').limit(1).single()
    if (!cfg) return json({ skipped: 'sin_config' })

    const { data: caja } = await admin.from('cierres_caja').select('*').eq('fecha', fecha).maybeSingle()
    const accion = decidirAccionCaja(cfg, horaHHMM, caja)
```

Reemplázalo por:

```ts
    const { data: cfg } = await admin.from('caja_config').select('*').limit(1).single()
    if (!cfg) return json({ skipped: 'sin_config' })

    // Réplica de diaSemanaDeFecha/horarioDelDia (lib/cajaScheduler.ts) — runtime Deno separado.
    const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    const dia = DIAS_SEMANA[ahoraBogota.getDay()]
    const horarioSemanal = (cfg.horario_semanal ?? {}) as Record<string, { apertura: string | null; cierre: string | null }>
    const horarioHoy = horarioSemanal[dia] ?? { apertura: null, cierre: null }
    const cfgResuelto = { modo_automatico: cfg.modo_automatico, hora_apertura: horarioHoy.apertura, hora_cierre: horarioHoy.cierre }

    const { data: caja } = await admin.from('cierres_caja').select('*').eq('fecha', fecha).maybeSingle()
    const accion = decidirAccionCaja(cfgResuelto, horaHHMM, caja)
```

- [ ] **Step 2: Verificar que la función sigue siendo válida TypeScript/Deno**

Run: `npx tsc --noEmit` (el proyecto incluye `supabase/functions` en su chequeo; si no lo incluye, verifica visualmente que los tipos de `cfgResuelto` calzan con la firma de `decidirAccionCaja`/`decidirAccionCaja`'s local `type Accion` en el archivo).
Expected: sin errores.

- [ ] **Step 3: Redesplegar la función**

Run: `npx supabase functions deploy caja-scheduler`
Expected: despliegue exitoso (nueva versión).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/caja-scheduler/index.ts
git commit -m "$(cat <<'EOF'
feat(caja): caja-scheduler resuelve el horario del día desde horario_semanal

Antes usaba hora_apertura/hora_cierre planas (mismo horario todos los
días); ahora resuelve el horario del día de la semana actual antes de
decidir abrir/cerrar.
EOF
)"
```

---

### Task 10: `lib/caja.ts` — cierre con parámetros nulos + `obtenerModoCierre`

**Files:**
- Modify: `lib/caja.ts`

**Interfaces:**
- Produces: `cerrarCaja(params: { efectivo_contado: number | null; diferencia: number | null; nota: string | null })` (firma ampliada — antes solo `number`/`string | null`), `cerrarCajaSinDiferencia(): Promise<CierreCajaRow>`, `obtenerModoCierre(): Promise<'con_diferencia' | 'sin_diferencia'>`.
- Consumes: `obtenerCajaHoy()`, `obtenerResumenEnVivo()` (ya existentes en este archivo).

- [ ] **Step 1: Ampliar la firma de `cerrarCaja`**

Busca:

```ts
export async function cerrarCaja(params: { efectivo_contado: number, diferencia: number, nota: string | null }) {
```

Reemplázalo por:

```ts
export async function cerrarCaja(params: { efectivo_contado: number | null, diferencia: number | null, nota: string | null }) {
```

(El resto del cuerpo de la función no cambia — ya asigna `params.efectivo_contado`/`params.diferencia`/`params.nota` directamente a las columnas, y esas columnas ya son nullable en `cierres_caja`.)

- [ ] **Step 2: Agregar `cerrarCajaSinDiferencia` y `obtenerModoCierre`**

Al final del archivo:

```ts

export async function cerrarCajaSinDiferencia() {
  return cerrarCaja({ efectivo_contado: null, diferencia: null, nota: null })
}

export async function obtenerModoCierre(): Promise<'con_diferencia' | 'sin_diferencia'> {
  const { data, error } = await supabase.from('caja_config').select('modo_cierre').limit(1).single()
  if (error) throw error
  return (data?.modo_cierre ?? 'con_diferencia') as 'con_diferencia' | 'sin_diferencia'
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos en `lib/caja.ts` (el llamador existente en `app/(app)/caja/cierre.tsx:89-93` sigue pasando `number`, compatible con `number | null`).

- [ ] **Step 4: Commit**

```bash
git add lib/caja.ts
git commit -m "$(cat <<'EOF'
feat(caja): cerrarCajaSinDiferencia + obtenerModoCierre

cerrarCaja ahora acepta efectivo_contado/diferencia nulos para el
cierre automático "sin diferencia" (mismo cálculo que ya usa el
cierre blando del scheduler, disparable ahora también manualmente).
EOF
)"
```

---

### Task 11: `caja/config.tsx` — horario por día + selector de modo de cierre

**Files:**
- Modify: `app/(app)/caja/config.tsx` (reescritura completa del cuerpo del componente)

**Interfaces:**
- Consumes: `DIAS_SEMANA`, `DiaSemana`, `HorarioSemanal`, `HorarioDia` de `../../../lib/cajaScheduler`; tabla `caja_config` (columnas `modo_automatico`, `horario_semanal`, `modo_cierre`).

- [ ] **Step 1: Reescribir el archivo completo**

```tsx
import { useEffect, useState } from 'react'
import { View, Text, Switch, ActivityIndicator, ScrollView } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { ArrowLeft, History } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { supabase } from '../../../lib/supabase'
import { DIAS_SEMANA, type DiaSemana, type HorarioSemanal } from '../../../lib/cajaScheduler'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, tipografia } from '../../../lib/theme'
import { Boton, CampoTexto, ControlSegmentado, FilaLista, Presionable, Tarjeta, useToast } from '../../../components/ui'

const ETIQUETA_DIA: Record<DiaSemana, string> = {
  domingo: 'Domingo', lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado',
}

type ModoCierre = 'con_diferencia' | 'sin_diferencia'

// Encabezado a nivel de módulo: no se remonta en cada render (Regla 2).
function Encabezado({ paleta, onVolver }: { paleta: Paleta; onVolver: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        paddingHorizontal: espacio.xl,
        paddingTop: 56,
        paddingBottom: espacio.m,
      }}
    >
      <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={onVolver} hitSlop={12}>
        <ArrowLeft size={24} color={paleta.texto} />
      </Presionable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Caja</Text>
    </View>
  )
}

const validHora = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

export default function CajaConfig() {
  const { perfil } = useAuth()
  const router = useRouter()
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [auto, setAuto] = useState(false)
  const [horario, setHorario] = useState<HorarioSemanal>({})
  const [modoCierre, setModoCierre] = useState<ModoCierre>('con_diferencia')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('caja_config').select('*').limit(1).single()
      if (data) {
        setAuto(data.modo_automatico)
        setHorario((data.horario_semanal ?? {}) as HorarioSemanal)
        setModoCierre((data.modo_cierre ?? 'con_diferencia') as ModoCierre)
      }
      setCargando(false)
    }
    if (perfil?.rol === 'dueno') load()
  }, [perfil])

  if (perfil?.rol !== 'dueno') return <Redirect href="/" />

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado paleta={paleta} onVolver={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      </View>
    )
  }

  function actualizarDia(dia: DiaSemana, campo: 'apertura' | 'cierre', valor: string) {
    setHorario((prev) => ({ ...prev, [dia]: { ...(prev[dia] ?? { apertura: '', cierre: '' }), [campo]: valor } }))
  }

  async function guardar() {
    if (auto) {
      for (const dia of DIAS_SEMANA) {
        const h = horario[dia]
        if (!h?.apertura || !h?.cierre) continue // día sin horario = la tienda no automatiza ese día
        if (!validHora(h.apertura) || !validHora(h.cierre)) {
          mostrar(`Usa el formato HH:MM para ${ETIQUETA_DIA[dia]} (ej. 06:00 y 23:00).`, 'error')
          return
        }
        if (h.cierre <= h.apertura) {
          mostrar(`En ${ETIQUETA_DIA[dia]}, la hora de cierre debe ser posterior a la de apertura.`, 'error')
          return
        }
      }
    }
    setGuardando(true)
    const { error } = await supabase.from('caja_config').update({
      modo_automatico: auto,
      horario_semanal: horario,
      modo_cierre: modoCierre,
    }).not('id', 'is', null)
    setGuardando(false)
    if (error) { mostrar(error.message, 'error'); return }
    mostrar('La configuración de caja se actualizó.')
    router.back()
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: espacio.xxxl, gap: espacio.l }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[tipografia.h3, { color: paleta.texto }]}>Horario automático</Text>

        <Tarjeta>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>Modo automático</Text>
            <Switch
              value={auto}
              onValueChange={setAuto}
              trackColor={{ false: paleta.borde, true: paleta.primarioSoft }}
              thumbColor={auto ? paleta.primario : paleta.superficie}
            />
          </View>
        </Tarjeta>

        {auto && (
          <>
            <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
              El cierre automático calcula los totales del sistema y envía el reporte por correo. No cuenta el efectivo físico.
              Deja un día sin horario si esa tienda no abre ese día.
            </Text>
            {DIAS_SEMANA.filter((d) => d !== 'domingo').concat('domingo').map((dia) => (
              <Tarjeta key={dia}>
                <Text style={[tipografia.etiqueta, { color: paleta.texto, marginBottom: espacio.s }]}>
                  {ETIQUETA_DIA[dia]}
                </Text>
                <View style={{ flexDirection: 'row', gap: espacio.m }}>
                  <View style={{ flex: 1 }}>
                    <CampoTexto
                      etiqueta="Apertura"
                      placeholder="06:00"
                      value={horario[dia]?.apertura ?? ''}
                      onChangeText={(v) => actualizarDia(dia, 'apertura', v)}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <CampoTexto
                      etiqueta="Cierre"
                      placeholder="23:00"
                      value={horario[dia]?.cierre ?? ''}
                      onChangeText={(v) => actualizarDia(dia, 'cierre', v)}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
              </Tarjeta>
            ))}
          </>
        )}

        <Text style={[tipografia.h3, { color: paleta.texto, marginTop: espacio.m }]}>Modo de cierre</Text>
        <ControlSegmentado
          opciones={['Con diferencia', 'Sin diferencia']}
          indice={modoCierre === 'sin_diferencia' ? 1 : 0}
          onCambio={(i) => setModoCierre(i === 1 ? 'sin_diferencia' : 'con_diferencia')}
        />
        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
          {modoCierre === 'sin_diferencia'
            ? 'Al cerrar caja desde el menú solo se confirma; el sistema calcula el efectivo esperado, sin contar caja.'
            : 'Al cerrar caja desde el menú se pide el efectivo contado y, si hay diferencia, una justificación.'}
        </Text>

        <Tarjeta estilo={{ paddingVertical: espacio.xs, marginTop: espacio.m }}>
          <FilaLista
            icono={<History size={20} color={paleta.primario} />}
            titulo="Historial de cierres"
            subtitulo="Ver cierres anteriores"
            chevron
            onPress={() => router.push('/caja/historial')}
          />
        </Tarjeta>

        <Boton titulo="Guardar" onPress={guardar} cargando={guardando} deshabilitado={guardando} />
      </ScrollView>
    </View>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/caja/config.tsx"
git commit -m "$(cat <<'EOF'
feat(caja): config.tsx — horario por día de la semana + modo de cierre

Reemplaza los 2 campos de hora únicos por un horario configurable por
día, agrega el selector Con/Sin diferencia, y mueve el acceso al
historial de cierres a esta pantalla (título "Caja").
EOF
)"
```

---

### Task 12: `caja/index.tsx` — quitar el dashboard cuando la caja está abierta

**Files:**
- Modify: `app/(app)/caja/index.tsx` (reescritura completa del componente)

**Interfaces:**
- No cambia el comportamiento cuando no hay caja de hoy o cuando ya está cerrada (reabrir) — solo el caso "abierta" pasa de mostrar un dashboard a redirigir a `/caja/cierre`.

- [ ] **Step 1: Reescribir el archivo completo**

```tsx
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { View, Text, ActivityIndicator, ScrollView, RefreshControl } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useRequireModulo } from '../../../lib/auth'
import { obtenerCajaHoy, abrirCaja, reabrirCaja } from '../../../lib/caja'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, tipografia } from '../../../lib/theme'
import { Badge, Boton, Presionable, TarjetaMetrica } from '../../../components/ui'

const pesos = (n: number) => '$' + n.toLocaleString('es-CO')

// Encabezado a nivel de módulo: no se remonta en cada render (Regla 2).
function Encabezado({ paleta, onVolver, derecha }: { paleta: Paleta; onVolver: () => void; derecha?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        paddingHorizontal: espacio.xl,
        paddingTop: 56,
        paddingBottom: espacio.m,
      }}
    >
      <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={onVolver} hitSlop={12}>
        <ArrowLeft size={24} color={paleta.texto} />
      </Presionable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Caja del Día</Text>
      {derecha}
    </View>
  )
}

export default function CajaDashboard() {
  const redir = useRequireModulo('caja')
  const router = useRouter()
  const { paleta } = useTema()
  const paddingInferior = usePaddingInferior(espacio.xxxl)

  const [estadoCaja, setEstadoCaja] = useState<any>(null)
  const [resumen, setResumen] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [abriendo, setAbriendo] = useState(false)

  const cargarDatos = useCallback(async () => {
    try {
      const caja = await obtenerCajaHoy()
      setEstadoCaja(caja)
      if (caja && caja.estado === 'cerrada') {
        setResumen({
          total_general: caja.total_general,
          total_ventas: caja.total_ventas,
          total_efectivo: caja.total_efectivo,
          total_nequi: caja.total_nequi,
          total_bre_b: caja.total_bre_b,
          total_otro: caja.total_otro,
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  if (redir) return redir

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado paleta={paleta} onVolver={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      </View>
    )
  }

  // Ya no hay dashboard para la caja abierta: el ícono de Caja en el menú
  // navega directo a /caja/cierre o muestra el modal de confirmación
  // "sin diferencia" — si de todas formas se llega aquí con la caja
  // abierta (deep link, back del navegador), se redirige al cierre.
  if (estadoCaja?.estado === 'abierta') {
    return <Redirect href="/caja/cierre" />
  }

  async function handleAbrir() {
    setAbriendo(true)
    try {
      await abrirCaja()
      await cargarDatos()
    } catch (e) {
      console.error(e)
    } finally {
      setAbriendo(false)
    }
  }

  async function handleReabrir() {
    setAbriendo(true)
    try {
      await reabrirCaja()
      await cargarDatos()
    } catch (e) {
      console.error(e)
    } finally {
      setAbriendo(false)
    }
  }

  if (!estadoCaja) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado paleta={paleta} onVolver={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: espacio.xl, gap: espacio.xl }}>
          <Text style={[tipografia.h1, { color: paleta.texto, textAlign: 'center' }]}>Caja del Día</Text>
          <Text style={[tipografia.cuerpo, { color: paleta.texto2, textAlign: 'center' }]}>
            Aún no se ha abierto la caja para hoy.
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <Boton titulo="Abrir Caja del Día" onPress={handleAbrir} cargando={abriendo} deshabilitado={abriendo} />
          </View>
        </View>
      </View>
    )
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos()
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={paleta.primario} />}
      >
        <View style={{ alignItems: 'center', gap: espacio.m }}>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Resumen Final de Caja</Text>
          <Badge texto="CERRADA" tipo="peligro" />
        </View>

        {resumen && (
          <View style={{ gap: espacio.m }}>
            <TarjetaMetrica
              etiqueta="Total General"
              valor={pesos(resumen.total_general)}
              sub={`${resumen.total_ventas} ventas en total`}
            />
            <View style={{ flexDirection: 'row', gap: espacio.m, flexWrap: 'wrap' }}>
              <TarjetaMetrica mini etiqueta="Efectivo" valor={pesos(resumen.total_efectivo)} />
              <TarjetaMetrica mini etiqueta="Nequi" valor={pesos(resumen.total_nequi)} />
              <TarjetaMetrica mini etiqueta="Bre-B" valor={pesos(resumen.total_bre_b)} />
              <TarjetaMetrica mini etiqueta="Otro" valor={pesos(resumen.total_otro)} />
            </View>
          </View>
        )}

        <Boton titulo="Abrir caja de nuevo" onPress={handleReabrir} cargando={abriendo} deshabilitado={abriendo} />
      </ScrollView>
    </View>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/caja/index.tsx"
git commit -m "$(cat <<'EOF'
fix(caja): quita el dashboard duplicado cuando la caja está abierta

El menú principal ya muestra el total y el desglose por método; este
dashboard los repetía y además exponía config/historial redundantes
(ya movidos a Perfil → Caja). Si se llega aquí con la caja abierta, se
redirige a /caja/cierre.
EOF
)"
```

---

### Task 13: Menú principal — comportamiento del ícono "Caja"

**Files:**
- Modify: `app/(app)/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `obtenerModoCierre()`, `cerrarCajaSinDiferencia()` de `../../../lib/caja` (Task 10).

- [ ] **Step 1: Ampliar los imports**

Busca:

```tsx
import { obtenerCajaHoy } from '../../../lib/caja'
```

Reemplázalo por:

```tsx
import { cerrarCajaSinDiferencia, obtenerCajaHoy, obtenerModoCierre } from '../../../lib/caja'
```

Y en el import de `react-native` (línea 2), agrega `Alert`:

```tsx
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
```

- [ ] **Step 2: Agregar el estado de `modoCierre` y ampliar `cargarCaja`**

Busca:

```tsx
  const [estadoCaja, setEstadoCaja] = useState<EstadoCaja>('cargando')
```

Agrega justo debajo:

```tsx
  const [modoCierre, setModoCierre] = useState<'con_diferencia' | 'sin_diferencia'>('con_diferencia')
```

Busca:

```tsx
  const cargarCaja = useCallback(() => {
    obtenerCajaHoy()
      .then((caja) => {
        if (!caja) setEstadoCaja('sin-abrir')
        else setEstadoCaja(caja.estado === 'abierta' ? 'abierta' : 'cerrada')
      })
      .catch(() => setEstadoCaja('sin-abrir'))
  }, [])
```

Reemplázalo por:

```tsx
  const cargarCaja = useCallback(() => {
    obtenerCajaHoy()
      .then((caja) => {
        if (!caja) setEstadoCaja('sin-abrir')
        else setEstadoCaja(caja.estado === 'abierta' ? 'abierta' : 'cerrada')
      })
      .catch(() => setEstadoCaja('sin-abrir'))
    obtenerModoCierre()
      .then(setModoCierre)
      .catch(() => setModoCierre('con_diferencia'))
  }, [])
```

- [ ] **Step 3: Agregar el manejador y cambiar el `onPress` del badge**

Dentro de `Menu()`, después de la definición de `refrescar` (antes del `return`), agrega:

```tsx
  const onPressCaja = () => {
    if (estadoCaja !== 'abierta') {
      router.push('/caja')
      return
    }
    if (modoCierre === 'sin_diferencia') {
      Alert.alert('Cerrar caja', '¿Seguro que quieres cerrar la caja?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar caja',
          style: 'destructive',
          onPress: () => {
            cerrarCajaSinDiferencia()
              .then(() => {
                mostrar('Caja cerrada')
                cargarCaja()
              })
              .catch((e: any) => mostrar(e.message, 'error'))
          },
        },
      ])
      return
    }
    router.push('/caja/cierre')
  }
```

Busca:

```tsx
          <Pressable accessibilityRole="button" accessibilityLabel="Estado de caja" hitSlop={8} onPress={() => router.push('/caja')}>
```

Reemplázalo por:

```tsx
          <Pressable accessibilityRole="button" accessibilityLabel="Estado de caja" hitSlop={8} onPress={onPressCaja}>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/(tabs)/index.tsx"
git commit -m "$(cat <<'EOF'
feat(caja): el ícono de Caja en el menú cierra según el modo configurado

Con caja abierta: modo "con diferencia" navega directo a /caja/cierre;
modo "sin diferencia" muestra un confirm simple y cierra automático
(cerrarCajaSinDiferencia). Con caja cerrada, sin cambios.
EOF
)"
```

---

### Task 14: Perfil — renombrar a "Caja"

**Files:**
- Modify: `app/(app)/(tabs)/perfil.tsx`

**Interfaces:** Ninguna — cambio de texto/subtítulo.

- [ ] **Step 1: Renombrar la fila**

Busca:

```tsx
              <FilaLista
                icono={
                  <CirculoIcono tono="exito">
                    <Wallet />
                  </CirculoIcono>
                }
                titulo="Automatización de caja"
                subtitulo="Apertura, cierre y correo"
                chevron
                onPress={() => router.push('/caja/config')}
              />
```

Reemplázalo por:

```tsx
              <FilaLista
                icono={
                  <CirculoIcono tono="exito">
                    <Wallet />
                  </CirculoIcono>
                }
                titulo="Caja"
                subtitulo="Horario, modo de cierre e historial"
                chevron
                onPress={() => router.push('/caja/config')}
              />
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/(tabs)/perfil.tsx"
git commit -m "$(cat <<'EOF'
fix(ui): renombra "Automatización de caja" a "Caja" en Perfil

Ahora la pantalla agrupa horario, modo de cierre e historial, no solo
la automatización.
EOF
)"
```

---

## Fase C — Reorganización del Perfil

### Task 15: Menú principal — quitar la lista de accesos (Proveedores/Reportes/Balance/Análisis IA)

**Files:**
- Modify: `app/(app)/(tabs)/index.tsx`

**Interfaces:** Ninguna — el destino de esta lista es Perfil (Task 16).

- [ ] **Step 1: Quitar la constante `ACCESOS` y su uso**

Busca y elimina por completo:

```tsx
const ACCESOS: { id: string; titulo: string; sub: string; ruta?: string; Icono: LucideIcon; tono: TonoIcono }[] = [
  { id: 'proveedores', titulo: 'Proveedores', sub: 'Datos, cuentas y deudas', ruta: '/proveedores', Icono: Truck, tono: 'primario' },
  { id: 'reportes', titulo: 'Reportes', sub: 'El negocio a fondo', ruta: '/reportes', Icono: ChartColumn, tono: 'primario' },
  { id: 'balance', titulo: 'Balance', sub: 'Ingresos − egresos', ruta: '/balance', Icono: Scale, tono: 'primario' },
  { id: 'analisis-ia', titulo: 'Análisis IA', sub: 'Recomendaciones de compra', Icono: Sparkles, tono: 'acento' },
]
```

Busca y elimina:

```tsx
  const accesos = ACCESOS.filter((a) => puedeAcceder(perfil.rol, a.id))
```

Busca y elimina el bloque de render:

```tsx
        {accesos.length > 0 ? (
          <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
            {accesos.map((a, i) => (
              <View key={a.id}>
                {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} /> : null}
                <FilaLista
                  icono={
                    <CirculoIcono tono={a.tono}>
                      <a.Icono />
                    </CirculoIcono>
                  }
                  titulo={a.titulo}
                  subtitulo={a.sub}
                  chevron
                  onPress={() => (a.ruta ? router.push(a.ruta) : mostrar('Análisis IA estará disponible pronto', 'info'))}
                />
              </View>
            ))}
          </Tarjeta>
        ) : null}
```

(El `</ScrollView>` que quedaba justo después de este bloque pasa a cerrar el `<>...</>` anterior directamente — verifica que el JSX quede balanceado.)

- [ ] **Step 2: Quitar los imports que quedan sin uso**

En el import de `lucide-react-native`, quita `ChartColumn`, `Scale`, `Sparkles`, `Truck` si ya no se usan en el resto del archivo (siguen usándose `Banknote`, `CreditCard`, `Smartphone`, `Zap` para los métodos de pago). Deja:

```tsx
import {
  Banknote,
  CreditCard,
  Smartphone,
  Zap,
} from 'lucide-react-native'
```

Quita también el import de `puedeAcceder` de `../../../lib/permisos` si ya no se usa en ningún otro lugar del archivo, y el tipo `TonoIcono`/`CirculoIcono`/`FilaLista` de los imports de `components/ui` si ya no se usan (verifica con `grep -n "CirculoIcono\|FilaLista\|TonoIcono\|puedeAcceder" "app/(app)/(tabs)/index.tsx"` antes de quitarlos — el resto del archivo no los usa en otro lado, pero confírmalo).

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores (ni imports sin usar marcados por ESLint si el proyecto lo corre en el mismo check).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/(tabs)/index.tsx"
git commit -m "$(cat <<'EOF'
refactor(ui): quita Proveedores/Reportes/Balance/Análisis IA del menú

Se mueven a Perfil → sección "Negocio" (siguiente commit) para dejar
el menú principal enfocado en el resumen del día.
EOF
)"
```

---

### Task 16: Perfil — nueva sección "Negocio"

**Files:**
- Modify: `app/(app)/(tabs)/perfil.tsx`

**Interfaces:**
- Consumes: `puedeAcceder(rol, id)` de `../../../lib/permisos` (ids `'proveedores'`, `'reportes'`, `'balance'`, `'analisis-ia'`, ya definidos en `lib/permisos.ts`).

- [ ] **Step 1: Ampliar los imports**

Busca:

```tsx
import React from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { LogOut, SunMoon, Users, Wallet } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import type { Rol } from '../../../lib/permisos'
```

Reemplázalo por:

```tsx
import React from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChartColumn, LogOut, Scale, Sparkles, SunMoon, Truck, Users, Wallet } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { puedeAcceder, type Rol } from '../../../lib/permisos'
```

- [ ] **Step 2: Agregar la lista de accesos de negocio**

Debajo de `const MODOS: ModoTema[] = ['claro', 'oscuro', 'sistema']`, agrega:

```tsx
const NEGOCIO = [
  { id: 'proveedores', titulo: 'Proveedores', sub: 'Datos, cuentas y deudas', ruta: '/proveedores', Icono: Truck },
  { id: 'reportes', titulo: 'Reportes', sub: 'El negocio a fondo', ruta: '/reportes', Icono: ChartColumn },
  { id: 'balance', titulo: 'Balance', sub: 'Ingresos − egresos', ruta: '/balance', Icono: Scale },
  { id: 'analisis-ia', titulo: 'Análisis IA', sub: 'Recomendaciones de compra', ruta: undefined, Icono: Sparkles },
] as const
```

- [ ] **Step 3: Renderizar la sección**

Dentro de `Perfil()`, agrega junto a `const esDueno = perfil.rol === 'dueno'`:

```tsx
  const accesosNegocio = NEGOCIO.filter((a) => puedeAcceder(perfil.rol as Rol, a.id))
```

Busca el bloque de la sección "Caja y equipo" (el `{esDueno ? (<>...</>) : null}`) y agrega la nueva sección justo después de cerrarlo, antes de la `Tarjeta` de "Cerrar sesión":

```tsx
        {accesosNegocio.length > 0 ? (
          <>
            <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Negocio</Text>
            <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
              {accesosNegocio.map((a, i) => (
                <View key={a.id}>
                  {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} /> : null}
                  <FilaLista
                    icono={
                      <CirculoIcono tono="primario">
                        <a.Icono />
                      </CirculoIcono>
                    }
                    titulo={a.titulo}
                    subtitulo={a.sub}
                    chevron
                    onPress={() => (a.ruta ? router.push(a.ruta) : undefined)}
                  />
                </View>
              ))}
            </Tarjeta>
          </>
        ) : null}
```

(Análisis IA no tiene ruta implementada aún — igual que en el menú anterior, `onPress` no navega; si se quiere el mismo toast informativo de antes, agrega `useToast` a los imports de `components/ui` y usa `mostrar('Análisis IA estará disponible pronto', 'info')` en vez de `undefined`.)

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/(tabs)/perfil.tsx"
git commit -m "$(cat <<'EOF'
feat(ui): Perfil gana la sección "Negocio" (Proveedores/Reportes/Balance/Análisis IA)

Filtrada por permisos igual que antes en el menú: Sandra ve Proveedores
y Reportes; Balance y Análisis IA solo Andrés.
EOF
)"
```

---

## Fase D — Alertas de Gastos Fijos

### Task 17: `lib/gastos.ts` — gastos fijos próximos a vencer

**Files:**
- Modify: `lib/gastos.ts`
- Create: `lib/gastos.test.ts`

**Interfaces:**
- Produces: `interface GastoFijoPorVencer { id: string; nombre: string; monto_aproximado: number; dia_pago: number; dias_restantes: number }`, `obtenerGastosFijosPorVencer(): Promise<GastoFijoPorVencer[]>`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// lib/gastos.test.ts
const mockSelect = jest.fn()
jest.mock('./supabase', () => ({
  supabase: { from: jest.fn(() => ({ select: mockSelect })) },
}))

import { obtenerGastosFijosPorVencer } from './gastos'

function encadenar(data: unknown) {
  const builder: any = {
    eq: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    then: (resolve: (v: unknown) => void) => resolve({ data, error: null }),
  }
  return builder
}

describe('obtenerGastosFijosPorVencer', () => {
  const HOY = new Date().getDate()

  it('incluye gastos sin pago registrado con dia_pago dentro de los próximos 3 días', () => {
    const diaCercano = ((HOY + 2 - 1) % 31) + 1
    mockSelect.mockReturnValue(
      encadenar([
        { id: '1', nombre: 'Arriendo', monto_aproximado: 500000, dia_pago: diaCercano, gastos_fijos_pagos: [] },
      ])
    )
    return obtenerGastosFijosPorVencer().then((r) => {
      expect(r).toHaveLength(1)
      expect(r[0].nombre).toBe('Arriendo')
    })
  })

  it('excluye los que ya tienen un pago registrado este período', () => {
    mockSelect.mockReturnValue(
      encadenar([
        { id: '2', nombre: 'Internet', monto_aproximado: 100000, dia_pago: HOY, gastos_fijos_pagos: [{ id: 'p1' }] },
      ])
    )
    return obtenerGastosFijosPorVencer().then((r) => {
      expect(r).toHaveLength(0)
    })
  })

  it('excluye los que vencen en más de 3 días', () => {
    const diaLejano = ((HOY + 10 - 1) % 31) + 1
    mockSelect.mockReturnValue(
      encadenar([
        { id: '3', nombre: 'Seguro', monto_aproximado: 200000, dia_pago: diaLejano, gastos_fijos_pagos: [] },
      ])
    )
    return obtenerGastosFijosPorVencer().then((r) => {
      expect(r).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npm test -- gastos`
Expected: FAIL — `obtenerGastosFijosPorVencer` no está definida.

- [ ] **Step 3: Implementar**

Agrega al final de `lib/gastos.ts`:

```ts
export interface GastoFijoPorVencer {
  id: string
  nombre: string
  monto_aproximado: number
  dia_pago: number
  dias_restantes: number
}

export async function obtenerGastosFijosPorVencer(): Promise<GastoFijoPorVencer[]> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('gastos_fijos')
    .select('*, gastos_fijos_pagos(*)')
    .eq('activo', true)
    .gte('gastos_fijos_pagos.fecha_pago', startOfMonth.toISOString())
    .lte('gastos_fijos_pagos.fecha_pago', endOfMonth.toISOString());

  if (error) throw error;

  const hoy = new Date().getDate();
  return ((data ?? []) as unknown as (GastoFijoRow & { gastos_fijos_pagos: GastoFijoPagoRow[] })[])
    .filter((g) => !g.gastos_fijos_pagos || g.gastos_fijos_pagos.length === 0)
    .map((g) => ({
      id: g.id,
      nombre: g.nombre,
      monto_aproximado: g.monto_aproximado,
      dia_pago: g.dia_pago ?? 1,
      dias_restantes: (g.dia_pago ?? 1) - hoy,
    }))
    .filter((g) => g.dias_restantes <= 3)
    .sort((a, b) => a.dias_restantes - b.dias_restantes);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npm test -- gastos`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/gastos.ts lib/gastos.test.ts
git commit -m "$(cat <<'EOF'
feat(gastos): obtenerGastosFijosPorVencer

Reutiliza el mismo patrón de join filtrado por período que ya usa
app/(app)/gastos/fijos.tsx; filtra los que vencen en ≤3 días y no
tienen pago registrado este mes.
EOF
)"
```

---

### Task 18: Menú principal — banner de gastos fijos por vencer

**Files:**
- Modify: `app/(app)/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `obtenerGastosFijosPorVencer(): Promise<GastoFijoPorVencer[]>` de `../../../lib/gastos`.

- [ ] **Step 1: Ampliar imports y agregar el estado**

Busca:

```tsx
import { puedeAcceder } from '../../../lib/permisos'
```

Reemplázalo por:

```tsx
import { obtenerGastosFijosPorVencer, type GastoFijoPorVencer } from '../../../lib/gastos'
import { puedeAcceder } from '../../../lib/permisos'
```

Dentro de `Menu()`, junto a los demás `useState`, agrega:

```tsx
  const [porVencer, setPorVencer] = useState<GastoFijoPorVencer[]>([])
```

- [ ] **Step 2: Cargar el banner solo si el rol tiene acceso a gastos fijos**

Busca `cargarDatos` y, dentro del bloque `if (esStaff) { ... }` (después de `setGastos(g)`), agrega:

```tsx
        if (puedeAcceder(perfil.rol, 'gastos-fijos')) {
          obtenerGastosFijosPorVencer().then(setPorVencer).catch(() => setPorVencer([]))
        }
```

- [ ] **Step 3: Renderizar el banner**

Justo antes del bloque `{accesos.length > 0 ? (...` — espera, ese bloque ya se quitó en el Task 15; agrégalo justo antes del `</ScrollView>` final (después de la tarjeta de "Gastos del período"):

```tsx
        {porVencer.length > 0 ? (
          <Tarjeta estilo={{ borderColor: paleta.advertencia, backgroundColor: paleta.advertenciaSoft }}>
            <Text style={[tipografia.etiqueta, { color: paleta.texto, marginBottom: espacio.s }]}>
              Gastos fijos por vencer
            </Text>
            {porVencer.map((g, i) => (
              <View key={g.id}>
                {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde, marginVertical: espacio.s }} /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[tipografia.cuerpo, { color: paleta.texto }]}>{g.nombre}</Text>
                    <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                      {formatear(g.monto_aproximado)} · {g.dias_restantes < 0 ? 'Atrasado' : g.dias_restantes === 0 ? 'Vence hoy' : `Vence en ${g.dias_restantes} días`}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Confirmar pago de ${g.nombre}`}
                    onPress={() => router.push(`/gastos/pagar?id=${g.id}&nombre=${encodeURIComponent(g.nombre)}&monto=${g.monto_aproximado}`)}
                    style={({ pressed }) => ({
                      paddingVertical: espacio.s,
                      paddingHorizontal: espacio.m,
                      borderRadius: radio.sm,
                      backgroundColor: pressed ? paleta.primarioSoft : paleta.superficie,
                      borderWidth: 1,
                      borderColor: paleta.primario,
                    })}
                  >
                    <Text style={[tipografia.etiqueta, { color: paleta.primario }]}>Confirmar pago</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </Tarjeta>
        ) : null}
```

(`paleta.advertencia`/`paleta.advertenciaSoft` ya existen en `lib/theme.ts:28-30,58-60,88-90` — no requiere tokens nuevos.)

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/(tabs)/index.tsx"
git commit -m "$(cat <<'EOF'
feat(gastos): banner de gastos fijos por vencer en el menú

Visible para quien tiene acceso a Gastos Fijos (dueño y administrativa).
Cada ítem tiene un botón "Confirmar pago" que abre el flujo existente
de registrar pago, pre-cargado con ese gasto.
EOF
)"
```

---

## Fase E — Balance: filtros de mes/año/rango

### Task 19: `lib/balance.ts` — extender `rangoPeriodo` con año y rango

**Files:**
- Modify: `lib/balance.ts`
- Modify: `lib/balance.test.ts`

**Interfaces:**
- Produces: `rangoPeriodo(tipo: 'semana' | 'mes' | 'anio' | 'rango', refDate: Date, rangoCustom?: { desde: string; hasta: string }): { desde: string; hasta: string }` (firma ampliada; los 2 casos existentes `'semana'`/`'mes'` con 2 argumentos no cambian de comportamiento).

- [ ] **Step 1: Escribir los tests que fallan**

Agrega al final de `lib/balance.test.ts`, dentro de `describe('rangoPeriodo', ...)`:

```ts
  it('año: primer y último día del año que contiene la fecha', () => {
    expect(rangoPeriodo('anio', new Date(2026, 5, 17))).toEqual({ desde: '2026-01-01', hasta: '2026-12-31' })
  })
  it('rango: usa el rango personalizado tal cual', () => {
    expect(rangoPeriodo('rango', new Date(2026, 5, 17), { desde: '2026-01-10', hasta: '2026-03-05' }))
      .toEqual({ desde: '2026-01-10', hasta: '2026-03-05' })
  })
  it('rango: lanza error si falta rangoCustom', () => {
    expect(() => rangoPeriodo('rango', new Date(2026, 5, 17))).toThrow()
  })
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npm test -- balance`
Expected: FAIL — el tipo de `tipo` no acepta `'anio'`/`'rango'` (error de TypeScript o de runtime).

- [ ] **Step 3: Implementar**

Reemplaza la función completa:

```ts
export function rangoPeriodo(
  tipo: 'semana' | 'mes' | 'anio' | 'rango',
  refDate: Date,
  rangoCustom?: { desde: string; hasta: string }
): { desde: string; hasta: string } {
  if (tipo === 'rango') {
    if (!rangoCustom) throw new Error('rangoPeriodo: se requiere rangoCustom para el tipo "rango".')
    return rangoCustom
  }
  if (tipo === 'mes') {
    const desde = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
    const hasta = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)
    return { desde: toISO(desde), hasta: toISO(hasta) }
  }
  if (tipo === 'anio') {
    const desde = new Date(refDate.getFullYear(), 0, 1)
    const hasta = new Date(refDate.getFullYear(), 11, 31)
    return { desde: toISO(desde), hasta: toISO(hasta) }
  }
  // semana: lunes (1) a domingo (0→7)
  const dow = refDate.getDay() === 0 ? 7 : refDate.getDay()
  const lunes = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - (dow - 1))
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6)
  return { desde: toISO(lunes), hasta: toISO(domingo) }
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npm test -- balance`
Expected: PASS (incluyendo los tests preexistentes de `'mes'`/`'semana'`, sin cambios de comportamiento).

- [ ] **Step 5: Commit**

```bash
git add lib/balance.ts lib/balance.test.ts
git commit -m "$(cat <<'EOF'
feat(balance): rangoPeriodo soporta año y rango personalizado

Semana y Mes no cambian de comportamiento; 'rango' exige un
rangoCustom explícito (lanza si falta).
EOF
)"
```

---

### Task 20: `balance/index.tsx` — pestañas Año y Rango

**Files:**
- Modify: `app/(app)/balance/index.tsx`

**Interfaces:**
- Consumes: `SelectorRango` de `../../../components/ui` (ya existe, usado igual que en el menú principal); `rangoPeriodo` ampliado (Task 19).

- [ ] **Step 1: Ampliar imports**

Busca:

```tsx
import { CirculoIcono, EstadoVacio, Presionable, Tarjeta, TarjetaMetrica } from '../../../components/ui'
```

Reemplázalo por:

```tsx
import { CirculoIcono, EstadoVacio, Presionable, SelectorRango, Tarjeta, TarjetaMetrica } from '../../../components/ui'
```

- [ ] **Step 2: Ampliar el tipo `Tipo` y `etiquetaPeriodo`**

Busca:

```tsx
type Tipo = 'semana' | 'mes'
```

Reemplázalo por:

```tsx
type Tipo = 'semana' | 'mes' | 'anio' | 'rango'
```

Busca:

```tsx
function etiquetaPeriodo(tipo: Tipo, refDate: Date): string {
  if (tipo === 'mes') {
    return `${NOMBRE_MES[refDate.getMonth()]} ${refDate.getFullYear()}`
  }
  const { desde, hasta } = rangoPeriodo('semana', refDate)
  return `${desde} → ${hasta}`
}
```

Reemplázalo por:

```tsx
function etiquetaPeriodo(tipo: Tipo, refDate: Date, rangoCustom: { desde: string; hasta: string } | null): string {
  if (tipo === 'mes') {
    return `${NOMBRE_MES[refDate.getMonth()]} ${refDate.getFullYear()}`
  }
  if (tipo === 'anio') {
    return String(refDate.getFullYear())
  }
  if (tipo === 'rango') {
    return rangoCustom ? `${rangoCustom.desde} → ${rangoCustom.hasta}` : 'Elige un rango'
  }
  const { desde, hasta } = rangoPeriodo('semana', refDate)
  return `${desde} → ${hasta}`
}
```

- [ ] **Step 3: Ampliar `SelectorTipo`**

Busca:

```tsx
  const opciones: { valor: Tipo; etiqueta: string; testID: string }[] = [
    { valor: 'semana', etiqueta: 'Semana', testID: 'btn-tipo-semana' },
    { valor: 'mes', etiqueta: 'Mes', testID: 'btn-tipo-mes' },
  ]
```

Reemplázalo por:

```tsx
  const opciones: { valor: Tipo; etiqueta: string; testID: string }[] = [
    { valor: 'semana', etiqueta: 'Semana', testID: 'btn-tipo-semana' },
    { valor: 'mes', etiqueta: 'Mes', testID: 'btn-tipo-mes' },
    { valor: 'anio', etiqueta: 'Año', testID: 'btn-tipo-anio' },
  ]
```

- [ ] **Step 4: Estado de rango personalizado + carga de datos**

Busca:

```tsx
  const [tipo, setTipo] = useState<Tipo>('mes')
  const [refDate, setRefDate] = useState<Date>(new Date())
```

Reemplázalo por:

```tsx
  const [tipo, setTipo] = useState<Tipo>('mes')
  const [refDate, setRefDate] = useState<Date>(new Date())
  const [rangoCustom, setRangoCustom] = useState<{ desde: string; hasta: string } | null>(null)
```

Busca:

```tsx
  const cargarDatos = useCallback(async (t: Tipo, ref: Date, isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    setError(null)
    try {
      const { desde, hasta } = rangoPeriodo(t, ref)
      const bal = await obtenerBalance(desde, hasta)
      setData(bal)
    } catch (err: unknown) {
      console.error('Error al cargar balance:', err)
      setError('No se pudo cargar el balance. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      // No disparar la petición si el rol no tiene acceso (el guard redirige abajo).
      if (!requireModulo) cargarDatos(tipo, refDate)
    }, [cargarDatos, requireModulo, tipo, refDate])
  )
```

Reemplázalo por:

```tsx
  const cargarDatos = useCallback(async (t: Tipo, ref: Date, custom: { desde: string; hasta: string } | null, isRefresh = false) => {
    if (t === 'rango' && !custom) return
    if (!isRefresh) setLoading(true)
    setError(null)
    try {
      const { desde, hasta } = rangoPeriodo(t, ref, custom ?? undefined)
      const bal = await obtenerBalance(desde, hasta)
      setData(bal)
    } catch (err: unknown) {
      console.error('Error al cargar balance:', err)
      setError('No se pudo cargar el balance. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      // No disparar la petición si el rol no tiene acceso (el guard redirige abajo).
      if (!requireModulo) cargarDatos(tipo, refDate, rangoCustom)
    }, [cargarDatos, requireModulo, tipo, refDate, rangoCustom])
  )
```

- [ ] **Step 5: `cambiarTipo`, `mover` y `onRefresh`**

Busca:

```tsx
  const cambiarTipo = (t: Tipo) => {
    if (t === tipo) return
    setTipo(t)
    setRefDate(new Date())
  }

  // Mueve refDate un mes o una semana atrás (-1) o adelante (+1)
  const mover = (dir: -1 | 1) => {
    setRefDate((prev) => {
      if (tipo === 'mes') {
        return new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
      }
      return new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + dir * 7)
    })
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos(tipo, refDate, true)
  }
```

Reemplázalo por:

```tsx
  const cambiarTipo = (t: Tipo) => {
    if (t === tipo) return
    setTipo(t)
    setRefDate(new Date())
  }

  // Mueve refDate un año, un mes o una semana atrás (-1) o adelante (+1). No aplica a 'rango'.
  const mover = (dir: -1 | 1) => {
    setRefDate((prev) => {
      if (tipo === 'anio') {
        return new Date(prev.getFullYear() + dir, prev.getMonth(), 1)
      }
      if (tipo === 'mes') {
        return new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
      }
      return new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + dir * 7)
    })
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos(tipo, refDate, rangoCustom, true)
  }
```

- [ ] **Step 6: `esMesEnCurso` y el uso de `etiquetaPeriodo`**

`esMesEnCurso(tipo, refDate)` ya retorna `false` para cualquier `tipo !== 'mes'`, así que no necesita cambios (sigue funcionando con `'anio'`/`'rango'`).

Busca:

```tsx
          <Text style={[tipografia.cuerpoLg, { color: paleta.texto, textTransform: 'capitalize' }]}>
            {etiquetaPeriodo(tipo, refDate)}
          </Text>
```

Reemplázalo por:

```tsx
          <Text style={[tipografia.cuerpoLg, { color: paleta.texto, textTransform: 'capitalize' }]}>
            {etiquetaPeriodo(tipo, refDate, rangoCustom)}
          </Text>
```

- [ ] **Step 7: Ocultar las flechas prev/next en modo Rango y agregar el chip de `SelectorRango`**

Busca:

```tsx
        <SelectorTipo tipo={tipo} onCambio={cambiarTipo} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: espacio.m }}>
          <Presionable
            testID="btn-nav-prev"
            accessibilityRole="button"
            accessibilityLabel="Período anterior"
            onPress={() => mover(-1)}
            hitSlop={12}
            style={{ padding: espacio.xs }}
          >
            <ChevronLeft size={22} color={paleta.texto2} />
          </Presionable>
          <Text style={[tipografia.cuerpoLg, { color: paleta.texto, textTransform: 'capitalize' }]}>
            {etiquetaPeriodo(tipo, refDate, rangoCustom)}
          </Text>
          <Presionable
            testID="btn-nav-next"
            accessibilityRole="button"
            accessibilityLabel="Período siguiente"
            onPress={() => mover(1)}
            hitSlop={12}
            style={{ padding: espacio.xs }}
          >
            <ChevronRight size={22} color={paleta.texto2} />
          </Presionable>
        </View>
```

Reemplázalo por:

```tsx
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
          <View style={{ flex: 1 }}>
            <SelectorTipo tipo={tipo} onCambio={cambiarTipo} />
          </View>
          <SelectorRango
            activo={tipo === 'rango'}
            onAplicar={(desde, hasta) => {
              setRangoCustom({ desde, hasta })
              setTipo('rango')
            }}
          />
        </View>

        {tipo === 'rango' ? (
          <Text style={[tipografia.cuerpoLg, { color: paleta.texto, textTransform: 'capitalize', marginTop: espacio.m, textAlign: 'center' }]}>
            {etiquetaPeriodo(tipo, refDate, rangoCustom)}
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: espacio.m }}>
            <Presionable
              testID="btn-nav-prev"
              accessibilityRole="button"
              accessibilityLabel="Período anterior"
              onPress={() => mover(-1)}
              hitSlop={12}
              style={{ padding: espacio.xs }}
            >
              <ChevronLeft size={22} color={paleta.texto2} />
            </Presionable>
            <Text style={[tipografia.cuerpoLg, { color: paleta.texto, textTransform: 'capitalize' }]}>
              {etiquetaPeriodo(tipo, refDate, rangoCustom)}
            </Text>
            <Presionable
              testID="btn-nav-next"
              accessibilityRole="button"
              accessibilityLabel="Período siguiente"
              onPress={() => mover(1)}
              hitSlop={12}
              style={{ padding: espacio.xs }}
            >
              <ChevronRight size={22} color={paleta.texto2} />
            </Presionable>
          </View>
        )}
```

- [ ] **Step 8: Reintentar con los argumentos correctos**

Busca:

```tsx
            textoAccion="Reintentar"
            onAccion={() => cargarDatos(tipo, refDate)}
```

Reemplázalo por:

```tsx
            textoAccion="Reintentar"
            onAccion={() => cargarDatos(tipo, refDate, rangoCustom)}
```

- [ ] **Step 9: Correr la suite de integración de Balance**

Run: `npm test -- balance_ui`
Expected: PASS — los 4 grupos de tests (`btn-tipo-semana`, `btn-nav-prev`, etc.) siguen encontrando los mismos `testID`.

- [ ] **Step 10: Verificar tipos y toda la suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS, sin regresiones.

- [ ] **Step 11: Commit**

```bash
git add "app/(app)/balance/index.tsx"
git commit -m "$(cat <<'EOF'
feat(balance): pestañas Año y Rango junto a Semana/Mes

Año navega por año calendario completo; Rango reutiliza el mismo
SelectorRango del menú principal (chip + modal de fecha inicio/fin) y
oculta las flechas prev/next mientras está activo.
EOF
)"
```

---

## Self-Review

**Cobertura del spec:**
- §4.1 login → Task 1. §4.2 grilla 2x2 → Task 2. §4.3 ocultar gráfico en Hoy → Task 3. §4.4 sombra del FAB → Task 4.
- §5.1 migración `horario_semanal`/`modo_cierre` → Task 7. §5.2 scheduler → Task 9 (con Task 8 de soporte). §5.3 función de cierre reutilizable → Task 10 (implementado como refactor de `cerrarCaja` + `cerrarCajaSinDiferencia`, en vez de una función SQL nueva — más simple, reutiliza la lógica cliente ya existente). §5.4 comportamiento del ícono → Task 13. §5.5 simplificar dashboard → Task 12.
- §6 Perfil: renombrar Caja + historial → Task 14/11. Sección Negocio → Tasks 15-16.
- §7 alertas de gastos fijos → Tasks 17-18.
- §8 filtros de Balance → Tasks 19-20.
- §9 safe-area → Tasks 5-6.

**Nota de desviación del spec:** el spec (§5.3) proponía una función RPC de Postgres `cerrar_caja_sin_diferencia()`; el plan la implementa en cambio como una función de `lib/caja.ts` (`cerrarCajaSinDiferencia`) que reutiliza `cerrarCaja` con parámetros nulos, ejecutándose con las credenciales del usuario autenticado (igual que el cierre manual con diferencia) en vez de requerir una función `security definer` nueva. Es funcionalmente equivalente, más simple, y consistente con cómo ya funciona `cerrarCaja` — no se necesita una función SQL adicional.

**Placeholders:** ninguno — todos los steps de código tienen contenido completo, no hay "TODO" ni "similar a".

**Consistencia de tipos:** `ModoCierre` (`'con_diferencia' | 'sin_diferencia'`) se usa igual en `lib/caja.ts` (Task 10, como literal de retorno), `caja/config.tsx` (Task 11, alias de tipo local) y `index.tsx` (Task 13, estado). `HorarioSemanal`/`DiaSemana`/`DIAS_SEMANA` se definen una sola vez en `lib/cajaScheduler.ts` (Task 8) y se consumen en Task 9 (edge function, replicado por restricción de runtime Deno) y Task 11 (UI). `GastoFijoPorVencer` se define en Task 17 y se consume igual en Task 18.
