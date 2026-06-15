# Venus — Plan de Módulos Pendientes

Fecha: 2026-06-14
Estado: **Para revisión del fundador (Don Carlos / equipo) antes de construir cualquier módulo adicional.**
Fuentes: `docs/Venus_PRD_v3.0.md` (documento maestro) y `CLAUDE.md`.

---

## 0. Contexto: qué ya está construido

Antes de listar lo pendiente, el estado actual del proyecto:

- **Autenticación + navegación por rol** (rama mergeada): login con selector de usuario + PIN, gating fail-closed por rol (`dueno` / `empleado`), home en cuadrícula generada desde un mapa central de permisos (`lib/permisos.ts`), y guards por módulo (`useRequireModulo`).
- **Módulo 1 — Nueva Venta (v1)** (rama `feat/nueva-venta`, en verificación): carrito de zapatos y varios, buscador, pagos efectivo/Nequi/Daviplata + mixtos, cambio, cliente opcional, descuento de stock atómico vía RPC `registrar_venta`, y hub de ventas con resumen del día. **Online-first** (offline-first quedó diferido).
- **Esquema de base de datos**: ya está versionado y aplicado en Supabase (`supabase/migrations/`) e incluye tablas para casi todos los módulos pendientes. Esto reduce significativamente la complejidad de backend de varios módulos (el modelo de datos ya está diseñado). El split dueño/empleado se enforce a nivel de base de datos vía **RLS** con helpers `private.is_owner()` / `private.is_employee()` y `private.hoy_bogota()`.

Tablas existentes relevantes: `productos_calzado`, `productos_varios`, `historial_precios_calzado`, `historial_precios_varios`, `proveedores`, `proveedor_cuentas_bancarias`, `compras`, `compra_items`, `compra_documentos`, `cierres_caja`, `empleado_config`, `empleado_dias_trabajados`, `empleado_pagos`, `gastos_fijos`, `gastos_fijos_pagos`, `gastos_variables`, `clima_registro`, `ventas`, `venta_items`, `metodos_pago_venta`, `users`.

### Cómo leer la estimación de complejidad

- **Simple**: CRUD sobre 1–2 tablas que ya existen, pocas pantallas, sin integraciones externas, sin lógica financiera sensible. ~2–4 días.
- **Medio**: varias tablas relacionadas, lógica de negocio con gating financiero por rol, agregaciones, subida de fotos a Storage, UI moderada. ~1–2 semanas.
- **Complejo**: integraciones externas (IA/LLM, WhatsApp, correo, OCR), tareas programadas (cron/edge functions), o flujos de datos grandes. ~2–4+ semanas y dependencias de infraestructura.

### Notas transversales (aplican a varios módulos)

- **Fotos**: se comprimen a máx. 500KB antes de subir a Supabase Storage (Regla PRD 19) para no agotar el plan gratuito (1GB).
- **RLS**: cualquier tabla con costos/márgenes/finanzas es solo-dueño a nivel de base de datos; los productos NO tienen columna de costo (el costo vive en tablas solo-dueño). No romper este patrón.
- **Notificaciones push y tareas programadas** (cierre automático, alertas de vencimiento, reportes diarios) requieren **Supabase Edge Functions + pg_cron** y configuración de push (expo-notifications). Es infraestructura compartida que conviene montar una sola vez.
- **Offline-first** está diferido para todo el sistema; estos módulos se diseñan online-first salvo decisión contraria.

---

## Módulo 1 — Inventario de Calzado

**1. Qué hace exactamente**
Administra el catálogo y el stock de todos los zapatos, organizados por las 7 categorías fijas (Chanclas, Escolar, Botas caucho, Deportivo, Tennis, Clásico, Otros). Permite crear/editar productos (referencia, descripción, foto, proveedor, talla, color, precio de venta, costo, stock actual, stock mínimo), consultar el inventario con filtros, ver el estado AGOTADO, y mantener el historial de precios. Un mismo modelo puede tener múltiples filas (una por talla/color).

**2. Quién lo usa**
Ambos para **consultar**. Solo **Don Carlos** para crear/editar/configurar y para ver costos.

**3. Pantallas**
- Lista/búsqueda de inventario con filtros (categoría, proveedor, estado disponible/stock bajo/agotado).
- Detalle de producto (incluye historial de precios — solo dueño).
- Crear/editar producto (formulario con cámara/galería para foto, selector de categoría, proveedor, talla, color, precios).
- (Empleado) vista de solo lectura sin costo ni margen.

**4. Qué datos maneja**
Tablas existentes: `productos_calzado` (referencia, descripcion, foto_url, proveedor_id, talla, color, precio_venta, stock_actual, stock_minimo, activo) e `historial_precios_calzado` (incluye costo — solo dueño). Storage para fotos. **Importante (PRD/RLS):** el costo de compra NO está en `productos_calzado`; vive en `historial_precios_calzado` (solo dueño).

**5. Reglas de negocio**
- El inventario nunca queda negativo (Regla 2). Stock 0 ⇒ AGOTADO, no vendible.
- Productos agotados siguen visibles con estado AGOTADO (Regla 11).
- Solo Don Carlos cambia precios (Regla 16); cada cambio guarda fecha y precio anterior (historial).
- Andrés no ve costos ni márgenes (Regla 4).
- Categorías fijas, no eliminables; Don Carlos decide cuáles mostrar.
- Fotos comprimidas a 500KB (Regla 19).

**6. Dependencias**
Lo consume **Nueva Venta** (ya construido lee de aquí), **Recibir mercancía/Proveedores** (escribe stock al recibir), **Reportes**, **Balance** (valor de inventario), **Análisis IA**. Triggers de historial de precios ya existen en el esquema.

**7. Complejidad: Medio**
CRUD sobre tabla existente, pero suma: subida/compresión de fotos a Storage, historial de precios con gating por rol, y filtros. El backend ya está modelado.

---

## Módulo 2 — Inventario de Productos Varios

**1. Qué hace exactamente**
Administra productos que no son zapatos (huevos, café, limón, aceite, etc.). Don Carlos define cada producto con nombre, unidad de medida (panel, libra, kilo, unidad, litro…), precio de venta, stock actual y mínimo, y foto opcional. Sin categorías fijas ni talla/color. Soporta stock y ventas en cantidades decimales (ej. 0.5 libra).

**2. Quién lo usa**
Ambos para **consultar**. Solo **Don Carlos** para agregar/editar productos.

**3. Pantallas**
- Lista/búsqueda de productos varios con estado de stock.
- Crear/editar producto (nombre, unidad, precio, stock, mínimo, foto).
- Detalle con historial de precios (solo dueño).

**4. Qué datos maneja**
Tablas existentes: `productos_varios` (nombre, unidad_medida, precio_venta, stock_actual numeric, stock_minimo, foto_url, activo) e `historial_precios_varios`. Storage para fotos.

**5. Reglas de negocio**
- Stock nunca negativo; cantidades decimales permitidas.
- Solo Don Carlos cambia precios y ve costos (Reglas 4, 16).
- Alertas de stock mínimo (rojo en dashboard dueño; amarillo al buscar para el empleado).
- Fotos comprimidas a 500KB.

**6. Dependencias**
Lo consume **Nueva Venta** (ya lee de aquí), **Reportes**, **Balance**. Estructuralmente casi idéntico al Inventario de Calzado (menos campos).

**7. Complejidad: Simple**
CRUD sobre una tabla con menos campos que calzado, sin categorías ni variantes. Reutiliza patrones del Inventario de Calzado (foto, historial de precios).

---

## Módulo 3 — Proveedores

**1. Qué hace exactamente**
Registra proveedores (datos de contacto, cuentas bancarias, documentos adjuntos), las compras de mercancía (referencia, talla, color, cantidad, costo, contado/crédito), el flujo de "Llegó mercancía" para Andrés, y el control de deudas (cuánto se debe a cada proveedor, vencimientos, historial de pagos). Al confirmar una compra/recepción, el inventario se incrementa automáticamente.

**2. Quién lo usa**
Principalmente **Don Carlos** (proveedores, compras, costos, deudas). **Andrés** puede registrar la llegada física de mercancía (sin ver costos ni deudas).

**3. Pantallas**
- Lista de proveedores + detalle (cuentas bancarias, documentos, deuda actual, historial de pagos).
- Crear/editar proveedor + agregar cuentas bancarias.
- Registrar compra (selección de proveedor, ítems con costo, contado/crédito, fecha de pago, adjuntar documentos).
- "Llegó mercancía" (flujo empleado: proveedor + ítems sin costo → confirmar recepción → notifica a Don Carlos).
- Revisión de recepción pendiente (Don Carlos completa costos y condición de pago).
- Control de deudas / registrar pago a proveedor.

**4. Qué datos maneja**
Tablas existentes: `proveedores`, `proveedor_cuentas_bancarias`, `compras` (estado pendiente_revision/completada/cancelada, condicion_pago contado/credito, total, monto_pagado, saldo_pendiente), `compra_items` (con costo_unitario), `compra_documentos` (pdf/imagen en Storage). Escribe en `productos_calzado`/`productos_varios` (stock).

**5. Reglas de negocio**
- Cada recepción del empleado queda `pendiente_revision` con campos financieros nulos; al revisar Don Carlos pasa a `completada` y el empleado pierde acceso (no ve costos ni deudas) (Regla 7).
- Las deudas no desaparecen solas; solo se eliminan cuando Don Carlos registra el pago (Regla 12).
- Andrés no ve costos ni deudas (Regla 4).
- Recibir mercancía incrementa stock; documentos adjuntos comprimidos si son imágenes.

**6. Dependencias**
Escribe en **Inventario** (calzado y varios). Alimenta **Balance** (pagos a proveedores = egreso) y **Dashboard** (alertas de pago próximo a vencer). El módulo "Recibir mercancía" del grid es el sub-flujo de empleado de este módulo.

**7. Complejidad: Complejo**
Es el módulo más grande de los administrativos: múltiples tablas, flujo de dos actores con cambio de estado y gating financiero, adjuntos en Storage, escritura de stock, y control de deudas con vencimientos/notificaciones. Conviene dividirlo en sub-entregas (proveedores+cuentas → compras+recepción → deudas/pagos).

---

## Módulo 4 — Cierre de Caja Diario

**1. Qué hace exactamente**
Resume el día (número de ventas, desglose efectivo/Nequi/Daviplata, total), permite a Andrés contar el efectivo físico y registrar diferencias (sobrante/faltante con nota), y entrega a Don Carlos comparaciones (hoy vs ayer, hoy vs mismo día semana pasada) y ventas por hora. Soporta dos modos: **manual** (Andrés abre/cierra) y **automático** (apertura/cierre por horario configurable, por defecto 6 AM–11 PM).

**2. Quién lo usa**
**Andrés** inicia el cierre (o el sistema automáticamente). **Don Carlos** configura el modo/horario y consume el resumen y las comparaciones.

**3. Pantallas**
- Cerrar caja (resumen del día + conteo de efectivo + confirmación de diferencia).
- Resumen/detalle del cierre para Don Carlos (desglose, diferencia, comparaciones, ventas por hora).
- Configuración de caja (modo manual/automático, horario) — solo dueño.

**4. Qué datos maneja**
Tabla existente: `cierres_caja` (totales por método, efectivo contado, diferencia, nota, fecha). Lee `ventas` y `metodos_pago_venta` del día (`private.hoy_bogota()`). Configuración de horario (en `empleado_config` o tabla de configuración).

**5. Reglas de negocio**
- El cierre es obligatorio antes de registrar ventas del día siguiente; si no se cerró ayer, recordar al abrir (Regla 6).
- La notificación de cierre siempre llega a Don Carlos, aunque no abra la app (Regla 13).
- Si no se cerró a las 9 PM, alerta a Don Carlos (Regla 14).
- Diferencia de efectivo se registra con nota; no se borra.

**6. Dependencias**
Lee **Nueva Venta** (ventas del día). Dispara **Reportes automáticos** (al cierre). El modo automático y las alertas dependen de la **infraestructura de cron/edge functions + push**. Cuenta de "día trabajado" para **Gestión Empleado**.

**7. Complejidad: Medio (manual) / Complejo (automático)**
El cierre manual con conteo y diferencia es Medio (lee tablas existentes + 1 tabla). El **modo automático** (cron de apertura/cierre + envío al cierre) y las **alertas por horario** suben a Complejo por requerir tareas programadas y push.

---

## Módulo 5 — Gestión del Empleado

**1. Qué hace exactamente**
Control simple del sueldo de Andrés: configuración (sueldo mensual fijo, fecha de inicio, días/semana), conteo automático de días trabajados (un día cuenta si hubo ≥1 venta o un cierre), ajustes manuales de días (ausencias/extra), cálculo del pago (días × sueldo diario = sueldo/30), registro de pagos e historial.

**2. Quién lo usa**
Solo **Don Carlos**.

**3. Pantallas**
- Configuración del empleado (sueldo, inicio, días/semana).
- Vista de días trabajados del período + ajuste manual.
- Registrar pago (monto sugerido, ajustable, fecha, período).
- Historial de pagos.

**4. Qué datos maneja**
Tablas existentes: `empleado_config` (sueldo, fecha inicio, días/semana), `empleado_dias_trabajados`, `empleado_pagos` (fecha, monto, período).

**5. Reglas de negocio**
- Día trabajado = ≥1 venta registrada o un cierre de caja ejecutado (Regla 8).
- Don Carlos puede ajustar manualmente días trabajados (Regla 9).
- Valor diario = sueldo mensual ÷ 30.
- Solo Don Carlos accede (datos financieros del empleado — Regla 4).

**6. Dependencias**
Lee actividad de **Nueva Venta** y **Cierre de Caja** (para contar días). Alimenta **Balance** (sueldo = egreso). El conteo automático de días puede implementarse con un job o derivarse on-read de ventas/cierres.

**7. Complejidad: Medio**
Tablas existentes y cálculo simple, pero el conteo automático de días trabajados cruza ventas y cierres y conviene definir bien (derivado on-read vs. job nocturno). Sin integraciones externas.

---

## Módulo 6 — Reportes y Dashboard del Dueño

**1. Qué hace exactamente**
Da a Don Carlos una visión del negocio: dashboard con el "hoy" (total, número de ventas, desglose por método, comparación vs ayer), alertas (stock bajo, pagos a proveedor por vencer, si Andrés no ha registrado ventas hoy), accesos rápidos; reporte semanal (total 7 días, día top, producto top, vs semana anterior); reporte mensual (total, desglose, top 10 productos, productos sin movimiento, vs mes anterior, proyección); e inventario completo con filtros y valor total.

**2. Quién lo usa**
Solo **Don Carlos**.

**3. Pantallas**
- Dashboard principal (hoy + alertas + accesos rápidos).
- Reporte semanal.
- Reporte mensual.
- Inventario completo (con filtros y valor total).

**4. Qué datos maneja**
Principalmente **lectura/agregación**: `ventas`, `venta_items`, `metodos_pago_venta`, `productos_calzado`/`productos_varios` (stock bajo), `compras` (vencimientos), `historial_precios_*` (valor de inventario con costo). No crea tablas nuevas; conviene apoyarse en vistas SQL o funciones de agregación.

**5. Reglas de negocio**
- Solo Don Carlos ve reportes de períodos anteriores (Regla 3) y costos/márgenes (Regla 4).
- Andrés solo ve el total del día en curso (ya cubierto en el hub de Nueva Venta).
- Historial de ventas se conserva indefinidamente (Regla 15).

**6. Dependencias**
**Depende de casi todo lo demás existiendo y con datos**: Nueva Venta, Inventario, Proveedores (vencimientos). Es un módulo de consumo; rinde mejor cuando los módulos fuente ya están construidos.

**7. Complejidad: Medio**
Sin integraciones externas, pero muchas agregaciones y comparaciones temporales (semana/mes, vs período anterior, proyección). Conviene invertir en vistas/funciones SQL reutilizables. La calidad depende de tener datos reales de los otros módulos.

---

## Módulo 7 — Análisis de Temporadas con IA

**1. Qué hace exactamente**
Analiza el historial de ventas (mínimo 3 meses) cruzado con variables de contexto (día/semana/quincena, festivos colombianos, clima de Florencia) para: mostrar el comportamiento de temporadas pasadas (qué se vendió, qué tallas/colores se agotaron primero, qué sobró, días pico), generar recomendaciones de compra antes de cada temporada, detectar productos lentos (>45 días sin venta y dinero "congelado"), y dar proyecciones simples como rango. Todo en español colombiano simple, sin jerga técnica.

**2. Quién lo usa**
Solo **Don Carlos**.

**3. Pantallas**
- Selección de temporada (predefinidas Colombia + personalizadas).
- Vista de temporada pasada (resumen narrativo + datos).
- Recomendación de compra (con margen de seguridad ajustable).
- Productos lentos.
- Proyección del mes (rango mín/probable/máx).

**4. Qué datos maneja**
Lee `ventas`/`venta_items` (historial completo), `productos_*`, `clima_registro` (ya existe; alimentada por consulta diaria del clima de Florencia), calendario de festivos de Colombia (dato semilla), definición de temporadas (predefinidas + personalizadas). Envía datos agregados a una **API de LLM** (OpenAI/Gemini) para generar el lenguaje y, opcionalmente, las recomendaciones.

**5. Reglas de negocio**
- Requiere ≥3 meses de historial; antes, muestra datos sin proyecciones.
- La IA es sugerencia, no orden; Don Carlos puede ignorar/ajustar (Regla 10).
- Lenguaje simple en español colombiano (sin gráficas técnicas).
- Solo Don Carlos (Regla 3, 4).

**6. Dependencias**
**Depende fuertemente de datos históricos** de Nueva Venta y de la captura diaria de clima (job a API de clima → `clima_registro`). Necesita calendario de festivos. Es de los últimos a construir (necesita meses de datos para ser útil).

**7. Complejidad: Complejo**
Integración con API de LLM (costo, prompts, manejo de errores), job diario de clima, calendario de festivos, agregaciones analíticas no triviales, y diseño cuidadoso del prompt para que la salida sea fiel a los datos. Alto valor pero alto esfuerzo y dependencias.

---

## Módulo 8 — Gastos Fijos

**1. Qué hace exactamente**
Registra gastos recurrentes (arriendo, electricidad, agua, internet, seguro…), genera alertas antes y en la fecha de vencimiento, y permite registrar el pago con comprobante adjunto (foto/PDF). Muestra estado por gasto (pagado / próximo a vencer / vencido), historial con comprobantes y total del mes.

**2. Quién lo usa**
Solo **Don Carlos**.

**3. Pantallas**
- Lista de gastos fijos con estado (✅/⚠️/🔴) y total del mes.
- Crear/editar gasto fijo (nombre, monto aprox., día de pago, a quién, alertas, notas).
- Registrar pago (monto real, fecha, comprobante adjunto).
- Historial de pagos con comprobantes.

**4. Qué datos maneja**
Tablas existentes: `gastos_fijos` (nombre, monto_aproximado, dia_pago, alerta_dias_antes, notas) y `gastos_fijos_pagos` (monto real, fecha, comprobante en Storage).

**5. Reglas de negocio**
- Gastos vencidos generan alerta inmediata (al abrir la app + push) (Regla 20).
- Comprobantes adjuntos (imágenes comprimidas a 500KB).
- Solo Don Carlos.

**6. Dependencias**
Alimenta **Balance** (gastos fijos pagados = egreso) y **Dashboard** (alertas de vencimiento). Las alertas/push dependen de la infraestructura de notificaciones.

**7. Complejidad: Medio**
CRUD sobre dos tablas existentes + adjuntos en Storage. Lo que sube de Simple a Medio son las **alertas de vencimiento** (cálculo de fechas + push/cron) y los comprobantes.

---

## Módulo 9 — Gastos Variables

**1. Qué hace exactamente**
Registra gastos imprevistos/no recurrentes (fletes, reparaciones, empaques, transporte para comprar mercancía, etc.) con descripción, monto, categoría (Transporte/Reparaciones/Insumos/Otros), fecha y recibo opcional. Muestra el total del mes, desglose por categoría y comparación con el mes anterior.

**2. Quién lo usa**
Principalmente **Don Carlos**. **Andrés** puede registrar gastos pequeños del día si Don Carlos lo autoriza.

**3. Pantallas**
- Registrar gasto variable (descripción, monto, categoría, fecha, recibo opcional).
- Control mensual (total, desglose por categoría, vs mes anterior).

**4. Qué datos maneja**
Tabla existente: `gastos_variables` (descripcion, monto, categoria, fecha, comprobante opcional en Storage).

**5. Reglas de negocio**
- Andrés solo registra si está autorizado (configurable); por defecto solo dueño.
- Comprobantes opcionales (imágenes comprimidas).

**6. Dependencias**
Alimenta **Balance** (egreso) y **Dashboard**. Independiente de los demás para funcionar.

**7. Complejidad: Simple**
CRUD sobre una sola tabla existente, con una agregación mensual sencilla y foto opcional. El único matiz es el permiso opcional al empleado.

---

## Módulo 10 — Balance Real del Negocio

**1. Qué hace exactamente**
Muestra si el negocio gana o pierde en un período: Ingresos (ventas efectivo+Nequi+Daviplata) menos Egresos (gastos fijos pagados + gastos variables + pagos a proveedores + sueldo de Andrés) = Balance. Pantalla mensual con desglose de egresos, resaltado en rojo si es negativo, y navegación mes a mes para ver la evolución histórica.

**2. Quién lo usa**
Solo **Don Carlos**.

**3. Pantallas**
- Balance del mes (ingresos, egresos, ganancia/pérdida, desglose de egresos).
- Navegación mes a mes (histórico).

**4. Qué datos maneja**
**Solo lectura/agregación** cruzando: `ventas` (+`metodos_pago_venta`), `gastos_fijos_pagos`, `gastos_variables`, `compras`/pagos a proveedores, `empleado_pagos`. No crea tablas; idealmente una función/vista SQL que calcule el balance por mes.

**5. Reglas de negocio**
- Balance mensual se calcula automáticamente: ingresos − egresos (Regla 21).
- Solo Don Carlos (Regla 3, 4).
- Resultado negativo se muestra claramente en rojo.

**6. Dependencias**
**Depende de que existan** Nueva Venta (ingresos), Gastos Fijos, Gastos Variables, Proveedores (pagos) y Gestión Empleado (sueldo). Es un módulo "techo": tiene sentido construirlo cuando sus fuentes de egresos ya existen, si no, el balance está incompleto.

**7. Complejidad: Medio**
Sin integraciones externas, pero su corrección depende de agregar correctamente 4–5 fuentes de egresos y manejar períodos. Conviene una función SQL única y testeable. Bajo si todas las fuentes existen; medio por la coordinación entre módulos.

---

## Módulo 11 — Reportes Automáticos Diarios

**1. Qué hace exactamente**
Al cierre de cada día (automático o manual), Venus genera un resumen y lo envía a Don Carlos sin que lo pida: **WhatsApp** siempre (mensaje corto en texto plano: total, número de ventas, desglose, más vendido, stock bajo, separados pendientes, estado de caja) y **correo** opcional (mismo resumen con más detalle). Configurable: activar/desactivar cada canal, correo destino y hora de envío.

**2. Quién lo usa**
Lo **recibe Don Carlos**. La **configuración** la hace Don Carlos.

**3. Pantallas**
- Configuración de reportes (WhatsApp on/off, correo on/off, correo destino, hora de envío).
- (La "salida" no es una pantalla de la app sino el mensaje de WhatsApp/correo.)

**4. Qué datos maneja**
Lee el resumen del día (mismos datos que Cierre de Caja: `ventas`, `metodos_pago_venta`, productos top, stock bajo, separados). Necesita: configuración de reportes (canales, destino, hora), integración con **API de WhatsApp** (ej. WhatsApp Cloud API / proveedor) y **servicio de correo** (ej. Resend/SMTP). Implementado vía **Edge Function** disparada por el cierre o por cron.

**5. Reglas de negocio**
- El reporte por WhatsApp siempre se envía a Don Carlos al cierre (Reglas 13); por defecto WhatsApp activado, correo desactivado.
- Hora de envío por defecto: al cierre de caja.
- Debe llegar aunque Don Carlos no abra la app (es push externo, no in-app).

**6. Dependencias**
Depende de **Cierre de Caja** (disparador y datos), **Nueva Venta** e **Inventario** (contenido). Depende de **infraestructura externa**: cuenta/API de WhatsApp, servicio de correo, Edge Functions + secrets. Comparte mecanismo con las notificaciones push de otros módulos.

**7. Complejidad: Complejo**
Integraciones externas (WhatsApp + correo), Edge Functions, manejo de secrets y de fallos de envío/reintentos, y dependencia del flujo de cierre. La API de WhatsApp en particular implica aprobación de número/plantillas y posible costo.

---

## Módulo 12 — Carga Inicial del Inventario

**1. Qué hace exactamente**
Permite pasar el inventario del cuaderno físico a la app antes de empezar, por dos métodos combinables: **(1) Plantilla Excel** — Don Carlos llena una plantilla con columnas fijas y listas desplegables, la sube y Venus importa todas las filas, mostrando un resumen; **(2) Fotografiar el cuaderno con IA de visión** — se toman fotos, la IA extrae categoría/descripción/talla/color/cantidad/precio, Don Carlos revisa fila por fila (✅/✏️, rojo lo que no se leyó) y confirma. La referencia de proveedor puede quedar vacía.

**2. Quién lo usa**
Solo **Don Carlos** (carga inicial del negocio).

**3. Pantallas**
- Carga inicial (elegir método).
- Importar Excel (subir archivo + previsualización + resumen "se cargaron X productos en Y referencias").
- Fotografiar cuaderno (cámara → lista revisable con ✅/✏️ y filas en rojo a completar → confirmar).

**4. Qué datos maneja**
Escribe masivamente en `productos_calzado` y `productos_varios`. Para Excel: parsing de archivo (validación de categorías/colores). Para IA: subida de fotos + **API de IA de visión (OCR/LLM)** para extraer estructura. Referencia opcional.

**5. Reglas de negocio**
- Validación de categorías/colores (las 7 categorías fijas) en la importación.
- La referencia de proveedor no es obligatoria (la mayoría del inventario actual no la tiene); se puede completar después.
- El método de IA es asistido: Don Carlos revisa y corrige antes de confirmar (no se carga a ciegas).
- Fotos comprimidas si se almacenan.

**6. Dependencias**
Escribe en **Inventario** (calzado y varios), por lo que esos modelos deben existir (ya existen). El método IA comparte motor con **Análisis IA** (visión/LLM). Es un módulo de **arranque** (one-time), pero muy valioso para reducir la fricción de adopción.

**7. Complejidad: Complejo**
Dos vías técnicas distintas: parsing/validación de Excel (medio) **y** OCR/visión con IA + UI de revisión/corrección (complejo). Más generación y mantenimiento de la plantilla Excel. La parte de IA depende de la calidad de la letra (riesgo reconocido en el PRD).

---

## Resumen y orden de construcción sugerido

### Tabla resumen

| # | Módulo | Usuario | Complejidad | Backend ya existe |
|---|---|---|---|---|
| 1 | Inventario calzado | Ambos (editar: dueño) | Medio | Sí |
| 2 | Inventario varios | Ambos (editar: dueño) | Simple | Sí |
| 3 | Proveedores (+recibir mercancía) | Dueño / Andrés recibe | Complejo | Sí |
| 4 | Cierre de caja | Andrés / dueño config | Medio (manual) · Complejo (auto) | Sí |
| 5 | Gestión empleado | Dueño | Medio | Sí |
| 6 | Reportes y dashboard | Dueño | Medio | Lectura |
| 7 | Análisis IA temporadas | Dueño | Complejo | Parcial (clima) |
| 8 | Gastos fijos | Dueño | Medio | Sí |
| 9 | Gastos variables | Dueño/(Andrés autorizado) | Simple | Sí |
| 10 | Balance | Dueño | Medio | Lectura |
| 11 | Reportes automáticos | Dueño (recibe) | Complejo | Parcial |
| 12 | Carga inicial inventario | Dueño | Complejo | Escribe inventario |

### Orden de construcción recomendado (propuesta, sujeta a la decisión del fundador)

1. **Inventario varios** (Simple) y **Inventario calzado** (Medio) — base de datos del catálogo; complementan Nueva Venta y son prerrequisito de casi todo. Establecen los patrones de foto/Storage e historial de precios.
2. **Carga inicial** — apenas exista el Inventario, conviene para meter el inventario real y poder operar/ver datos verdaderos (puede empezar solo por el método Excel y dejar IA después).
3. **Cierre de caja (manual)** — cierra el ciclo operativo diario de Andrés; habilita "día trabajado".
4. **Gastos variables** (Simple) y **Gastos fijos** (Medio) — egresos, prerrequisitos del Balance.
5. **Proveedores** (Complejo, por fases) — recepción de mercancía + deudas; egreso de proveedores para el Balance.
6. **Gestión empleado** (Medio) — sueldo, último egreso del Balance.
7. **Balance** (Medio) — ya con todas las fuentes de egresos disponibles.
8. **Reportes y dashboard** (Medio) — consume todo lo anterior; máximo valor cuando hay datos.
9. **Infraestructura de notificaciones/cron** (transversal) — habilita cierre automático, alertas de vencimiento y push. Conviene montarla antes de los reportes automáticos.
10. **Reportes automáticos** (Complejo) — requiere cierre + infra de envío (WhatsApp/correo).
11. **Análisis IA temporadas** (Complejo) — al final: necesita ≥3 meses de datos reales para ser útil.

**Razonamiento del orden:** primero los módulos que generan datos y cierran la operación diaria (inventario, carga inicial, cierre, gastos), luego los que consumen y agregan (balance, dashboard), y al final los que dependen de infraestructura externa o de meses de historial (reportes automáticos, IA). Esto maximiza el valor entregable temprano y respeta las dependencias.

### Infraestructura transversal a decidir antes de varios módulos

- **Notificaciones push** (expo-notifications) + **Edge Functions + pg_cron**: requeridas por cierre automático (M4), alertas de vencimiento (M3, M8) y reportes automáticos (M11).
- **Integraciones externas con costo/aprobación**: API de WhatsApp (M11), servicio de correo (M11), API de LLM de texto y de visión (M7, M12), API de clima (M7). Definir proveedores y presupuesto.
- **Offline-first**: sigue diferido para todo el sistema; decidir si/ cuándo se aborda (afecta especialmente Nueva Venta y Cierre de Caja en el local).
