# Venus — Product Requirements Document v2.0
## App de gestión para tienda de calzado familiar
### Junio 2026

> **Documento fuente de verdad del producto Venus.**
> Venus es una aplicación móvil Android para gestionar la tienda de calzado
> familiar "Venus" en Florencia, Caquetá. No es Aveia ni un módulo de Aveia.
> Es un sistema independiente, simple y poderoso para un negocio familiar real.
>
> **Cambios v2.0 vs v1.0:**
> - Módulo 8: Gastos fijos (alquiler, servicios, alertas, comprobantes)
> - Módulo 9: Gastos variables e imprevistos
> - Módulo 10: Balance real del negocio (ingresos vs gastos)
> - Fotos de productos en inventario (cámara + galería, opcional)
> - Pagos mixtos en una sola venta (efectivo + Nequi simultáneo)
> - Sección de infraestructura: costos cero + backup automático local

---

## 1. VISIÓN Y PROPÓSITO

### Qué es Venus en una sola oración
Venus es una app Android que reemplaza el cuaderno de Don Carlos, permitiéndole
ver en tiempo real desde cualquier parte del país qué se vendió, cuánto entró,
qué hay en inventario y qué necesita pedir antes de la próxima temporada.

### El problema que resuelve

Don Carlos es dueño de la tienda de calzado Venus en Florencia, Caquetá.
Su negocio tiene tres heridas abiertas:

1. **El cuaderno no escala.** Andrés, el empleado, anota cada venta a mano:
   referencia, talla, color, precio y método de pago. Al final del día suma
   todo manualmente. Los errores son frecuentes, las tachaduras confunden,
   y si se moja o se pierde el cuaderno, se pierde el historial del negocio.

2. **Don Carlos no sabe qué pasa cuando viaja.** Cuando está en Bogotá o
   Medellín comprando mercancía, no tiene forma de saber cuánto vendió Andrés
   ese día, si algún producto se agotó, o si hubo algún problema en la caja.
   Depende de llamadas telefónicas y de confiar en la memoria de su empleado.

3. **Las temporadas lo agarran mal parado.** Don Carlos sabe por experiencia
   que en enero (regreso a clases) y en diciembre (fiestas) las ventas
   se disparan. Pero no tiene datos exactos de qué tallas y colores se agotaron
   primero el año pasado, así que compra mercancía basándose en intuición y
   frecuentemente le sobra de unas referencias y le falta de otras.

Venus resuelve las tres: reemplaza el cuaderno con un registro digital simple,
le da visibilidad remota a Don Carlos en tiempo real, y usa los datos históricos
para ayudarle a comprar mejor antes de cada temporada.

### A quién va dirigido

**Usuario primario — Andrés (empleado, 25 años):**
Siempre está en el local. Registra ventas y entradas de mercancía. No es
técnico pero sabe usar WhatsApp y redes sociales. Necesita que la app sea
tan fácil como sacar la calculadora.

**Usuario secundario — Don Carlos (dueño, 52 años):**
Viaja frecuentemente. Necesita ver todo desde su celular en cualquier momento.
No le gusta lo complicado. Si algo tiene más de tres pasos, no lo va a usar.

### Qué NO es Venus

- No es un software de facturación electrónica DIAN.
- No es una tienda en línea ni vende por WhatsApp.
- No lleva contabilidad formal ni declaraciones de impuestos.
- No es un sistema de nómina electrónica.
- No gestiona múltiples sucursales.
- No registra clientes de forma habitual.

### El negocio sin Venus vs con Venus

| Dimensión | Sin Venus | Con Venus |
|---|---|---|
| Registro de ventas | Cuaderno manual, errores frecuentes | App en 10 segundos por venta |
| Visibilidad del dueño | Llamada telefónica a Andrés | Dashboard en tiempo real desde cualquier ciudad |
| Inventario | Se entera cuando ya no hay | Alerta cuando queda poco |
| Compras de temporada | Intuición y memoria | Recomendación basada en datos del año anterior |
| Pago del empleado | Suma manual del cuaderno | Cálculo automático de días trabajados |
| Control de proveedores | Facturas en papel que se pierden | Registro digital de deudas y pagos |

---

## 2. USUARIOS Y ROLES

### Rol: Dueño — Don Carlos

**Dispositivo:** Celular Android personal (el que ya tiene).

**Qué puede hacer:**
- Todo lo que puede hacer Andrés más:
- Ver reportes financieros: ventas del día, semana y mes
- Ver desglose de ingresos por método de pago
- Ver margen aproximado por producto si registra el costo de compra
- Acceder al análisis de temporadas con recomendaciones de compra
- Ver y registrar el pago del sueldo de Andrés
- Configurar el sueldo fijo del empleado
- Agregar, editar o eliminar productos del catálogo
- Agregar, editar o eliminar proveedores
- Ver el historial completo de ventas con capacidad de corrección
- Configurar los niveles de stock mínimo por producto

**Pantalla principal del dueño:**
- Ventas de hoy (total y número de transacciones)
- Desglose hoy: efectivo / Nequi / Daviplata
- Comparación con ayer y con el mismo día la semana pasada
- Productos con stock bajo (alerta roja)
- Lo que se le debe a proveedores (resumen)
- Acceso rápido a reportes y análisis de IA

---

### Rol: Empleado — Andrés

**Dispositivo:** Celular Android del negocio o el suyo propio.

**Qué puede hacer:**
- Registrar ventas (zapatos y productos varios)
- Consultar el inventario disponible antes de decirle al cliente si hay o no
- Registrar entrada de mercancía cuando llega un proveedor
- Ver el resumen de ventas del día actual (solo el día en curso)
- Ejecutar el cierre de caja al final del día

**Pantalla principal de Andrés:**
- Botón grande: **"Nueva venta"**
- Botón: **"Consultar inventario"**
- Botón: **"Llegó mercancía"**
- Resumen simple: ventas de hoy (número de ventas y total)
- Botón: **"Cerrar caja"** (aparece después de las 5 PM)

**Qué NO puede ver ni hacer Andrés:**
- Reportes financieros de semanas o meses anteriores
- Márgenes de ganancia ni costos de compra
- Información del sueldo ni pagos al empleado
- Eliminar o editar productos del catálogo
- Ver lo que se le debe a proveedores
- Acceder al análisis de temporadas de IA
- Corregir ventas de días anteriores (solo Don Carlos puede)

---

## 3. MÓDULOS DEL SISTEMA

---

### Módulo 1: Registro de Ventas

**Qué hace:** Permite registrar cada transacción de venta de forma rápida
desde el celular, actualizando el inventario automáticamente.

**Quién lo usa:** Andrés principalmente, Don Carlos cuando está en el local.

---

#### Flujo de venta de zapatos

1. Andrés toca **"Nueva venta"**
2. Aparece un buscador. Andrés escribe la referencia, el color o la talla.
   Ejemplo: escribe "Nike 40 negro" y aparecen las opciones disponibles.
3. Selecciona el producto. El sistema muestra: referencia, color, talla,
   precio de venta y stock disponible.
4. Confirma la cantidad (casi siempre 1 par, pero puede ser más).
5. Si el cliente lleva varios productos, toca **"Agregar otro"** y repite.
6. Toca **"Cobrar"**. Aparece el total.
7. Selecciona método de pago: **Efectivo / Nequi / Daviplata**
8. Si es efectivo, ingresa cuánto dio el cliente y el sistema calcula el cambio.
9. Toca **"Confirmar venta"**. El inventario se descuenta automáticamente.
10. Aparece confirmación: "✓ Venta registrada"

**Regla crítica:** Una venta confirmada no se puede eliminar. Si Andrés
se equivocó, debe notificarle a Don Carlos, quien puede hacer la corrección
desde su acceso de dueño con una nota explicativa.

---

#### Flujo de venta de productos varios (huevos, limón, café)

1. Andrés toca **"Nueva venta"**
2. Busca el producto. Ejemplo: "huevos"
3. El sistema muestra: Huevos por panel — $16.000 COP/panel
4. Andrés ingresa la cantidad. Ejemplo: 2 paneles.
5. Para limón y café (se venden por libra): el sistema muestra el precio
   por libra y Andrés ingresa la cantidad. Ejemplo: 0.5 libras de café.
6. El sistema calcula el total automáticamente.
7. Selecciona método de pago y confirma.

**Nota:** Los productos varios (huevos, limón, café) no tienen talla ni
color. Solo tienen nombre, unidad de medida, precio y stock.

---

#### Corrección de ventas

Solo Don Carlos puede corregir ventas. El flujo es:
1. Don Carlos busca la venta en el historial (por fecha o por producto)
2. Toca la venta y selecciona **"Corregir"**
3. Ingresa el motivo de la corrección (texto libre)
4. Modifica lo que sea necesario
5. La venta original queda en el historial con una nota de corrección.
   No se borra, se marca como corregida.

---

### Módulo 2: Inventario

**Qué hace:** Mantiene el control exacto de qué hay disponible en la tienda,
organizado por talla, color y referencia para zapatos, y por unidad para
productos varios.

**Quién lo usa:** Ambos para consultar. Solo Don Carlos para configurar.

---

#### Estructura del inventario de zapatos

Cada producto de calzado tiene:
- **Referencia del proveedor** (ej: NK-2024-BLK)
- **Descripción** (ej: Tenis Nike Air Force)
- **Foto del producto** (opcional — Don Carlos puede tomar foto con la cámara
  o subir desde la galería del celular. Se guarda en Supabase Storage.
  Se recomienda comprimir a máximo 500KB antes de subir para no agotar
  el límite gratuito de 1GB)
- **Proveedor** (ej: Distribuidora Calzado Bogotá)
- **Talla** (ej: 36, 37, 38, 39, 40, 41, 42)
- **Color** (ej: Negro, Blanco, Café, Azul)
- **Precio de venta** (ej: $120.000 COP)
- **Costo de compra** (opcional, solo visible para Don Carlos)
- **Stock actual** (ej: 3 pares)
- **Stock mínimo** (ej: 1 par — cuando baja de aquí, alerta)

La foto es completamente opcional. Si no hay foto, el sistema muestra
un ícono genérico del producto. La foto ayuda a Andrés a identificar
rápidamente el producto en pantalla sin leer la referencia.

Un mismo modelo de zapato puede tener múltiples filas según talla y color.
Ejemplo:
- NK-2024-BLK | Tenis Nike | Talla 38 | Negro | 2 pares
- NK-2024-BLK | Tenis Nike | Talla 39 | Negro | 1 par
- NK-2024-BLK | Tenis Nike | Talla 38 | Blanco | 0 pares ← AGOTADO

Cuando el stock llega a cero, el producto aparece como **AGOTADO** y
no se puede registrar una venta de ese artículo.

---

#### Estructura del inventario de productos varios

Cada producto tiene:
- **Nombre** (ej: Huevos)
- **Unidad** (ej: Panel)
- **Precio de venta** (ej: $16.000 COP/panel)
- **Stock actual** (ej: 8 paneles)
- **Stock mínimo** (ej: 2 paneles)

---

#### Alertas de stock mínimo

Cuando el stock de cualquier producto baja del mínimo configurado:
- En el celular de Don Carlos: notificación push + ícono rojo en dashboard
- En el celular de Andrés: ícono amarillo en el producto al buscarlo

---

### Módulo 3: Proveedores

**Qué hace:** Registra los proveedores de Venus, las compras que se les
hacen y lo que se les debe.

**Quién lo usa:** Don Carlos principalmente. Andrés puede registrar
la llegada de mercancía pero no ve las deudas.

---

#### Datos de cada proveedor

- Nombre del proveedor o empresa
- Teléfono de contacto
- Ciudad (Bogotá, Medellín, Bucaramanga, etc.)
- Tipo de productos que suministra (zapatos, huevos, café, etc.)
- Notas (texto libre para observaciones importantes)

---

#### Registro de compra a proveedor

Cuando Don Carlos compra mercancía:
1. Selecciona el proveedor
2. Registra cada producto comprado: referencia, talla, color, cantidad,
   precio de costo por unidad
3. El sistema calcula el total de la compra
4. Don Carlos indica si pagó de contado o a crédito
5. Si es a crédito: registra cuánto debe y la fecha acordada de pago
6. El inventario se actualiza automáticamente con la mercancía recibida

---

#### Llegada de mercancía (flujo de Andrés)

Cuando Andrés recibe mercancía en el local sin que Don Carlos esté:
1. Andrés toca **"Llegó mercancía"**
2. Selecciona el proveedor
3. Registra cada producto que llegó (referencia, talla, color, cantidad)
4. Toca **"Confirmar recepción"**
5. Don Carlos recibe una notificación: "Andrés registró mercancía de
   [Proveedor] — X referencias"
6. Don Carlos revisa y completa los datos financieros (costos, pago/crédito)

---

#### Control de deudas con proveedores

Don Carlos ve:
- Lista de proveedores con deuda pendiente
- Cuánto debe a cada uno
- Fecha de vencimiento del pago
- Historial de pagos realizados

Cuando paga, registra el pago y la deuda se actualiza.

---

### Módulo 4: Cierre de Caja Diario

**Qué hace:** Resume lo que pasó en el día, desglosa por método de pago,
y le da a Don Carlos la información para tomar decisiones.

**Quién lo inicia:** Andrés al final de su turno.

---

#### Flujo del cierre de caja

1. Andrés toca **"Cerrar caja"**
2. El sistema muestra el resumen del día:
   - Número total de ventas
   - Total en efectivo cobrado
   - Total en Nequi cobrado
   - Total en Daviplata cobrado
   - **Total general del día**
   - Lista de todas las ventas del día (producto, cantidad, precio, método)
3. Andrés cuenta el efectivo físico en caja e ingresa el monto
4. El sistema compara: efectivo en caja vs efectivo registrado en ventas
5. Si hay diferencia (sobrante o faltante), queda registrada con una nota
6. Andrés toca **"Confirmar cierre"**
7. Don Carlos recibe notificación con el resumen del día

---

#### Lo que ve Don Carlos en el cierre

- Resumen del día con desglose por método de pago
- Si hubo diferencia en efectivo y por cuánto
- Comparación automática: hoy vs ayer, hoy vs mismo día semana pasada
- Ventas del día organizadas por hora (para ver en qué momento hay más tráfico)

---

### Módulo 5: Gestión del Empleado

**Qué hace:** Lleva el control simple del sueldo de Andrés, los días
que trabaja y el historial de pagos.

**Quién lo usa:** Solo Don Carlos.

---

#### Configuración del empleado

Don Carlos registra una sola vez:
- Nombre del empleado: Andrés
- Sueldo mensual fijo: [monto en COP]
- Fecha de inicio: [fecha]
- Días de trabajo por semana: [los que sean acordados]

---

#### Control de días trabajados

Cada día que Andrés abre la app y registra al menos una venta o cierre de
caja, el sistema cuenta ese día como trabajado automáticamente.

Don Carlos puede marcar manualmente días de ausencia o días adicionales
trabajados si hubo alguna situación especial.

---

#### Cálculo del pago

El sistema calcula automáticamente:
- Días trabajados en el período
- Valor diario (sueldo mensual ÷ 30)
- Total a pagar por el período

Don Carlos ve esto en cualquier momento desde su dashboard.

---

#### Registro del pago

Cuando Don Carlos le paga a Andrés:
1. Toca **"Registrar pago a Andrés"**
2. El sistema muestra el monto calculado como sugerencia
3. Don Carlos puede ajustar si hay algún acuerdo diferente
4. Confirma el pago con la fecha
5. Queda en el historial: fecha, monto pagado, período correspondiente

---

#### Historial de pagos

Don Carlos ve una lista cronológica de todos los pagos realizados a Andrés,
con fecha, monto y período cubierto.

---

### Módulo 6: Reportes y Dashboard del Dueño

**Qué hace:** Le da a Don Carlos una visión clara del negocio en cualquier
momento, desde cualquier lugar.

**Quién lo usa:** Solo Don Carlos.

---

#### Dashboard principal

Al abrir la app, Don Carlos ve:

**Hoy:**
- Total vendido hoy
- Número de ventas hoy
- Desglose: efectivo / Nequi / Daviplata
- Comparación con ayer (flecha arriba o abajo con porcentaje)

**Alertas:**
- Productos con stock bajo (lista con ícono rojo)
- Proveedores con pago próximo a vencer
- Si Andrés no ha registrado ventas hoy (posible problema)

**Accesos rápidos:**
- Ver reporte semanal
- Ver reporte mensual
- Análisis de temporadas
- Inventario completo

---

#### Reporte semanal

- Total vendido en los últimos 7 días
- Día con más ventas
- Producto más vendido de la semana
- Comparación con la semana anterior

---

#### Reporte mensual

- Total vendido en el mes
- Desglose por método de pago del mes
- Los 10 productos más vendidos del mes
- Los productos sin movimiento en el mes
- Comparación con el mes anterior
- Proyección del mes basada en el promedio diario actual

---

#### Inventario completo

- Lista de todos los productos con su stock actual
- Filtros: por proveedor, por categoría (zapatos / productos varios),
  por estado (disponible / stock bajo / agotado)
- Valor total del inventario (si Don Carlos registró los costos)

---

### Módulo 7: Análisis de Temporadas con IA

**Qué hace:** Analiza el historial de ventas para ayudarle a Don Carlos
a comprar mejor antes de cada temporada, basándose en datos reales del
negocio, no en intuición.

**Quién lo usa:** Solo Don Carlos.

---

#### Cómo funciona

La IA de Venus no es magia. Es análisis de los datos que el mismo negocio
ha generado. Necesita al menos 3 meses de historial para dar recomendaciones
útiles. Antes de eso, muestra los datos disponibles sin hacer proyecciones.

---

#### Temporadas definidas en Venus

El sistema viene con temporadas predefinidas para Colombia:
- **Regreso a clases (enero):** 2 semanas antes y durante enero
- **Semana Santa:** semana previa y semana de pascua
- **Mitad de año (junio-julio):** vacaciones escolares
- **Halloween/Noviembre:** octubre último semana y noviembre
- **Fin de año/Navidad:** diciembre completo

Don Carlos puede agregar temporadas personalizadas (ej: "Feria de Florencia").

---

#### Lo que muestra la IA

**Vista de una temporada pasada:**
- Cuánto se vendió en esa temporada vs el mes anterior
- Qué tallas se agotaron primero
- Qué colores rotaron más
- Qué productos sobraron al final de la temporada
- En qué días exactos fue el pico de ventas

**Recomendación de compra antes de una temporada:**
- "Para el regreso a clases de enero, según el año pasado te recomiendo
  pedir al menos: 5 pares talla 36 negro, 8 pares talla 37 blanco..."
- La recomendación se basa en lo que se agotó + un porcentaje de
  margen de seguridad que Don Carlos puede ajustar

**Productos lentos:**
- Lista de productos que llevan más de 45 días sin venderse
- Cuántas unidades hay en stock de esos productos
- Cuánto dinero tiene "congelado" en esa mercancía

**Proyección simple:**
- Si el mes lleva 15 días y se han vendido X, el sistema proyecta
  el total del mes asumiendo el mismo ritmo
- Se muestra como rango (mínimo / probable / máximo) no como número exacto

---

#### Lenguaje de la IA

Todo en español colombiano simple. Sin términos técnicos. Ejemplo:

✅ "Don Carlos, el año pasado en enero se le acabaron las tallas 37 y 38
en los primeros 5 días. Le recomiendo pedir el doble de esas tallas
esta vez."

❌ "El análisis predictivo de series temporales indica una desviación
estándar de 2.3 en la demanda del SKU referenciado."

---

## 4. FLUJOS PRINCIPALES

---

### Flujo 1: Andrés registra una venta de zapatos

**Escenario:** Cliente compra un par de tenis Nike talla 39 negros a
$120.000 COP. Paga con Nequi.

1. Andrés abre Venus en su celular.
2. Toca el botón grande **"Nueva venta"**.
3. En el buscador escribe "Nike 39".
4. Aparece: "Tenis Nike Air Force — Talla 39 — Negro — Stock: 2 pares — $120.000"
5. Toca el producto para seleccionarlo.
6. La cantidad es 1 (por defecto). No cambia nada.
7. Toca **"Cobrar"**. Aparece: Total: $120.000 COP
8. Toca **"Nequi"**.
9. Aparece confirmación: "¿Confirmar venta por $120.000 via Nequi?"
10. Toca **"Sí, confirmar"**.
11. Pantalla verde: **"✓ Venta registrada"**. El stock de ese par baja a 1.

**Sin internet:** El flujo es exactamente igual. La venta se guarda
localmente y se sincroniza cuando vuelve el internet. Andrés no nota
ninguna diferencia.

---

### Flujo 2: Andrés registra una venta de huevos

**Escenario:** Cliente compra 2 paneles de huevos. Paga en efectivo con $40.000.

1. Andrés toca **"Nueva venta"**.
2. Escribe "huevos".
3. Aparece: "Huevos — Por panel — $16.000 COP"
4. Cambia la cantidad a 2.
5. El sistema muestra: Total: $32.000 COP
6. Toca **"Cobrar"** → selecciona **"Efectivo"**
7. Ingresa $40.000 (lo que dio el cliente).
8. El sistema muestra: **"Cambio: $8.000"**
9. Confirma la venta.

---

### Flujo 3: Llegada de mercancía de un proveedor

**Escenario:** Llega el proveedor "Calzado Medellín SAS" con 20 pares
de zapatos nuevos. Don Carlos no está en el local.

1. Andrés toca **"Llegó mercancía"**.
2. Selecciona el proveedor: "Calzado Medellín SAS"
3. Toca **"Agregar producto"**
4. Para cada referencia que llegó, ingresa:
   - Referencia: CM-2026-001
   - Descripción: Baleta dama
   - Talla: 36
   - Color: Rosado
   - Cantidad: 4 pares
5. Repite para cada referencia diferente.
6. Al terminar, toca **"Confirmar recepción"**.
7. Don Carlos recibe notificación: "📦 Andrés registró mercancía de
   Calzado Medellín SAS — 6 referencias — 20 pares"
8. Don Carlos entra a la app, revisa la entrada y completa:
   - Precio de costo por par de cada referencia
   - Si pagó de contado o quedó a crédito

---

### Flujo 4: Cierre del día

**Escenario:** Son las 7 PM. Andrés va a cerrar la tienda.

1. Andrés toca **"Cerrar caja"**.
2. El sistema muestra el resumen del día:
   - 8 ventas registradas
   - Efectivo: $340.000
   - Nequi: $120.000
   - Daviplata: $0
   - **Total: $460.000**
3. El sistema pregunta: "¿Cuánto efectivo hay físicamente en caja?"
4. Andrés cuenta: $340.000. Lo ingresa.
5. Sistema: **"✓ Cuadra perfectamente"**
   (Si hubiera diferencia: "⚠ Hay una diferencia de $5.000. ¿Qué pasó?")
6. Andrés toca **"Confirmar cierre"**.
7. Don Carlos recibe notificación:
   "📊 Cierre Venus — Hoy: $460.000 (↑12% vs ayer) — Caja: ✓ Cuadra"

---

### Flujo 5: Don Carlos consulta análisis de temporada

**Escenario:** Es noviembre. Don Carlos va a viajar a Bogotá a comprar
mercancía para diciembre.

1. Don Carlos abre Venus desde su celular en el bus.
2. Toca **"Análisis de temporadas"**.
3. Selecciona **"Navidad / Diciembre"**.
4. Ve el reporte del diciembre anterior:
   - Se vendieron 87 pares en diciembre vs 34 en noviembre
   - Tallas más vendidas: 37, 38, 36 (en ese orden)
   - Colores más vendidos: negro, blanco, dorado
   - Se agotó primero: talla 37 negro (día 8 de diciembre)
   - Sobraron: tallas 42 y 43 en todos los colores
5. Ve la recomendación:
   "Para este diciembre le recomiendo pedir:
   Talla 36: mínimo 8 pares
   Talla 37: mínimo 12 pares (se agotó rápido el año pasado)
   Talla 38: mínimo 10 pares
   Talla 39-41: 5 pares cada una
   Talla 42-43: no más de 2 pares (rotan poco)"
6. Don Carlos toca **"Compartir"** y se manda el reporte a sí mismo
   por WhatsApp para tenerlo a mano cuando llegue donde el proveedor.

---

### Flujo 6: Don Carlos registra el pago del sueldo de Andrés

**Escenario:** Fin de mes. Don Carlos le va a pagar a Andrés.

1. Don Carlos toca **"Empleado"** en su menú.
2. Ve: "Andrés — 26 días trabajados este mes — Le corresponde: $XXX.XXX COP"
3. Toca **"Registrar pago"**.
4. El sistema sugiere el monto calculado.
5. Don Carlos confirma o ajusta el monto.
6. Toca **"Confirmar pago"**.
7. Queda en el historial: "Pago a Andrés — 30 noviembre 2026 — $XXX.XXX COP"

---

## 5. DISEÑO Y EXPERIENCIA DE USUARIO

### Principios de diseño para Venus

**Simple sobre completo:** Si algo requiere más de 3 toques para hacerse,
hay que rediseñarlo. El empleado en el mostrador no puede estar mirando
el celular mientras atiende al cliente.

**Grande y legible:** Botones grandes, texto grande. Don Carlos tiene 52 años
y usa el celular sin gafas.

**Español colombiano:** Sin anglicismos. No "dashboard", sino "resumen".
No "checkout", sino "cobrar". No "sync", sino "guardando..."

**Errores claros:** Si algo sale mal, el mensaje dice exactamente qué pasó
y qué hacer. No mensajes genéricos de "Error desconocido".

---

### Pantalla de ventas de Andrés

```
┌─────────────────────────────┐
│  🏪 Venus          [menú]   │
│  Hoy: 5 ventas — $230.000   │
│─────────────────────────────│
│                             │
│    ┌─────────────────┐      │
│    │  + Nueva venta  │      │
│    └─────────────────┘      │
│                             │
│  ┌──────────────────────┐   │
│  │ 🔍 Buscar producto   │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │  📦 Llegó mercancía  │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │  🔒 Cerrar caja      │   │
│  └──────────────────────┘   │
└─────────────────────────────┘
```

---

### Dashboard de Don Carlos

```
┌─────────────────────────────┐
│  🏪 Venus — Hoy             │
│─────────────────────────────│
│  $460.000                   │
│  8 ventas  ↑12% vs ayer     │
│─────────────────────────────│
│  💵 Efectivo    $340.000    │
│  📱 Nequi       $120.000    │
│  📱 Daviplata       $0      │
│─────────────────────────────│
│  ⚠️ Stock bajo              │
│  · Tenis Nike 37 Negro: 1   │
│  · Huevos: 1 panel          │
│─────────────────────────────│
│  [Reportes] [Análisis IA]   │
│  [Inventario] [Empleado]    │
└─────────────────────────────┘
```

---

## 6. ARQUITECTURA TÉCNICA

### Stack tecnológico

| Tecnología | Para qué | Por qué |
|---|---|---|
| React Native / Expo | App Android | Un solo código para ambos usuarios, fácil de actualizar |
| Supabase | Base de datos en la nube | Tiempo real, seguro, económico |
| SQLite / op-sqlite | Base de datos local | Funciona sin internet |
| PowerSync | Sincronización offline | Mantiene local y nube en sinronía |
| Supabase Auth | Autenticación | Dos usuarios con roles diferentes |
| OpenAI / Gemini API | Análisis de temporadas IA | Genera las recomendaciones de compra |

### Por qué offline-first es crítico para Venus

En Florencia, el internet es intermitente. Si la app requiere internet
para registrar una venta y se cae la red en la hora pico de la tarde,
Andrés no puede operar. Con offline-first:

- Andrés registra ventas normalmente sin internet
- Don Carlos puede consultar el inventario local sin internet
- Cuando vuelve el internet, todo se sincroniza automáticamente
- La DIAN no aplica aquí, así que no hay cola de documentos pendientes

### Sincronización entre celulares

- El celular de Andrés y el de Don Carlos comparten la misma base de datos
  en Supabase
- Cuando Andrés registra una venta, Don Carlos la ve en segundos
  (si hay internet en ambos) o al sincronizarse (si hay internet después)
- PowerSync maneja los conflictos automáticamente

### Seguridad

- Cada usuario tiene su propio correo y contraseña
- Los datos de Don Carlos (márgenes, reportes financieros, pago empleado)
  están bloqueados a nivel de base de datos para el rol de empleado
- Si el celular de Andrés se pierde, Don Carlos puede desactivar
  su acceso desde su propio celular

---

## 7. REGLAS DE NEGOCIO CRÍTICAS

1. **Una venta confirmada no se elimina.** Solo se corrige con nota.
   Esto protege la integridad del historial.

2. **El inventario nunca queda en negativo.** Si el stock de un producto
   es 0, no se puede registrar una venta de ese artículo. Andrés ve
   el mensaje: "Este producto está agotado."

3. **Solo Don Carlos ve los reportes financieros de períodos anteriores.**
   Andrés solo ve el total del día en curso.

4. **Solo Don Carlos ve los costos de compra y los márgenes.**
   Andrés solo ve precios de venta.

5. **Solo Don Carlos puede corregir ventas de días anteriores.**
   Andrés puede cancelar una venta en el momento (antes de confirmar),
   pero no después.

6. **El cierre de caja es obligatorio antes de registrar ventas
   del día siguiente.** Si Andrés no cerró caja ayer, el sistema
   le recuerda al abrir la app al día siguiente.

7. **Cada entrada de mercancía queda pendiente de revisión financiera
   por Don Carlos.** Andrés puede registrar la llegada física pero
   los costos y condiciones de pago los completa Don Carlos.

8. **Los días trabajados de Andrés se calculan por días de actividad
   en la app.** Un día cuenta si hubo al menos 1 venta registrada
   o un cierre de caja ejecutado.

9. **Don Carlos puede ajustar manualmente los días trabajados.**
   Para los días que Andrés trabajó sin internet o hubo alguna
   situación especial.

10. **El análisis de IA no reemplaza el juicio de Don Carlos.**
    Las recomendaciones de compra son sugerencias, no órdenes.
    Don Carlos siempre puede ignorarlas o ajustarlas.

11. **Los productos agotados siguen visibles en el inventario.**
    Se muestran con estado AGOTADO para que Don Carlos sepa qué
    necesita reponer.

12. **Las deudas con proveedores no desaparecen solas.**
    Solo se eliminan cuando Don Carlos registra explícitamente el pago.

13. **Las notificaciones de cierre de caja siempre llegan a Don Carlos.**
    Aunque no abra la app, recibe el resumen del día por notificación push.

14. **Si Andrés no ha cerrado caja a las 9 PM, Don Carlos recibe una alerta.**
    Puede indicar que hubo algún problema en el local.

15. **El historial de ventas se conserva indefinidamente.**
    Don Carlos puede consultar lo que se vendió hace 2 años para
    comparar temporadas.

16. **Los precios de venta solo los cambia Don Carlos.**
    Andrés no puede modificar precios en el momento de la venta.

17. **Los precios de venta solo los cambia Don Carlos.**
    Andrés no puede modificar precios en el momento de la venta.

18. **Pagos mixtos están soportados.**
    Un cliente puede pagar una parte en efectivo y otra por Nequi
    o Daviplata en una sola venta. Andrés selecciona ambos métodos
    e ingresa el monto de cada uno. El sistema valida que la suma
    sea igual al total de la venta.

19. **Las fotos de productos se comprimen automáticamente.**
    La app comprime cada imagen a máximo 500KB antes de subirla
    a Supabase para proteger el límite gratuito de 1GB de storage.

20. **Los gastos fijos vencidos generan alerta inmediata.**
    Si un gasto fijo no fue marcado como pagado en su fecha de
    vencimiento, Don Carlos recibe notificación al abrir la app
    y por push en su celular.

21. **El balance mensual se calcula automáticamente.**
    Ingresos menos todos los egresos del mes = ganancia o pérdida real.

---

## 8. MÓDULO DE GASTOS FIJOS

**Qué hace:** Registra todos los gastos recurrentes del negocio,
genera alertas antes del vencimiento y permite adjuntar comprobantes.

**Quién lo usa:** Solo Don Carlos.

---

### Gastos fijos típicos de Venus
- Arriendo del local
- Electricidad (Electrohuila)
- Agua
- Internet
- Seguro del local (si aplica)
- Cualquier gasto que se repite cada mes

---

### Registro de un gasto fijo

Don Carlos registra cada gasto una sola vez:
- **Nombre:** Arriendo local Venus
- **Monto aproximado:** $800.000 COP/mes
- **Día de pago:** Día 5 de cada mes
- **A quién se paga:** Nombre del arrendador
- **Alertas:** 5 días antes + el día del vencimiento
- **Notas:** Texto libre (ej: "Pagar a doña Martha en efectivo")

---

### Flujo de pago de un gasto fijo

1. Don Carlos recibe alerta: "En 3 días vence el arriendo — $800.000"
2. Cuando paga, abre Venus y toca el gasto
3. Toca **"Registrar pago"**
4. Ingresa el monto real pagado
5. Selecciona la fecha del pago
6. Adjunta comprobante: foto con cámara o PDF desde galería
7. Confirma. El gasto queda marcado ✅ Pagado

---

### Vista de gastos fijos

Don Carlos ve:
- Lista con estado: ✅ Pagado / ⚠️ Próximo a vencer / 🔴 Vencido
- Historial completo con comprobantes adjuntos
- Total de gastos fijos del mes actual

---

## 9. MÓDULO DE GASTOS VARIABLES

**Qué hace:** Registra gastos imprevistos o no recurrentes que afectan
la rentabilidad pero no son mensuales fijos.

**Quién lo usa:** Don Carlos principalmente. Andrés puede registrar
gastos pequeños del día si Don Carlos lo autoriza.

---

### Tipos de gastos variables en Venus
- Flete de mercancía desde Bogotá o Medellín
- Reparaciones del local
- Compra de bolsas, papel de regalo, empaques
- Transporte de Don Carlos para comprar mercancía
- Cualquier gasto imprevisto

---

### Registro de un gasto variable

1. Toca **"Gasto variable"**
2. Ingresa:
   - Descripción: "Flete mercancía de Bogotá"
   - Monto: $45.000 COP
   - Categoría: Transporte / Reparaciones / Insumos / Otros
   - Fecha: automática o manual
3. Adjunta foto del recibo (opcional)
4. Confirma

---

### Control mensual

Don Carlos ve:
- Total gastado en variables este mes
- Desglose por categoría
- Comparación con el mes anterior

---

## 10. BALANCE REAL DEL NEGOCIO

**Qué hace:** Muestra si el negocio está ganando o perdiendo plata real,
combinando todos los ingresos y egresos del período.

**Quién lo usa:** Solo Don Carlos.

---

### Fórmula del balance

```
INGRESOS
+ Ventas (efectivo + Nequi + Daviplata)
= Total ingresos

EGRESOS
- Gastos fijos pagados
- Gastos variables
- Pagos a proveedores
- Sueldo de Andrés
= Total egresos

BALANCE = Ingresos - Egresos
```

---

### Pantalla de balance

```
┌─────────────────────────────┐
│  Balance — Noviembre 2026   │
│─────────────────────────────│
│  ✅ Ingresos    $4.200.000  │
│  ❌ Egresos     $2.800.000  │
│─────────────────────────────│
│  💰 Ganancia    $1.400.000  │
│─────────────────────────────│
│  Desglose egresos:          │
│  · Arriendo      $800.000   │
│  · Electricidad   $95.000   │
│  · Agua           $45.000   │
│  · Fletes         $90.000   │
│  · Sueldo Andrés $850.000   │
│  · Proveedores   $920.000   │
└─────────────────────────────┘
```

Si el resultado es negativo, aparece en rojo:
"Este mes los gastos superaron las ventas en $X.XXX.XXX"

Don Carlos puede navegar mes a mes para ver la evolución histórica
de la rentabilidad del negocio.

---

## 11. INFRAESTRUCTURA: COSTOS CERO Y BACKUP AUTOMÁTICO

**Estrategia:** Venus opera con infraestructura 100% gratuita.
El objetivo es no gastar nada en servidores mientras el negocio
no lo justifique.

---

### Límites del plan gratuito de Supabase

| Recurso | Límite gratuito | Uso estimado Venus/mes |
|---|---|---|
| Base de datos | 500 MB | ~5 MB |
| Storage (fotos) | 1 GB | ~50 MB |
| Usuarios activos | 50.000/mes | 2 usuarios |
| Ancho de banda | 5 GB/mes | ~100 MB |

Venus puede operar años en el plan gratuito sin acercarse a los límites.
El único riesgo es el storage si Don Carlos sube fotos sin comprimir.
La app comprime automáticamente a 500KB para evitarlo.

---

### Backup automático local

Un script corre en el PC del desarrollador cada noche a las 2 AM:

1. Se conecta a Supabase
2. Descarga toda la base de datos
3. Guarda el archivo localmente: `venus-backup-2026-11-30.sql`
4. Mantiene los últimos 30 backups y borra los más antiguos
5. Si el PC está apagado, corre la próxima vez que esté encendido

Las fotos se respaldan por separado como archivos de imagen.

**Tecnología:** Script en Python o Node.js, menos de 50 líneas.
Corre como tarea programada del sistema operativo. No requiere
conocimiento técnico para usarlo después de instalado.

---

### Cuándo considerar el plan de pago ($25 USD/mes)

- Base de datos supera 400 MB
- Storage de fotos supera 800 MB
- Más de 2 usuarios activos frecuentes

La app mostrará alerta cuando el uso supere el 80% de cualquier límite.

---

## 12. MÉTRICAS DE ÉXITO

### A los 30 días de uso

- Don Carlos ve el resumen del negocio sin llamar a Andrés
- Andrés registra una venta en menos de 30 segundos
- El inventario cuadra con la realidad física del negocio
- No se han perdido datos por falta de internet

### A los 3 meses de uso

- Don Carlos tiene datos suficientes para la primera recomendación de compra
- El cuaderno está guardado en un cajón y no se usa
- Andrés ha adoptado la app como parte natural de su trabajo

### Criterios para considerar Venus exitosa

- Don Carlos compra basado en recomendaciones de la app y tiene
  menos sobrantes al final de una temporada
- El negocio tiene historial digital de al menos 6 meses
- Don Carlos responde en menos de 10 segundos: "¿Cuánto vendiste ayer?"

---

## 13. LO QUE NO ENTRA EN ESTA VERSIÓN

- **Facturación DIAN:** Venus no emite facturas legales. Si un cliente
  pide factura, Don Carlos la hace manualmente por fuera de la app.
- **E-commerce o WhatsApp:** Solo ventas presenciales.
- **Nómina electrónica:** El pago de Andrés es informal.
- **Contabilidad formal:** Sin libros contables ni declaraciones de renta.
- **Múltiples sucursales:** Solo la tienda Venus en Florencia.
- **Registro habitual de clientes:** Sin CRM ni fidelización.
- **App para iOS:** Solo Android.
- **Panel web:** Solo app móvil.
- **Integración con datáfono:** Se evalúa en versión 3.0.

---

## GLOSARIO

**Panel de huevos**
Una bandeja plástica o de cartón con 30 huevos. La unidad de venta más
común en tiendas de barrio. En Venus, se vende "por panel".

**Libra de limón / café**
Unidad de peso equivalente a 500 gramos. Venus vende limón y café por libra.
El sistema permite ingresar fracciones (ej: 0.5 libras).

**Talla de calzado colombiana**
Colombia usa la misma numeración que España y Europa. Las tallas de zapatos
de dama van de 34 a 40. Las de caballero de 38 a 45. En Venus se registra
el número exacto por par.

**Temporada escolar**
Enero y julio-agosto en Colombia. Las familias compran zapatos nuevos para
los niños al regreso de vacaciones. Es uno de los picos de venta más altos
del año para una zapatería.

**Temporada de fin de año**
Noviembre y diciembre. Las ventas se disparan por bonificaciones de fin de año,
regalos navideños y celebraciones. El pico más alto del año.

**Sueldo fijo**
El empleado gana la misma cantidad cada mes sin importar las ventas.
No hay comisiones en Venus. El sueldo se acuerda entre Don Carlos y Andrés
y se configura una vez en la app.

**Cierre de caja**
El proceso de fin del día donde Andrés cuenta el dinero físico en la caja,
lo compara con lo que el sistema registró, y confirma que todo cuadra.
Es el equivalente digital del cuadre que antes hacía con la calculadora.

**Proveedor**
La persona o empresa que le vende mercancía a Don Carlos. Puede ser un
distribuidor de calzado en Bogotá o Medellín, o el señor que trae los
huevos cada semana.

**Stock mínimo**
El número de unidades por debajo del cual Venus le avisa a Don Carlos
que ese producto se está acabando. Si el stock mínimo de los tenis Nike
talla 38 es 1, cuando quede solo 1 par en bodega, llega la alerta.

**Referencia del proveedor**
El código que el proveedor usa para identificar un modelo específico.
Ejemplo: "NK-2024-BLK" puede ser el código que Calzado Bogotá usa para
los tenis Nike negros. Ayuda a hacer pedidos sin confusiones.

---

*Venus PRD v2.0 — Junio 2026*
*Para uso del equipo de desarrollo. Próxima revisión: después de las
primeras 2 semanas de uso con Don Carlos y Andrés.*
