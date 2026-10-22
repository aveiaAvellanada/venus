# Venus - Guía para Claude Code

## Qué es este proyecto
Venus es una app Android para gestionar la tienda de calzado familiar "Venus" en Florencia, Caquetá, Colombia. Reemplaza un cuaderno físico con un sistema digital simple, ágil y completo, con auditoría de cada acción.

Documento maestro del producto: `docs/Venus_PRD_v4.0.md` (reemplaza al v3.0). Ante cualquier duda de comportamiento, el PRD v4.0 manda.

## Usuarios y permisos
No hay personas fijas en el código. Hay **un dueño** (`users.rol = 'dueno'`, hoy Andrés Artunduaga) que tiene todo y es el único que crea, desactiva y da permisos a los empleados desde la app (Perfil → Empleados). Cada empleado (`rol = 'empleado'`) puede **exactamente** lo que diga su lista `users.permisos`; las personas cambian con el tiempo (entran, se desactivan).

- **Login:** usuario + PIN de 6 dígitos. El correo de Supabase Auth es `usuario@venus.invalid` (dominio reservado); la app no lleva correos ni lista del equipo, solo recuerda en cada teléfono a quienes ya entraron. Cuentas con PIN viejo de 4 dígitos (`debe_cambiar_pin`) crean uno de 6 al entrar.
- **Permisos** (filas del cuadro del PRD v4.0 §2; deben coincidir en `lib/permisos.ts` y `private.permisos_validos()`): operación `ventas`, `devoluciones`, `inventario`, `recibir_mercancia`, `caja`, `gastos`; administración `proveedores`, `gastos_fijos`, `reportes`, `carga_inicial`; finanzas `costos`, `deudas`, `balance`.
- **Plantillas** (solo preseleccionan): *Operativo* = operación; *Administrativo* = operación + administración. Finanzas nunca viene en plantilla: el dueño la entrega a propósito.
- **Solo el dueño, no delegable:** crear/desactivar empleados, permisos, PIN de otros, sueldos y pagos a empleados, configuración de caja y de reportes automáticos, dashboard del dueño.
- **Ventas de otros días:** las ve quien tiene `reportes` (historial) o `devoluciones` (para buscar la venta de una garantía o un cambio); el resto solo las de hoy y las separadas. En Movimientos, los chips de período salen con cualquiera de los dos; en el Menú, solo con `reportes`.
- **Dónde se aplica:** en la base con `private.tiene_permiso('<permiso>')` / `private.es_dueno()` (exigen la cuenta activa) en RLS y RPC; en la app con `tienePermiso(perfil, ...)`, `esDueno(perfil)` y `useRequireModulo`. La base manda: nunca confíes solo en la UI.

### Auditoría
TODA acción registra quién la hizo, cuándo y qué cambió. El dueño puede ver el historial de acciones de cada empleado. Las tablas llevan `created_by` y registro de auditoría en acciones críticas.

## Stack tecnológico
- React Native 0.86 con Expo SDK 57 (TypeScript estricto) — la versión que corre Expo Go actual
- expo-router (navegación basada en archivos)
- Supabase (PostgreSQL 17, Auth, Storage) con RLS activado en todas las tablas
- Online-first en esta versión. Offline-first diferido.
- Cliente Supabase en: `lib/supabase.ts`. Tipos generados en `shared/database.types.ts` (`lib/database.types.ts` los re-exporta). Código puro común a la app y al panel web en `shared/`.

## Módulos del sistema (15)
Entre paréntesis, el acceso por defecto según el PRD (plantillas). En la app cada acceso es un permiso que el dueño entrega o quita por persona.

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
- Regateo: el mínimo (obligatorio) y el máximo (opcional) son precios **recomendados**, por variante y, si se quiere, por rango de tallas de la referencia (`calzado_tramos_precio`, igual para todos los colores). El precio final de la venta es libre (sin aviso ni bloqueo); queda guardado por item con los recomendados y la garantía de ese momento.
- Garantía: `productos_calzado.garantia_dias`, por referencia (`fijar_garantia_referencia`); queda en `venta_items.garantia_dias_snapshot`, se muestra en la venta y la devolución avisa si ya venció (no bloquea).
- Cambio de calzado: el reemplazo es cualquier modelo activo (se busca la referencia, color y talla, y se fija su precio); la diferencia con lo realmente pagado se cobra (un solo medio) o se devuelve (efectivo por defecto).
- Costos de compra, deudas con proveedores y balance requieren su permiso (`costos`, `deudas`, `balance`); por defecto solo el dueño los tiene.
- Los pagos deben sumar EXACTAMENTE el total para confirmar; pagos mixtos permitidos (ej. efectivo + Nequi).
- Devoluciones: no se puede devolver más de lo vendido; Granja no restituye stock; todo auditado.
- Ventas separadas (v2): descuentan stock al separar; nombre y teléfono del cliente obligatorios; solo el dueño cancela una separación.
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

## Estado de implementación (al 2026-10-09)
- Construidos M1–M13 y M15 (fase 1); falta M14 Análisis IA (requiere 3+ meses de datos). Nunca se ha probado en un teléfono ni desplegado.
- Usuarios dinámicos y permisos por persona (arriba), arqueo de caja con base y gastos del cajón, ventas idempotentes, devoluciones contadas en su fecha.
- Migraciones `20261009*` aplicadas al remoto el 2026-10-09 (verificación de despliegue OK, tipos regenerados). Pendiente: APK con EAS y prueba en teléfono, siguiendo `docs/despliegue.md`. CI en `.github/workflows/ci.yml`.
- Rediseño de Productos y del carrito (ramas `rediseno-productos` / `rediseno-carrito`): paleta monocroma, carrito que se vacía al vender, cierre de caja siempre con conteo, cédula o razón social del cliente. Migraciones `20261011*` (`caja_cierre_siempre_con_diferencia`, `ventas_cliente_documento`) aplicadas al remoto el 2026-10-11 por SQL Editor (registradas en el historial; comprobado: 2 versiones, 0 cajas sin conteo, una sola `registrar_venta` con `p_cliente_documento`, columna `ventas.cliente_documento`). Los tipos de `shared/database.types.ts` ya las incluyen (generados de una base local con todas las migraciones; regenerar desde el remoto cuando haya acceso con la CLI).
- Panel web de administración (solo el dueño; back-office, análisis, replicable para otros negocios) en `web/`: fase 0 hecha (login solo dueño, navegación, búsqueda global, Inicio, historial de acciones registrando en la base) y fase 1 construida (inventario y precios, proveedores, compras, carga masiva; `docs/panel-web-fase1.md`) y de la fase 2 el conteo físico (`/conteo`, rama `panel-web-conteo` integrada a `main` el 2026-10-22 junto con las ramas de ajustes, colores y maqueta de Movimientos, migración `20261022180000_panel_conteo_fisico` aplicada al remoto el 2026-10-22 con el conector de Supabase, registrada con esa versión, `verificar_despliegue` OK y tipos regenerados del remoto; `docs/panel-web-fase2.md`). El panel usa la misma paleta monocroma y tipografía de la app (`web/src/index.css` copia `paletaClara`/`paletaOscura` de `lib/theme.ts`) y tema Claro/Oscuro/Sistema como Perfil → Tema (`web/src/lib/tema.ts`). Plan y fases en `docs/panel-web.md`.
- Expo SDK 57 (React Native 0.86): es la versión que acepta el Expo Go actual (rama `claude/lucid-mccarthy-f4rpl6`, integrada). Pendiente: validar de punta a punta en un dispositivo.

- Ajustes del 2026-10-16 (`docs/plan-ajustes-2026-10-16.md`): Ola 1 (teclado con `ScreenWrapper`, "Cédula o NIT", venta exitosa que vuelve al menú, Gastos en Perfil → Negocio) y Ola 2 (migración `20261017043632_precios_por_talla_garantia.sql`: máximo opcional, precio libre, tramos por talla, garantía, cambio con reemplazo de cualquier modelo). Ramas `ajustes-ola1` / `ajustes-ola2`. Migración `20261017043632_precios_por_talla_garantia` aplicada al remoto el 2026-10-17 (verificada: una sola `registrar_venta`, máximo nullable, columnas de garantía, tabla de tramos con RLS y la prueba `precios_por_talla_test.sql` corrida con rollback); tipos regenerados del remoto. Pendiente: pago mixto de la diferencia en un cambio (hoy un solo medio) y el diseño de stock por rangos (Recibir mercancía, Carga inicial y masiva).

- Cambios de la maqueta `docs/maquetas/movimientos.html` (2026-10-21, rama `maqueta-movimientos`): barra inferior flotante en píldora (`useEspacioTabBar` para el espacio al final de cada pestaña), barras del gráfico en píldora, salmón `#F7C5BC` (gastos fijos por vencer, caja CERRADA) y verde `#D2F47A` (caja ABIERTA) en `lib/theme.ts`, buscador del reemplazo igual a Productos → Calzado, y Movimientos por producto, agrupado por día y con buscador dentro del período elegido. Migración `20261022022841_devoluciones_ven_ventas_de_otros_dias` aplicada al remoto el 2026-10-21 (probada con rollback).

## No construir en esta versión
- Facturación electrónica DIAN
- E-commerce o catálogo por WhatsApp
- Nómina electrónica
- Contabilidad formal
- Múltiples sucursales
- App para iOS
- Ventas a crédito formal con intereses
- Offline-first (diferido)
