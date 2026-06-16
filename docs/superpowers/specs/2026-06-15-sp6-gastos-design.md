# Venus — SP-6: Gastos Fijos y Variables
**Design Specification**

## 1. Objetivo
Dotar a Andrés Artunduaga de un centro de control de egresos donde pueda registrar pagos recurrentes (como el arriendo o los servicios públicos) y gastos del día a día (fletes, reparaciones). Esta información es la base para el futuro módulo de Balance que calculará la rentabilidad neta del negocio.

---

## 2. Roles y Accesos
- **Gastos Fijos:** Acceso **exclusivo para el Dueño** (`dueno`). Los empleados no deben saber cuánto paga el negocio de arriendo ni servicios.
- **Gastos Variables:** Principalmente para el Dueño. Sin embargo, se prevé una configuración para permitir a los empleados (Camilo o Beatriz) registrar "gastos menores" sacados de la caja del día (como pagar un envío o un taxi), dejando un registro transparente. Por ahora, se mantendrá acceso exclusivo a `dueno` o a un empleado autorizado.

---

## 3. Lógica Funcional

### 3.1. Gastos Variables (El día a día)
Para fletes, reparaciones menores, o artículos de limpieza.
1. **Pantalla de Registro:** Un formulario simple con:
   - Descripción (Ej. "Flete de los tennis Nike").
   - Monto ($).
   - Categoría (Selector: Transporte, Insumos, Reparaciones, Otros).
   - Comprobante Fotográfico (Opcional, usando `expo-image-picker` y la compresión de 500KB diseñada en SP-1/SP-3).
2. **Dashboard Mensual:** Una lista agrupada de los gastos de este mes para que el dueño sepa en qué se está yendo el dinero menudo.

### 3.2. Gastos Fijos (Los compromisos mensuales)
Para Arriendo, Internet, Agua, Luz, etc. Funciona en dos niveles:
1. **El Contrato / Definición:** El dueño crea el Gasto Fijo indicando el Nombre, el Monto Aproximado y el Día de Pago (ej. los días 15).
2. **El Pago Real:** Cada mes, el sistema le recuerda al dueño que debe pagar ese gasto. El dueño entra y le da a "Registrar Pago", ingresa la cantidad exacta que pagó este mes y sube la foto del recibo pagado.

### 3.3. Alertas Preventivas Visuales
En la pantalla de Gastos Fijos, la aplicación pondrá un icono visual dinámico:
- 🟢 **Al Día:** Si el pago de este mes ya se registró.
- 🟡 **Por Vencer:** Si faltan 5 días o menos para el "Día de Pago".
- 🔴 **Vencido:** Si ya pasó el "Día de Pago" de este mes y no hay pago registrado.

*(Nota: En fases posteriores con servicios en la nube, estas alertas también te llegarán como Notificación Push a tu teléfono).*

---

## 4. Consideraciones Técnicas
- **Tablas a utilizar (ya existen en el esquema):** 
  - `public.gastos_variables`
  - `public.gastos_fijos` (Definición del contrato)
  - `public.gastos_fijos_pagos` (Historial de recibos pagados)
- **Cámara:** Se reciclará la función `lib/imagenes.ts` para que subir un recibo pagado sea instantáneo y no consuma mucho espacio en tu cuota gratuita de Supabase Storage.

---

## 5. Criterios de Aceptación (Smoke Tests)
1. El Dueño puede entrar a la sección de Egresos; si entra un empleado no autorizado, se le bloquea el paso.
2. El Dueño registra un Gasto Variable por $15.000 de "Bolsas de Empaque" y sube la foto de la factura; este aparece en el listado mensual.
3. El Dueño crea el Gasto Fijo de "Internet" para el día 28. Como hoy no es 28 y no ha pagado, aparece la alerta visual (Vencido o Por Vencer según la fecha de prueba).
4. Al registrar un pago sobre "Internet", el estado del gasto cambia a "Al Día" verde.
