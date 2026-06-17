import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRequireModulo } from '../../../lib/auth'
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

// ── Componente principal ──────────────────────────────────────────────────────

export default function NuevaDevolucionScreen() {
  const requireModulo = useRequireModulo('devoluciones')
  const router = useRouter()
  const params = useLocalSearchParams<{ venta: string; numero: string }>()

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
      Alert.alert('Éxito', 'La devolución fue registrada correctamente.', [
        { text: 'Aceptar', onPress: () => router.back() },
      ])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la devolución.'
      Alert.alert('Error', msg)
    } finally {
      setEnviando(false)
    }
  }

  // ── Guard ────────────────────────────────────────────────────────────────
  if (requireModulo) return requireModulo

  // ── Cargando ─────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.cargandoText}>Cargando venta…</Text>
      </View>
    )
  }

  // ── Error de carga ────────────────────────────────────────────────────────
  if (errorCarga || !venta) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{errorCarga ?? 'Venta no disponible.'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={16}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle}>Nueva Devolución</Text>
        </View>

        {/* Info de la venta */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="receipt-outline" size={18} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Venta #{venta.numero}</Text>
          </View>
          <Text style={styles.ventaDetalle}>
            Fecha: {new Date(venta.fecha).toLocaleDateString('es-CO')}
          </Text>
          {venta.cliente_nombre ? (
            <Text style={styles.ventaDetalle}>Cliente: {venta.cliente_nombre}</Text>
          ) : null}
          <Text style={styles.ventaDetalle}>
            Estado:{' '}
            <Text style={styles.estadoBadge}>{venta.estado}</Text>
          </Text>
        </View>

        {/* Tipo de devolución */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tipo de devolución *</Text>
          <View style={styles.tipoRow}>
            {(['total', 'parcial', 'cambio'] as TipoDevolucion[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tipoBtn, tipo === t && styles.tipoBtnActive]}
                onPress={() => setTipo(t)}
                testID={`btn-tipo-${t}`}
              >
                <Text style={[styles.tipoBtnText, tipo === t && styles.tipoBtnTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {tipo === 'cambio' && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={15} color="#0284c7" />
              <Text style={styles.infoText}>
                Solo aplica para ítems de calzado. Los productos de Granja no admiten cambio de producto.
              </Text>
            </View>
          )}
        </View>

        {/* Items de la venta */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ítems a devolver</Text>
          {venta.items.map((ventaItem, idx) => {
            const ei = estadoItems[idx]
            const disp = disponible(ventaItem)
            const esCalzado = ventaItem.tipo_producto === 'calzado'
            const esCambio = tipo === 'cambio'
            // En modo cambio, los items 'varios'/Granja se muestran como no disponibles
            const bloqueadoPorGranja = esCambio && !esCalzado

            return (
              <View key={ventaItem.venta_item_id} style={styles.itemCard} testID={`item-devolucion-${ventaItem.venta_item_id}`}>
                <View style={styles.itemHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{ventaItem.descripcion}</Text>
                    {(ventaItem.talla || ventaItem.color) ? (
                      <Text style={styles.itemSubtitle}>
                        {[ventaItem.talla && `Talla: ${ventaItem.talla}`, ventaItem.color && `Color: ${ventaItem.color}`]
                          .filter(Boolean)
                          .join('  •  ')}
                      </Text>
                    ) : null}
                    <Text style={styles.itemStock}>
                      Vendido: {ventaItem.cantidad_vendida} • Disponible: {disp}
                      {disp === 0 ? '  (ya devuelto)' : ''}
                    </Text>
                    <Text style={styles.itemPrecio}>
                      Precio: {formatCOP(ventaItem.precio_unitario)} c/u
                    </Text>
                  </View>
                  <View style={styles.tipoBadgeWrapper}>
                    <Text style={[styles.tipoBadge, esCalzado ? styles.tipoBadgeCalzado : styles.tipoBadgeVarios]}>
                      {esCalzado ? 'Calzado' : 'Granja'}
                    </Text>
                  </View>
                </View>

                {bloqueadoPorGranja ? (
                  <View style={styles.granjaWarning}>
                    <Ionicons name="ban-outline" size={14} color="#92400e" />
                    <Text style={styles.granjaWarningText}>
                      Los productos de Granja no aplican para cambio de producto.
                    </Text>
                  </View>
                ) : disp === 0 ? (
                  <Text style={styles.yaDevueltoText}>Este ítem ya fue devuelto completamente.</Text>
                ) : (
                  <>
                    {/* Cantidad */}
                    <View style={styles.cantidadRow}>
                      <Text style={styles.label}>Cantidad a devolver:</Text>
                      {tipo === 'total' ? (
                        <Text style={styles.cantidadFija}>{disp}</Text>
                      ) : (
                        <TextInput
                          style={styles.cantidadInput}
                          keyboardType="number-pad"
                          value={String(ei.cantidad)}
                          onChangeText={(v) => actualizarCantidad(idx, v)}
                          editable={disp > 0}
                          testID={`input-cantidad-${ventaItem.venta_item_id}`}
                        />
                      )}
                    </View>

                    {/* Reemplazo para cambio */}
                    {esCambio && esCalzado && (
                      <View style={styles.reemplazoSection}>
                        <Text style={styles.label}>Calzado de reemplazo *</Text>
                        {ei.reemplazoSeleccionado ? (
                          <View style={styles.reemplazoSeleccionado}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.reemplazoNombre}>
                                {ei.reemplazoSeleccionado.descripcion}
                              </Text>
                              <Text style={styles.reemplazoDetalle}>
                                {[
                                  ei.reemplazoSeleccionado.talla && `T: ${ei.reemplazoSeleccionado.talla}`,
                                  ei.reemplazoSeleccionado.color && `C: ${ei.reemplazoSeleccionado.color}`,
                                ]
                                  .filter(Boolean)
                                  .join('  •  ')}
                              </Text>
                            </View>
                            <TouchableOpacity
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
                              <Ionicons name="close-circle" size={22} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.buscarReemplazoBtn}
                            onPress={() => abrirModalReemplazo(idx)}
                            testID={`btn-buscar-reemplazo-${ventaItem.venta_item_id}`}
                          >
                            <Ionicons name="search" size={16} color="#3b82f6" />
                            <Text style={styles.buscarReemplazoBtnText}>Buscar calzado…</Text>
                          </TouchableOpacity>
                        )}

                        {/* Precio de reemplazo */}
                        {ei.cambio_talla_color_id && (
                          <View style={styles.precioReemplazoGroup}>
                            <Text style={styles.label}>Precio de reemplazo ($) *</Text>
                            <TextInput
                              style={styles.input}
                              keyboardType="numeric"
                              placeholder="Ingresa el precio"
                              placeholderTextColor="#9ca3af"
                              value={ei.precio_reemplazo !== undefined ? String(ei.precio_reemplazo) : ''}
                              onChangeText={(v) => actualizarPrecioReemplazo(idx, v)}
                              testID={`input-precio-reemplazo-${ventaItem.venta_item_id}`}
                            />
                            {ei.precio_reemplazo !== undefined && ei.precio_reemplazo > 0 && (
                              <View style={styles.diferenciaRow}>
                                {(() => {
                                  const diff = calcularDiferenciaCambio(
                                    ventaItem.precio_unitario,
                                    ei.precio_reemplazo,
                                    ei.cantidad
                                  )
                                  return (
                                    <>
                                      <Ionicons
                                        name={diff > 0 ? 'trending-up' : diff < 0 ? 'trending-down' : 'remove-outline'}
                                        size={15}
                                        color={diff > 0 ? '#ef4444' : diff < 0 ? '#10b981' : '#6b7280'}
                                      />
                                      <Text
                                        style={[
                                          styles.diferenciaText,
                                          diff > 0
                                            ? styles.diferenciaPositiva
                                            : diff < 0
                                            ? styles.diferenciaNegativa
                                            : styles.diferenciaCero,
                                        ]}
                                      >
                                        {diff > 0
                                          ? `Cliente paga ${formatCOP(diff)} adicional`
                                          : diff < 0
                                          ? `Reembolso ${formatCOP(-diff)}`
                                          : 'Cambio sin diferencia de precio'}
                                      </Text>
                                    </>
                                  )
                                })()}
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>
            )
          })}
        </View>

        {/* Motivo */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Motivo *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe el motivo de la devolución…"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            value={motivo}
            onChangeText={(v) => {
              setMotivo(v)
              setErroresValidacion([])
            }}
            testID="input-motivo"
          />
        </View>

        {/* Resumen neto */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          <View style={styles.resumenRow}>
            <Text style={styles.resumenLabel}>Monto a reembolsar:</Text>
            <Text style={[styles.resumenValor, { color: '#10b981' }]}>
              {formatCOP(neto.monto_devuelto)}
            </Text>
          </View>
          <View style={styles.resumenRow}>
            <Text style={styles.resumenLabel}>Monto a cobrar al cliente:</Text>
            <Text style={[styles.resumenValor, { color: '#ef4444' }]}>
              {formatCOP(neto.monto_cobrado)}
            </Text>
          </View>

          {/* Método de reembolso */}
          {neto.monto_devuelto > 0 && (
            <View style={styles.metodoGroup}>
              <Text style={styles.label}>Método de reembolso *</Text>
              <MetodoPicker
                value={metodoReembolso}
                onChange={setMetodoReembolso}
                testPrefix="reembolso"
              />
            </View>
          )}

          {/* Método de cobro */}
          {neto.monto_cobrado > 0 && (
            <View style={styles.metodoGroup}>
              <Text style={styles.label}>Método de cobro adicional *</Text>
              <MetodoPicker
                value={metodoCobro}
                onChange={setMetodoCobro}
                testPrefix="cobro"
              />
            </View>
          )}

          {neto.monto_devuelto === 0 && neto.monto_cobrado === 0 && tipo === 'cambio' && (
            <View style={styles.infoBox}>
              <Ionicons name="checkmark-circle-outline" size={15} color="#059669" />
              <Text style={[styles.infoText, { color: '#059669' }]}>
                Cambio sin diferencia de precio.
              </Text>
            </View>
          )}
        </View>

        {/* Errores de validación */}
        {erroresValidacion.length > 0 && (
          <View style={styles.erroresBox}>
            {erroresValidacion.map((e, i) => (
              <View key={i} style={styles.errorRow}>
                <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                <Text style={styles.errorRowText}>{e}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Botón confirmar */}
        <TouchableOpacity
          style={[styles.submitButton, !puedeConfirmar && styles.submitButtonDisabled]}
          onPress={handleConfirmar}
          disabled={!puedeConfirmar}
          activeOpacity={0.8}
          testID="btn-confirmar-devolucion"
        >
          {enviando ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#ffffff" style={styles.submitIcon} />
              <Text style={styles.submitButtonText}>Confirmar devolución</Text>
            </>
          )}
        </TouchableOpacity>
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
  { value: 'daviplata', label: 'Daviplata' },
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
  return (
    <View style={styles.metodosRow}>
      {METODOS.map((m) => (
        <TouchableOpacity
          key={m.value}
          style={[styles.metodoChip, value === m.value && styles.metodoChipActive]}
          onPress={() => onChange(m.value)}
          testID={`btn-metodo-${testPrefix}-${m.value}`}
        >
          <Text style={[styles.metodoChipText, value === m.value && styles.metodoChipTextActive]}>
            {m.label}
          </Text>
        </TouchableOpacity>
      ))}
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
  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={onCerrar}
      testID="modal-buscar-reemplazo"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Buscar calzado de reemplazo</Text>
            <TouchableOpacity onPress={onCerrar} hitSlop={12} testID="btn-cerrar-modal-reemplazo">
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#6b7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por descripción, talla, color…"
                placeholderTextColor="#9ca3af"
                autoFocus
                value={estadoItem.busquedaReemplazo}
                onChangeText={(q) => onBuscar(idx, q)}
                testID="input-buscar-reemplazo"
              />
              {estadoItem.buscandoReemplazo && (
                <ActivityIndicator size="small" color="#3b82f6" />
              )}
            </View>

            <ScrollView
              style={styles.modalResultsScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {estadoItem.resultadosBusqueda.length === 0 &&
              !estadoItem.buscandoReemplazo &&
              estadoItem.busquedaReemplazo.trim() !== '' ? (
                <Text style={styles.sinResultados}>Sin resultados para esa búsqueda.</Text>
              ) : null}

              {estadoItem.resultadosBusqueda.map((prod) => (
                <TouchableOpacity
                  key={prod.id}
                  style={styles.resultItem}
                  onPress={() => onSeleccionar(idx, prod)}
                  testID={`resultado-reemplazo-${prod.id}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTitle}>{prod.descripcion}</Text>
                    <Text style={styles.resultSubtitle}>
                      {[
                        prod.referencia && `Ref: ${prod.referencia}`,
                        prod.talla && `T: ${prod.talla}`,
                        prod.color && `C: ${prod.color}`,
                        `Stock: ${prod.stock_actual}`,
                      ]
                        .filter(Boolean)
                        .join('  •  ')}
                    </Text>
                    <Text style={styles.resultPrecio}>
                      {formatCOP(prod.precio_minimo)} – {formatCOP(prod.precio_maximo)}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#10b981" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  cargandoText: { fontSize: 15, color: '#6b7280' },
  errorText: { fontSize: 15, color: '#ef4444', textAlign: 'center' },
  backButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    marginBottom: 16,
    marginTop: Platform.OS === 'ios' ? 44 : 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  ventaDetalle: { fontSize: 14, color: '#4b5563', marginTop: 4 },
  estadoBadge: { fontWeight: '700', color: '#3b82f6' },

  tipoRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  tipoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  tipoBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  tipoBtnText: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  tipoBtnTextActive: { color: '#ffffff' },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  infoText: { flex: 1, fontSize: 13, color: '#0284c7', lineHeight: 18 },

  itemCard: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 14,
    marginTop: 14,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  itemSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  itemStock: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  itemPrecio: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  tipoBadgeWrapper: { paddingTop: 2 },
  tipoBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tipoBadgeCalzado: { backgroundColor: '#dbeafe', color: '#1d4ed8' },
  tipoBadgeVarios: { backgroundColor: '#dcfce7', color: '#166534' },

  granjaWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 10,
  },
  granjaWarningText: { flex: 1, fontSize: 13, color: '#92400e' },
  yaDevueltoText: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },

  cantidadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  cantidadFija: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    minWidth: 40,
    textAlign: 'center',
  },
  cantidadInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    width: 70,
    textAlign: 'center',
  },

  reemplazoSection: { marginTop: 12, gap: 8 },
  buscarReemplazoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  buscarReemplazoBtnText: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  reemplazoSeleccionado: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  reemplazoNombre: { fontSize: 14, fontWeight: '700', color: '#111827' },
  reemplazoDetalle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  precioReemplazoGroup: { marginTop: 10 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  diferenciaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  diferenciaText: { fontSize: 13, fontWeight: '600' },
  diferenciaPositiva: { color: '#ef4444' },
  diferenciaNegativa: { color: '#059669' },
  diferenciaCero: { color: '#6b7280' },

  resumenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  resumenLabel: { fontSize: 14, color: '#4b5563' },
  resumenValor: { fontSize: 16, fontWeight: '700' },
  metodoGroup: { marginTop: 14 },
  metodosRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  metodoChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  metodoChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  metodoChipText: { fontSize: 13, fontWeight: '600', color: '#4b5563' },
  metodoChipTextActive: { color: '#ffffff' },

  erroresBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorRowText: { fontSize: 13, color: '#dc2626', flex: 1 },

  submitButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitIcon: { marginRight: 8 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalBody: { padding: 16, flex: 1 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  modalResultsScroll: { maxHeight: 400 },
  sinResultados: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 24,
    fontStyle: 'italic',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  resultTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  resultSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  resultPrecio: { fontSize: 12, color: '#3b82f6', marginTop: 2, fontWeight: '600' },
})
