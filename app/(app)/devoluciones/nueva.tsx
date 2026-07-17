import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  ArrowLeft,
  Ban,
  CircleAlert,
  CircleCheckBig,
  CircleX,
  Info,
  Minus,
  Receipt,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react-native'
import { useRequireModulo } from '../../../lib/auth'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import {
  buscarVentaParaDevolucion,
  registrarDevolucion,
  calcularDiferenciaCambio,
  netearDevolucion,
  validarCantidades,
  type TipoDevolucion,
  type MetodoDinero,
  type VentaParaDevolucion,
  type VentaItemParaDevolucion,
  type ItemDevolucionInput,
} from '../../../lib/devoluciones'
import { listarCalzado, type ProductoCalzado } from '../../../lib/inventario'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { Badge, Boton, CampoTexto, EstadoVacio, Presionable, Tarjeta, useToast } from '../../../components/ui'

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface EstadoItem {
  venta_item_id: string
  cantidad: number            // Cantidad a devolver/cambiar
  cambio_talla_color_id?: string
  precio_reemplazo?: number
  // UI state
  busquedaReemplazo: string
  resultadosBusqueda: ProductoCalzado[]
  buscandoReemplazo: boolean
  reemplazoSeleccionado?: ProductoCalzado
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCOP(n: number): string {
  return '$' + n.toLocaleString('es-CO')
}

function disponible(item: VentaItemParaDevolucion): number {
  return item.cantidad_vendida - item.cantidad_ya_devuelta
}

const TIPOS: { value: TipoDevolucion; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'cambio', label: 'Cambio' },
]

// ── Componente principal ──────────────────────────────────────────────────────

export default function NuevaDevolucionScreen() {
  const requireModulo = useRequireModulo('devoluciones')
  const router = useRouter()
  const params = useLocalSearchParams<{ venta: string; numero: string }>()
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const paddingInferior = usePaddingInferior(espacio.xxxl)

  // ── Estado de la venta ──
  const [venta, setVenta] = useState<VentaParaDevolucion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // ── Estado del formulario ──
  const [tipo, setTipo] = useState<TipoDevolucion>('total')
  const [motivo, setMotivo] = useState('')
  const [metodoReembolso, setMetodoReembolso] = useState<MetodoDinero | null>(null)
  const [metodoCobro, setMetodoCobro] = useState<MetodoDinero | null>(null)
  const [estadoItems, setEstadoItems] = useState<EstadoItem[]>([])

  // ── Validación y envío ──
  const [erroresValidacion, setErroresValidacion] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)

  // ── Modal buscador de reemplazo activo ──
  const [modalReemplazoIdx, setModalReemplazoIdx] = useState<number | null>(null)

  // ── Cargar venta ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const numeroStr = params.numero
    const num = numeroStr ? parseInt(numeroStr, 10) : NaN

    if (!numeroStr || isNaN(num) || num <= 0) {
      setErrorCarga('Número de venta inválido.')
      setCargando(false)
      return
    }

    async function cargar() {
      try {
        const data = await buscarVentaParaDevolucion(num)
        if (!data) {
          setErrorCarga('Venta no encontrada.')
          setCargando(false)
          return
        }
        // Solo se admiten devoluciones sobre ventas vigentes; las terminales
        // (devuelta_total/cambiada_total/cancelada) o separadas las rechazaría el RPC.
        const estadosPermitidos = ['completada', 'devuelta_parcial', 'cambiada_parcial']
        if (!estadosPermitidos.includes(data.estado)) {
          setErrorCarga(`Esta venta no admite devoluciones (estado: ${data.estado}).`)
          setCargando(false)
          return
        }
        setVenta(data)
        // Inicializar estado de items: para 'total' usamos el disponible completo
        setEstadoItems(
          data.items.map((it) => ({
            venta_item_id: it.venta_item_id,
            cantidad: disponible(it),
            busquedaReemplazo: '',
            resultadosBusqueda: [],
            buscandoReemplazo: false,
          }))
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al cargar la venta.'
        setErrorCarga(msg)
      } finally {
        setCargando(false)
      }
    }

    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Recalcular cantidades al cambiar tipo ─────────────────────────────────
  useEffect(() => {
    if (!venta) return
    if (tipo === 'total') {
      setEstadoItems((prev) =>
        prev.map((ei, i) => ({
          ...ei,
          cantidad: disponible(venta.items[i]),
          cambio_talla_color_id: undefined,
          precio_reemplazo: undefined,
          busquedaReemplazo: '',
          resultadosBusqueda: [],
          reemplazoSeleccionado: undefined,
        }))
      )
    } else if (tipo === 'parcial') {
      setEstadoItems((prev) =>
        prev.map((ei) => ({
          ...ei,
          cambio_talla_color_id: undefined,
          precio_reemplazo: undefined,
          busquedaReemplazo: '',
          resultadosBusqueda: [],
          reemplazoSeleccionado: undefined,
        }))
      )
    } else {
      // cambio: solo items calzado; parcial conserva cantidades
      setEstadoItems((prev) =>
        prev.map((ei) => ({
          ...ei,
          cambio_talla_color_id: undefined,
          precio_reemplazo: undefined,
          busquedaReemplazo: '',
          resultadosBusqueda: [],
          reemplazoSeleccionado: undefined,
        }))
      )
    }
    setMetodoReembolso(null)
    setMetodoCobro(null)
    setErroresValidacion([])
  }, [tipo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cálculo del neto ──────────────────────────────────────────────────────
  const neto = React.useMemo(() => {
    if (!venta) return { monto_devuelto: 0, monto_cobrado: 0 }

    if (tipo === 'total' || tipo === 'parcial') {
      const items = estadoItems.map((ei, i) => {
        const precio = venta.items[i].precio_unitario
        return { diferencia: 0, subtotal: precio * ei.cantidad }
      })
      return netearDevolucion(tipo, items)
    }

    // cambio: solo items calzado activos (con reemplazo seleccionado)
    const itemsCambio = estadoItems
      .map((ei, i) => {
        const ventaItem = venta.items[i]
        if (ventaItem.tipo_producto !== 'calzado') return null
        if (!ei.cambio_talla_color_id || ei.precio_reemplazo === undefined) return null
        const diferencia = calcularDiferenciaCambio(
          ventaItem.precio_unitario,
          ei.precio_reemplazo,
          ei.cantidad
        )
        return { diferencia, subtotal: 0 }
      })
      .filter((x): x is { diferencia: number; subtotal: number } => x !== null)

    if (itemsCambio.length === 0) return { monto_devuelto: 0, monto_cobrado: 0 }
    return netearDevolucion('cambio', itemsCambio)
  }, [tipo, estadoItems, venta])

  // ── Actualizar cantidad por item ──────────────────────────────────────────
  function actualizarCantidad(idx: number, val: string) {
    const n = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0
    setEstadoItems((prev) =>
      prev.map((ei, i) => (i === idx ? { ...ei, cantidad: n } : ei))
    )
    setErroresValidacion([])
  }

  // ── Actualizar precio de reemplazo ────────────────────────────────────────
  function actualizarPrecioReemplazo(idx: number, val: string) {
    const n = parseFloat(val.replace(/[^0-9]/g, '')) || 0
    setEstadoItems((prev) =>
      prev.map((ei, i) => (i === idx ? { ...ei, precio_reemplazo: n } : ei))
    )
    setErroresValidacion([])
  }

  // ── Buscar calzado de reemplazo ───────────────────────────────────────────
  function abrirModalReemplazo(idx: number) {
    setModalReemplazoIdx(idx)
  }

  function cerrarModalReemplazo() {
    setModalReemplazoIdx(null)
  }

  async function buscarReemplazo(idx: number, query: string) {
    setEstadoItems((prev) =>
      prev.map((ei, i) =>
        i === idx ? { ...ei, busquedaReemplazo: query, buscandoReemplazo: true } : ei
      )
    )
    if (!query.trim()) {
      setEstadoItems((prev) =>
        prev.map((ei, i) =>
          i === idx ? { ...ei, resultadosBusqueda: [], buscandoReemplazo: false } : ei
        )
      )
      return
    }
    try {
      const resultados = await listarCalzado({ busqueda: query.trim() })
      setEstadoItems((prev) =>
        prev.map((ei, i) =>
          i === idx
            ? { ...ei, resultadosBusqueda: resultados, buscandoReemplazo: false }
            : ei
        )
      )
    } catch {
      setEstadoItems((prev) =>
        prev.map((ei, i) => (i === idx ? { ...ei, buscandoReemplazo: false } : ei))
      )
    }
  }

  function seleccionarReemplazo(idx: number, prod: ProductoCalzado) {
    setEstadoItems((prev) =>
      prev.map((ei, i) =>
        i === idx
          ? {
              ...ei,
              cambio_talla_color_id: prod.id,
              reemplazoSeleccionado: prod,
              busquedaReemplazo: '',
              resultadosBusqueda: [],
            }
          : ei
      )
    )
    cerrarModalReemplazo()
  }

  // ── Confirmar devolución ──────────────────────────────────────────────────
  async function handleConfirmar() {
    if (!venta) return

    if (!motivo.trim()) {
      setErroresValidacion(['El motivo es obligatorio.'])
      return
    }

    // Armar los items a enviar según el tipo
    let itemsParaEnviar: Array<{ venta_item_id: string; cantidad: number }> = []

    if (tipo === 'total' || tipo === 'parcial') {
      itemsParaEnviar = estadoItems
        .filter((ei) => ei.cantidad > 0)
        .map((ei) => ({ venta_item_id: ei.venta_item_id, cantidad: ei.cantidad }))
    } else {
      // cambio: solo items calzado con reemplazo seleccionado
      itemsParaEnviar = estadoItems
        .filter((ei, i) => {
          const it = venta.items[i]
          return (
            it.tipo_producto === 'calzado' &&
            ei.cambio_talla_color_id &&
            ei.precio_reemplazo !== undefined &&
            ei.cantidad > 0
          )
        })
        .map((ei) => ({ venta_item_id: ei.venta_item_id, cantidad: ei.cantidad }))
    }

    if (itemsParaEnviar.length === 0) {
      setErroresValidacion(['Debes seleccionar al menos un ítem para devolver.'])
      return
    }

    // Construir mapas para validarCantidades
    const vendido: Record<string, number> = {}
    const yaDevuelto: Record<string, number> = {}
    for (const it of venta.items) {
      vendido[it.venta_item_id] = it.cantidad_vendida
      yaDevuelto[it.venta_item_id] = it.cantidad_ya_devuelta
    }

    const errores = validarCantidades(itemsParaEnviar, vendido, yaDevuelto)
    if (errores.length > 0) {
      setErroresValidacion(errores)
      return
    }

    // Validar métodos de pago requeridos
    if (neto.monto_devuelto > 0 && !metodoReembolso) {
      setErroresValidacion(['Selecciona el método de reembolso.'])
      return
    }
    if (neto.monto_cobrado > 0 && !metodoCobro) {
      setErroresValidacion(['Selecciona el método de cobro adicional.'])
      return
    }

    // Para cambio: validar que todos los items calzado con cantidad > 0 tengan reemplazo
    if (tipo === 'cambio') {
      const sinReemplazo = estadoItems.some((ei, i) => {
        const it = venta.items[i]
        return (
          it.tipo_producto === 'calzado' &&
          ei.cantidad > 0 &&
          !ei.cambio_talla_color_id
        )
      })
      if (sinReemplazo) {
        setErroresValidacion([
          'Todos los ítems de calzado en cambio deben tener un producto de reemplazo seleccionado.',
        ])
        return
      }
    }

    // Armar ItemDevolucionInput[]
    const items: ItemDevolucionInput[] = estadoItems
      .filter((ei, i) => {
        if (ei.cantidad <= 0) return false
        if (tipo === 'cambio') {
          const it = venta.items[i]
          return it.tipo_producto === 'calzado' && !!ei.cambio_talla_color_id
        }
        return true
      })
      .map((ei) => {
        const base: ItemDevolucionInput = {
          venta_item_id: ei.venta_item_id,
          cantidad: ei.cantidad,
        }
        if (tipo === 'cambio' && ei.cambio_talla_color_id) {
          base.cambio_talla_color_id = ei.cambio_talla_color_id
          base.precio_reemplazo = ei.precio_reemplazo
        }
        return base
      })

    setEnviando(true)
    setErroresValidacion([])
    try {
      await registrarDevolucion({
        venta_id: venta.venta_id,
        motivo: motivo.trim(),
        tipo_devolucion: tipo,
        metodo_reembolso: metodoReembolso ?? undefined,
        metodo_cobro: metodoCobro ?? undefined,
        monto_devuelto: neto.monto_devuelto,
        monto_cobrado: neto.monto_cobrado,
        items,
      })
      mostrar('Devolución registrada')
      router.back()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la devolución.'
      mostrar(msg, 'error')
    } finally {
      setEnviando(false)
    }
  }

  // ── Guard ────────────────────────────────────────────────────────────────
  if (requireModulo) return requireModulo

  // ── Cargando ─────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, alignItems: 'center', justifyContent: 'center', gap: espacio.m }}>
        <ActivityIndicator size="large" color={paleta.primario} />
        <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Cargando venta…</Text>
      </View>
    )
  }

  // ── Error de carga ────────────────────────────────────────────────────────
  if (errorCarga || !venta) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, justifyContent: 'center', padding: espacio.xl, gap: espacio.l }}>
        <EstadoVacio
          icono={<CircleAlert />}
          titulo={errorCarga ?? 'Venta no disponible.'}
        />
        <Boton titulo="Volver" variante="fantasma" onPress={() => router.back()} />
      </View>
    )
  }

  // ── Determina si el botón confirmar está habilitado ───────────────────────
  const itemsConCantidad = estadoItems.filter((ei) => ei.cantidad > 0)
  const puedeConfirmar =
    !enviando &&
    motivo.trim().length > 0 &&
    itemsConCantidad.length > 0 &&
    (neto.monto_devuelto === 0 || metodoReembolso !== null) &&
    (neto.monto_cobrado === 0 || metodoCobro !== null)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: paleta.fondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: espacio.m,
        paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m,
      }}>
        <Presionable accessibilityRole="button" accessibilityLabel="Volver"
          onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={paleta.texto} />
        </Presionable>
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Nueva Devolución</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.l }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Info de la venta */}
        <Tarjeta>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginBottom: espacio.s }}>
            <Receipt size={18} color={paleta.primario} />
            <Text style={[tipografia.h3, { color: paleta.texto }]}>Venta #{venta.numero}</Text>
          </View>
          <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>
            Fecha: {new Date(venta.fecha).toLocaleDateString('es-CO')}
          </Text>
          {venta.cliente_nombre ? (
            <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Cliente: {venta.cliente_nombre}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginTop: espacio.xs }}>
            <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Estado:</Text>
            <Badge texto={venta.estado} tipo="neutro" />
          </View>
        </Tarjeta>

        {/* Tipo de devolución */}
        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Tipo de devolución *</Text>
          <View style={{ flexDirection: 'row', gap: espacio.s, marginTop: espacio.m }}>
            {TIPOS.map(({ value: t, label }) => {
              const activo = tipo === t
              return (
                <Presionable
                  key={t}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: activo }}
                  onPress={() => setTipo(t)}
                  testID={`btn-tipo-${t}`}
                  style={{
                    flex: 1,
                    paddingVertical: espacio.s,
                    borderRadius: radio.sm,
                    alignItems: 'center',
                    backgroundColor: activo ? paleta.primario : paleta.superficie2,
                    borderWidth: 1,
                    borderColor: activo ? paleta.primario : paleta.borde,
                  }}
                >
                  <Text style={[tipografia.etiqueta, { color: activo ? paleta.sobrePrimario : paleta.texto2 }]}>
                    {label}
                  </Text>
                </Presionable>
              )
            })}
          </View>
          {tipo === 'cambio' && (
            <View style={{
              flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s,
              backgroundColor: paleta.primarioSoft, borderRadius: radio.sm, padding: espacio.s, marginTop: espacio.m,
            }}>
              <Info size={15} color={paleta.primario} />
              <Text style={[tipografia.caption, { color: paleta.primario, flex: 1 }]}>
                Solo aplica para ítems de calzado. Los productos de Granja no admiten cambio de producto.
              </Text>
            </View>
          )}
        </Tarjeta>

        {/* Items de la venta */}
        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Ítems a devolver</Text>
          {venta.items.map((ventaItem, idx) => {
            const ei = estadoItems[idx]
            const disp = disponible(ventaItem)
            const esCalzado = ventaItem.tipo_producto === 'calzado'
            const esCambio = tipo === 'cambio'
            // En modo cambio, los items 'varios'/Granja se muestran como no disponibles
            const bloqueadoPorGranja = esCambio && !esCalzado

            return (
              <View
                key={ventaItem.venta_item_id}
                testID={`item-devolucion-${ventaItem.venta_item_id}`}
                style={{ borderTopWidth: 1, borderTopColor: paleta.borde, paddingTop: espacio.m, marginTop: espacio.m }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s, marginBottom: espacio.s }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>{ventaItem.descripcion}</Text>
                    {(ventaItem.talla || ventaItem.color) ? (
                      <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                        {[ventaItem.talla && `Talla: ${ventaItem.talla}`, ventaItem.color && `Color: ${ventaItem.color}`]
                          .filter(Boolean)
                          .join('  •  ')}
                      </Text>
                    ) : null}
                    <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                      Vendido: {ventaItem.cantidad_vendida} • Disponible: {disp}
                      {disp === 0 ? '  (ya devuelto)' : ''}
                    </Text>
                    <Text style={[tipografia.caption, tabular, { color: paleta.texto3 }]}>
                      Precio: {formatCOP(ventaItem.precio_unitario)} c/u
                    </Text>
                  </View>
                  <Badge texto={esCalzado ? 'Calzado' : 'Granja'} tipo={esCalzado ? 'neutro' : 'exito'} />
                </View>

                {bloqueadoPorGranja ? (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: espacio.s,
                    backgroundColor: paleta.advertenciaSoft, borderRadius: radio.sm, padding: espacio.s,
                  }}>
                    <Ban size={14} color={paleta.advertenciaTexto} />
                    <Text style={[tipografia.caption, { color: paleta.advertenciaTexto, flex: 1 }]}>
                      Los productos de Granja no aplican para cambio de producto.
                    </Text>
                  </View>
                ) : disp === 0 ? (
                  <Text style={[tipografia.caption, { color: paleta.texto3, fontStyle: 'italic' }]}>
                    Este ítem ya fue devuelto completamente.
                  </Text>
                ) : (
                  <>
                    {/* Cantidad */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, marginTop: espacio.xs }}>
                      <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Cantidad a devolver:</Text>
                      {tipo === 'total' ? (
                        <Text style={[tipografia.h3, tabular, { color: paleta.texto, minWidth: 40, textAlign: 'center' }]}>
                          {disp}
                        </Text>
                      ) : (
                        <View style={{ width: 90 }}>
                          <CampoTexto
                            keyboardType="number-pad"
                            value={String(ei.cantidad)}
                            onChangeText={(v) => actualizarCantidad(idx, v)}
                            editable={disp > 0}
                            testID={`input-cantidad-${ventaItem.venta_item_id}`}
                          />
                        </View>
                      )}
                    </View>

                    {/* Reemplazo para cambio */}
                    {esCambio && esCalzado && (
                      <View style={{ marginTop: espacio.m, gap: espacio.s }}>
                        <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Calzado de reemplazo *</Text>
                        {ei.reemplazoSeleccionado ? (
                          <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: paleta.exitoSoft, borderRadius: radio.sm, padding: espacio.m,
                          }}>
                            <View style={{ flex: 1 }}>
                              <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>
                                {ei.reemplazoSeleccionado.descripcion}
                              </Text>
                              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                                {[
                                  ei.reemplazoSeleccionado.talla && `T: ${ei.reemplazoSeleccionado.talla}`,
                                  ei.reemplazoSeleccionado.color && `C: ${ei.reemplazoSeleccionado.color}`,
                                ]
                                  .filter(Boolean)
                                  .join('  •  ')}
                              </Text>
                            </View>
                            <Presionable
                              accessibilityRole="button"
                              accessibilityLabel="Quitar reemplazo"
                              onPress={() => {
                                setEstadoItems((prev) =>
                                  prev.map((e, i) =>
                                    i === idx
                                      ? {
                                          ...e,
                                          cambio_talla_color_id: undefined,
                                          precio_reemplazo: undefined,
                                          reemplazoSeleccionado: undefined,
                                        }
                                      : e
                                  )
                                )
                              }}
                              hitSlop={12}
                              testID={`btn-quitar-reemplazo-${ventaItem.venta_item_id}`}
                            >
                              <CircleX size={22} color={paleta.peligro} />
                            </Presionable>
                          </View>
                        ) : (
                          <Presionable
                            accessibilityRole="button"
                            accessibilityLabel="Buscar calzado de reemplazo"
                            onPress={() => abrirModalReemplazo(idx)}
                            testID={`btn-buscar-reemplazo-${ventaItem.venta_item_id}`}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: espacio.s,
                              backgroundColor: paleta.primarioSoft, borderRadius: radio.sm,
                              paddingVertical: espacio.m, paddingHorizontal: espacio.l,
                            }}
                          >
                            <Search size={16} color={paleta.primario} />
                            <Text style={[tipografia.etiqueta, { color: paleta.primario }]}>Buscar calzado…</Text>
                          </Presionable>
                        )}

                        {/* Precio de reemplazo */}
                        {ei.cambio_talla_color_id && (
                          <View style={{ marginTop: espacio.xs, gap: espacio.xs }}>
                            <CampoTexto
                              etiqueta="Precio de reemplazo ($) *"
                              keyboardType="number-pad"
                              placeholder="Ingresa el precio"
                              value={ei.precio_reemplazo !== undefined ? String(ei.precio_reemplazo) : ''}
                              onChangeText={(v) => actualizarPrecioReemplazo(idx, v)}
                              testID={`input-precio-reemplazo-${ventaItem.venta_item_id}`}
                            />
                            {ei.precio_reemplazo !== undefined && ei.precio_reemplazo > 0 && (() => {
                              const diff = calcularDiferenciaCambio(
                                ventaItem.precio_unitario,
                                ei.precio_reemplazo,
                                ei.cantidad
                              )
                              const IconoDiff = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus
                              const colorDiff = diff > 0 ? paleta.peligroTexto : diff < 0 ? paleta.exitoTexto : paleta.texto2
                              return (
                                <View style={{
                                  flexDirection: 'row', alignItems: 'center', gap: espacio.s,
                                  padding: espacio.s, borderRadius: radio.sm, backgroundColor: paleta.superficie2,
                                }}>
                                  <IconoDiff size={15} color={colorDiff} />
                                  <Text style={[tipografia.etiqueta, tabular, { color: colorDiff }]}>
                                    {diff > 0
                                      ? `Cliente paga ${formatCOP(diff)} adicional`
                                      : diff < 0
                                      ? `Reembolso ${formatCOP(-diff)}`
                                      : 'Cambio sin diferencia de precio'}
                                  </Text>
                                </View>
                              )
                            })()}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>
            )
          })}
        </Tarjeta>

        {/* Motivo */}
        <Tarjeta>
          <CampoTexto
            etiqueta="Motivo *"
            placeholder="Describe el motivo de la devolución…"
            multiline
            numberOfLines={3}
            value={motivo}
            onChangeText={(v) => {
              setMotivo(v)
              setErroresValidacion([])
            }}
            testID="input-motivo"
          />
        </Tarjeta>

        {/* Resumen neto */}
        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Resumen</Text>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingVertical: espacio.s, borderBottomWidth: 1, borderBottomColor: paleta.borde, marginTop: espacio.s,
          }}>
            <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Monto a reembolsar:</Text>
            <Text style={[tipografia.h3, tabular, { color: paleta.exitoTexto }]}>
              {formatCOP(neto.monto_devuelto)}
            </Text>
          </View>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: espacio.s,
          }}>
            <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Monto a cobrar al cliente:</Text>
            <Text style={[tipografia.h3, tabular, { color: paleta.peligroTexto }]}>
              {formatCOP(neto.monto_cobrado)}
            </Text>
          </View>

          {/* Método de reembolso */}
          {neto.monto_devuelto > 0 && (
            <View style={{ marginTop: espacio.m }}>
              <Text style={[tipografia.etiqueta, { color: paleta.texto2, marginBottom: espacio.xs }]}>
                Método de reembolso *
              </Text>
              <MetodoPicker
                value={metodoReembolso}
                onChange={setMetodoReembolso}
                testPrefix="reembolso"
              />
            </View>
          )}

          {/* Método de cobro */}
          {neto.monto_cobrado > 0 && (
            <View style={{ marginTop: espacio.m }}>
              <Text style={[tipografia.etiqueta, { color: paleta.texto2, marginBottom: espacio.xs }]}>
                Método de cobro adicional *
              </Text>
              <MetodoPicker
                value={metodoCobro}
                onChange={setMetodoCobro}
                testPrefix="cobro"
              />
            </View>
          )}

          {neto.monto_devuelto === 0 && neto.monto_cobrado === 0 && tipo === 'cambio' && (
            <View style={{
              flexDirection: 'row', alignItems: 'flex-start', gap: espacio.s,
              backgroundColor: paleta.exitoSoft, borderRadius: radio.sm, padding: espacio.s, marginTop: espacio.m,
            }}>
              <CircleCheckBig size={15} color={paleta.exitoTexto} />
              <Text style={[tipografia.caption, { color: paleta.exitoTexto, flex: 1 }]}>
                Cambio sin diferencia de precio.
              </Text>
            </View>
          )}
        </Tarjeta>

        {/* Errores de validación */}
        {erroresValidacion.length > 0 && (
          <View style={{
            backgroundColor: paleta.peligroSoft, borderRadius: radio.sm, padding: espacio.m, gap: espacio.xs,
          }}>
            {erroresValidacion.map((e, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
                <CircleX size={16} color={paleta.peligroTexto} />
                <Text style={[tipografia.caption, { color: paleta.peligroTexto, flex: 1 }]}>{e}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Botón confirmar */}
        <Boton
          titulo="Confirmar devolución"
          onPress={handleConfirmar}
          cargando={enviando}
          deshabilitado={!puedeConfirmar}
          icono={<CircleCheckBig size={20} color={paleta.sobrePrimario} />}
        />
      </ScrollView>

      {/* Modal buscador de reemplazo */}
      {modalReemplazoIdx !== null && (
        <BuscadorReemplazoModal
          idx={modalReemplazoIdx}
          estadoItem={estadoItems[modalReemplazoIdx]}
          onBuscar={buscarReemplazo}
          onSeleccionar={seleccionarReemplazo}
          onCerrar={cerrarModalReemplazo}
        />
      )}
    </KeyboardAvoidingView>
  )
}

// ── Sub-componente: selector de método de pago ────────────────────────────────

const METODOS: { value: MetodoDinero; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'bre_b', label: 'Bre-B' },
  { value: 'otro', label: 'Otro' },
]

function MetodoPicker({
  value,
  onChange,
  testPrefix,
}: {
  value: MetodoDinero | null
  onChange: (m: MetodoDinero) => void
  testPrefix: string
}) {
  const { paleta } = useTema()
  return (
    <View style={{ flexDirection: 'row', gap: espacio.s }}>
      {METODOS.map((m) => {
        const activo = value === m.value
        return (
          <Presionable
            key={m.value}
            accessibilityRole="button"
            accessibilityLabel={m.label}
            accessibilityState={{ selected: activo }}
            onPress={() => onChange(m.value)}
            testID={`btn-metodo-${testPrefix}-${m.value}`}
            style={{
              flex: 1,
              height: 40,
              borderRadius: radio.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: activo ? paleta.primario : paleta.superficie2,
              borderWidth: 1,
              borderColor: activo ? paleta.primario : paleta.borde,
            }}
          >
            <Text style={[tipografia.etiqueta, { color: activo ? paleta.sobrePrimario : paleta.texto2 }]}>
              {m.label}
            </Text>
          </Presionable>
        )
      })}
    </View>
  )
}

// ── Sub-componente: modal buscador de reemplazo ───────────────────────────────

interface BuscadorReemplazoModalProps {
  idx: number
  estadoItem: EstadoItem
  onBuscar: (idx: number, query: string) => void
  onSeleccionar: (idx: number, prod: ProductoCalzado) => void
  onCerrar: () => void
}

function BuscadorReemplazoModal({
  idx,
  estadoItem,
  onBuscar,
  onSeleccionar,
  onCerrar,
}: BuscadorReemplazoModalProps) {
  const { paleta } = useTema()
  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={onCerrar}
      testID="modal-buscar-reemplazo"
    >
      <View style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: paleta.fondo, borderTopLeftRadius: radio.xl, borderTopRightRadius: radio.xl, maxHeight: '80%',
        }}>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            padding: espacio.l, borderBottomWidth: 1, borderBottomColor: paleta.borde,
          }}>
            <Text style={[tipografia.h3, { color: paleta.texto }]}>Buscar calzado de reemplazo</Text>
            <Presionable
              accessibilityRole="button"
              accessibilityLabel="Cerrar buscador de reemplazo"
              onPress={onCerrar}
              hitSlop={12}
              testID="btn-cerrar-modal-reemplazo"
            >
              <X size={24} color={paleta.texto2} />
            </Presionable>
          </View>

          <View style={{ padding: espacio.l, flex: 1 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: espacio.s,
              backgroundColor: paleta.superficie2, borderRadius: radio.md, paddingHorizontal: espacio.m, height: 44,
              marginBottom: espacio.m,
            }}>
              <Search size={18} color={paleta.texto3} />
              <TextInput
                style={[tipografia.cuerpo, { flex: 1, color: paleta.texto }]}
                placeholder="Buscar por descripción, talla, color…"
                placeholderTextColor={paleta.textoDeshabilitado}
                autoFocus
                value={estadoItem.busquedaReemplazo}
                onChangeText={(q) => onBuscar(idx, q)}
                testID="input-buscar-reemplazo"
              />
              {estadoItem.buscandoReemplazo && (
                <ActivityIndicator size="small" color={paleta.primario} />
              )}
            </View>

            <ScrollView
              style={{ maxHeight: 400 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {estadoItem.resultadosBusqueda.length === 0 &&
              !estadoItem.buscandoReemplazo &&
              estadoItem.busquedaReemplazo.trim() !== '' ? (
                <EstadoVacio icono={<Search />} titulo="Sin resultados" mensaje="Prueba con otra búsqueda." />
              ) : null}

              {estadoItem.resultadosBusqueda.map((prod) => (
                <Presionable
                  key={prod.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Seleccionar ${prod.descripcion}`}
                  onPress={() => onSeleccionar(idx, prod)}
                  testID={`resultado-reemplazo-${prod.id}`}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: espacio.m,
                    paddingVertical: espacio.m, borderBottomWidth: 1, borderBottomColor: paleta.borde,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>{prod.descripcion}</Text>
                    <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                      {[
                        prod.marca,
                        prod.referencia && `Ref: ${prod.referencia}`,
                        prod.talla && `T: ${prod.talla}`,
                        prod.color && `C: ${prod.color}`,
                        `Stock: ${prod.stock_actual}`,
                      ]
                        .filter(Boolean)
                        .join('  •  ')}
                    </Text>
                    <Text style={[tipografia.caption, tabular, { color: paleta.primario }]}>
                      {formatCOP(prod.precio_minimo)} – {formatCOP(prod.precio_maximo)}
                    </Text>
                  </View>
                  <CircleCheckBig size={22} color={paleta.exito} />
                </Presionable>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  )
}
