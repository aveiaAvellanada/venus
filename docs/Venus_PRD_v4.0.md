# Venus — Product Requirements Document v4.0
## App de gestión para tienda de calzado familiar
### Junio 2026

> **Documento fuente de verdad del producto Venus.**
> Venus es una aplicación móvil Android para gestionar la tienda de calzado
> familiar "Venus" en Florencia, Caquetá, Colombia.
>
> **Cambios v4.0 vs v3.0 (actualizado con ventas separadas):**
> - Nombres reales: dueño = Andrés Artunduaga, empleados = Camilo, Beatriz, Sandra
> - Nueva Venta: separación zapatos/Granja, filtros, precio mínimo/máximo con regateo, cédula cliente, detalle de venta, nota en venta, indicador de stock, historial con búsqueda, resumen métodos de pago
> - Módulo Devoluciones agregado (todos los usuarios pueden procesar, todo auditado)
> - Inventario Calzado: búsqueda ágil en tiempo real, filtros combinables, "¿Agregar otro similar?" al guardar
> - Módulo "Granja" (antes Productos Varios): sin stock, precio siempre en el momento de venta, cálculo automático por unidad
> - Recibir Mercancía: puede crear producto nuevo si no existe, sin salir del flujo
> - Proveedores: botón WhatsApp directo al proveedor
> - Módulo renombrado: "Caja" (antes "Cierre de Caja")
> - Gestión Empleado: Andrés puede crear empleados desde la app
> - Balance: proyección del mes
> - Ventas Separadas / Pago Parcial documentado como v2 de Nueva Venta
> - Permisos redefinidos: empleados tienen casi todos los permisos, solo Andrés ve finanzas/costos/márgenes
> - Auditoría completa: todas las acciones registran quién las hizo y cuándo

---

## 1. VISIÓN Y PROPÓSITO

Venus reemplaza el cuaderno de Don Andrés con un sistema digital simple, ágil y
completo que le permite ver en tiempo real desde cualquier parte del país qué se
vendió, cuánto entró, qué hay en inventario, y qué necesita pedir antes de la
próxima temporada.

**El negocio sin Venus:** cuaderno manual, errores de suma, sin visibilidad remota,
compras basadas en intuición, sin registro de quién hizo qué.

**El negocio con Venus:** registro digital en segundos, Andrés ve todo en tiempo real
desde su celular, datos para comprar mejor por temporada, auditoría completa de
cada acción de cada empleado.

---

## 2. USUARIOS Y ROLES

### Dueño — Andrés Artunduaga
- Email: venusdelcaqueta@gmail.com
- PIN: definido (guardado de forma segura)
- **Ve TODO sin excepción**
- Puede crear y desactivar empleados desde la app
- Ve costos, márgenes, balance, deudas con proveedores, pagos a empleados
- Ve el historial completo de todos los módulos
- Ve quién hizo cada acción y cuándo (auditoría completa)

### Empleados
- **Camilo Artunduaga** — artuneleven1@gmail.com
- **Beatriz Bueno** — beatrizbueno1979@gmail.com
- **Sandra Cardona** — sandracardona.venus2026@gmail.com (administrativa, mismos permisos que Andrés excepto finanzas)
- **Nikol Artunduaga** — pendiente de email

### Tabla de permisos

| Acción | Andrés | Sandra | Camilo / Beatriz / Nikol |
|---|---|---|---|
| Ver costos y márgenes | ✅ | ❌ | ❌ |
| Ver balance financiero | ✅ | ❌ | ❌ |
| Ver pagos a empleados | ✅ | ❌ | ❌ |
| Ver deudas con proveedores | ✅ | ❌ | ❌ |
| Crear/desactivar usuarios | ✅ | ❌ | ❌ |
| Ver reportes históricos completos | ✅ | ✅ | ❌ |
| Cambiar precios | ✅ | ✅ | ✅ |
| Devoluciones | ✅ | ✅ | ✅ |
| Ventas | ✅ | ✅ | ✅ |
| Inventario calzado (ver y editar) | ✅ | ✅ | ✅ |
| Granja (ver y editar) | ✅ | ✅ | ✅ |
| Recibir mercancía | ✅ | ✅ | ✅ |
| Gastos operativos | ✅ | ✅ | ✅ |
| Caja (abrir/cerrar) | ✅ | ✅ | ✅ |
| Proveedores (gestión) | ✅ | ✅ | ❌ |
| Gastos fijos | ✅ | ✅ | ❌ |
| Gestión empleado | ✅ | ❌ | ❌ |
| Balance | ✅ | ❌ | ❌ |

**Auditoría:** TODA acción queda registrada con quién la hizo, cuándo, y qué cambió.
Andrés puede ver el historial de acciones de cada empleado en cualquier momento.

---

## 3. MÓDULOS DEL SISTEMA

---

### Módulo 1 — Nueva Venta

**Qué hace:** Registra ventas de zapatos y productos de Granja con carrito,
métodos de pago simples o mixtos, descuento de stock atómico, y persistencia
de efectivo recibido y cambio.

**Quién lo usa:** Todos los usuarios.

#### 3.1.1 Flujo de venta

**Etapa 1 — Carrito:**

El vendedor elige qué tipo de producto va a vender:

**Zapatos:**
- Buscador con texto libre que filtra en tiempo real por descripción, referencia, talla o color
- Filtros rápidos tocables: Categoría (Chanclas, Escolar, Botas caucho, Deportivo, Tennis, Clásico, Otros), Talla, Color
- Los filtros se combinan entre sí
- Resultados muestran: foto, descripción, talla, color, precio mínimo–máximo, stock disponible
- Productos agotados NO aparecen en la búsqueda de ventas
- Al agregar al carrito: se puede ajustar el precio dentro del rango mínimo–máximo o fuera de él (el sistema permite el regateo libremente)
- Indicador visual de stock al agregar: si quedan 2 unidades o menos, aparece advertencia "Quedan solo X pares"
- Stepper +/− para cantidad, limitado al stock disponible

**Granja:**
- Buscador separado de zapatos
- Al seleccionar un producto: aparece la unidad de medida asociada (Panel, Libra, Kilo, etc.)
- El vendedor ingresa la cantidad (acepta decimales: 0.5 libras)
- El vendedor ingresa el precio por unidad en ese momento
- El sistema calcula automáticamente: cantidad × precio por unidad = total
- No hay precio guardado ni stock que descontar

**Etapa 2 — Cobrar:**
- Total grande visible
- Chips de método: Efectivo / Nequi / Daviplata (selección múltiple para pago mixto)
- Monto por método (si es uno solo, autocompleta el total)
- Si hay efectivo: campo "Recibido" → el sistema muestra "Cambio: $X"
- Datos del cliente (todos opcionales, en sección colapsable):
  - Nombre
  - Apellido
  - Cédula
  - Teléfono
- Nota de la venta (campo de texto libre opcional): "Cliente pidió descuento por dos pares", "Paga viernes"
- Botón "Confirmar venta" (deshabilitado si los pagos no suman el total)

**Etapa 3 — Confirmación:**
- Pantalla verde: "✓ Venta #N registrada"
- Botones: "Nueva venta" / "Listo"

#### 3.1.2 Hub de ventas

- Cabecera: "Hoy: N ventas — $total"
- Resumen de métodos de pago del día: "$X efectivo · $Y Nequi · $Z Daviplata"
- Botón grande: "+ Nueva venta"
- Lista de ventas del día con: hora, total, método de pago, nombre del vendedor
- Buscador en la lista: por número de venta, nombre de cliente o producto
- Al tocar una venta: se abre el detalle completo

#### 3.1.3 Detalle de venta

- Número de venta
- Fecha y hora
- Quién la vendió
- Lista de productos vendidos con cantidad, precio unitario y subtotal
- Precio final de cada item (incluyendo si hubo regateo)
- Métodos de pago y montos
- Efectivo recibido y cambio (si aplica)
- Datos del cliente (si se registraron)
- Nota de la venta (si se escribió)
- Estado: Completada / Devuelta parcialmente / Devuelta totalmente
- Botón "Registrar devolución" (si la venta está completada)

#### 3.1.4 Precios en zapatos

Cada zapato tiene:
- **Precio mínimo:** el precio más bajo recomendable de venta
- **Precio máximo:** el precio más alto recomendable de venta
- El vendedor puede ajustar el precio al agregar al carrito (el regateo es permitido y el precio final queda registrado en el item)
- Andrés puede ver si un vendedor vendió sistemáticamente por debajo del precio mínimo

#### 3.1.5 Ventas Separadas — Pago Parcial (v2 — segunda iteración)

**Qué es:** Cuando un cliente no puede pagar el total en el momento pero quiere
reservar los zapatos. El empleado registra el anticipo, separa físicamente los
zapatos en una bolsa con el nombre del cliente, y el sistema lleva el control
del saldo pendiente.

**Flujo:**

1. En la pantalla de cobro, el vendedor toca **"Pago parcial"** en lugar de confirmar
2. Ingresa el monto del anticipo que pagó el cliente
3. Nombre y teléfono del cliente son **obligatorios** en este caso
4. Confirma el pago parcial

**Lo que pasa en el sistema:**
- El stock se descuenta inmediatamente (igual que una venta normal)
- La venta queda en estado **"Separado — [nombre del cliente]"**
- El hub de ventas muestra las ventas separadas con saldo pendiente
- Andrés ve en su dashboard los separados pendientes de cobro

**Cuando el cliente vuelve a pagar:**
1. El vendedor busca la venta en "Ventas separadas"
2. Selecciona la venta del cliente
3. Registra el pago del saldo restante
4. La venta pasa a estado **"Completada"**

**Si el cliente no vuelve:**
- Andrés puede cancelar la separación manualmente
- El stock regresa al inventario disponible
- El anticipo queda registrado como ingreso con nota de cancelación

**Reglas:**
- Nombre y teléfono del cliente son obligatorios en ventas separadas
- El stock se descuenta inmediatamente al separar
- Solo Andrés puede cancelar una separación

---

#### 3.1.6 Reglas de negocio

- Stock nunca queda en negativo
- Una venta confirmada NUNCA se elimina, solo se corrige con nota o devolución
- Los pagos deben sumar exactamente el total para poder confirmar
- El precio final pagado queda guardado en cada item de la venta
- Toda venta registra quién la procesó (auditoría)
- Las ventas separadas descuentan stock inmediatamente pero quedan pendientes de cobro total

---

### Módulo 2 — Devoluciones

**Qué hace:** Permite registrar la devolución parcial o total de una venta,
devolver el dinero al cliente y restituir el stock de zapatos.

**Quién lo usa:** Todos los usuarios. Toda devolución queda auditada con quién la procesó.

#### 3.2.1 Tipos de devolución

**Devolución total:** el cliente devuelve todo lo comprado. Se devuelve el dinero
completo y el inventario de zapatos se restituye.

**Devolución parcial:** el cliente devuelve solo algunos items. Se devuelve solo
el valor de lo devuelto.

**Cambio de producto:** el cliente devuelve unos zapatos y quiere el mismo modelo
en otra talla. No hay movimiento de dinero, solo de inventario.

#### 3.2.2 Flujo de devolución

1. Desde el detalle de la venta, tocar "Registrar devolución"
2. Se muestra la lista de items de esa venta
3. El usuario selecciona qué items se devuelven y en qué cantidad
4. El sistema pregunta el motivo:
   - Talla incorrecta
   - Defecto del producto
   - Cliente cambió de opinión
   - Cambio por otro producto
   - Otro (campo de texto libre)
5. El sistema pregunta cómo se devuelve el dinero:
   - Efectivo
   - Nequi
   - Daviplata
   - Cambio por otro producto (no hay movimiento de dinero)
6. Se confirma la devolución

#### 3.2.3 Lo que pasa en el sistema

- El stock del calzado devuelto se incrementa automáticamente
- La venta original queda marcada como "Devuelta parcialmente" o "Devuelta totalmente"
- Se crea un registro de devolución con: fecha, motivo, quién la procesó, qué se devolvió, cómo se devolvió el dinero
- La venta original NUNCA se borra

#### 3.2.4 Reglas de negocio

- No se puede devolver más de lo que se vendió
- Los productos de Granja no restituyen stock (no tienen stock)
- Toda devolución registra quién la procesó (auditoría)

---

### Módulo 3 — Inventario de Calzado

**Qué hace:** Administra el catálogo y el stock de todos los zapatos.

**Quién lo usa:** Todos para consultar. Andrés y Sandra para crear/editar.

#### 3.3.1 Catálogo

Cada producto tiene:
- Categoría (Chanclas, Escolar, Botas caucho, Deportivo, Tennis, Clásico, Otros)
- Descripción
- Referencia del proveedor (opcional)
- Foto (cámara directa o desde galería, comprimida a máx 500KB, opcional)
- Proveedor vinculado (opcional)
- Talla
- Color
- Precio mínimo de venta
- Precio máximo de venta
- Costo de compra (solo visible para Andrés)
- Stock actual
- Stock mínimo para alerta
- Activo / Inactivo

#### 3.3.2 Agilidad de operación

**Buscar:**
- Buscador con texto libre que filtra en tiempo real: descripción, referencia, talla, color
- Filtros rápidos combinables: categoría, estado (disponible / stock bajo / agotado), proveedor
- Resultados instantáneos sin botón de buscar

**Consultar:**
- Al tocar un producto: detalle completo
- Historial de precios (solo Andrés): fecha de cada cambio y precio anterior
- Historial de movimientos: cuándo entró stock (recepciones) y cuándo salió (ventas)
- Botón directo "Editar" desde el detalle

**Agregar:**
- Botón "+" siempre visible
- Formulario con campos ordenados por frecuencia: categoría → descripción → talla → color → precios → stock
- Al guardar: "¿Agregar otro similar?" para agilizar cuando llegan varias tallas del mismo modelo

**Editar:**
- Desde el detalle con un toque
- Precio mínimo y máximo editables (cada cambio queda en el historial con fecha y quién lo cambió)

#### 3.3.3 Reglas de negocio

- Stock nunca queda negativo
- Productos agotados siguen visibles con estado AGOTADO (no se borran)
- Categorías fijas, no eliminables
- Fotos comprimidas a 500KB automáticamente
- Cada cambio de precio queda registrado con fecha y quién lo hizo (auditoría)

---

### Módulo 4 — Granja

**Qué hace:** Administra los productos que no son zapatos (huevos, café, limón,
etc.). Sin gestión de stock. El precio se define en el momento de cada venta.

**Quién lo usa:** Todos para vender y consultar. Andrés y Sandra para crear/editar productos.

#### 3.4.1 Catálogo

Cada producto tiene:
- Nombre
- Unidad de medida (Panel, Libra, Kilo, Litro, Unidad, Gramo)
- Foto (opcional)
- Proveedor vinculado (opcional)
- Notas internas (opcional)

**No tiene:**
- Stock (no se gestiona inventario)
- Precio guardado (el precio se ingresa en el momento de la venta)
- Categorías

#### 3.4.2 Flujo de venta desde Granja

1. El vendedor busca el producto en el buscador de Granja
2. Selecciona el producto — aparece con su unidad de medida
3. Ingresa la cantidad (acepta decimales: 0.5 libras)
4. Ingresa el precio por unidad en ese momento
5. El sistema calcula: cantidad × precio por unidad = total
6. Se agrega al carrito de la venta

#### 3.4.3 Agregar y editar productos

- Formulario simple: nombre, unidad, foto, proveedor, notas
- Andrés y Sandra pueden crear y editar
- El resto solo puede vender y consultar

---

### Módulo 5 — Recibir Mercancía

**Qué hace:** Registra la entrada física de mercancía al negocio y actualiza
el inventario de calzado automáticamente.

**Quién lo usa:** Todos para registrar llegada física. Solo Andrés y Sandra ven costos y deudas.

#### 3.5.1 Flujo completo

**Paso 1 — Seleccionar proveedor:**
Se elige el proveedor de la lista. Si es nuevo, se puede crear en el momento sin salir del flujo.

**Paso 2 — Registrar productos que llegaron:**
Para cada producto:
- Si el producto ya existe en el catálogo: se busca y se selecciona
- Si el producto es nuevo (no existe en el catálogo): se crea en el momento con todos sus datos y queda agregado al inventario automáticamente
- Se ingresa la cantidad recibida

**Paso 3 — Confirmar recepción:**
El empleado confirma que todo llegó físicamente. El stock de esos productos sube automáticamente.
Andrés recibe notificación si un empleado registró mercancía sin completar la parte financiera.

**Paso 4 — Información financiera (solo Andrés y Sandra):**
- Precio de costo por unidad
- Contado o crédito
- Si es crédito: monto total y fecha de pago acordada
- Adjuntar factura o foto del documento del proveedor

#### 3.5.2 Reglas de negocio

- Cualquier empleado puede registrar la llegada física
- Solo Andrés y Sandra completan los datos financieros
- Si un empleado registra sin datos financieros, queda pendiente de revisión de Andrés
- Toda recepción registra quién la procesó (auditoría)

---

### Módulo 6 — Proveedores

**Qué hace:** Gestiona los proveedores del negocio con sus datos de contacto,
cuentas bancarias, documentos y control de deudas.

**Quién lo usa:** Andrés y Sandra.

#### 3.6.1 Datos de cada proveedor

- Nombre
- NIT o cédula
- Teléfono (WhatsApp principalmente)
- Ciudad
- Notas
- Cuentas bancarias: banco, tipo (ahorros/corriente/Nequi/Daviplata), número
- Documentos adjuntos: facturas, pedidos por WhatsApp (fotos o PDFs)
- Botón de contacto directo por WhatsApp

#### 3.6.2 Historial de compras

- Lista de todas las compras a ese proveedor con fecha, monto total y estado (pagado/pendiente)
- Deuda actual pendiente

#### 3.6.3 Registro de pago a proveedor

- Andrés o Sandra registran el pago cuando se hace
- Queda en el historial con fecha y monto
- La deuda se actualiza automáticamente

---

### Módulo 7 — Caja

**Qué hace:** Registra la apertura y cierre del día operativo del negocio.
Reemplaza el cuadre manual con calculadora.

**Quién lo usa:** Todos para abrir/cerrar. Solo Andrés ve el historial completo.

#### 3.7.1 Modos de operación

**Modo automático (configurable por Andrés):**
Andrés define la hora de apertura (ej: 6:00 AM) y la hora de cierre (ej: 11:00 PM).
El sistema abre y cierra automáticamente cada día. Al cierre automático, se genera
el resumen del día y se envía a Andrés por WhatsApp.
El horario se puede cambiar en cualquier momento desde Configuración.

**Modo manual:**
Cualquier empleado toca "Abrir caja" al llegar y "Cerrar caja" al irse.
Útil para días con horario irregular o festivos.

Andrés puede cambiar entre modos en cualquier momento.

#### 3.7.2 Cierre del día

El sistema muestra el resumen:
- Total vendido
- Número de ventas
- Desglose por método de pago (efectivo / Nequi / Daviplata)
- Devoluciones del día
- El empleado cuenta el efectivo físico e ingresa el monto
- El sistema compara: efectivo en caja vs efectivo registrado en ventas
- Si hay diferencia (sobrante o faltante): queda registrado con una nota
- Andrés recibe el resumen por WhatsApp al cerrar

#### 3.7.3 Lo que ve cada uno

**Todos los empleados:** el cierre del día actual
**Solo Andrés:** historial completo de cierres de días anteriores, comparativo entre días, diferencias de caja y quién cerró

---

### Módulo 8 — Gestión de Empleados

**Qué hace:** Andrés administra los empleados del negocio: crear cuentas,
configurar sueldos, registrar pagos y ver historial.

**Quién lo usa:** Solo Andrés.

#### 3.8.1 Crear empleado

Andrés puede crear un nuevo empleado directamente desde la app:
- Nombre completo
- Email (se usa para el login)
- PIN inicial (el empleado lo puede cambiar después)
- Rol (empleado — en esta versión todos son empleado)
- Sueldo fijo mensual
- Fecha de inicio

El empleado queda creado en Supabase Auth y puede hacer login inmediatamente.

#### 3.8.2 Gestión de empleados activos

- Lista de todos los empleados con estado (activo/inactivo)
- Activar o desactivar empleados (sin borrarlos)
- Editar datos: nombre, sueldo
- Ver días trabajados en el mes actual
- Ver historial de pagos

#### 3.8.3 Días trabajados

Un día cuenta como trabajado si el empleado registró al menos una venta o un cierre de caja ese día.
Andrés puede ajustar manualmente si hubo alguna situación especial.

#### 3.8.4 Registrar pago de sueldo

1. Andrés toca "Registrar pago" para el empleado
2. El sistema muestra el monto calculado según días trabajados
3. Andrés confirma o ajusta el monto
4. Queda en el historial: fecha, monto pagado, período cubierto

---

### Módulo 9 — Gastos Fijos

**Qué hace:** Registra los gastos recurrentes del negocio con alertas de
vencimiento y comprobantes adjuntos.

**Quién lo usa:** Andrés y Sandra.

#### 3.9.1 Registro de gasto fijo

- Nombre (Arriendo, Electricidad, Agua, Internet, etc.)
- Monto aproximado mensual
- Día de pago en el mes
- A quién se paga
- Alertas: X días antes + el día del vencimiento
- Notas

#### 3.9.2 Registrar pago

1. Andrés o Sandra reciben alerta de vencimiento
2. Cuando pagan: tocan el gasto y registran el pago
3. Ingresan el monto real pagado (puede diferir del estimado)
4. Adjuntan comprobante (foto o PDF)
5. El gasto queda marcado como pagado ✅

#### 3.9.3 Vista de gastos fijos

- Lista con estado: ✅ Pagado / ⚠️ Próximo a vencer / 🔴 Vencido
- Historial de pagos con comprobantes adjuntos
- Total de gastos fijos del mes actual

---

### Módulo 10 — Gastos Variables

**Qué hace:** Registra gastos imprevistos o no recurrentes.

**Quién lo usa:** Andrés y Sandra principalmente. Otros empleados con autorización.

#### 3.10.1 Registro de gasto variable

- Descripción
- Monto
- Categoría: Transporte / Reparaciones / Insumos / Otros
- Fecha (automática o manual)
- Comprobante adjunto (opcional)

#### 3.10.2 Control mensual

- Total gastado en variables este mes
- Desglose por categoría
- Comparación con el mes anterior

---

### Módulo 11 — Balance

**Qué hace:** Muestra si el negocio está ganando o perdiendo dinero real en
el período, combinando todos los ingresos y egresos.

**Quién lo usa:** Solo Andrés.

#### 3.11.1 Fórmula del balance

```
INGRESOS
+ Ventas del período (efectivo + Nequi + Daviplata)
- Devoluciones del período
= Total ingresos netos

EGRESOS
- Gastos fijos pagados
- Gastos variables
- Pagos a proveedores
- Sueldos pagados a empleados
= Total egresos

BALANCE = Ingresos netos - Egresos
```

#### 3.11.2 Pantalla de balance

- Período seleccionable (semana, mes, rango personalizado)
- Total ingresos / Total egresos / Ganancia o pérdida
- Desglose de egresos por categoría
- Si el resultado es negativo: aparece en rojo con el monto de pérdida
- Proyección del mes: si vamos a la mitad del mes, el sistema estima cómo va a cerrar basado en el promedio de los días anteriores
- Navegación histórica: mes a mes para ver la evolución

---

### Módulo 12 — Reportes y Dashboard

**Qué hace:** Le da a Andrés una visión clara del negocio en cualquier momento
desde cualquier lugar.

**Quién lo usa:** Andrés (histórico completo). Sandra (ver reportes sin datos financieros de costos).

#### 3.12.1 Dashboard principal (Andrés)

Al abrir la app:
- Total vendido hoy
- Número de ventas hoy
- Desglose: efectivo / Nequi / Daviplata
- Comparación con ayer (flecha arriba o abajo con porcentaje)
- Productos con stock bajo (alerta)
- Proveedores con pago próximo a vencer
- Si algún empleado no ha registrado actividad hoy

#### 3.12.2 Reportes

- Reporte semanal: total, día con más ventas, producto más vendido, comparación semana anterior
- Reporte mensual: total, desglose por método de pago, top 10 productos, productos sin movimiento, comparación mes anterior
- Inventario completo con valor total (si se registraron costos)

---

### Módulo 13 — Reportes Automáticos

**Qué hace:** Al cierre de cada día, Venus envía automáticamente un resumen
a Andrés por WhatsApp (siempre) y correo (opcional).

**Quién lo usa:** Andrés lo recibe y configura.

#### 3.13.1 Mensaje de WhatsApp (al cierre del día)

```
📊 Venus — Resumen del día
📅 [Fecha]

💰 Total vendido: $XXX.XXX
🛍️ Ventas: N
💵 Efectivo: $XXX
📱 Nequi: $XXX
📱 Daviplata: $XXX

👟 Más vendido: [producto]
⚠️ Stock bajo: [lista]

✅ Caja cuadró / ⚠️ Diferencia de $X
```

#### 3.13.2 Configuración

- WhatsApp on/off (activado por defecto)
- Correo on/off (desactivado por defecto)
- Correo destino
- Hora de envío (por defecto: al cierre de caja)

---

### Módulo 14 — Análisis IA Temporadas

**Qué hace:** Analiza el historial de ventas cruzado con variables de contexto
para ayudarle a Andrés a comprar mejor antes de cada temporada.

**Quién lo usa:** Solo Andrés.

**Nota:** Requiere mínimo 3 meses de datos reales para ser útil. Se construye al final.

#### 3.14.1 Variables de análisis

- Día de la semana
- Hora del día / semana del mes
- Festivos colombianos (calendario integrado)
- Clima de Florencia (consultado automáticamente cada día)
- Temporadas: Regreso a clases (enero), Semana Santa, Vacaciones (junio-julio), Halloween/Noviembre, Navidad/Diciembre

#### 3.14.2 Lo que muestra la IA

- Análisis de temporadas pasadas: qué se vendió más, qué tallas se agotaron primero, qué sobró
- Recomendación de compra: "Para el regreso a clases le recomiendo pedir: talla 37 negro: 12 pares..."
- Productos lentos: más de 45 días sin moverse, cuánto dinero tiene congelado ahí
- Proyección de ventas del próximo período

**Todo en lenguaje simple colombiano. Sin gráficas técnicas ni jerga.**

---

### Módulo 15 — Carga Inicial del Inventario

**Qué hace:** Permite pasar el inventario del cuaderno físico a la app antes
de empezar a operar con Venus.

**Quién lo usa:** Solo Andrés (y Sandra).

#### 3.15.1 Método 1 — Plantilla Excel

1. Venus provee una plantilla Excel con columnas fijas y listas desplegables para categorías y colores
2. Andrés o Sandra llenan la plantilla en el computador
3. Suben el archivo desde la app
4. Venus importa todos los productos y muestra resumen: "Se cargaron X productos en Y referencias"

#### 3.15.2 Método 2 — Fotografiar el cuaderno con IA

1. Andrés fotografía cada página del cuaderno con el celular
2. La IA extrae: categoría, descripción, talla, color, cantidad, precio
3. Andrés revisa fila por fila (✅ correcto / ✏️ corregir)
4. Lo que la IA no pudo leer aparece en rojo para completar manualmente
5. Confirma y el inventario se carga

**Nota:** La referencia del proveedor puede quedar vacía en la carga inicial. Se completa después cuando llegue mercancía nueva.

---

## 4. ORDEN DE CONSTRUCCIÓN RECOMENDADO

1. Inventario Calzado (Medio)
2. Granja (Simple)
3. Recibir Mercancía (Medio)
4. Carga Inicial — método Excel primero, IA después (Complejo)
5. Devoluciones (Medio)
6. Caja (Medio)
7. Gastos Variables (Simple)
8. Gastos Fijos (Medio)
9. Proveedores (Complejo)
10. Gestión Empleados (Medio)
11. Balance (Medio)
12. Reportes y Dashboard (Medio)
13. Infraestructura notificaciones (WhatsApp + Edge Functions)
14. Reportes Automáticos (Complejo)
15. Análisis IA Temporadas (Complejo — necesita 3+ meses de datos)

---

## 5. INFRAESTRUCTURA TÉCNICA

- **Stack:** React Native / Expo SDK 54, expo-router, TypeScript, Supabase, Supabase Auth
- **Base de datos:** Supabase (PostgreSQL 17) con RLS activado en todas las tablas
- **Storage:** Supabase Storage para fotos (plan gratuito: 1GB)
- **Conectividad:** Online-first en esta versión. Offline-first diferido.
- **Auditoría:** Todas las tablas tienen created_by (usuario que creó) y campo de auditoría en acciones críticas

---

## 6. LO QUE NO ENTRA EN ESTA VERSIÓN

- Facturación electrónica DIAN
- E-commerce o catálogo por WhatsApp
- Nómina electrónica
- Contabilidad formal
- Múltiples sucursales
- App para iOS
- Panel web
- Ventas a crédito formal con intereses
- Offline-first (diferido)

---

## 7. GLOSARIO

**Panel de huevos:** bandeja con 30 huevos. Unidad de venta en Granja.
**Libra:** unidad de peso = 500 gramos. Café y limón se venden por libra.
**Temporada escolar:** enero y julio-agosto. Pico de ventas de calzado escolar.
**Temporada navideña:** noviembre y diciembre. Pico más alto del año.
**Precio mínimo:** precio más bajo recomendable al que se puede vender un zapato.
**Precio máximo:** precio más alto recomendable al que se puede vender un zapato.
**Regateo:** negociación del precio con el cliente. Venus permite vender a cualquier precio y registra el precio real de la venta.
**Auditoría:** registro automático de quién hizo qué y cuándo en el sistema.
**Granja:** módulo de Venus para productos que no son zapatos (huevos, café, limón, etc.).
**Caja:** módulo de Venus para el control del día operativo del negocio.

---

*Venus PRD v4.0 — Junio 2026*
*Para revisión y aprobación del equipo antes de construir módulos adicionales.*
*Próxima revisión: después de completar los primeros 5 módulos.*
