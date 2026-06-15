# Venus - Guía para Claude Code

## Qué es este proyecto
Venus es una app Android para gestionar la tienda de calzado familiar "Venus" en Florencia, Caquetá, Colombia. Reemplaza un cuaderno físico con un sistema digital simple, ágil y completo, con auditoría de cada acción.

Documento maestro del producto: `docs/Venus_PRD_v4.0.md` (reemplaza al v3.0). Ante cualquier duda de comportamiento, el PRD v4.0 manda.

## Usuarios y roles
Nombres reales de las cuentas provisionadas (en `public.users` + Supabase Auth):

- **Andrés Artunduaga** (`venusdelcaqueta@gmail.com`) — **dueño** (`rol = 'dueno'`). Ve TODO sin excepción: costos, márgenes, balance, deudas con proveedores, pagos a empleados, reportes históricos y la auditoría completa. Único que puede crear/desactivar empleados.
- **Sandra Cardona** (`sandracardona.venus2026@gmail.com`) — empleada **administrativa**: casi los mismos permisos que Andrés EXCEPTO finanzas (no ve costos/márgenes, balance, pagos a empleados ni deudas; no gestiona empleados). Sí gestiona proveedores, gastos fijos y ve reportes históricos.
- **Camilo Artunduaga** (`artuneleven1@gmail.com`), **Beatriz Bueno** (`beatrizbueno1979@gmail.com`), **Nikol Artunduaga** (email pendiente) — empleados **operativos**: ventas, devoluciones, inventario calzado y Granja (ver y editar), recibir mercancía, gastos variables (con autorización) y caja (abrir/cerrar). No ven finanzas ni gestionan proveedores/gastos fijos/empleados.

### Regla de permisos (resumen)
Los empleados tienen casi todos los permisos. **Solo Andrés ve finanzas, costos y márgenes** (más balance, pagos a empleados, deudas con proveedores y gestión de usuarios). Sandra es un nivel intermedio (administrativa sin finanzas). El detalle fino está en la tabla de permisos del PRD v4.0 (§2).

### Auditoría
TODA acción registra quién la hizo, cuándo y qué cambió. Andrés puede ver el historial de acciones de cada empleado. Las tablas llevan `created_by` y registro de auditoría en acciones críticas.

## Stack tecnológico
- React Native con Expo SDK 54 (TypeScript estricto)
- expo-router (navegación basada en archivos)
- Supabase (PostgreSQL 17, Auth, Storage) con RLS activado en todas las tablas
- Online-first en esta versión. Offline-first diferido.
- Cliente Supabase en: `lib/supabase.ts`. Tipos generados en `lib/database.types.ts`.

## Módulos del sistema (15)
1. **Nueva Venta** — zapatos y Granja; carrito, regateo con precio mín/máx, pagos simples o mixtos, efectivo recibido y cambio, cliente opcional (incluye cédula), nota de venta. Ventas Separadas / pago parcial = v2.
2. **Devoluciones** — total, parcial o cambio de producto; restituye stock de calzado; todo auditado.
3. **Inventario de Calzado** — 7 categorías fijas (Chanclas, Escolar, Botas caucho, Deportivo, Tennis, Clásico, Otros); precio mín/máx; búsqueda en tiempo real; "¿Agregar otro similar?".
4. **Granja** (antes Productos Varios) — productos que no son zapatos; SIN stock; precio se ingresa en el momento de la venta; cálculo por unidad de medida.
5. **Recibir Mercancía** — entrada de mercancía; puede crear producto nuevo sin salir del flujo; sube stock de calzado.
6. **Proveedores** — datos, cuentas bancarias, documentos, deudas; botón WhatsApp directo. (Andrés y Sandra.)
7. **Caja** (antes Cierre de Caja) — apertura/cierre del día, automático configurable o manual.
8. **Gestión de Empleados** — Andrés crea/desactiva empleados desde la app, sueldos, días trabajados, pagos. (Solo Andrés.)
9. **Gastos Fijos** — recurrentes con alertas de vencimiento y comprobantes. (Andrés y Sandra.)
10. **Gastos Variables** — imprevistos por categoría. (Andrés y Sandra; otros con autorización.)
11. **Balance** — ingresos netos − egresos; proyección del mes; histórico. (Solo Andrés.)
12. **Reportes y Dashboard** — visión del negocio (Andrés; Sandra sin datos de costos).
13. **Reportes Automáticos** — resumen diario al cierre por WhatsApp (siempre) y correo (opcional).
14. **Análisis IA Temporadas** — recomendaciones de compra cruzando ventas, festivos y clima. (Solo Andrés; requiere 3+ meses de datos.)
15. **Carga Inicial del Inventario** — plantilla Excel e IA con cámara. (Andrés y Sandra.)

## Reglas críticas de negocio
- Una venta confirmada NUNCA se elimina; solo se corrige con nota o se procesa una devolución.
- El inventario de calzado NUNCA queda en negativo; los agotados siguen visibles como AGOTADO.
- **Granja no maneja stock** y su precio se define en el momento de la venta (no hay precio guardado).
- Regateo permitido: cada zapato tiene precio mínimo y máximo; el precio final pagado queda guardado por item.
- Solo Andrés ve costos de compra, márgenes, balance y reportes financieros completos.
- Los pagos deben sumar EXACTAMENTE el total para confirmar; pagos mixtos permitidos (ej. efectivo + Nequi).
- Devoluciones: no se puede devolver más de lo vendido; Granja no restituye stock; todo auditado.
- Ventas separadas (v2): descuentan stock al separar; nombre y teléfono del cliente obligatorios; solo Andrés cancela una separación.
- Toda acción registra quién la hizo y cuándo (auditoría completa).
- Las fotos se comprimen a máximo 500KB antes de subir a Storage.

## Variables de entorno
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

## Convenciones de código
- TypeScript estricto en todo el proyecto
- `lib/` para utilidades compartidas y acceso a datos
- `app/` para rutas (expo-router); pantallas dentro de los grupos de ruta
- `hooks/` para custom hooks
- Lógica pura y testeable separada del acceso a datos y de la UI (ej. `lib/carrito.ts` con tests)
- Todo en español en la UI

## Estado de implementación (al 2026-06-14)
- Construido: autenticación + navegación por rol; Módulo 1 Nueva Venta v1 (online-first).
- **Pendiente de alinear con v4.0:** el modelo de roles en código y RLS aún es de 2 niveles (`dueno`/`empleado`) y el `empleado` está más restringido que en v4.0; "Granja" todavía es `productos_varios` CON stock y precio guardado. Estos ajustes (3 niveles de permiso, Granja sin stock, devoluciones, auditoría `created_by`, precio mín/máx) se deben planear antes de construir nuevos módulos. Plan de módulos en `docs/plan-modulos-pendientes.md` (a actualizar contra v4.0).

## No construir en esta versión
- Facturación electrónica DIAN
- E-commerce o catálogo por WhatsApp
- Nómina electrónica
- Contabilidad formal
- Múltiples sucursales
- App para iOS
- Panel web
- Ventas a crédito formal con intereses
- Offline-first (diferido)
