# Venus Admin — panel web

Estado: plan aprobado en lo principal el 2026-10-09. Este documento manda sobre
el panel web; el PRD v4.0 sigue mandando sobre el negocio y la app del celular.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Quién entra | Solo el dueño (Andrés). |
| Verificación en dos pasos | Después (fase 5). Mientras tanto, el mismo login usuario + PIN. |
| Qué se hace en la web | Todo el back-office: mercancía que entra, precios, inventario, proveedores, y además análisis y administración. |
| Qué se queda en el celular | Lo que pasa en el mostrador: nueva venta, devoluciones, abrir y cerrar caja contando el efectivo. La web no registra ventas. |
| Alcance | Escalable y replicable para otros negocios más adelante. |
| Repositorio | El mismo, carpeta `web/`. |

## Principios

1. **Una base, dos apps.** Celular y web usan el mismo Supabase, las mismas
   migraciones, los mismos tipos y las mismas reglas.
2. **La base manda.** Permisos y validaciones viven en RLS y RPC. La web nunca
   escribe directo donde el celular usa una RPC (ventas, caja, empleados).
3. **Nada propio de Venus en el código.** Nombre, logo, categorías, métodos de
   pago, unidades de Granja, zona horaria y moneda salen de la configuración del
   negocio, no de constantes.
4. **Todo queda auditado**, con quién, cuándo y qué cambió (antes y después).
5. **Hecho para el teclado.** Tablas editables, atajos, búsqueda global y
   acciones en lote: lo que en el celular son diez toques, en la web es una fila.

## Replicable: una instancia por negocio

| | Una instancia por negocio (recomendado) | Multi-negocio en una sola base |
|---|---|---|
| Cómo | Un proyecto Supabase por negocio, mismo código, misma app | Una base con `negocio_id` en cada tabla y RLS por negocio |
| Aislamiento de datos | Total: imposible ver datos de otro negocio | Depende de que cada política filtre bien |
| Respaldos y restauración | Por negocio | Todos juntos |
| Costo | Plan gratis de Supabase por negocio mientras quepa | Una sola base |
| Trabajo hoy | Configuración + script para crear instancias | Rehacer todas las tablas y políticas |
| Cuándo cambiar | Si llegan a ser decenas de negocios o se vende como servicio | — |

Para que sea replicable de verdad hace falta: configuración del negocio en una
tabla; categorías, métodos de pago y unidades como tablas (hoy son restricciones
fijas: `categoria in ('Chanclas', …)`, `metodo in ('efectivo','nequi', …)`); marca
(nombre, logo, colores) desde la configuración; y un script que cree una
instancia nueva (aplica migraciones, carga la configuración y crea al dueño).

## Arquitectura

- `web/`: React + Vite + TypeScript, como página estática.
  - React Router, TanStack Query (datos y caché), TanStack Table (tablas con
    filtros, orden, edición y exportación), supabase-js, Recharts (gráficos),
    SheetJS (Excel), generación de PDF (etiquetas y órdenes de compra).
- `shared/`: lo que usan las dos apps y no depende de la pantalla: tipos de la
  base, catálogo de permisos, cálculos (carrito, arqueo, balance, reportes),
  formato de pesos y fechas. Se extrae de `lib/` a medida que la web lo necesite.
- Publicación: Cloudflare Pages (gratis), con dominio propio opcional.
- CI: se suma un trabajo para compilar y probar `web/`.
- Acceso: mismo login (usuario + PIN). La web solo deja entrar al dueño, y los
  datos sensibles ya están protegidos por la base para cualquiera que no lo sea.

## Mapa del panel

Leyenda: ✅ los datos ya existen · 🆕 necesita cambios en la base.

### A. Mercancía y precios (lo primero)

| # | Pantalla | Qué hace | Datos |
|---|---|---|---|
| A1 | **Compras y recepción** | Factura del proveedor en una grilla rápida: referencia, **matriz de tallas** (34–44 con cantidad por talla en una sola fila), costo, precio sugerido. Crea productos nuevos en la misma fila. Adjunta foto o PDF de la factura. Contado o crédito con vencimiento. Al confirmar sube el stock. | ✅ compras, compra_items, triggers de stock |
| A2 | **Inventario y precios** | Tabla editable de calzado y Granja: filtros (categoría, marca, talla, agotados, bajo mínimo), costo, margen, precio mín/máx, stock mínimo. Edición en lote (por ejemplo, +10% a una categoría). Valor del inventario a costo y a precio. | ✅ productos · 🆕 RPC de cambio de precios en lote |
| A3 | **Reglas de precio** | Margen objetivo por categoría o marca: al recibir, el precio mín/máx se sugiere solo desde el costo. Alerta de productos vendidos por debajo del margen. | 🆕 reglas_precio |
| A4 | **Conteo físico** | Toma de inventario por categoría: cantidad contada contra sistema, diferencias y ajuste con motivo (daño, pérdida, error). Todo auditado. | 🆕 ajustes_inventario + RPC |
| A5 | **Kardex por producto** | Entradas, ventas, devoluciones y ajustes con saldo, para saber por qué un producto tiene el stock que tiene. | 🆕 vista/RPC sobre compras, ventas, devoluciones y ajustes |
| A6 | **Etiquetas** | PDF para imprimir con código de barras, referencia, talla y precio. Base para escanear en el celular al vender (más adelante). | 🆕 código por producto |
| A7 | **Reposición y órdenes de compra** | Sugiere qué pedir según el stock mínimo y el ritmo de venta. Arma la orden al proveedor, la envía por WhatsApp o PDF y luego se recibe contra esa orden. | 🆕 ordenes_compra |
| A8 | **Proveedores** | Ficha, cuentas, documentos, deudas, pagos, calendario de vencimientos, historial de compras y de costos por proveedor. | ✅ |
| A9 | **Carga masiva** | Importar y exportar Excel con validación antes de guardar. | ✅ lector de Excel actual |

### B. Dinero y negocio

| # | Pantalla | Qué hace | Datos |
|---|---|---|---|
| B1 | **Inicio** | Ventas de hoy contra ayer, por método, caja, stock bajo, vencimientos, empleados sin actividad. | ✅ |
| B2 | **Ventas** | Historial con filtros, detalle con artículos, pagos y devoluciones; exportar. | ✅ |
| B3 | **Reportes** | Por período, top y sin movimiento, por empleado, por hora y día de la semana, por marca y categoría, margen, rotación. | ✅ base · 🆕 RPC nuevas por dimensión |
| B4 | **Balance** | Como el PRD: ingresos, egresos, proyección y evolución mes a mes. | ✅ |
| B5 | **Caja** | Historial de cierres, diferencias y justificaciones, reaperturas, arqueo. | ✅ |
| B6 | **Gastos** | Fijos con calendario y comprobantes; variables con filtros. | ✅ |
| B7 | **Clientes** | Directorio a partir de las ventas (nombre, cédula, teléfono) e historial de compras. Sin catálogo ni marketing (fuera de alcance). | ✅ datos en ventas · 🆕 tabla clientes |

### C. Gente, control y configuración

| # | Pantalla | Qué hace | Datos |
|---|---|---|---|
| C1 | **Empleados y permisos** | Matriz persona × permiso; crear, desactivar, restablecer PIN; sueldos, días y pagos. | ✅ |
| C2 | **Historial de acciones** | Quién hizo qué, cuándo y qué cambió (antes y después), por empleado, fecha y módulo. Lo exige el PRD y hoy no existe en ninguna app. | 🆕 auditoria |
| C3 | **Configuración del negocio** | Datos, logo y colores, categorías, métodos de pago, unidades de Granja, caja, reportes automáticos. Es la base de la replicabilidad. | 🆕 negocio_config + catálogos |
| C4 | **Respaldo** | Descargar todos los datos en Excel. | ✅ |

## Cambios en la base

En orden de necesidad:

1. **Auditoría** (fase 0): tabla `auditoria` llenada por un trigger genérico en
   las tablas importantes (tabla, registro, acción, antes, después, quién,
   cuándo). Solo el dueño la lee. Cuanto antes exista, más historia habrá.
2. Cambio de precios en lote (RPC con auditoría).
3. `ajustes_inventario` + RPC, y kardex.
4. Código por producto para etiquetas.
5. `reglas_precio`.
6. `ordenes_compra` + ítems.
7. `clientes`.
8. `negocio_config` y catálogos como tablas (categorías, métodos de pago,
   unidades), reemplazando las restricciones fijas. Toca también la app del
   celular, que hoy tiene esas listas en el código.
9. (Fase 5) Verificación en dos pasos exigida por la base para finanzas y
   gestión de empleados.

Cada cambio sigue las reglas de `AGENTS.md`: migración con test SQL, grant
explícito, RPC en la lista de `verificar_despliegue.sql` si la usa una app.

## Fases

| Fase | Contenido |
|---|---|
| **0. Cimientos** ✅ | Fusionar el PR #1. Crear `web/` y `shared/`, login solo para el dueño, estructura y navegación, búsqueda global, publicación y CI. La auditoría empieza a registrar. Hecho el 2026-10-09; además, Inicio (B1) ya funciona. Publicación: `web/README.md`. |
| **1. Mercancía** (plan: `docs/panel-web-fase1.md`) | A1 Compras y recepción con matriz de tallas, A2 Inventario y precios, A8 Proveedores, A9 Carga masiva. |
| **2. Control de inventario** | A4 Conteo físico, A5 Kardex, A6 Etiquetas, A3 Reglas de precio, A7 Reposición y órdenes de compra. |
| **3. Dinero** | B2 Ventas, B3 Reportes, B4 Balance, B5 Caja, B6 Gastos, B7 Clientes. |
| **4. Gente y control** | C1 Empleados y permisos, C2 Historial de acciones, C4 Respaldo. |
| **5. Replicable** | C3 Configuración del negocio, catálogos como tablas (también en el celular), marca blanca, script de instancia nueva, verificación en dos pasos. |

## Costos

Supabase gratis (500 MB de base, 1 GB de archivos) y Cloudflare Pages gratis
alcanzan para una tienda. Lo único con costo sería un dominio propio, opcional.
