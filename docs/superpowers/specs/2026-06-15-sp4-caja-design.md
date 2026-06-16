# Venus — SP-4: Cierre de Caja (Modo Manual)
**Design Specification**

## 1. Objetivo
Permitir a los empleados (Camilo, Beatriz, Nikol, Sandra) y a Andrés Artunduaga abrir y cerrar el día operativo del negocio. Este módulo consolida los ingresos de todas las ventas realizadas durante el día, exige que el empleado cuente el dinero físico (efectivo), y calcula de forma automática la existencia de faltantes o sobrantes.

Este plan cubre la versión **Modo Manual**, en la cual los empleados inician el proceso pulsando "Abrir caja" y "Cerrar caja" voluntariamente. El modo automático y las notificaciones automáticas por WhatsApp se dejan para un posterior módulo (SP-5/SP-6) una vez tengamos infraestructura de tareas en la nube (Edge Functions).

---

## 2. Roles y Accesos (RLS)
- **Operación diaria:** Cualquier empleado autenticado puede abrir la caja, ver el estado actual del día y realizar el cierre.
- **Auditoría / Historial:** *Solo Andrés* (el dueño) podrá consultar el histórico de los días anteriores. Los empleados solo verán el resumen del día *en curso* y perderán acceso a ese día una vez que lo hayan cerrado.
- **Transparencia:** Todo cierre registra inmutablemente el ID del empleado que realizó la acción (`cerrado_por`).

---

## 3. Lógica Funcional

### 3.1. Estado del Día
La aplicación móvil consultará la base de datos (RPC o query directa filtrada por `fecha` = hoy) para determinar en qué estado se encuentra la caja:
1. **No abierta:** Aparece un botón grande "Abrir Caja". Al tocarlo, se crea un registro en `cierres_caja` con `estado = 'abierto'`, la fecha actual y `modo = 'manual'`.
2. **Abierta:** Se muestra un dashboard resumen en vivo:
   - Número total de ventas del día.
   - Total general vendido.
   - Desglose por métodos: Efectivo, Nequi, Daviplata.
   - *Nota: Este dashboard en vivo se alimentará sumando todas las `ventas` vinculadas a la caja del día actual.*
3. **Cerrada:** Muestra el reporte final congelado del día (cuánto efectivo se contó, diferencia, y nota si la hubo). Ya no se puede modificar. 

### 3.2. Proceso de Cierre
Cuando la caja está "Abierta" y termina el turno:
1. El empleado presiona **"Cerrar Caja"**.
2. La app le pide que ingrese la cantidad exacta de billetes y monedas que hay físicamente en la gaveta (campo numérico: **Efectivo Contado**).
3. El sistema compara el *Efectivo Contado* contra el *Total en Efectivo* registrado por las ventas.
4. Si hay una diferencia (positiva = sobrante; negativa = faltante), el sistema despliega un campo de texto obligatorio llamado **"Justificación / Nota"**. (Ej. *"Compré bolsas de hielo y se me olvidó registrar el gasto"* o *"No sé por qué sobran $5.000"*).
5. Al confirmar, la caja pasa a estado `cerrado`, y la fila de `cierres_caja` se actualiza con todos los totales finales (`total_general`, `total_efectivo`, `total_nequi`, `total_daviplata`, `efectivo_contado`, `diferencia`, `diferencia_nota`, `cierre_at`).

### 3.3. Bloqueo de Ventas (Gating)
- En el módulo de *Nueva Venta* (SP-2), se debe añadir una validación simple: **No se puede cobrar una venta si la caja de hoy no está abierta**. Si el empleado lo intenta, un Alert le avisará: *"Abre la caja primero en el módulo de Cierre"*.
- Si la caja del día ya fue cerrada, tampoco se pueden registrar más ventas en ese día.

---

## 4. Consideraciones Técnicas
- **Tabla principal:** `public.cierres_caja` (ya existe).
- **Cálculo de Totales:** Crearemos un nuevo servicio (`lib/caja.ts`) con una función que traiga todas las ventas de la fecha actual y agrupe los montos según la tabla de `metodos_pago_venta`. Esto previene que el total dependa del caché local del teléfono y garantiza exactitud.
- **Zonas horarias:** Para las consultas SQL y filtros de fecha usaremos siempre la zona horaria de Colombia (Bogotá), tal y como se diseñó en el PRD.

---

## 5. Criterios de Aceptación (Smoke Tests)
1. Al iniciar un día nuevo, el empleado ve la opción "Abrir Caja".
2. Tras abrir la caja, las ventas registradas se reflejan en tiempo real en los contadores del módulo de caja.
3. El empleado intenta hacer un Cierre indicando menos dinero del vendido en efectivo; el sistema le exige dejar una Nota.
4. Una vez cerrado, el empleado ya no puede registrar nuevas ventas ese mismo día (aparece el bloqueo).
5. Andrés puede entrar a la pestaña "Historial de Cierres" y ver una lista de días pasados con sus sobrantes/faltantes.
