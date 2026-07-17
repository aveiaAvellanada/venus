# Carrito/Productos + Ajustes Rápidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el spec `docs/superpowers/specs/2026-07-16-carrito-productos-ajustes-design.md`: 5 ajustes rápidos (Fase A) + el rediseño de Carrito/Productos donde Productos pasa a ser el hub principal de venta (Fase B).

**Architecture:** Todo sobre `feat/redesign-nueva-venta`. El carrito compartido (`lib/carrito-contexto.tsx` + `lib/carrito.ts`) no se toca en su forma reducer; se le agrega un componente de slider de precio reutilizado en dos lugares (línea del carrito y paso de compra rápida). Productos gana acciones de venta que hoy solo existían dentro de Nueva Venta.

**Tech Stack:** Expo Router, React Native, TypeScript estricto, Supabase, Jest + react-test-renderer, `@react-native-community/slider` (dependencia nueva).

## Global Constraints

- TypeScript estricto; toda la UI en español.
- Seguir los patrones de componentes existentes (`Tarjeta`, `Presionable`, `Boton`, `CampoTexto`, `Chip`, patrón de hoja modal de `SelectorRango`).
- No tocar RLS ni el modelo de permisos.
- Rama: `feat/redesign-nueva-venta`.
- Cada task termina con `tsc --noEmit` limpio y `npm test` verde antes de commitear.
- Este repo tiene commits concurrentes de otro proceso sobre `productos.tsx`, `excel.ts`, `ventas.ts`, `editor.tsx` de calzado y algunos tests — antes de cada task que toque esos archivos, releer el archivo actual (puede haber cambiado desde que se escribió este plan) y adaptar el `old_string` de los `Edit` si no calza exacto.

---

## Fase A — Ajustes rápidos

### Task 1: Productos — Recibir Mercancía al inicio, Carga Inicial se retira de aquí

**Files:**
- Modify: `app/(app)/(tabs)/productos.tsx`

**Interfaces:** Ninguna — reordenamiento de JSX y una fila menos.

- [ ] **Step 1: Mover la sección "Ingresar mercancía" y quitar la fila de Carga Inicial**

Busca (el bloque completo al final del `ScrollView`, después de la lista de Calzado/Granja):

```tsx
        <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Ingresar mercancía</Text>
        <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
          <FilaLista
            icono={
              <CirculoIcono tono="exito">
                <PackagePlus />
              </CirculoIcono>
            }
            titulo="Recibir mercancía"
            subtitulo="Entrada de mercancía nueva"
            chevron
            onPress={() => router.push('/recibir-mercancia')}
          />
          {puedeAcceder(perfil.rol, 'carga-inicial') ? (
            <>
              <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} />
              <FilaLista
                icono={
                  <CirculoIcono tono="primario">
                    <Camera />
                  </CirculoIcono>
                }
                titulo="Carga inicial"
                subtitulo="Plantilla Excel o cámara"
                chevron
                onPress={() => router.push('/inventario/carga')}
              />
            </>
          ) : null}
        </Tarjeta>
      </ScrollView>
```

Reemplázalo (quita el bloque de ahí, deja el `</ScrollView>` de cierre solo):

```tsx
      </ScrollView>
```

Y agrégalo, sin la fila de Carga Inicial, justo después del título "Productos" y antes del `ControlSegmentado`:

```tsx
        <Text style={[tipografia.h1, { color: paleta.texto }]}>Productos</Text>

        <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
          <FilaLista
            icono={
              <CirculoIcono tono="exito">
                <PackagePlus />
              </CirculoIcono>
            }
            titulo="Recibir mercancía"
            subtitulo="Entrada de mercancía nueva"
            chevron
            onPress={() => router.push('/recibir-mercancia')}
          />
        </Tarjeta>

        <ControlSegmentado
```

- [ ] **Step 2: Quitar imports que quedan sin uso**

Si `Camera` de `lucide-react-native` y `puedeAcceder` de `../../../lib/permisos` ya no se usan en el resto del archivo (verifica con `grep -n "Camera\|puedeAcceder" "app/(app)/(tabs)/productos.tsx"` antes de quitarlos — `Camera` puede seguir haciendo falta si Task 6 de Fase B aún no corrió y agrega el ícono de lápiz para Granja usando otro ícono; confirma antes de tocar el import).

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/(tabs)/productos.tsx"
git commit -m "$(cat <<'EOF'
fix(ui): Recibir Mercancía al inicio de Productos

Antes había que deslizar toda la lista de productos para llegar a
"Ingresar mercancía". Carga Inicial se retira de aquí (se mueve a
Perfil en el siguiente commit).
EOF
)"
```

---

### Task 2: Perfil — Carga Inicial en la sección Negocio

**Files:**
- Modify: `app/(app)/(tabs)/perfil.tsx`

**Interfaces:**
- Consumes: `puedeAcceder(rol, 'carga-inicial')` (ya existente en `lib/permisos.ts`).

- [ ] **Step 1: Agregar Carga Inicial a la lista `NEGOCIO`**

Busca (en `app/(app)/(tabs)/perfil.tsx`):

```tsx
const NEGOCIO = [
  { id: 'proveedores', titulo: 'Proveedores', sub: 'Datos, cuentas y deudas', ruta: '/proveedores', Icono: Truck },
  { id: 'reportes', titulo: 'Reportes', sub: 'El negocio a fondo', ruta: '/reportes', Icono: ChartColumn },
  { id: 'balance', titulo: 'Balance', sub: 'Ingresos − egresos', ruta: '/balance', Icono: Scale },
  { id: 'analisis-ia', titulo: 'Análisis IA', sub: 'Recomendaciones de compra', ruta: undefined, Icono: Sparkles },
] as const
```

Reemplázalo por (agrega Carga Inicial al final):

```tsx
const NEGOCIO = [
  { id: 'proveedores', titulo: 'Proveedores', sub: 'Datos, cuentas y deudas', ruta: '/proveedores', Icono: Truck },
  { id: 'reportes', titulo: 'Reportes', sub: 'El negocio a fondo', ruta: '/reportes', Icono: ChartColumn },
  { id: 'balance', titulo: 'Balance', sub: 'Ingresos − egresos', ruta: '/balance', Icono: Scale },
  { id: 'analisis-ia', titulo: 'Análisis IA', sub: 'Recomendaciones de compra', ruta: undefined, Icono: Sparkles },
  { id: 'carga-inicial', titulo: 'Carga inicial', sub: 'Plantilla Excel o cámara', ruta: '/inventario/carga', Icono: Camera },
] as const
```

- [ ] **Step 2: Agregar el import de `Camera`**

Busca:

```tsx
import { ChartColumn, LogOut, Scale, Sparkles, SunMoon, Truck, Users, Wallet } from 'lucide-react-native'
```

Reemplázalo por:

```tsx
import { Camera, ChartColumn, LogOut, Scale, Sparkles, SunMoon, Truck, Users, Wallet } from 'lucide-react-native'
```

- [ ] **Step 3: Verificar y correr los tests de Perfil**

Run: `npx tsc --noEmit && npm test -- tabs_perfil_ui`
Expected: sin errores; los tests existentes de la sección Negocio (dueño ve todo, admin ve un subconjunto, operativo no ve nada) siguen en verde — no hace falta un test nuevo porque `puedeAcceder(rol, 'carga-inicial')` ya sigue las mismas reglas STAFF_ADMIN evaluadas ahí.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/(tabs)/perfil.tsx"
git commit -m "$(cat <<'EOF'
feat(ui): Carga Inicial se mueve a Perfil → sección Negocio

Antes vivía al final de Productos, gated a dueño/admin. Ahora es una
fila más de la sección Negocio, igual que Proveedores/Reportes/Balance.
EOF
)"
```

---

### Task 3: Migración + `lib/gastos.ts` — foto en Gastos Fijos

**Files:**
- Create: `supabase/migrations/20260716235000_gastos_fijos_comprobante.sql`
- Modify: `lib/gastos.ts`
- Modify: `lib/database.types.ts` (regenerado)

**Interfaces:**
- Produces: columna `gastos_fijos.comprobante_url text` (nullable). `guardarGastoFijo(datos: GastoFijoInsert, imagenUri?: string): Promise<GastoFijoRow>` (firma ampliada — antes solo `datos`).

- [ ] **Step 1: Migración**

```sql
alter table public.gastos_fijos
  add column if not exists comprobante_url text;
```

- [ ] **Step 2: Aplicar y regenerar tipos**

Run: `npx supabase db push --linked` (si el historial de migraciones vuelve a estar desalineado por trabajo concurrente de otro proceso, repetir el mismo procedimiento de `supabase migration repair` usado en la sesión anterior antes de reintentar).
Run: `npx supabase gen types typescript --linked > lib/database.types.ts`
Expected: `gastos_fijos.Row`/`Insert`/`Update` en `lib/database.types.ts` incluyen `comprobante_url: string | null`.

- [ ] **Step 3: `guardarGastoFijo` acepta `imagenUri`**

Busca en `lib/gastos.ts`:

```ts
export async function guardarGastoFijo(datos: GastoFijoInsert): Promise<GastoFijoRow> {
  if (datos.id) {
    const { data, error } = await supabase
      .from('gastos_fijos')
      .update(datos)
      .eq('id', datos.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('gastos_fijos')
      .insert(datos)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
```

Reemplázalo por:

```ts
export async function guardarGastoFijo(
  datos: GastoFijoInsert,
  imagenUri?: string
): Promise<GastoFijoRow> {
  let comprobanteUrl: string | null = null;
  if (imagenUri) {
    comprobanteUrl = await comprimirYSubirComprobante(imagenUri);
  }
  const payload = comprobanteUrl ? { ...datos, comprobante_url: comprobanteUrl } : datos;

  if (datos.id) {
    const { data, error } = await supabase
      .from('gastos_fijos')
      .update(payload)
      .eq('id', datos.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('gastos_fijos')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: puede aparecer un error en `app/(app)/gastos/fijos-editor.tsx` si ya llama a `guardarGastoFijo` con una firma incompatible — se corrige en el Task 4. Si no hay ningún otro caller, sin errores.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260716235000_gastos_fijos_comprobante.sql lib/database.types.ts lib/gastos.ts
git commit -m "$(cat <<'EOF'
feat(gastos): comprobante_url en gastos_fijos + guardarGastoFijo acepta foto

Replica el mismo patrón que ya usa guardarGastoVariable (comprimir y
subir a Storage, guardar el path en comprobante_url).
EOF
)"
```

---

### Task 4: `gastos/fijos-editor.tsx` — UI para tomar/adjuntar foto

**Files:**
- Modify: `app/(app)/gastos/fijos-editor.tsx`

**Interfaces:**
- Consumes: `guardarGastoFijo(datos, imagenUri?)` (Task 3).

- [ ] **Step 1: Imports**

Busca:

```tsx
import React, { useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { guardarGastoFijo } from '../../../lib/gastos'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, tipografia } from '../../../lib/theme'
import { Boton, CampoTexto, Presionable, useToast } from '../../../components/ui'
```

Reemplázalo por:

```tsx
import React, { useState } from 'react'
import { View, Text, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { ArrowLeft, Camera } from 'lucide-react-native'
import { guardarGastoFijo } from '../../../lib/gastos'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, radio, tipografia } from '../../../lib/theme'
import { Boton, CampoTexto, Presionable, useToast } from '../../../components/ui'
```

- [ ] **Step 2: Estado `fotoUri` + `pickImage`**

Busca:

```tsx
  const [nombre, setNombre] = useState('')
  const [montoAproximado, setMontoAproximado] = useState('')
  const [diaPago, setDiaPago] = useState('')
  const [beneficiario, setBeneficiario] = useState('')
  const [notas, setNotas] = useState('')

  const [saving, setSaving] = useState(false)
```

Reemplázalo por:

```tsx
  const [nombre, setNombre] = useState('')
  const [montoAproximado, setMontoAproximado] = useState('')
  const [diaPago, setDiaPago] = useState('')
  const [beneficiario, setBeneficiario] = useState('')
  const [notas, setNotas] = useState('')
  const [fotoUri, setFotoUri] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    })
    if (!result.canceled) {
      setFotoUri(result.assets[0].uri)
    }
  }
```

- [ ] **Step 3: Pasar `fotoUri` a `guardarGastoFijo`**

Busca:

```tsx
      await guardarGastoFijo({
        nombre,
        monto_aproximado: parseFloat(montoAproximado),
        dia_pago: dia,
        beneficiario: beneficiario || null,
        notas: notas || null,
        activo: true,
      })
```

Reemplázalo por:

```tsx
      await guardarGastoFijo(
        {
          nombre,
          monto_aproximado: parseFloat(montoAproximado),
          dia_pago: dia,
          beneficiario: beneficiario || null,
          notas: notas || null,
          activo: true,
        },
        fotoUri || undefined
      )
```

- [ ] **Step 4: UI de foto (antes del botón Guardar)**

Busca:

```tsx
        <CampoTexto
          etiqueta="Notas adicionales (Opcional)"
          value={notas}
          onChangeText={setNotas}
          placeholder="Alguna nota sobre el pago"
          multiline
          numberOfLines={3}
        />

        <Boton titulo="Guardar Contrato" onPress={handleSave} cargando={saving} deshabilitado={saving} />
```

Reemplázalo por:

```tsx
        <CampoTexto
          etiqueta="Notas adicionales (Opcional)"
          value={notas}
          onChangeText={setNotas}
          placeholder="Alguna nota sobre el pago"
          multiline
          numberOfLines={3}
        />

        <View>
          <Text style={[tipografia.etiqueta, { color: paleta.texto2, marginBottom: espacio.s }]}>
            Foto del Contrato/Recibo (Opcional)
          </Text>
          <Presionable
            accessibilityRole="button"
            accessibilityLabel={fotoUri ? 'Cambiar foto del contrato' : 'Tomar foto del contrato'}
            onPress={pickImage}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: espacio.s,
              backgroundColor: paleta.primarioSoft,
              padding: espacio.l,
              borderRadius: radio.sm,
              borderWidth: 1,
              borderColor: paleta.primario,
              borderStyle: 'dashed',
            }}
          >
            <Camera size={22} color={paleta.primario} />
            <Text style={[tipografia.cuerpoLg, { color: paleta.primario }]}>
              {fotoUri ? 'Cambiar Foto' : 'Tomar Foto'}
            </Text>
          </Presionable>
          {fotoUri ? (
            <Image
              source={{ uri: fotoUri }}
              style={{ width: '100%', height: 200, borderRadius: radio.sm, marginTop: espacio.m }}
            />
          ) : null}
        </View>

        <Boton titulo="Guardar Contrato" onPress={handleSave} cargando={saving} deshabilitado={saving} />
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/gastos/fijos-editor.tsx"
git commit -m "$(cat <<'EOF'
feat(gastos): foto opcional al crear un gasto fijo

Mismo patrón de cámara/preview que ya usa Gastos Variables.
EOF
)"
```

---

### Task 5: Movimientos — "Registrar gasto" al inicio de la vista Gastos

**Files:**
- Modify: `app/(app)/(tabs)/movimientos.tsx`

**Interfaces:** Ninguna — reordenamiento de JSX dentro de la rama `vista === 2`.

- [ ] **Step 1: Mover el bloque de acciones rápidas antes del resumen**

Busca (dentro del `else` final, `vista === 2`):

```tsx
        ) : (
          <View style={{ gap: espacio.l }}>
            {esStaff && gastos ? (
              gastos.gastos.length === 0 ? (
                <EstadoVacio icono={<ReceiptText />} titulo="Sin gastos en este período" />
              ) : (
                <Tarjeta>
                  <View style={{ gap: espacio.s }}>
                    {gastos.gastos.map((g, i) => (
                      <View key={`${g.tipo}-${g.nombre}-${g.fecha}-${i}`}>
                        {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde }} /> : null}
                        <View
                          style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingVertical: 6 }}
                        >
                          <Text
                            style={[tipografia.etiqueta, { color: paleta.texto, flex: 1 }]}
                            numberOfLines={1}
                          >
                            {g.nombre}
                          </Text>
                          <Badge texto={g.tipo === 'fijo' ? 'FIJO' : 'VARIABLE'} tipo="neutro" />
                          <Text style={[tipografia.etiqueta, tabular, { color: paleta.texto }]}>
                            {formatear(g.monto)}
                          </Text>
                        </View>
                      </View>
                    ))}
                    <View style={{ height: 1, backgroundColor: paleta.borde }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>Total gastos</Text>
                      <Text style={[tipografia.cuerpoLg, tabular, { color: paleta.peligroTexto }]}>
                        {formatear(gastos.total)}
                      </Text>
                    </View>
                  </View>
                </Tarjeta>
              )
            ) : null}

            <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
              <FilaLista
                icono={
                  <CirculoIcono tono="peligro">
                    <ReceiptText />
                  </CirculoIcono>
                }
                titulo="Registrar gasto variable"
                subtitulo="Imprevistos por categoría"
                chevron
                onPress={() => router.push('/gastos')}
              />
              {puedeAcceder(perfil.rol, 'gastos-fijos') ? (
                <>
                  <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} />
                  <FilaLista
                    icono={
                      <CirculoIcono tono="primario">
                        <CalendarClock />
                      </CirculoIcono>
                    }
                    titulo="Gastos fijos"
                    subtitulo="Recurrentes y vencimientos"
                    chevron
                    onPress={() => router.push('/gastos/fijos')}
                  />
                </>
              ) : null}
            </Tarjeta>
          </View>
        )}
```

Reemplázalo por (mismo contenido, orden invertido de los dos bloques):

```tsx
        ) : (
          <View style={{ gap: espacio.l }}>
            <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
              <FilaLista
                icono={
                  <CirculoIcono tono="peligro">
                    <ReceiptText />
                  </CirculoIcono>
                }
                titulo="Registrar gasto variable"
                subtitulo="Imprevistos por categoría"
                chevron
                onPress={() => router.push('/gastos')}
              />
              {puedeAcceder(perfil.rol, 'gastos-fijos') ? (
                <>
                  <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} />
                  <FilaLista
                    icono={
                      <CirculoIcono tono="primario">
                        <CalendarClock />
                      </CirculoIcono>
                    }
                    titulo="Gastos fijos"
                    subtitulo="Recurrentes y vencimientos"
                    chevron
                    onPress={() => router.push('/gastos/fijos')}
                  />
                </>
              ) : null}
            </Tarjeta>

            {esStaff && gastos ? (
              gastos.gastos.length === 0 ? (
                <EstadoVacio icono={<ReceiptText />} titulo="Sin gastos en este período" />
              ) : (
                <Tarjeta>
                  <View style={{ gap: espacio.s }}>
                    {gastos.gastos.map((g, i) => (
                      <View key={`${g.tipo}-${g.nombre}-${g.fecha}-${i}`}>
                        {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde }} /> : null}
                        <View
                          style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingVertical: 6 }}
                        >
                          <Text
                            style={[tipografia.etiqueta, { color: paleta.texto, flex: 1 }]}
                            numberOfLines={1}
                          >
                            {g.nombre}
                          </Text>
                          <Badge texto={g.tipo === 'fijo' ? 'FIJO' : 'VARIABLE'} tipo="neutro" />
                          <Text style={[tipografia.etiqueta, tabular, { color: paleta.texto }]}>
                            {formatear(g.monto)}
                          </Text>
                        </View>
                      </View>
                    ))}
                    <View style={{ height: 1, backgroundColor: paleta.borde }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>Total gastos</Text>
                      <Text style={[tipografia.cuerpoLg, tabular, { color: paleta.peligroTexto }]}>
                        {formatear(gastos.total)}
                      </Text>
                    </View>
                  </View>
                </Tarjeta>
              )
            ) : null}
          </View>
        )}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/(tabs)/movimientos.tsx"
git commit -m "$(cat <<'EOF'
fix(ui): "Registrar gasto" al inicio de la vista Gastos en Movimientos

Antes había que deslizar pasando el resumen del período para llegar a
las acciones de registrar gasto variable/fijo.
EOF
)"
```

---

## Fase B — Carrito y Productos

### Task 6: Dependencia `@react-native-community/slider`

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar**

Run: `npx expo install @react-native-community/slider`
Expected: se agrega a `package.json` en una versión compatible con el SDK de Expo del proyecto.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: agrega @react-native-community/slider"
```

---

### Task 7: Componente `SliderPrecio`

**Files:**
- Create: `components/ui/SliderPrecio.tsx`
- Create: `components/ui/SliderPrecio.test.tsx`
- Modify: `components/ui/index.ts`

**Interfaces:**
- Produces: `SliderPrecio({ valor, minimo, maximo, onCambio, paso? }): JSX.Element` — `paso` default `1000`.

- [ ] **Step 1: Test que falla**

```tsx
// components/ui/SliderPrecio.test.tsx
import React from 'react'
// @ts-ignore
import renderer, { act } from 'react-test-renderer'
import Slider from '@react-native-community/slider'
import { TemaProvider } from '../../lib/tema'
import { SliderPrecio } from './SliderPrecio'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.useFakeTimers()

async function montar(props: { valor: number; minimo: number; maximo: number; onCambio: (v: number) => void }) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <SliderPrecio {...props} />
      </TemaProvider>
    )
  })
  return arbol
}

describe('SliderPrecio', () => {
  it('muestra el valor actual y los límites min/max formateados', async () => {
    const arbol = await montar({ valor: 180000, minimo: 150000, maximo: 220000, onCambio: jest.fn() })
    const textos = arbol.root.findAllByType(require('react-native').Text)
      .map((t: any) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children)))
    expect(textos.join(' ')).toContain('$180.000')
    expect(textos.join(' ')).toContain('$150.000')
    expect(textos.join(' ')).toContain('$220.000')
  })

  it('el Slider usa minimo/maximo/paso y dispara onCambio', async () => {
    const onCambio = jest.fn()
    const arbol = await montar({ valor: 180000, minimo: 150000, maximo: 220000, onCambio })
    const slider = arbol.root.findByType(Slider)
    expect(slider.props.minimumValue).toBe(150000)
    expect(slider.props.maximumValue).toBe(220000)
    expect(slider.props.step).toBe(1000)
    act(() => slider.props.onValueChange(200000))
    expect(onCambio).toHaveBeenCalledWith(200000)
  })

  it('pinta el precio en rojo cuando el valor está bajo el mínimo', async () => {
    const arbol = await montar({ valor: 100000, minimo: 150000, maximo: 220000, onCambio: jest.fn() })
    const { paletaClara } = require('../../lib/theme')
    const rojo = arbol.root.findAll((n: any) => {
      if (n.type !== require('react-native').Text) return false
      const style = Array.isArray(n.props.style) ? Object.assign({}, ...n.props.style.filter(Boolean)) : n.props.style
      return style?.color === paletaClara.peligroTexto
    })
    expect(rojo.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- SliderPrecio`
Expected: FAIL — `SliderPrecio` no existe.

- [ ] **Step 3: Implementar**

```tsx
// components/ui/SliderPrecio.tsx
import React from 'react'
import { Text, View } from 'react-native'
import Slider from '@react-native-community/slider'
import { useTema } from '../../lib/tema'
import { espacio, tabular, tipografia } from '../../lib/theme'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

interface Props {
  valor: number
  minimo: number
  maximo: number
  onCambio: (valor: number) => void
  paso?: number
}

// Slider de precio para regateo: entre precio_minimo y precio_maximo, en múltiplos de $1.000.
export function SliderPrecio({ valor, minimo, maximo, onCambio, paso = 1000 }: Props) {
  const { paleta } = useTema()
  const bajoMinimo = valor < minimo

  return (
    <View style={{ gap: espacio.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{pesos(minimo)}</Text>
        <Text
          style={[
            tipografia.h3,
            tabular,
            { color: bajoMinimo ? paleta.peligroTexto : paleta.texto },
          ]}
        >
          {pesos(valor)}
        </Text>
        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{pesos(maximo)}</Text>
      </View>
      <Slider
        minimumValue={minimo}
        maximumValue={Math.max(maximo, minimo + paso)}
        step={paso}
        value={valor}
        onValueChange={onCambio}
        minimumTrackTintColor={paleta.primario}
        maximumTrackTintColor={paleta.borde}
        thumbTintColor={paleta.primario}
        accessibilityLabel="Precio de venta"
      />
    </View>
  )
}
```

- [ ] **Step 4: Exportar**

Agrega en `components/ui/index.ts`:

```ts
export { SliderPrecio } from './SliderPrecio'
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npm test -- SliderPrecio`
Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add components/ui/SliderPrecio.tsx components/ui/SliderPrecio.test.tsx components/ui/index.ts
git commit -m "$(cat <<'EOF'
feat(ui): componente SliderPrecio para regateo entre min y max

Un solo componente reutilizado en la línea del carrito y en el paso
de Compra Rápida (Tasks 9 y 10).
EOF
)"
```

---

### Task 8: `lib/productos.ts` — `agruparPorReferencia` soporta incluir inactivos

**Files:**
- Modify: `lib/productos.ts`
- Modify: `lib/productos.test.ts`

**Interfaces:**
- Produces: `ModeloCalzado` gana el campo `activo: boolean`. `agruparPorReferencia(filas, opciones?: { incluirInactivos?: boolean })` — segundo parámetro opcional, default `incluirInactivos: false` (mismo comportamiento que hoy si no se pasa nada).

- [ ] **Step 1: Test nuevo (agregar, no reemplazar los existentes)**

Agrega en `lib/productos.test.ts`, dentro de `describe('agruparPorReferencia', ...)`:

```ts
  it('con incluirInactivos:true, conserva las variantes inactivas y marca el modelo', () => {
    const modelos = agruparPorReferencia(
      [
        fila({ referencia: '9999', activo: true, talla: '38' }),
        fila({ referencia: '9999', activo: false, talla: '40' }),
      ],
      { incluirInactivos: true }
    )
    expect(modelos).toHaveLength(1)
    expect(modelos[0].variantes).toHaveLength(2)
    expect(modelos[0].activo).toBe(true) // al menos una variante activa
  })

  it('modelo con todas las variantes inactivas: activo=false', () => {
    const modelos = agruparPorReferencia(
      [fila({ referencia: '8888', activo: false, talla: '38' })],
      { incluirInactivos: true }
    )
    expect(modelos[0].activo).toBe(false)
  })
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- lib/productos.test.ts`
Expected: FAIL — `agruparPorReferencia` no acepta un segundo argumento (TypeScript) o `modelos[0].activo` es `undefined`.

- [ ] **Step 3: Implementar**

Reemplaza en `lib/productos.ts`:

```ts
export interface ModeloCalzado {
  clave: string
  referencia: string | null
  nombre: string
  marca: string | null
  categoria: string
  foto: string | null
  colores: string[]
  precioMin: number
  precioMax: number
  agotado: boolean
  variantes: ProductoCalzado[]
}
```

por:

```ts
export interface ModeloCalzado {
  clave: string
  referencia: string | null
  nombre: string
  marca: string | null
  categoria: string
  foto: string | null
  colores: string[]
  precioMin: number
  precioMax: number
  agotado: boolean
  activo: boolean
  variantes: ProductoCalzado[]
}
```

Reemplaza:

```ts
export function agruparPorReferencia(filas: ProductoCalzado[]): ModeloCalzado[] {
  const grupos = new Map<string, ProductoCalzado[]>()
  for (const f of filas) {
    if (!f.activo) continue
    const ref = (f.referencia ?? '').trim().toLowerCase()
    const clave = ref !== '' ? ref : `desc:${f.descripcion.trim().toLowerCase()}`
    const grupo = grupos.get(clave)
    if (grupo) grupo.push(f)
    else grupos.set(clave, [f])
  }

  return [...grupos.values()].map((variantes) => {
    const ordenadas = [...variantes].sort((a, b) => tallaNumerica(a.talla) - tallaNumerica(b.talla))
    const primera = ordenadas[0]
    const colores: string[] = []
    for (const v of variantes) {
      const c = v.color?.trim()
      if (c && !colores.includes(c)) colores.push(c)
    }
    const ref = (primera.referencia ?? '').trim()
    return {
      clave: ref !== '' ? ref : primera.descripcion.trim(),
      referencia: ref !== '' ? ref : null,
      nombre: primera.descripcion,
      marca: primera.marca,
      categoria: primera.categoria,
      foto: variantes.find((v) => v.foto_url)?.foto_url ?? null,
      colores,
      precioMin: Math.min(...variantes.map((v) => Number(v.precio_minimo))),
      precioMax: Math.max(...variantes.map((v) => Number(v.precio_maximo))),
      agotado: variantes.every((v) => Number(v.stock_actual) <= 0),
      variantes: ordenadas,
    }
  })
}
```

por:

```ts
export function agruparPorReferencia(
  filas: ProductoCalzado[],
  opciones?: { incluirInactivos?: boolean }
): ModeloCalzado[] {
  const incluirInactivos = opciones?.incluirInactivos ?? false
  const grupos = new Map<string, ProductoCalzado[]>()
  for (const f of filas) {
    if (!incluirInactivos && !f.activo) continue
    const ref = (f.referencia ?? '').trim().toLowerCase()
    const clave = ref !== '' ? ref : `desc:${f.descripcion.trim().toLowerCase()}`
    const grupo = grupos.get(clave)
    if (grupo) grupo.push(f)
    else grupos.set(clave, [f])
  }

  return [...grupos.values()].map((variantes) => {
    const ordenadas = [...variantes].sort((a, b) => tallaNumerica(a.talla) - tallaNumerica(b.talla))
    const primera = ordenadas[0]
    const colores: string[] = []
    for (const v of variantes) {
      const c = v.color?.trim()
      if (c && !colores.includes(c)) colores.push(c)
    }
    const ref = (primera.referencia ?? '').trim()
    return {
      clave: ref !== '' ? ref : primera.descripcion.trim(),
      referencia: ref !== '' ? ref : null,
      nombre: primera.descripcion,
      marca: primera.marca,
      categoria: primera.categoria,
      foto: variantes.find((v) => v.foto_url)?.foto_url ?? null,
      colores,
      precioMin: Math.min(...variantes.map((v) => Number(v.precio_minimo))),
      precioMax: Math.max(...variantes.map((v) => Number(v.precio_maximo))),
      agotado: variantes.every((v) => Number(v.stock_actual) <= 0),
      activo: variantes.some((v) => v.activo),
      variantes: ordenadas,
    }
  })
}
```

- [ ] **Step 4: Correr toda la suite de `productos.test.ts`**

Run: `npm test -- lib/productos.test.ts`
Expected: PASS (todos, incluidos los 2 nuevos y los 5 preexistentes sin cambios de comportamiento).

- [ ] **Step 5: Commit**

```bash
git add lib/productos.ts lib/productos.test.ts
git commit -m "$(cat <<'EOF'
feat(productos): agruparPorReferencia acepta incluirInactivos

Necesario para el toggle "ver descontinuados" (Task 14) — por defecto
el comportamiento no cambia (sigue excluyendo inactivos).
EOF
)"
```

---

### Task 9: `productos/[ref].tsx` — Agregar al carrito ya no navega + botón Compra rápida

**Files:**
- Modify: `app/(app)/productos/[ref].tsx`
- Modify: `lib/producto_detalle_ui.test.tsx`

**Interfaces:**
- Consumes: `useCarrito()` (ya existente).
- Produces: navegación `router.push('/ventas/nueva?modo=rapida')` para Compra rápida (consumida por Task 10).

- [ ] **Step 1: Quitar la navegación de "Agregar al carrito" y agregar "Compra rápida"**

Busca:

```tsx
            <Boton
              titulo="Agregar al carrito"
              icono={<ShoppingCart size={20} color={paleta.sobrePrimario} />}
              deshabilitado={!variante || Number(variante.stock_actual) <= 0}
              onPress={() => {
                if (!variante || !modelo) return
                dispatch({
                  tipo: 'agregar',
                  producto: {
                    tipo: 'calzado',
                    id: variante.id,
                    titulo: modelo.nombre,
                    detalle: detalleCalzado({
                      marca: modelo.marca,
                      talla: variante.talla,
                      color: variante.color,
                    }),
                    precio: Number(variante.precio_maximo),
                    stock: Number(variante.stock_actual),
                    precioMin: Number(variante.precio_minimo),
                    precioMax: Number(variante.precio_maximo),
                  },
                })
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                mostrar(`Agregado: talla ${variante.talla} · ${variante.color}`)
                router.push('/ventas/nueva')
              }}
            />
```

Reemplázalo por:

```tsx
            <Boton
              titulo="Agregar al carrito"
              icono={<ShoppingCart size={20} color={paleta.sobrePrimario} />}
              deshabilitado={!variante || Number(variante.stock_actual) <= 0}
              onPress={() => {
                if (!variante || !modelo) return
                dispatch({
                  tipo: 'agregar',
                  producto: {
                    tipo: 'calzado',
                    id: variante.id,
                    titulo: modelo.nombre,
                    detalle: detalleCalzado({
                      marca: modelo.marca,
                      talla: variante.talla,
                      color: variante.color,
                    }),
                    precio: Number(variante.precio_maximo),
                    stock: Number(variante.stock_actual),
                    precioMin: Number(variante.precio_minimo),
                    precioMax: Number(variante.precio_maximo),
                  },
                })
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                mostrar(`Agregado: talla ${variante.talla} · ${variante.color}`)
              }}
            />
            <Boton
              titulo="Compra rápida"
              variante="secundario"
              deshabilitado={!variante || Number(variante.stock_actual) <= 0}
              onPress={() => {
                if (!variante || !modelo) return
                dispatch({ tipo: 'limpiar' })
                dispatch({
                  tipo: 'agregar',
                  producto: {
                    tipo: 'calzado',
                    id: variante.id,
                    titulo: modelo.nombre,
                    detalle: detalleCalzado({
                      marca: modelo.marca,
                      talla: variante.talla,
                      color: variante.color,
                    }),
                    precio: Number(variante.precio_maximo),
                    stock: Number(variante.stock_actual),
                    precioMin: Number(variante.precio_minimo),
                    precioMax: Number(variante.precio_maximo),
                  },
                })
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                router.push('/ventas/nueva?modo=rapida')
              }}
            />
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores (el segundo argumento de `router.push` con query string es válido para expo-router).

- [ ] **Step 3: Actualizar el test que asumía navegación al agregar**

Busca en `lib/producto_detalle_ui.test.tsx`:

```tsx
  it('elegir talla habilita Agregar al carrito y navega a Nueva Venta', async () => {
    conRol('empleado')
    const arbol = await montar()
    const negro = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Negro')!
    await act(async () => negro.props.onPress!())
    const talla40 = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Talla 40: 5 disponibles')!
    await act(async () => talla40.props.onPress!())
    const cta = arbol.root
      .findAllByProps({ accessibilityLabel: 'Agregar al carrito' })
      .find((n: Nodo) => n.props.onPress)!
    await act(async () => cta.props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/ventas/nueva')
  })
```

Reemplázalo por:

```tsx
  it('elegir talla habilita Agregar al carrito y NO navega (se queda en Productos)', async () => {
    conRol('empleado')
    const arbol = await montar()
    const negro = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Negro')!
    await act(async () => negro.props.onPress!())
    const talla40 = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Talla 40: 5 disponibles')!
    await act(async () => talla40.props.onPress!())
    const cta = arbol.root
      .findAllByProps({ accessibilityLabel: 'Agregar al carrito' })
      .find((n: Nodo) => n.props.onPress)!
    await act(async () => cta.props.onPress!())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('Compra rápida limpia el carrito, agrega el ítem y navega con modo=rapida', async () => {
    conRol('empleado')
    const arbol = await montar()
    const negro = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Negro')!
    await act(async () => negro.props.onPress!())
    const talla40 = botones(arbol).find((n: Nodo) => n.props.accessibilityLabel === 'Talla 40: 5 disponibles')!
    await act(async () => talla40.props.onPress!())
    const cta = arbol.root
      .findAllByProps({ accessibilityLabel: 'Compra rápida' })
      .find((n: Nodo) => n.props.onPress)!
    await act(async () => cta.props.onPress!())
    expect(mockPush).toHaveBeenCalledWith('/ventas/nueva?modo=rapida')
  })
```

- [ ] **Step 4: Correr la suite del detalle de producto**

Run: `npm test -- producto_detalle_ui`
Expected: PASS (7/7 — 5 preexistentes sin cambios + 2 nuevos/actualizados).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/productos/[ref].tsx" lib/producto_detalle_ui.test.tsx
git commit -m "$(cat <<'EOF'
feat(productos): Agregar al carrito ya no navega + botón Compra rápida

Con Productos como hub principal de venta, forzar la navegación al
carrito en cada ítem interrumpe comprar varias cosas seguidas. Compra
rápida sigue navegando (con ?modo=rapida) porque su flujo es justamente
saltar directo a pagar un solo ítem.
EOF
)"
```

---

### Task 10: `nueva.tsx` — quita el buscador, agrega la etapa "ajustarPrecio", usa el slider, fix de safe-area

**Files:**
- Modify: `app/(app)/ventas/nueva.tsx`
- Modify: `lib/venta_nueva_ui.test.tsx`

**Interfaces:**
- Consumes: `SliderPrecio` (Task 7), `usePaddingInferior` (ya existente).
- Produces: ruta `/ventas/nueva?modo=rapida` entra directo a la etapa `'ajustarPrecio'` cuando el carrito tiene exactamente 1 ítem al montar.

- [ ] **Step 1: Imports**

Busca:

```tsx
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Check, Lock, Minus, Plus, X } from 'lucide-react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useRequireModulo } from '../../../lib/auth'
import { useCarrito } from '../../../lib/carrito-contexto'
import {
  bajoMinimo, calcularCambio, montoEfectivo, pagosCuadran, totalCarrito,
  type AccionCarrito, type ItemCarrito, type MetodoPago, type PagoInput, type ProductoVendible,
} from '../../../lib/carrito'
import { buscarProductos, registrarVenta } from '../../../lib/ventas'
import { obtenerCajaHoy } from '../../../lib/caja'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import {
  Boton, CampoTexto, Chip, EstadoVacio, OverlayExito, Presionable, Tarjeta,
} from '../../../components/ui'
```

Reemplázalo por:

```tsx
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Check, Lock, Minus, Plus, X } from 'lucide-react-native'
import { useRequireModulo } from '../../../lib/auth'
import { useCarrito } from '../../../lib/carrito-contexto'
import {
  bajoMinimo, calcularCambio, montoEfectivo, pagosCuadran, totalCarrito,
  type AccionCarrito, type ItemCarrito, type MetodoPago, type PagoInput,
} from '../../../lib/carrito'
import { registrarVenta } from '../../../lib/ventas'
import { obtenerCajaHoy } from '../../../lib/caja'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import {
  Boton, CampoTexto, Chip, EstadoVacio, OverlayExito, Presionable, SliderPrecio, Tarjeta,
} from '../../../components/ui'
```

(Se quitan `useRef`, `Haptics`, `Animated`/`FadeInDown` y `ProductoVendible` — dejaban de usarse al retirar el buscador; `useLocalSearchParams` y `usePaddingInferior` se agregan.)

- [ ] **Step 2: `LineaCarrito` usa el slider para calzado**

Busca:

```tsx
function LineaCarrito({ item, dispatch }: { item: ItemCarrito; dispatch: (a: AccionCarrito) => void }) {
  const { paleta } = useTema()
  const esCalzado = item.producto.tipo === 'calzado'
  const [precioTxt, setPrecioTxt] = useState(String(item.precio))
  const [cantTxt, setCantTxt] = useState(String(item.cantidad))
  const bajo = bajoMinimo(item)

  function commitPrecio() {
    dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: Number(soloEntero(precioTxt)) || 0 })
  }
  function commitCantidad() {
    dispatch({ tipo: 'cambiarCantidad', id: item.producto.id, cantidad: Number(soloDecimal(cantTxt)) || 0 })
  }

  const inputInline = {
    borderWidth: 1.5,
    borderColor: bajo ? paleta.peligro : paleta.bordeFuerte,
    borderRadius: radio.sm,
    paddingVertical: 6,
    paddingHorizontal: espacio.s,
    minWidth: 84,
    color: paleta.texto,
    backgroundColor: paleta.superficie,
    ...tipografia.cuerpo,
    ...tabular,
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.s }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]} numberOfLines={1}>
          {item.producto.titulo}
        </Text>
        {esCalzado ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
              <Text style={[tipografia.caption, { color: paleta.texto2 }]}>Precio c/u</Text>
              <TextInput
                accessibilityLabel="Precio unitario"
                style={inputInline}
                keyboardType="number-pad"
                value={precioTxt}
                onChangeText={t => setPrecioTxt(soloEntero(t))}
                onEndEditing={commitPrecio}
              />
            </View>
            <Text style={[tipografia.caption, { color: bajo ? paleta.peligroTexto : paleta.texto3 }]}>
              Rango {pesos(item.producto.precioMin ?? 0)}–{pesos(item.producto.precioMax ?? 0)}
              {bajo ? ' · bajo el mínimo' : ''}
            </Text>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
            <TextInput
              accessibilityLabel="Cantidad"
              style={inputInline}
              keyboardType="decimal-pad"
              value={cantTxt}
              onChangeText={t => setCantTxt(soloDecimal(t))}
              onEndEditing={commitCantidad}
            />
            <Text style={[tipografia.caption, { color: paleta.texto2 }]}>{item.producto.unidad} ×</Text>
            <TextInput
              accessibilityLabel="Precio unitario"
              style={inputInline}
              keyboardType="number-pad"
              value={precioTxt}
              onChangeText={t => setPrecioTxt(soloEntero(t))}
              onEndEditing={commitPrecio}
            />
          </View>
        )}
        <Text style={[tipografia.caption, tabular, { color: paleta.texto2 }]}>
          Subtotal {pesos(item.subtotal)}
        </Text>
      </View>
```

Reemplázalo por:

```tsx
function LineaCarrito({ item, dispatch }: { item: ItemCarrito; dispatch: (a: AccionCarrito) => void }) {
  const { paleta } = useTema()
  const esCalzado = item.producto.tipo === 'calzado'
  const [precioTxt, setPrecioTxt] = useState(String(item.precio))
  const [cantTxt, setCantTxt] = useState(String(item.cantidad))

  function commitPrecio() {
    dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: Number(soloEntero(precioTxt)) || 0 })
  }
  function commitCantidad() {
    dispatch({ tipo: 'cambiarCantidad', id: item.producto.id, cantidad: Number(soloDecimal(cantTxt)) || 0 })
  }

  const inputInline = {
    borderWidth: 1.5,
    borderColor: paleta.bordeFuerte,
    borderRadius: radio.sm,
    paddingVertical: 6,
    paddingHorizontal: espacio.s,
    minWidth: 84,
    color: paleta.texto,
    backgroundColor: paleta.superficie,
    ...tipografia.cuerpo,
    ...tabular,
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.s }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]} numberOfLines={1}>
          {item.producto.titulo}
        </Text>
        {esCalzado ? (
          <SliderPrecio
            valor={item.precio}
            minimo={item.producto.precioMin ?? 0}
            maximo={item.producto.precioMax ?? item.precio}
            onCambio={(v) => dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: v })}
          />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
            <TextInput
              accessibilityLabel="Cantidad"
              style={inputInline}
              keyboardType="decimal-pad"
              value={cantTxt}
              onChangeText={t => setCantTxt(soloDecimal(t))}
              onEndEditing={commitCantidad}
            />
            <Text style={[tipografia.caption, { color: paleta.texto2 }]}>{item.producto.unidad} ×</Text>
            <TextInput
              accessibilityLabel="Precio unitario"
              style={inputInline}
              keyboardType="number-pad"
              value={precioTxt}
              onChangeText={t => setPrecioTxt(soloEntero(t))}
              onEndEditing={commitPrecio}
            />
          </View>
        )}
        <Text style={[tipografia.caption, tabular, { color: paleta.texto2 }]}>
          Subtotal {pesos(item.subtotal)}
        </Text>
      </View>
```

(`bajoMinimo` import se mantiene — sigue haciendo falta en el paso `'ajustarPrecio'` nuevo; si terminara sin usarse en ningún lado tras este task, quitar el import ahí. Verifica con grep antes de decidir.)

- [ ] **Step 3: Tipo `Etapa` + estado + `usePaddingInferior` + parámetro `modo`**

Busca:

```tsx
export default function NuevaVenta() {
  const redir = useRequireModulo('ventas')
  const router = useRouter()
  const { paleta } = useTema()

  const [etapa, setEtapa] = useState<Etapa>('carrito')
  // Carrito compartido: el detalle de producto (tab Productos) también agrega aquí.
  const { items, dispatch } = useCarrito()
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<ProductoVendible[]>([])
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [primeraCarga, setPrimeraCarga] = useState(true)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [metodos, setMetodos] = useState<MetodoPago[]>([])
```

Reemplázalo por:

```tsx
export default function NuevaVenta() {
  const redir = useRequireModulo('ventas')
  const router = useRouter()
  const { modo } = useLocalSearchParams<{ modo?: string }>()
  const { paleta } = useTema()
  const paddingInferior = usePaddingInferior(espacio.xxl)

  // Carrito compartido: el detalle de producto (tab Productos) también agrega aquí.
  const { items, dispatch } = useCarrito()
  const [etapa, setEtapa] = useState<Etapa>(modo === 'rapida' && items.length === 1 ? 'ajustarPrecio' : 'carrito')

  const [metodos, setMetodos] = useState<MetodoPago[]>([])
```

- [ ] **Step 4: Tipo `Etapa`**

Busca:

```tsx
type Etapa = 'carrito' | 'cobrar' | 'confirmacion'
```

Reemplázalo por:

```tsx
type Etapa = 'carrito' | 'ajustarPrecio' | 'cobrar' | 'confirmacion'
```

- [ ] **Step 5: Quitar `buscar` y `salirAtras` no cambia; el `if (redir)` tampoco. Renderizar la etapa `'ajustarPrecio'`**

Busca (elimina por completo esta función, ya no hace falta):

```tsx
  const buscar = useCallback((texto: string) => {
    setQuery(texto)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setBuscando(true)
      setErrorBusqueda(null)
      try {
        setResultados(await buscarProductos(texto))
        setPrimeraCarga(false)
      } catch {
        setErrorBusqueda('No se pudo buscar. Revisa tu conexión.')
      } finally {
        setBuscando(false)
      }
    }, 300)
  }, [])

  if (redir) return redir
```

Reemplázalo por:

```tsx
  if (redir) return redir
```

Busca (justo antes de `if (etapa === 'confirmacion')`, agrega el render de `'ajustarPrecio'`):

```tsx
  if (etapa === 'confirmacion') {
```

Reemplázalo por:

```tsx
  if (etapa === 'ajustarPrecio') {
    const item = items[0]
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, padding: espacio.xl, paddingTop: 56, gap: espacio.l }}>
        <Text style={[tipografia.h2, { color: paleta.texto }]}>{item.producto.titulo}</Text>
        {item.producto.tipo === 'calzado' ? (
          <SliderPrecio
            valor={item.precio}
            minimo={item.producto.precioMin ?? 0}
            maximo={item.producto.precioMax ?? item.precio}
            onCambio={(v) => dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: v })}
          />
        ) : null}
        <Text style={[tipografia.h3, tabular, { color: paleta.texto }]}>Subtotal {pesos(item.subtotal)}</Text>
        <Boton titulo="Continuar a pago" onPress={() => setEtapa('cobrar')} />
      </View>
    )
  }

  if (etapa === 'confirmacion') {
```

- [ ] **Step 6: Etapa `'carrito'` — quitar buscador, dejar solo el carrito + fix de safe-area**

Busca (todo el render final, etapa `'carrito'`):

```tsx
  // etapa === 'carrito'
  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m }}>
        <Presionable accessibilityRole="button" accessibilityLabel="Salir de la venta"
          onPress={salirDelFlujo} hitSlop={12}>
          <X size={24} color={paleta.texto} />
        </Presionable>
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Nueva venta</Text>
      </View>

      <View style={{ paddingHorizontal: espacio.xl }}>
        <CampoTexto
          placeholder="Buscar producto"
          value={query}
          onChangeText={buscar}
          autoFocus
        />
      </View>

      {buscando ? <ActivityIndicator style={{ marginVertical: espacio.s }} color={paleta.primario} /> : null}
      {errorBusqueda ? (
        <Text style={[tipografia.cuerpo, { color: paleta.peligroTexto, textAlign: 'center', marginVertical: espacio.xs }]}>
          {errorBusqueda}
        </Text>
      ) : null}

      <ScrollView style={{ flex: 1, marginTop: espacio.s, paddingHorizontal: espacio.xl }} keyboardShouldPersistTaps="handled">
        {resultados.map((p, i) => {
          const fila = (
            <Presionable
              accessibilityRole="button"
              accessibilityLabel={`Agregar ${p.titulo}`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                dispatch({ tipo: 'agregar', producto: p })
              }}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: espacio.m,
                paddingVertical: espacio.m, borderBottomWidth: 1, borderBottomColor: paleta.borde,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]} numberOfLines={1}>{p.titulo}</Text>
                <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                  {p.detalle}{p.tipo === 'calzado' ? ` · Stock: ${p.stock}` : ''}
                </Text>
              </View>
              <Text style={[tipografia.h3, tabular, { color: paleta.texto }]}>{pesos(p.precio)}</Text>
            </Presionable>
          )
          return primeraCarga && i < 8 ? (
            <Animated.View key={`${p.tipo}-${p.id}`} entering={FadeInDown.duration(220).delay(i * 40)}>
              {fila}
            </Animated.View>
          ) : (
            <View key={`${p.tipo}-${p.id}`}>{fila}</View>
          )
        })}
      </ScrollView>

      <Tarjeta estilo={{ borderRadius: 0, borderTopLeftRadius: radio.lg, borderTopRightRadius: radio.lg, borderBottomWidth: 0, gap: espacio.s, paddingBottom: espacio.xxl }}>
        <ScrollView style={{ maxHeight: 220 }}>
          {items.map((i: ItemCarrito) => (
            <LineaCarrito key={`${i.producto.tipo}-${i.producto.id}`} item={i} dispatch={dispatch} />
          ))}
        </ScrollView>
        <Boton
          titulo={total > 0 ? `Cobrar ${pesos(total)}` : 'Cobrar'}
          onPress={() => setEtapa('cobrar')}
          deshabilitado={items.length === 0}
        />
      </Tarjeta>
    </View>
  )
}
```

Reemplázalo por:

```tsx
  // etapa === 'carrito'
  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m }}>
        <Presionable accessibilityRole="button" accessibilityLabel="Salir de la venta"
          onPress={salirDelFlujo} hitSlop={12}>
          <X size={24} color={paleta.texto} />
        </Presionable>
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Carrito</Text>
      </View>

      {items.length === 0 ? (
        <EstadoVacio
          icono={<X />}
          titulo="Tu carrito está vacío"
          mensaje="Agrega productos desde la pestaña Productos"
        />
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: espacio.xl }} keyboardShouldPersistTaps="handled">
          {items.map((i: ItemCarrito) => (
            <LineaCarrito key={`${i.producto.tipo}-${i.producto.id}`} item={i} dispatch={dispatch} />
          ))}
        </ScrollView>
      )}

      <Tarjeta estilo={{ borderRadius: 0, borderTopLeftRadius: radio.lg, borderTopRightRadius: radio.lg, borderBottomWidth: 0, paddingBottom: paddingInferior }}>
        <Boton
          titulo={total > 0 ? `Cobrar ${pesos(total)}` : 'Cobrar'}
          onPress={() => setEtapa('cobrar')}
          deshabilitado={items.length === 0}
        />
      </Tarjeta>
    </View>
  )
}
```

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores. Si `bajoMinimo` queda sin uso, quítalo del import (verificar con grep primero).

- [ ] **Step 8: Actualizar `lib/venta_nueva_ui.test.tsx`**

Busca (el mock de `expo-router`, que no incluye `useLocalSearchParams`):

```tsx
const mockBack = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack, canGoBack: () => true }),
}))
```

Reemplázalo por:

```tsx
const mockBack = jest.fn()
const mockReplace = jest.fn()
let mockParams: { modo?: string } = {}
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}))
```

Busca (el mock de `lib/ventas`, que ya no necesita `buscarProductos`):

```tsx
const mockBuscar = jest.fn()
const mockRegistrar = jest.fn()
jest.mock('../lib/ventas', () => ({
  buscarProductos: (...a: unknown[]) => mockBuscar(...a),
  registrarVenta: (...a: unknown[]) => mockRegistrar(...a),
}))
```

Reemplázalo por:

```tsx
const mockRegistrar = jest.fn()
jest.mock('../lib/ventas', () => ({
  registrarVenta: (...a: unknown[]) => mockRegistrar(...a),
}))
```

Busca (reset de `mockParams` en cada test):

```tsx
describe('Nueva Venta restilizada', () => {
  beforeEach(() => jest.clearAllMocks())
```

Reemplázalo por:

```tsx
describe('Nueva Venta restilizada', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockParams = {}
  })
```

- [ ] **Step 9: Agregar 2 tests nuevos (carrito vacío + modo rápida)**

Agrega al final de `describe('Nueva Venta restilizada', ...)`, antes del cierre:

```tsx
  test('carrito vacío muestra el estado vacío en vez del buscador', async () => {
    const arbol = await montar()
    expect(todoElTexto(arbol)).toContain('Tu carrito está vacío')
  })

  test('modo=rapida con 1 ítem entra directo a ajustar precio (sin ver el carrito completo)', async () => {
    mockParams = { modo: 'rapida' }
    const arbol = await montar({ conItem: true })
    expect(todoElTexto(arbol)).toContain('Continuar a pago')
    presionarPorLabel(arbol, 'Continuar a pago')
    expect(todoElTexto(arbol)).toContain('Faltan')
  })
```

- [ ] **Step 10: Correr toda la suite de Nueva Venta**

Run: `npm test -- venta_nueva_ui`
Expected: PASS (6/6 — 4 preexistentes sin romperse + 2 nuevos).

- [ ] **Step 11: Verificar que `buscarProductos` no quedó huérfano**

Run: `grep -rn "buscarProductos" app/ lib/ components/`
Expected: solo aparece la definición en `lib/ventas.ts`. Si es así, elimínala de `lib/ventas.ts` (y su import de `orIlike`/`detalleCalzado` si quedan sin otro uso en ese archivo) para no dejar código muerto.

- [ ] **Step 12: Verificación final de la task**

Run: `npx tsc --noEmit && npm test`
Expected: limpio y verde en toda la suite (no solo el archivo de este task).

- [ ] **Step 13: Commit**

```bash
git add "app/(app)/ventas/nueva.tsx" lib/venta_nueva_ui.test.tsx lib/ventas.ts
git commit -m "$(cat <<'EOF'
feat(carrito): Nueva Venta pierde el buscador, gana ajustarPrecio y usa el slider

Productos es ahora la única vía para elegir qué vender; esta pantalla
queda como "Carrito": lista de ítems (con SliderPrecio para calzado) +
Cobrar. La nueva etapa "ajustarPrecio" atiende la entrada de Compra
Rápida (?modo=rapida) con un paso breve antes de pagar. De paso se
arregla el safe-area de la barra inferior (usePaddingInferior).
EOF
)"
```

---

### Task 11: `HojaVenderGranja` + integrarla en Productos (venta de Granja + ícono de editar)

**Files:**
- Create: `components/ui/HojaVenderGranja.tsx`
- Modify: `components/ui/index.ts`
- Modify: `app/(app)/(tabs)/productos.tsx`

**Interfaces:**
- Produces: `HojaVenderGranja({ visible, producto, onCerrar, onAgregar, onCompraRapida })`.
- Consumes: `useCarrito()`, `useRouter()` en `productos.tsx`.

- [ ] **Step 1: Componente `HojaVenderGranja`**

```tsx
// components/ui/HojaVenderGranja.tsx
import React, { useEffect, useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import type { ProductoVarios } from '../../lib/inventario'
import { Boton } from './Boton'
import { CampoTexto } from './CampoTexto'

interface Props {
  visible: boolean
  producto: ProductoVarios | null
  onCerrar: () => void
  onAgregar: (cantidad: number, precio: number) => void
  onCompraRapida: (cantidad: number, precio: number) => void
}

// Hoja modal para vender Granja: sin stock ni precio guardado, se
// definen ambos en el momento de la venta (PRD §Granja).
export function HojaVenderGranja({ visible, producto, onCerrar, onAgregar, onCompraRapida }: Props) {
  const { paleta } = useTema()
  const [cantidad, setCantidad] = useState('1')
  const [precio, setPrecio] = useState('')

  useEffect(() => {
    if (visible) {
      setCantidad('1')
      setPrecio('')
    }
  }, [visible])

  if (!producto) return null
  const cantidadNum = parseFloat(cantidad.replace(',', '.')) || 0
  const precioNum = Number(precio.replace(/[^0-9]/g, '')) || 0
  const puedeVender = cantidadNum > 0 && precioNum > 0

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }} onPress={onCerrar}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: paleta.fondo,
            borderTopLeftRadius: radio.xl,
            borderTopRightRadius: radio.xl,
            padding: espacio.xxl,
            gap: espacio.m,
          }}
        >
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: radio.full, backgroundColor: paleta.bordeFuerte }} />
          <Text style={[tipografia.h2, { color: paleta.texto }]}>{producto.nombre}</Text>

          <CampoTexto
            etiqueta={`Cantidad (${producto.unidad_medida})`}
            keyboardType="decimal-pad"
            value={cantidad}
            onChangeText={setCantidad}
            placeholder="1"
          />
          <CampoTexto
            etiqueta="Precio"
            keyboardType="number-pad"
            value={precio}
            onChangeText={(t) => setPrecio(t.replace(/[^0-9]/g, ''))}
            placeholder="0"
          />

          <Boton
            titulo="Agregar a carrito"
            deshabilitado={!puedeVender}
            onPress={() => onAgregar(cantidadNum, precioNum)}
          />
          <Boton
            titulo="Compra rápida"
            variante="secundario"
            deshabilitado={!puedeVender}
            onPress={() => onCompraRapida(cantidadNum, precioNum)}
          />
          <Boton titulo="Cancelar" variante="fantasma" tamano="md" onPress={onCerrar} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}
```

- [ ] **Step 2: Exportar**

Agrega en `components/ui/index.ts`:

```ts
export { HojaVenderGranja } from './HojaVenderGranja'
```

- [ ] **Step 3: Integrar en `productos.tsx`**

Busca (import de iconos, agrega `Pencil`):

```tsx
import { Camera, ChevronRight, Egg, Footprints, PackagePlus, Search } from 'lucide-react-native'
```

Reemplázalo por:

```tsx
import { ChevronRight, Egg, Footprints, PackagePlus, Pencil, Search } from 'lucide-react-native'
```

(`Camera` se quitó en el Task 1 al mover Carga Inicial fuera de esta pantalla; confirma con grep que no quedó en uso antes de aplicar esta línea tal cual — si Task 1 no se ha ejecutado todavía, ajusta para no duplicar el import.)

Busca:

```tsx
import { useAuth } from '../../../lib/auth'
import { CATEGORIAS } from '../../../lib/excel'
import { listarCalzado, listarVarios } from '../../../lib/inventario'
import type { ProductoVarios } from '../../../lib/inventario'
import { puedeAcceder } from '../../../lib/permisos'
import { agruparPorReferencia, filtrarModelos } from '../../../lib/productos'
import type { ModeloCalzado } from '../../../lib/productos'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import {
  Badge,
  CampoTexto,
  Chip,
  CirculoIcono,
  ControlSegmentado,
  Esqueleto,
  EstadoVacio,
  FilaLista,
  Tarjeta,
} from '../../../components/ui'
```

Reemplázalo por:

```tsx
import { useRouter } from 'expo-router'
import { useAuth } from '../../../lib/auth'
import { useCarrito } from '../../../lib/carrito-contexto'
import { CATEGORIAS } from '../../../lib/excel'
import { listarCalzado, listarVarios } from '../../../lib/inventario'
import type { ProductoVarios } from '../../../lib/inventario'
import { agruparPorReferencia, filtrarModelos } from '../../../lib/productos'
import type { ModeloCalzado } from '../../../lib/productos'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import {
  Badge,
  CampoTexto,
  Chip,
  CirculoIcono,
  ControlSegmentado,
  Esqueleto,
  EstadoVacio,
  FilaLista,
  HojaVenderGranja,
  Tarjeta,
  useToast,
} from '../../../components/ui'
```

(`useRouter` ya estaba importado de `expo-router` en la línea 3 original junto con `useFocusEffect` — no lo dupliques, solo agrégalo a esa misma línea existente si no está. `puedeAcceder` se quitó porque Carga Inicial ya no vive aquí desde el Task 1; confirma con grep que no se use en otro lado del archivo antes de quitarlo.)

Dentro de `export default function Productos()`, agrega el estado y el manejador de venta de Granja:

```tsx
  const router = useRouter()
  const { dispatch } = useCarrito()
  const { mostrar } = useToast()
  const [productoGranja, setProductoGranja] = useState<ProductoVarios | null>(null)
```

Reemplaza la fila de Granja (dentro del `.map` de `variosVisibles`):

```tsx
                <FilaLista
                  icono={
                    <CirculoIcono tono="acento">
                      <Egg />
                    </CirculoIcono>
                  }
                  titulo={v.nombre}
                  subtitulo={`Por ${v.unidad_medida} · precio al vender`}
                  chevron
                  onPress={() => router.push(`/inventario/granja/editor?id=${v.id}`)}
                />
```

por:

```tsx
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <FilaLista
                      icono={
                        <CirculoIcono tono="acento">
                          <Egg />
                        </CirculoIcono>
                      }
                      titulo={v.nombre}
                      subtitulo={`Por ${v.unidad_medida} · precio al vender`}
                      onPress={() => setProductoGranja(v)}
                    />
                  </View>
                  {perfil.rol === 'dueno' || perfil.rol === 'admin' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${v.nombre}`}
                      hitSlop={8}
                      onPress={() => router.push(`/inventario/granja/editor?id=${v.id}`)}
                      style={{ padding: espacio.m }}
                    >
                      <Pencil size={18} color={paleta.texto3} />
                    </Pressable>
                  ) : null}
                </View>
```

(Agrega `Pressable` al import de `react-native` si no está ya en la línea 2 del archivo.)

Al final del `return`, justo antes del cierre de `</View>` raíz (después del `</ScrollView>`), agrega:

```tsx
      <HojaVenderGranja
        visible={productoGranja != null}
        producto={productoGranja}
        onCerrar={() => setProductoGranja(null)}
        onAgregar={(cantidad, precio) => {
          if (!productoGranja) return
          dispatch({
            tipo: 'agregar',
            producto: {
              tipo: 'varios',
              id: productoGranja.id,
              titulo: productoGranja.nombre,
              detalle: `por ${productoGranja.unidad_medida}`,
              precio,
              stock: Number.POSITIVE_INFINITY,
              unidad: productoGranja.unidad_medida,
            },
          })
          for (let i = 1; i < cantidad; i++) {
            dispatch({ tipo: 'agregar', producto: {
              tipo: 'varios', id: productoGranja.id, titulo: productoGranja.nombre,
              detalle: `por ${productoGranja.unidad_medida}`, precio,
              stock: Number.POSITIVE_INFINITY, unidad: productoGranja.unidad_medida,
            } })
          }
          setProductoGranja(null)
          mostrar(`Agregado: ${productoGranja.nombre}`)
        }}
        onCompraRapida={(cantidad, precio) => {
          if (!productoGranja) return
          dispatch({ tipo: 'limpiar' })
          dispatch({
            tipo: 'agregar',
            producto: {
              tipo: 'varios',
              id: productoGranja.id,
              titulo: productoGranja.nombre,
              detalle: `por ${productoGranja.unidad_medida}`,
              precio,
              stock: Number.POSITIVE_INFINITY,
              unidad: productoGranja.unidad_medida,
            },
          })
          dispatch({ tipo: 'cambiarCantidad', id: productoGranja.id, cantidad })
          setProductoGranja(null)
          router.push('/ventas/nueva?modo=rapida')
        }}
      />
```

> Nota de implementación: `carritoReducer` (`lib/carrito.ts`) no tiene una acción para agregar directamente con una cantidad arbitraria — `'agregar'` siempre suma de a 1. El bucle `for` de arriba y el `dispatch({tipo:'cambiarCantidad', ...})` de compra rápida son la forma de llegar a la cantidad pedida sin tocar el reducer (fuera de alcance de este spec). Si al implementar esto se ve torpe, considera agregar una acción `'agregarConCantidad'` al reducer — evalúalo como mejora menor, no bloquea el resto del task.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Correr toda la suite**

Run: `npm test`
Expected: verde (no hay test dedicado de `productos.tsx` hoy; verificar que ningún otro test se rompió por los imports movidos).

- [ ] **Step 6: Commit**

```bash
git add components/ui/HojaVenderGranja.tsx components/ui/index.ts "app/(app)/(tabs)/productos.tsx"
git commit -m "$(cat <<'EOF'
feat(productos): Granja se vende desde Productos con hoja "Vender"

Antes tocar un ítem de Granja navegaba a su editor; ahora abre una hoja
con cantidad + precio libre (Granja no tiene precio guardado ni stock)
y los mismos dos botones que calzado (Agregar a carrito / Compra
rápida). La edición se mueve a un ícono de lápiz aparte (dueño/admin).
EOF
)"
```

---

### Task 12: `TabBar.tsx` — el FAB se convierte en ícono de carrito con badge

**Files:**
- Modify: `components/ui/TabBar.tsx`
- Modify: `components/ui/TabBar.test.tsx`

**Interfaces:**
- Consumes: `useCarrito()` (Task 11 ya lo usa en `productos.tsx`; aquí se usa de nuevo).

- [ ] **Step 1: Imports**

Busca:

```tsx
import { ArrowLeftRight, CircleUserRound, Footprints, LayoutGrid, Plus } from 'lucide-react-native'
import { useTema } from '../../lib/tema'
import { motion, radio, tipografia } from '../../lib/theme'
import { Presionable } from './Presionable'
```

Reemplázalo por:

```tsx
import { ArrowLeftRight, CircleUserRound, Footprints, LayoutGrid, ShoppingCart } from 'lucide-react-native'
import { useCarrito } from '../../lib/carrito-contexto'
import { useTema } from '../../lib/tema'
import { motion, radio, tipografia } from '../../lib/theme'
import { Presionable } from './Presionable'
```

- [ ] **Step 2: Badge + ícono**

Busca:

```tsx
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { paleta } = useTema()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const irA = (name: string, key: string, enfocado: boolean) => {
    const evento = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true })
    if (!enfocado && !evento.defaultPrevented) navigation.navigate(name)
  }

  const abrirNuevaVenta = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    router.push('/ventas/nueva')
  }
```

Reemplázalo por:

```tsx
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { paleta } = useTema()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { items } = useCarrito()
  const cantidadCarrito = items.reduce((s, i) => s + i.cantidad, 0)

  const irA = (name: string, key: string, enfocado: boolean) => {
    const evento = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true })
    if (!enfocado && !evento.defaultPrevented) navigation.navigate(name)
  }

  const abrirCarrito = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    router.push('/ventas/nueva')
  }
```

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
          }}
        >
          <LinearGradient
            colors={paleta.gradienteHero}
            style={{
              width: 60,
              height: 60,
              borderRadius: radio.full,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={28} color={paleta.sobrePrimario} strokeWidth={2.4} />
          </LinearGradient>
        </Presionable>
```

Reemplázalo por:

```tsx
        <Presionable
          escala={0.92}
          accessibilityRole="button"
          accessibilityLabel="Carrito"
          onPress={abrirCarrito}
          style={{
            marginTop: -24,
            width: 60,
            height: 60,
            borderRadius: radio.full,
          }}
        >
          <LinearGradient
            colors={paleta.gradienteHero}
            style={{
              width: 60,
              height: 60,
              borderRadius: radio.full,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingCart size={26} color={paleta.sobrePrimario} strokeWidth={2.2} />
          </LinearGradient>
          {cantidadCarrito > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 20,
                height: 20,
                borderRadius: radio.full,
                backgroundColor: paleta.peligro,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
                borderWidth: 2,
                borderColor: paleta.fondo,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                {cantidadCarrito > 9 ? '9+' : cantidadCarrito}
              </Text>
            </View>
          ) : null}
        </Presionable>
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Actualizar `TabBar.test.tsx`**

Busca:

```tsx
  it('el FAB va a Nueva Venta', async () => {
    const arbol = await montar(propsFalsas())
    const fab = arbol.root.findByProps({ accessibilityLabel: 'Nueva venta' })
    await act(async () => fab.props.onPress())
    expect(mockPush).toHaveBeenCalledWith('/ventas/nueva')
  })
})
```

Reemplázalo por:

```tsx
  it('el FAB (carrito) va a Nueva Venta', async () => {
    const arbol = await montar(propsFalsas())
    const fab = arbol.root.findByProps({ accessibilityLabel: 'Carrito' })
    await act(async () => fab.props.onPress())
    expect(mockPush).toHaveBeenCalledWith('/ventas/nueva')
  })

  it('el FAB muestra el badge con la cantidad de ítems del carrito', async () => {
    const arbol = await montarConCarrito(propsFalsas(), [
      { producto: { tipo: 'calzado', id: 'a', titulo: 'X', detalle: '', precio: 1, stock: 5 }, cantidad: 2, precio: 1, subtotal: 2 },
    ])
    expect(arbol.root.findAllByProps({ children: 2 }).length).toBeGreaterThan(0)
  })

  it('el FAB no muestra badge cuando el carrito está vacío', async () => {
    const arbol = await montar(propsFalsas())
    expect(arbol.root.findAllByProps({ children: '9+' }).length).toBe(0)
  })
})
```

Busca (la función `montar`, para agregar una variante que siembra el carrito):

```tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function montar(props: any) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <TabBar {...props} />
      </TemaProvider>
    )
  })
  return arbol
}
```

Reemplázalo por:

```tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function montar(props: any) {
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <CarritoProvider>
          <TabBar {...props} />
        </CarritoProvider>
      </TemaProvider>
    )
  })
  return arbol
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function montarConCarrito(props: any, items: import('../../lib/carrito').ItemCarrito[]) {
  function Sembrador({ children }: { children: React.ReactNode }) {
    const { dispatch } = require('../../lib/carrito-contexto').useCarrito()
    React.useEffect(() => {
      items.forEach((i) => dispatch({ tipo: 'agregar', producto: i.producto }))
    }, [])
    return <>{children}</>
  }
  let arbol!: ReturnType<typeof renderer.create>
  await act(async () => {
    arbol = renderer.create(
      <TemaProvider>
        <CarritoProvider>
          <Sembrador>
            <TabBar {...props} />
          </Sembrador>
        </CarritoProvider>
      </TemaProvider>
    )
  })
  return arbol
}
```

Agrega el import de `CarritoProvider` junto a los demás imports del archivo:

```tsx
import { TemaProvider } from '../../lib/tema'
import { CarritoProvider } from '../../lib/carrito-contexto'
import { TabBar } from './TabBar'
```

- [ ] **Step 5: Correr la suite de TabBar**

Run: `npm test -- TabBar`
Expected: PASS (todos los tests, incluidos los 3 nuevos/actualizados). Nota: el test de badge siembra 1 ítem con `cantidad: 2` vía `carritoReducer`, que suma de a 1 por cada `dispatch({tipo:'agregar'})` — si la cantidad final no calza con lo esperado por cómo funciona `linea()`/`carritoReducer`, ajusta el test para despachar `'agregar'` dos veces en vez de fijar `cantidad: 2` directamente en el objeto sembrado (el reducer ignora el campo `cantidad` del objeto inicial de todos modos, ya que solo usa `accion.producto`).

- [ ] **Step 6: Commit**

```bash
git add components/ui/TabBar.tsx components/ui/TabBar.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): el FAB central del menú es ahora el carrito, con badge

Reemplaza el ícono "+" (Nueva Venta) por un carrito con contador de
ítems. Mismo destino de navegación (/ventas/nueva), que ahora es la
pantalla de revisión del carrito.
EOF
)"
```

---

### Task 13: `HojaFiltrosProductos` — filtros de marca y precio

**Files:**
- Create: `components/ui/HojaFiltrosProductos.tsx`
- Modify: `components/ui/index.ts`
- Modify: `app/(app)/(tabs)/productos.tsx`

**Interfaces:**
- Produces: `HojaFiltrosProductos({ visible, marcas, marcasSeleccionadas, rangoPrecio, precioSeleccionado, onAplicar, onCerrar })`.

- [ ] **Step 1: Componente**

```tsx
// components/ui/HojaFiltrosProductos.tsx
import React, { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import { Boton } from './Boton'
import { Chip } from './Chip'
import { SliderPrecio } from './SliderPrecio'

interface Props {
  visible: boolean
  marcas: string[]
  marcasSeleccionadas: string[]
  precioMinAbsoluto: number
  precioMaxAbsoluto: number
  precioSeleccionado: [number, number]
  onAplicar: (marcas: string[], precio: [number, number]) => void
  onCerrar: () => void
}

export function HojaFiltrosProductos({
  visible, marcas, marcasSeleccionadas, precioMinAbsoluto, precioMaxAbsoluto,
  precioSeleccionado, onAplicar, onCerrar,
}: Props) {
  const { paleta } = useTema()
  const [marcasElegidas, setMarcasElegidas] = useState<string[]>(marcasSeleccionadas)
  const [precioMax, setPrecioMax] = useState<number>(precioSeleccionado[1])

  const toggleMarca = (m: string) => {
    setMarcasElegidas((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }} onPress={onCerrar}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: paleta.fondo,
            borderTopLeftRadius: radio.xl,
            borderTopRightRadius: radio.xl,
            padding: espacio.xxl,
            gap: espacio.l,
            maxHeight: '80%',
          }}
        >
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: radio.full, backgroundColor: paleta.bordeFuerte }} />
          <Text style={[tipografia.h2, { color: paleta.texto }]}>Filtros</Text>

          <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Marca</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espacio.s }}>
            {marcas.map((m) => (
              <Chip key={m} etiqueta={m} activo={marcasElegidas.includes(m)} onPress={() => toggleMarca(m)} />
            ))}
          </ScrollView>

          <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Precio máximo</Text>
          <SliderPrecio
            valor={precioMax}
            minimo={precioMinAbsoluto}
            maximo={precioMaxAbsoluto}
            onCambio={setPrecioMax}
          />

          <Boton titulo="Aplicar filtros" onPress={() => onAplicar(marcasElegidas, [precioMinAbsoluto, precioMax])} />
          <Boton
            titulo="Limpiar filtros"
            variante="fantasma"
            tamano="md"
            onPress={() => {
              setMarcasElegidas([])
              setPrecioMax(precioMaxAbsoluto)
              onAplicar([], [precioMinAbsoluto, precioMaxAbsoluto])
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}
```

- [ ] **Step 2: Exportar**

Agrega en `components/ui/index.ts`:

```ts
export { HojaFiltrosProductos } from './HojaFiltrosProductos'
```

- [ ] **Step 3: Integrar en `productos.tsx`**

Agrega el import:

```tsx
import { HojaFiltrosProductos } from '../../../components/ui'
```

(agrégalo a la lista de imports ya existente de `components/ui`, no como línea aparte duplicada).

Dentro de `Productos()`, agrega estado:

```tsx
  const [filtrosVisibles, setFiltrosVisibles] = useState(false)
  const [marcasFiltro, setMarcasFiltro] = useState<string[]>([])
  const [precioMaxFiltro, setPrecioMaxFiltro] = useState<number | null>(null)
```

Después de calcular `modelosVisibles` (que ya filtra por categoría + búsqueda), agrega el filtro de marca/precio:

```tsx
  const marcasDisponibles = [...new Set(modelos.map((m) => m.marca).filter((m): m is string => !!m))].sort()
  const precioMaxAbsoluto = modelos.length > 0 ? Math.max(...modelos.map((m) => m.precioMax)) : 0
  const modelosFiltrados = modelosVisibles.filter((m) => {
    const pasaMarca = marcasFiltro.length === 0 || (m.marca != null && marcasFiltro.includes(m.marca))
    const pasaPrecio = precioMaxFiltro == null || m.precioMin <= precioMaxFiltro
    return pasaMarca && pasaPrecio
  })
```

Usa `modelosFiltrados` en vez de `modelosVisibles` en el render de la lista (busca `modelosVisibles.length === 0` y `modelosVisibles.map` dentro del bloque `modo === 0 ? (...)` y cambia ambas referencias a `modelosFiltrados`).

Agrega el botón "Filtros" junto al buscador:

```tsx
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
          <Search size={18} color={paleta.texto3} />
          <View style={{ flex: 1 }}>
            <CampoTexto
              placeholder="Buscar por nombre, marca o ref…"
              value={busqueda}
              onChangeText={setBusqueda}
              autoCorrect={false}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtros"
            onPress={() => setFiltrosVisibles(true)}
            hitSlop={8}
            style={{ padding: espacio.s }}
          >
            <SlidersHorizontal size={20} color={marcasFiltro.length > 0 || precioMaxFiltro != null ? paleta.primario : paleta.texto3} />
          </Pressable>
        </View>
```

(agrega `SlidersHorizontal` al import de `lucide-react-native`, y `Pressable` al de `react-native` si no están).

Al final, junto al `<HojaVenderGranja .../>` del Task 11:

```tsx
      <HojaFiltrosProductos
        visible={filtrosVisibles}
        marcas={marcasDisponibles}
        marcasSeleccionadas={marcasFiltro}
        precioMinAbsoluto={0}
        precioMaxAbsoluto={precioMaxAbsoluto}
        precioSeleccionado={[0, precioMaxFiltro ?? precioMaxAbsoluto]}
        onAplicar={(marcas, [, max]) => {
          setMarcasFiltro(marcas)
          setPrecioMaxFiltro(max)
          setFiltrosVisibles(false)
        }}
        onCerrar={() => setFiltrosVisibles(false)}
      />
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Correr toda la suite**

Run: `npm test`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add components/ui/HojaFiltrosProductos.tsx components/ui/index.ts "app/(app)/(tabs)/productos.tsx"
git commit -m "$(cat <<'EOF'
feat(productos): filtros de marca y precio máximo

Se suman al buscador y los chips de categoría existentes, sin tocar
lib/inventario.ts — el filtrado es en memoria sobre lo ya cargado.
EOF
)"
```

---

### Task 14: Productos descontinuados — toggle activo/inactivo + "ver descontinuados"

**Files:**
- Modify: `app/(app)/inventario/calzado/editor.tsx`
- Modify: `app/(app)/(tabs)/productos.tsx`

**Interfaces:**
- Consumes: `agruparPorReferencia(filas, {incluirInactivos})` (Task 8), `guardarCalzado({..., activo})` (ya acepta `activo`, sin cambios).

- [ ] **Step 1: Switch "Producto activo" en el editor (solo al editar, no al crear)**

Busca en `app/(app)/inventario/calzado/editor.tsx`:

```tsx
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
```

Reemplázalo por:

```tsx
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [activo, setActivo] = useState(true)
```

Busca:

```tsx
        setStockActual(data.stock_actual?.toString() || '')
        setStockMinimo(data.stock_minimo?.toString() || '')
        setFotoUrl(data.foto_url || null)
```

Reemplázalo por:

```tsx
        setStockActual(data.stock_actual?.toString() || '')
        setStockMinimo(data.stock_minimo?.toString() || '')
        setFotoUrl(data.foto_url || null)
        setActivo(data.activo ?? true)
```

Busca:

```tsx
      await guardarCalzado({
        id: id || undefined,
        categoria,
        descripcion,
        marca: marca || null,
        referencia: referencia || null,
        talla: talla || null,
        color: color || null,
        precio_minimo: parseFloat(precioMinimo),
        precio_maximo: parseFloat(precioMaximo),
        costo_compra: costoCompra ? parseFloat(costoCompra) : null,
        stock_actual: parseInt(stockActual, 10),
        stock_minimo: parseInt(stockMinimo, 10),
        foto_url: fotoUrl || null,
      })
```

Reemplázalo por:

```tsx
      await guardarCalzado({
        id: id || undefined,
        categoria,
        descripcion,
        marca: marca || null,
        referencia: referencia || null,
        talla: talla || null,
        color: color || null,
        precio_minimo: parseFloat(precioMinimo),
        precio_maximo: parseFloat(precioMaximo),
        costo_compra: costoCompra ? parseFloat(costoCompra) : null,
        stock_actual: parseInt(stockActual, 10),
        stock_minimo: parseInt(stockMinimo, 10),
        foto_url: fotoUrl || null,
        activo,
      })
```

Busca (agrega el Switch en la tarjeta "Inventario", solo si `id` existe — no tiene sentido desactivar algo que aún no se ha creado):

```tsx
        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Inventario</Text>
          <View style={{ flexDirection: 'row', gap: espacio.m, marginTop: espacio.m }}>
```

Reemplázalo por:

```tsx
        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Inventario</Text>
          {id ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: espacio.m, marginBottom: espacio.m }}>
              <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>Producto activo</Text>
              <Switch
                value={activo}
                onValueChange={setActivo}
                trackColor={{ false: paleta.borde, true: paleta.primarioSoft }}
                thumbColor={activo ? paleta.primario : paleta.superficie}
              />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: espacio.m, marginTop: espacio.m }}>
```

Agrega `Switch` al import de `react-native`:

```tsx
import { View, Text, ScrollView, Image, ActivityIndicator, Alert, Switch } from 'react-native'
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Toggle "ver descontinuados" en Productos**

Busca en `app/(app)/(tabs)/productos.tsx`:

```tsx
  const cargar = useCallback(async () => {
    if (!perfil) return
    try {
      if (modo === 0) setModelos(agruparPorReferencia(await listarCalzado()))
      else setVarios((await listarVarios()).filter((v) => v.activo))
    } catch {
      // estado vacío + pull-to-refresh para reintentar
    } finally {
      setCargando(false)
    }
  }, [perfil, modo])
```

Reemplázalo por:

```tsx
  const [verDescontinuados, setVerDescontinuados] = useState(false)

  const cargar = useCallback(async () => {
    if (!perfil) return
    try {
      if (modo === 0) setModelos(agruparPorReferencia(await listarCalzado(), { incluirInactivos: true }))
      else setVarios((await listarVarios()).filter((v) => v.activo))
    } catch {
      // estado vacío + pull-to-refresh para reintentar
    } finally {
      setCargando(false)
    }
  }, [perfil, modo])
```

Ajusta `modelosVisibles` para respetar el toggle (filtra por `activo` antes de aplicar categoría/búsqueda):

```tsx
  const modelosVisibles = filtrarModelos(
    categoria === 'Todas' ? modelos : modelos.filter((m) => m.categoria === categoria),
    busqueda
  )
```

por:

```tsx
  const modelosBase = verDescontinuados ? modelos : modelos.filter((m) => m.activo)
  const modelosVisibles = filtrarModelos(
    categoria === 'Todas' ? modelosBase : modelosBase.filter((m) => m.categoria === categoria),
    busqueda
  )
```

Agrega el chip de toggle junto a los chips de categoría (dentro del `ScrollView horizontal` de `CHIPS_CATEGORIA`, después del `.map`):

```tsx
            <Chip
              etiqueta="Ver descontinuados"
              activo={verDescontinuados}
              onPress={() => setVerDescontinuados((v) => !v)}
            />
```

En `CardModelo`, atenúa y deshabilita la venta cuando el modelo no está activo (reutiliza el mismo patrón visual que `agotado`):

Busca:

```tsx
      {modelo.agotado ? (
        <Badge texto="AGOTADO" tipo="peligro" />
      ) : (
        <Text style={[tipografia.etiqueta, tabular, { color: paleta.primario }]}>{rango}</Text>
      )}
```

Reemplázalo por:

```tsx
      {!modelo.activo ? (
        <Badge texto="DESCONTINUADO" tipo="neutro" />
      ) : modelo.agotado ? (
        <Badge texto="AGOTADO" tipo="peligro" />
      ) : (
        <Text style={[tipografia.etiqueta, tabular, { color: paleta.primario }]}>{rango}</Text>
      )}
```

(El detalle de producto ya deshabilita "Agregar al carrito"/"Compra rápida" cuando `stock_actual <= 0`; una variante inactiva normalmente también tendrá que revisarse ahí — como mejora natural del mismo cambio, en `productos/[ref].tsx` cambia la condición `deshabilitado={!variante || Number(variante.stock_actual) <= 0}` de ambos botones a `deshabilitado={!variante || Number(variante.stock_actual) <= 0 || !variante.activo}`.)

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Correr toda la suite**

Run: `npm test`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/inventario/calzado/editor.tsx" "app/(app)/(tabs)/productos.tsx" "app/(app)/productos/[ref].tsx"
git commit -m "$(cat <<'EOF'
feat(productos): productos descontinuados — toggle activo + "ver descontinuados"

El switch vive en el editor (solo al editar, no al crear). Productos
oculta los descontinuados por defecto; el chip "Ver descontinuados"
los muestra con badge, sin poder venderse.
EOF
)"
```

---

## Self-Review

**Cobertura del spec:** §4.1→Task 1, §4.2→Task 2, §4.3→Tasks 3-4, §4.4→Task 5, §4.5→Task 10 (Step 6, `paddingInferior` en la barra de Cobrar). §5.1→Task 6, §5.2→Task 7, §5.3→Task 10, §5.4→Task 10, §5.5→Task 10, §5.6→Tasks 9 y 11, §5.7→Task 12, §5.8→Task 13, §5.9→Tasks 8 y 14.

**Desviación del spec:** el spec no detallaba cómo `HojaVenderGranja`/compra rápida de Granja llegan a una cantidad >1 dado que `carritoReducer` solo suma de a 1 por `dispatch`. El Task 11 lo resuelve con un bucle de dispatches (documentado inline como posible mejora futura, no bloqueante).

**Placeholders:** ninguno.

**Consistencia de tipos:** `ModeloCalzado.activo` (Task 8) se consume igual en Task 14 (`modelo.activo`, `modelosBase`). `agruparPorReferencia(filas, {incluirInactivos})` mantiene la misma firma en sus 2 call sites (`productos.tsx` con `incluirInactivos:true`, `productos/[ref].tsx` sin cambios — sigue llamándolo sin opciones, comportamiento por defecto). `SliderPrecio` se usa con la misma interfaz en Tasks 7, 10 (dos lugares) y 13.
