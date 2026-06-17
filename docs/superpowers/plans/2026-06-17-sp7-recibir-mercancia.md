# Plan de Implementación: Recibir Mercancía (M5)

## Fases de Desarrollo

### Fase 1: Configuración de Rutas y Layout
- [ ] **T1.1:** Registrar la ruta `/recibir-mercancia` para el módulo `recibir-mercancia` en `lib/permisos.ts`.
- [ ] **T1.2:** Crear `app/(app)/recibir-mercancia/_layout.tsx` para definir el router stack de pantallas y proteger el módulo con `useRequireModulo('recibir-mercancia')`.

### Fase 2: Pantalla Principal (Index)
- [ ] **T2.1:** Crear `app/(app)/recibir-mercancia/index.tsx` que maneje la lista de pendientes de revisión para dueños/administradores e histórico operativo para empleados.

### Fase 3: Registro de Entrada (Nueva)
- [ ] **T3.1:** Crear `app/(app)/recibir-mercancia/nueva.tsx` con soporte para selección de proveedor y selección de productos.
- [ ] **T3.2:** Añadir modal de creación rápida de proveedores e integrarlo inline.
- [ ] **T3.3:** Añadir modal de creación rápida de calzado en catálogo e integrarlo inline.
- [ ] **T3.4:** Añadir formulario financiero condicional para Andrés/Sandra (dueño/admin) y botones para confirmar física/directa.

### Fase 4: Completar Entrada Pendiente (Detalle)
- [ ] **T4.1:** Crear `app/(app)/recibir-mercancia/[id].tsx` para permitir que dueños/administradores ingresen los costos y completen las facturas pendientes.

### Fase 5: Pruebas y Verificación
- [ ] **T5.1:** Escribir suite de pruebas unitarias en `lib/recibir_mercancia_ui.test.tsx` cubriendo todos los flujos e interacciones de roles.
- [ ] **T5.2:** Ejecutar `npx tsc --noEmit` y confirmar que no hay errores de tipado.
- [ ] **T5.3:** Correr `npm test` y verificar que la suite pase al 100%.
- [ ] **T5.4:** Autorevisión de cambios y merge final.
