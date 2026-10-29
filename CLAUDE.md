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
- Online-first, con modo sin conexión solo para vender (ver el estado del 2026-10-29). Offline-first completo diferido.
- Cliente Supabase en: `lib/supabase.ts`. Tipos generados en `shared/database.types.ts` (`lib/database.types.ts` los re-exporta). Código puro común a la app y al panel web en `shared/`.

## Módulos del sistema (15)
Entre paréntesis, el acceso por defecto según el PRD (plantillas). En la app cada acceso es un permiso que el dueño entrega o quita por persona.

1. **Nueva Venta** — zapatos y Granja; carrito, regateo con precio mín/máx, pagos simples o mixtos, efectivo recibido y cambio, cliente opcional (incluye cédula), nota de venta. Ventas Separadas / pago parcial = v2.
2. **Devoluciones** — total, parcial o cambio de producto; restituye stock de calzado; todo auditado.
3. **Inventario de Calzado** — 9 categorías fijas (Chanclas, Escolar, Botas caucho, Botas material, Fútbol, Infantil, Tennis, Clásico, Otros; `shared/excel.ts` y el CHECK de la base); referencia automática; precio mín/máx; búsqueda en tiempo real; "¿Agregar otro similar?".
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
- Panel web de administración (solo el dueño; back-office, análisis, replicable para otros negocios) en `web/`: fase 0 hecha (login solo dueño, navegación, búsqueda global, Inicio, historial de acciones registrando en la base) y fase 1 construida (inventario y precios, proveedores, compras, carga masiva, carga inicial con fotos; `docs/panel-web-fase1.md`) y de la fase 2 el conteo físico (`/conteo`, rama `panel-web-conteo` integrada a `main` el 2026-10-22 junto con las ramas de ajustes, colores y maqueta de Movimientos, migración `20261022180000_panel_conteo_fisico` aplicada al remoto el 2026-10-22 con el conector de Supabase, registrada con esa versión, `verificar_despliegue` OK y tipos regenerados del remoto; `docs/panel-web-fase2.md`). El panel usa la misma paleta monocroma y tipografía de la app (`web/src/index.css` copia `paletaClara`/`paletaOscura` de `lib/theme.ts`) y tema Claro/Oscuro/Sistema como Perfil → Tema (`web/src/lib/tema.ts`). Plan y fases en `docs/panel-web.md`.
- Expo SDK 57 (React Native 0.86): es la versión que acepta el Expo Go actual (rama `claude/lucid-mccarthy-f4rpl6`, integrada). Pendiente: validar de punta a punta en un dispositivo.

- Ajustes del 2026-10-16 (`docs/plan-ajustes-2026-10-16.md`): Ola 1 (teclado con `ScreenWrapper`, "Cédula o NIT", venta exitosa que vuelve al menú, Gastos en Perfil → Negocio) y Ola 2 (migración `20261017043632_precios_por_talla_garantia.sql`: máximo opcional, precio libre, tramos por talla, garantía, cambio con reemplazo de cualquier modelo). Ramas `ajustes-ola1` / `ajustes-ola2`. Migración `20261017043632_precios_por_talla_garantia` aplicada al remoto el 2026-10-17 (verificada: una sola `registrar_venta`, máximo nullable, columnas de garantía, tabla de tramos con RLS y la prueba `precios_por_talla_test.sql` corrida con rollback); tipos regenerados del remoto. Pendiente: pago mixto de la diferencia en un cambio (hoy un solo medio) y el diseño de stock por rangos (Recibir mercancía, Carga inicial y masiva).

- Cambios de la maqueta `docs/maquetas/movimientos.html` (2026-10-21, rama `maqueta-movimientos`): barra inferior flotante en píldora (`useEspacioTabBar` para el espacio al final de cada pestaña), barras del gráfico en píldora, salmón `#F7C5BC` (gastos fijos por vencer, caja CERRADA) y verde `#D2F47A` (caja ABIERTA) en `lib/theme.ts`, buscador del reemplazo igual a Productos → Calzado, y Movimientos por producto, agrupado por día y con buscador dentro del período elegido. Migración `20261022022841_devoluciones_ven_ventas_de_otros_dias` aplicada al remoto el 2026-10-21 (probada con rollback).

- Navegación con swipe (2026-10-22, rama `app-swipe-calendario`): pestañas deslizables con `expo-router/js-top-tabs` (`react-native-pager-view` 8.0.2, incluida en Expo Go SDK 57, y `react-native-tab-view`) y la misma `TabBar` flotante; swipe atrás desde el borde izquierdo en todas las pantallas internas con `components/Pila.tsx` (pila JS de react-navigation incluida en expo-router, en vez de `<Stack>`; `OPCIONES_MODAL` para las hojas que se cierran hacia abajo). `GestureHandlerRootView` en `app/_layout.tsx`. En el Menú se quitó "Año" y "Mes" es el mes calendario con `CalendarioMes` (día numerado, intensidad por ventas, flechas para meses anteriores); en Movimientos "Mes" sigue siendo los últimos 30 días.

- Compras en la app (2026-10-22, rama `app-compras`, sobre `app-swipe-calendario`): la factura de compra es la misma del panel (`shared/compras.ts`, que la web re-exporta) y se guarda con `registrar_compra`. `app/(app)/recibir-mercancia/`: `index` (compras con filtros Todas / Por pagar / Pendientes de costos, lo que se debe y lo vencido; sin `costos`/`deudas`, solo las llegadas propias pendientes), `nueva` (factura con proveedor, número, fecha, contado/crédito, foto o PDF; una tarjeta por referencia y color con `components/compras/EditorReferencia.tsx`: foto, sugerencias de referencia/marca/color, hasta dos colores, tallas 20–45, costo y precios por rango, "Otro color"; borrador en AsyncStorage), `[id]` (detalle con mercancía agrupada, pagos con `registrar_pago_proveedor` y factura adjunta) y `completar/[id]` (completar costos de una llegada). Sin `costos` es la llegada física: solo tallas que ya existen. Datos en `lib/compras.ts`.

- Revisión del 2026-10-23 (rama `app-revision`, versión 1.1.1): migración `20261023120000_registrar_compra_maximo_opcional` aplicada al remoto (máximo opcional y reconocimiento sin referencia en `registrar_compra`; había 44 productos sin máximo). En la app: clave de reintento por contenido (`intento.firma`) y llegada física idempotente (la clave es el id de la compra), borrador de compra por persona (`venus.compra.borrador.<usuario>`) refrescado con el inventario al abrir, hojas Revisar/Registrar pago como `Modal`, swipe atrás desde 30 px. `dinero_test.sql` actualizado a la regla de precio libre. Pendiente sugerido: RPC `completar_compra` (hoy `completarInformacionFinanciera` son varios UPDATE desde el cliente) y quitar las funciones viejas de compras en `lib/proveedores.ts`.

- Barras del sistema (2026-10-23, versión 1.1.2): la app es borde a borde (obligatorio en Android 15+), también cada `Modal`. `components/BarrasSistema.tsx` (en `app/_layout.tsx` y dentro de las ventanas de pantalla completa con `navegacion={false}`) pone franjas del color del fondo del alto exacto de la barra de estado y de la de navegación (48 dp con 3 botones, ~16 con gestos) y el estilo de los botones del sistema según el tema (`expo-navigation-bar`, plugin con `enforceContrast: false`: sin el velo gris de Android). `usePantallaInmersiva()` quita la franja de arriba en pantallas con foto bajo la barra (ficha del producto). Cabeceras con `MARGEN_SUPERIOR` (hooks/usePaddingInferior.ts) en vez de 56 fijo; todo pie u hoja inferior suma `insets.bottom`. `userInterfaceStyle: automatic` para que el tema "Sistema" siga al teléfono. Con gestos, el borde izquierdo lo toma el "atrás" del sistema (la pila retrocede igual).

- Fotos de calzado en la app (2026-10-26): igual que el panel (`shared/fotos.ts`). `lib/imagenes.ts` → `subirFotoCalzado(uri, nombreFoto(...))`: recorte cuadrado centrado con `expo-image-manipulator`, 1080×1080 (máximo 500 KB) y miniatura de 400×400, WebP en Android (JPEG `.jpg` si no), `catalogo/<referencia>-<color>.webp` con `upsert` y caché de un año, URL con `?v=`. El editor de calzado sube la foto al guardar (con la referencia y el color finales); Recibir mercancía al elegirla (`subirFotoColor(uri, fila)`; `fotoDesactualizada` avisa si después se cambió el nombre). Sin referencia ni descripción no se puede poner. Granja sigue con `comprimirYSubirImagen`.

- Referencia automática y categorías (2026-10-26, migración `20261026120000_referencia_automatica_categorias` aplicada al remoto el 2026-10-26 con el conector de Supabase y registrada con esa versión; la base no tenía calzado, así que no hubo datos que convertir; `verificar_despliegue` OK, prueba de códigos con rollback OK y tipos regenerados del remoto idénticos a `shared/database.types.ts`): sale "Deportivo" (pasa a Futbol si la descripción habla de fútbol/guayos, a Infantil si es de niño, si no a Tennis) y entran "Botas material", "Futbol" (se ve "Fútbol") e "Infantil". La referencia ya no se escribe: la base la pone (`trg_calzado_asignar_referencia`) como `CAT-MARC-NNN` (p. ej. `TEN-NIKE-012`; prefijos en `private.prefijo_categoria` y `shared/referencias.ts`), la misma para la misma descripción + marca; no se borra y cambiarla es solo del dueño; los zapatos sin referencia la reciben al migrar (las de proveedor se conservan). `referencia_para_modelo()` aparta el código antes de guardar (para nombrar la foto). La app y el panel reconocen el zapato por descripción + marca (`referenciaPorDescripcion`); `registrar_compra` y `cargar_inventario` también, cuando no llega la referencia. Pruebas: `referencias_test.sql` y `migracion_referencias/` (en CI).

- Panel → Inventario y precios (2026-10-26): miniatura de la foto en cada fila, vista Lista / Tarjetas (tarjetas de a 48, lista de a 100 con "Mostrar más"), orden por Referencia, Más recientes, Stock, Precio y, con `costos`, Costo y Margen (menú y encabezados; sin costo va al final), chip "Sin foto"; la vista y el orden se recuerdan en el navegador (`panel-inventario-vista`). Lógica en `web/src/lib/inventario.ts` (`ordenar`, `resumenTallas`).

- Un zapato, una referencia y foto obligatoria (2026-10-26, migración `20261026150000_referencia_unica_y_foto_heredada` aplicada al remoto con el conector y registrada con esa versión, probada con rollback): en la carga inicial dos colores del mismo zapato escritos en filas aparte apartaron cada uno su código (Ilario V quedó como `ESC-VERL-004` y `-005`; corregido en el remoto: el azul pasó a `ESC-VERL-004`, era el único caso). Ahora la app y el panel usan la referencia de la otra fila con la misma descripción y marca (`referenciaDeHermana`), y la base, al crear una talla con un código que nadie usa para un zapato que ya existe, le pone el del zapato. Una talla nueva sin foto toma la de su color. Un zapato nuevo no se crea sin foto (`erroresFactura`, `erroresCargaInicial`, editor de calzado con `fotoDeModeloColor`); la carga masiva por Excel no lleva fotos y no la pide.

- Carga inicial editable (2026-10-28, migración `20261028120000_carga_inicial_sumar_y_precios` aplicada al remoto con el conector, registrada con esa versión y probada con rollback): en lo ya cargado cada talla muestra "hay N" y lo escrito se **suma** (`sumar` en `cargar_inventario`; `stock` sigue siendo el de una talla nueva y la carga por Excel no cambia); cambiar el rango de precios de lo que ya existe lo guarda (`tallasConPrecioNuevo`). `cargar_inventario(p_filas, p_proveedor_id, p_clave_idempotencia)`: un reintento con la misma clave (`private.cargas_inventario`) no suma dos veces. Inventario y precios: totales arriba y tallas con sus pares también en las tarjetas.

- Ventas sin conexión (2026-10-29, migración `20261029120000_ventas_sin_conexion` aplicada al remoto con el conector, registrada con esa versión, probada con rollback y tipos regenerados del remoto): si se va la luz o el internet se sigue vendiendo (calzado y Granja, carrito, pagos y cliente) y la venta queda en el teléfono (`lib/ventasPendientes.ts`, `venus.ventas.pendientes`) con su clave de intento y la hora en que se hizo; se manda sola al volver la red (`VentasPendientesProvider` en `app/(app)/_layout.tsx`: al reconectar, al volver a la app y cada minuto), en orden y solo por quien la hizo, con `registrar_venta(..., p_vendida_en)`. La base la cuenta en su día y hora (`created_at`), no exige la caja de hoy abierta, y si faltaba stock la guarda igual con el stock en 0; avisa (también en `ventas.aviso_sincronizacion`) si faltaba stock o si la caja de ese día ya estaba cerrada o no se abrió. Marca `hecha_sin_conexion` y `recibida_at`. Hora del teléfono en el futuro (>10 min) o de hace más de 30 días se rechaza. Un rechazo del servidor queda en el teléfono con su error (Movimientos → Reintentar o Descartar). Píldora arriba "Sin conexión · N ventas por mandar" (`components/AvisoSinConexion.tsx`). Sin conexión se ve el inventario (con el stock de las ventas por mandar ya descontado) y Movimientos como se leyeron por última vez (`lib/cacheLocal.ts`, por persona) y las ventas por mandar. Arranque sin red: con la sesión y el perfil guardados (`venus.perfil.<id>`), solo si esa persona ya entró en ese teléfono. No se cierra sesión con ventas por mandar. Red: `expo-network` + `lib/conexion.ts` (tiempo límite de 15 s al confirmar; si se cae, se guarda con la misma clave y no se duplica). Pruebas: `ventas_sin_conexion_test.sql`.

- Productos de prueba en el remoto (2026-10-29, para enseñar la app): marca "Prueba" y nombre que empieza por "PRUEBA" — calzado `TEN-PRUE-001` (Tennis Runner, negro y blanco 38–42), `FUT-PRUE-001` (Guayo Pro, azul 36–41; la 41 agotada), `CLA-PRUE-001` (Clásico Oficina, café 39–42, sin máximo) y `CHA-PRUE-001` (Chancla Playa, rojo 35–40), sin foto; Granja: PRUEBA Huevos (panal), PRUEBA Concentrado pollito (libra), PRUEBA Maíz (kilo). Las ventas que se hagan con ellos son ventas reales: limpiarlas (y desactivar o borrar los productos) solo cuando el dueño lo pida.

## No construir en esta versión
- Facturación electrónica DIAN
- E-commerce o catálogo por WhatsApp
- Nómina electrónica
- Contabilidad formal
- Múltiples sucursales
- App para iOS
- Ventas a crédito formal con intereses
- Offline-first completo (solo las ventas funcionan sin conexión)
