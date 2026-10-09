import {
  ArrowLeftRight, Barcode, Boxes, CalendarClock, ClipboardCheck, Contact, Database, FileSpreadsheet,
  History, House, LineChart, type LucideIcon, PackagePlus, Percent, Receipt, Scale, Settings,
  ShoppingBag, Truck, Users, Wallet,
} from 'lucide-react'

// Mapa del panel (docs/panel-web.md). Cada sección dice en qué fase llega;
// las que aún no están muestran qué van a hacer.
export interface Seccion {
  id: string
  titulo: string
  ruta: string
  icono: LucideIcon
  fase: number
  lista: boolean
  descripcion: string
  // Otras palabras con que alguien la buscaría.
  palabras?: string[]
}

export interface GrupoNavegacion {
  titulo: string | null
  secciones: Seccion[]
}

export const NAVEGACION: GrupoNavegacion[] = [
  {
    titulo: null,
    secciones: [
      {
        id: 'inicio', titulo: 'Inicio', ruta: '/', icono: House, fase: 0, lista: true,
        descripcion: 'Ventas de hoy, caja, stock bajo, vencimientos y empleados sin actividad.',
        palabras: ['resumen', 'hoy', 'dashboard'],
      },
    ],
  },
  {
    titulo: 'Mercancía y precios',
    secciones: [
      {
        id: 'compras', titulo: 'Compras y recepción', ruta: '/compras', icono: PackagePlus, fase: 1, lista: false,
        descripcion: 'La factura del proveedor en una grilla: referencia con matriz de tallas, costo y precio sugerido; productos nuevos en la misma fila, foto de la factura y el stock sube solo.',
        palabras: ['recibir', 'mercancía', 'factura', 'entrada'],
      },
      {
        id: 'inventario', titulo: 'Inventario y precios', ruta: '/inventario', icono: Boxes, fase: 1, lista: false,
        descripcion: 'Tabla editable de calzado y Granja con filtros, margen, precio mínimo y máximo, stock mínimo, cambios en lote y valor del inventario.',
        palabras: ['productos', 'calzado', 'granja', 'stock', 'precio'],
      },
      {
        id: 'proveedores', titulo: 'Proveedores', ruta: '/proveedores', icono: Truck, fase: 1, lista: false,
        descripcion: 'Ficha, cuentas, documentos, deudas, pagos, calendario de vencimientos e historial de compras y costos.',
        palabras: ['deudas', 'pagos'],
      },
      {
        id: 'carga', titulo: 'Carga masiva', ruta: '/carga', icono: FileSpreadsheet, fase: 1, lista: false,
        descripcion: 'Importar y exportar el inventario en Excel, revisando los errores antes de guardar.',
        palabras: ['excel', 'importar', 'exportar'],
      },
      {
        id: 'conteo', titulo: 'Conteo físico', ruta: '/conteo', icono: ClipboardCheck, fase: 2, lista: false,
        descripcion: 'Toma de inventario: lo contado contra el sistema, diferencias y ajuste con motivo, todo registrado.',
        palabras: ['ajuste', 'toma de inventario'],
      },
      {
        id: 'kardex', titulo: 'Kardex', ruta: '/kardex', icono: ArrowLeftRight, fase: 2, lista: false,
        descripcion: 'La historia de cada producto: qué entró, qué se vendió, qué se devolvió y qué se ajustó.',
        palabras: ['movimientos', 'historia'],
      },
      {
        id: 'etiquetas', titulo: 'Etiquetas', ruta: '/etiquetas', icono: Barcode, fase: 2, lista: false,
        descripcion: 'Etiquetas con código de barras, referencia, talla y precio, listas para imprimir.',
        palabras: ['código de barras', 'imprimir'],
      },
      {
        id: 'reglas-precio', titulo: 'Reglas de precio', ruta: '/reglas-precio', icono: Percent, fase: 2, lista: false,
        descripcion: 'Margen objetivo por categoría o marca para sugerir el precio al recibir, y alertas de ventas bajo margen.',
        palabras: ['margen'],
      },
      {
        id: 'pedidos', titulo: 'Reposición y pedidos', ruta: '/pedidos', icono: ShoppingBag, fase: 2, lista: false,
        descripcion: 'Qué pedir según el stock mínimo y el ritmo de venta; la orden sale al proveedor por WhatsApp.',
        palabras: ['orden de compra', 'reponer'],
      },
    ],
  },
  {
    titulo: 'Dinero y negocio',
    secciones: [
      {
        id: 'ventas', titulo: 'Ventas', ruta: '/ventas', icono: Receipt, fase: 3, lista: false,
        descripcion: 'Historial con filtros por fecha, empleado, método y producto; detalle con pagos y devoluciones; exportar.',
      },
      {
        id: 'reportes', titulo: 'Reportes', ruta: '/reportes', icono: LineChart, fase: 3, lista: false,
        descripcion: 'Por período, empleado, hora, marca y categoría; más vendidos, sin movimiento, margen y rotación.',
        palabras: ['estadísticas', 'gráficos'],
      },
      {
        id: 'balance', titulo: 'Balance', ruta: '/balance', icono: Scale, fase: 3, lista: false,
        descripcion: 'Ingresos, egresos y ganancia; proyección del mes y evolución mes a mes.',
        palabras: ['ganancia', 'finanzas'],
      },
      {
        id: 'caja', titulo: 'Caja', ruta: '/caja', icono: Wallet, fase: 3, lista: false,
        descripcion: 'Historial de cierres, diferencias y justificaciones, reaperturas y arqueo.',
        palabras: ['cierre', 'arqueo'],
      },
      {
        id: 'gastos', titulo: 'Gastos', ruta: '/gastos', icono: CalendarClock, fase: 3, lista: false,
        descripcion: 'Gastos fijos con calendario de vencimientos y comprobantes; gastos variables con filtros.',
      },
      {
        id: 'clientes', titulo: 'Clientes', ruta: '/clientes', icono: Contact, fase: 3, lista: false,
        descripcion: 'Directorio a partir de las ventas e historial de compras de cada cliente.',
      },
    ],
  },
  {
    titulo: 'Gente y control',
    secciones: [
      {
        id: 'empleados', titulo: 'Empleados y permisos', ruta: '/empleados', icono: Users, fase: 4, lista: false,
        descripcion: 'Matriz persona × permiso; crear, desactivar y restablecer PIN; sueldos, días y pagos.',
        palabras: ['permisos', 'pin', 'sueldos'],
      },
      {
        id: 'historial', titulo: 'Historial de acciones', ruta: '/historial', icono: History, fase: 4, lista: false,
        descripcion: 'Quién hizo qué, cuándo y qué cambió (antes y después). Ya se está registrando desde la fase 0.',
        palabras: ['auditoría', 'quién'],
      },
      {
        id: 'respaldo', titulo: 'Respaldo', ruta: '/respaldo', icono: Database, fase: 4, lista: false,
        descripcion: 'Descargar todos los datos del negocio en Excel.',
        palabras: ['exportar', 'copia'],
      },
      {
        id: 'configuracion', titulo: 'Configuración', ruta: '/configuracion', icono: Settings, fase: 5, lista: false,
        descripcion: 'Datos y marca del negocio, categorías, métodos de pago, unidades, caja y reportes automáticos.',
        palabras: ['ajustes', 'marca'],
      },
    ],
  },
]

export const SECCIONES: Seccion[] = NAVEGACION.flatMap((g) => g.secciones)

// Sin tildes ni mayúsculas: "Clasico" encuentra "Clásico".
export const plano = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function seccionesQueCoinciden(texto: string): Seccion[] {
  const buscado = plano(texto)
  if (!buscado) return []
  return SECCIONES.filter((s) =>
    [s.titulo, ...(s.palabras ?? [])].some((p) => plano(p).includes(buscado)),
  )
}
