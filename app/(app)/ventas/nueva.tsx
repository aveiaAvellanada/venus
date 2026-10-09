import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Check, Lock, Minus, Plus, X } from 'lucide-react-native'
import { useRequireModulo } from '../../../lib/auth'
import { useCarrito } from '../../../lib/carrito-contexto'
import {
  calcularCambio, montoEfectivo, pagosCuadran, totalCarrito,
  type AccionCarrito, type ItemCarrito, type MetodoPago, type PagoInput,
} from '../../../lib/carrito'
import { registrarVenta, type RegistrarVentaInput } from '../../../lib/ventas'
import { intentoVenta } from '../../../lib/intentoVenta'
import { obtenerCajaHoy } from '../../../lib/caja'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import {
  Boton, CampoTexto, Chip, EstadoVacio, OverlayExito, Presionable, SliderPrecio, Tarjeta,
} from '../../../components/ui'

type Etapa = 'carrito' | 'ajustarPrecio' | 'cobrar' | 'confirmacion'
const METODOS: MetodoPago[] = ['efectivo', 'nequi', 'bre_b', 'otro']
const ETIQUETA: Record<MetodoPago, string> = { efectivo: 'Efectivo', nequi: 'Nequi', bre_b: 'Bre-B', otro: 'Otro' }
const pesos = (n: number) => '$' + n.toLocaleString('es-CO')
const soloEntero = (t: string) => t.replace(/[^0-9]/g, '')
const soloDecimal = (t: string) => {
  const limpio = t.replace(/[^0-9.]/g, '')
  const partes = limpio.split('.')
  return partes.length <= 1 ? limpio : partes[0] + '.' + partes.slice(1).join('')
}

function Paso({ onPress, etiqueta, children }: {
  onPress: () => void; etiqueta: string; children: ReactNode
}) {
  const { paleta } = useTema()
  return (
    <Presionable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      hitSlop={10}
      style={{
        width: 36, height: 36, borderRadius: radio.full,
        backgroundColor: paleta.primarioSoft, alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </Presionable>
  )
}

function LineaCarrito({ item, dispatch }: { item: ItemCarrito; dispatch: (a: AccionCarrito) => void }) {
  const { paleta } = useTema()
  const esCalzado = item.producto.tipo === 'calzado'
  const [precioTxt, setPrecioTxt] = useState(String(item.precio))
  const [cantTxt, setCantTxt] = useState(String(item.cantidad))

  function commitPrecio() {
    dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: Number(soloEntero(precioTxt)) || 0 })
  }
  function commitCantidad() {
    dispatch({ tipo: 'cambiarCantidad', id: item.producto.id, cantidad: Number(soloDecimal(cantTxt)) || 0 })
  }

  const inputInline = {
    borderWidth: 1.5,
    borderColor: paleta.bordeFuerte,
    borderRadius: radio.sm,
    paddingVertical: 6,
    paddingHorizontal: espacio.s,
    minWidth: 84,
    color: paleta.texto,
    backgroundColor: paleta.superficie,
    ...tipografia.cuerpo,
    ...tabular,
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.s }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]} numberOfLines={1}>
          {item.producto.titulo}
        </Text>
        {esCalzado ? (
          <SliderPrecio
            valor={item.precio}
            minimo={item.producto.precioMin ?? 0}
            maximo={item.producto.precioMax ?? item.precio}
            onCambio={(v) => dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: v })}
          />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
            <TextInput
              accessibilityLabel="Cantidad"
              style={inputInline}
              keyboardType="decimal-pad"
              value={cantTxt}
              onChangeText={t => setCantTxt(soloDecimal(t))}
              onEndEditing={commitCantidad}
            />
            <Text style={[tipografia.caption, { color: paleta.texto2 }]}>{item.producto.unidad} ×</Text>
            <TextInput
              accessibilityLabel="Precio unitario"
              style={inputInline}
              keyboardType="number-pad"
              value={precioTxt}
              onChangeText={t => setPrecioTxt(soloEntero(t))}
              onEndEditing={commitPrecio}
            />
          </View>
        )}
        <Text style={[tipografia.caption, tabular, { color: paleta.texto2 }]}>
          Subtotal {pesos(item.subtotal)}
        </Text>
      </View>
      {esCalzado ? (
        <>
          <Paso etiqueta="Quitar uno"
            onPress={() => dispatch({ tipo: 'cambiarCantidad', id: item.producto.id, cantidad: item.cantidad - 1 })}>
            <Minus size={18} color={paleta.primario} />
          </Paso>
          <Text style={[tipografia.h3, tabular, { color: paleta.texto, minWidth: 28, textAlign: 'center' }]}>
            {item.cantidad}
          </Text>
          <Paso etiqueta="Agregar uno"
            onPress={() => dispatch({ tipo: 'agregar', producto: item.producto })}>
            <Plus size={18} color={paleta.primario} />
          </Paso>
        </>
      ) : (
        <Paso etiqueta="Quitar del carrito"
          onPress={() => dispatch({ tipo: 'quitar', id: item.producto.id })}>
          <X size={18} color={paleta.primario} />
        </Paso>
      )}
    </View>
  )
}

export default function NuevaVenta() {
  const redir = useRequireModulo('ventas')
  const router = useRouter()
  const { modo } = useLocalSearchParams<{ modo?: string }>()
  const { paleta } = useTema()
  const paddingInferior = usePaddingInferior(espacio.xxl)

  // Carrito compartido: el detalle de producto (tab Productos) también agrega aquí.
  // `intento` conserva la clave entre reintentos fallidos para que el servidor no
  // duplique una venta que sí se guardó (ver lib/intentoVenta.ts).
  const { items, dispatch, intento: intentoRef } = useCarrito()
  const [etapa, setEtapa] = useState<Etapa>(modo === 'rapida' && items.length === 1 ? 'ajustarPrecio' : 'carrito')

  const [metodos, setMetodos] = useState<MetodoPago[]>([])
  const [montos, setMontos] = useState<Record<MetodoPago, string>>({ efectivo: '', nequi: '', bre_b: '', otro: '' })
  const [recibido, setRecibido] = useState('')
  const [cliente, setCliente] = useState({ nombre: '', apellido: '', telefono: '' })
  const [guardando, setGuardando] = useState(false)
  const [numeroVenta, setNumeroVenta] = useState<number | null>(null)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [cajaEstado, setCajaEstado] = useState<'loading' | 'ok' | 'bloqueado'>('loading')

  useEffect(() => {
    obtenerCajaHoy()
      .then(c => {
        if (!c || c.estado !== 'abierta') setCajaEstado('bloqueado')
        else setCajaEstado('ok')
      })
      .catch(() => setCajaEstado('bloqueado'))
  }, [])

  if (redir) return redir

  const salirAtras = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/movimientos')
  }

  if (cajaEstado === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={paleta.primario} />
      </View>
    )
  }

  if (cajaEstado === 'bloqueado') {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, justifyContent: 'center', padding: espacio.xl, gap: espacio.l }}>
        <EstadoVacio
          icono={<Lock />}
          titulo="Caja cerrada"
          mensaje="La caja de hoy no está abierta."
          textoAccion="Ir a Caja"
          onAccion={() => router.replace('/caja')}
        />
        <Boton titulo="Volver" variante="fantasma" onPress={salirAtras} />
      </View>
    )
  }

  const total = totalCarrito(items)
  const pagos: PagoInput[] = metodos.map(m => ({ metodo: m, monto: Number(montos[m]) || 0 }))
  const sumaPagos = pagos.reduce((s, p) => s + p.monto, 0)
  const diferencia = total - sumaPagos
  const efectivoMonto = montoEfectivo(pagos)
  const recibidoNum = Number(recibido) || 0
  const cambio = calcularCambio(recibidoNum, efectivoMonto)
  const puedeConfirmar = pagosCuadran(pagos, total) && (efectivoMonto === 0 || recibidoNum >= efectivoMonto)

  function toggleMetodo(m: MetodoPago) {
    setMetodos(prev => {
      const next = prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
      if (next.length === 1) setMontos(mm => ({ ...mm, [next[0]]: String(total) }))
      return next
    })
  }

  async function confirmar() {
    setGuardando(true)
    const venta: RegistrarVentaInput = {
      items,
      pagos,
      efectivoRecibido: efectivoMonto > 0 ? recibidoNum : null,
      cliente: {
        nombre: cliente.nombre || undefined,
        apellido: cliente.apellido || undefined,
        telefono: cliente.telefono || undefined,
      },
    }
    const intento = intentoVenta(intentoRef.current, venta)
    intentoRef.current = intento
    try {
      const { numero } = await registrarVenta(venta, intento.clave)
      intentoRef.current = null
      setNumeroVenta(numero)
      setOverlayVisible(true)
      setEtapa('confirmacion')
    } catch (e) {
      Alert.alert('No se registró', e instanceof Error ? e.message : 'Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  function salirDelFlujo() {
    if (items.length > 0) {
      Alert.alert('¿Descartar la venta?', 'Perderás el carrito actual.', [
        { text: 'Seguir', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: salirAtras },
      ])
    } else {
      salirAtras()
    }
  }

  function nuevaVenta() {
    dispatch({ tipo: 'limpiar' })
    setMetodos([])
    setMontos({ efectivo: '', nequi: '', bre_b: '', otro: '' })
    setRecibido('')
    setCliente({ nombre: '', apellido: '', telefono: '' })
    setNumeroVenta(null)
    setEtapa('carrito')
  }

  if (etapa === 'ajustarPrecio') {
    const item = items[0]
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, padding: espacio.xl, paddingTop: 56, gap: espacio.l }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m }}>
          <Presionable accessibilityRole="button" accessibilityLabel="Salir de la venta"
            onPress={salirDelFlujo} hitSlop={12}>
            <X size={24} color={paleta.texto} />
          </Presionable>
          <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>{item.producto.titulo}</Text>
        </View>
        {item.producto.tipo === 'calzado' ? (
          <SliderPrecio
            valor={item.precio}
            minimo={item.producto.precioMin ?? 0}
            maximo={item.producto.precioMax ?? item.precio}
            onCambio={(v) => dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: v })}
          />
        ) : null}
        <Text style={[tipografia.h3, tabular, { color: paleta.texto }]}>Subtotal {pesos(item.subtotal)}</Text>
        <Boton titulo="Continuar a pago" onPress={() => setEtapa('cobrar')} />
      </View>
    )
  }

  if (etapa === 'confirmacion') {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, alignItems: 'center', justifyContent: 'center', padding: espacio.xl, gap: espacio.l }}>
        <Check size={64} color={paleta.exito} strokeWidth={2.5} />
        <Text style={[tipografia.h1, { color: paleta.texto, textAlign: 'center' }]}>
          Venta #{numeroVenta} registrada
        </Text>
        <View style={{ alignSelf: 'stretch', gap: espacio.s }}>
          <Boton titulo="Nueva venta" onPress={nuevaVenta} />
          <Boton titulo="Listo" variante="fantasma" onPress={salirAtras} />
        </View>
        <OverlayExito visible={overlayVisible} onFin={() => setOverlayVisible(false)} />
      </View>
    )
  }

  if (etapa === 'cobrar') {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: paleta.fondo }}
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 56, gap: espacio.l }}
        keyboardShouldPersistTaps="handled"
      >
        <Presionable
          accessibilityRole="button"
          accessibilityLabel="Volver al carrito"
          hitSlop={12}
          onPress={() => {
            setMetodos([])
            setMontos({ efectivo: '', nequi: '', bre_b: '', otro: '' })
            setRecibido('')
            setEtapa('carrito')
          }}
        >
          <Text style={[tipografia.cuerpoLg, { color: paleta.primario }]}>← Carrito</Text>
        </Presionable>

        <Text style={[tipografia.displayXL, tabular, { color: paleta.texto, textAlign: 'center' }]}>
          {pesos(total)}
        </Text>

        <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Método de pago</Text>
        <View style={{ flexDirection: 'row', gap: espacio.s }}>
          {METODOS.map(m => (
            <Chip key={m} etiqueta={ETIQUETA[m]} activo={metodos.includes(m)} onPress={() => toggleMetodo(m)} />
          ))}
        </View>

        {metodos.map(m => (
          <CampoTexto
            key={m}
            etiqueta={ETIQUETA[m]}
            keyboardType="number-pad"
            value={montos[m]}
            onChangeText={t => setMontos(mm => ({ ...mm, [m]: soloEntero(t) }))}
            placeholder="0"
          />
        ))}

        {metodos.length > 0 ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[tipografia.cuerpoLg, tabular, {
              textAlign: 'center',
              color: diferencia === 0 ? paleta.exitoTexto : paleta.peligroTexto,
            }]}
          >
            {diferencia === 0
              ? '✓ Cuadra'
              : diferencia > 0
                ? `Faltan ${pesos(diferencia)}`
                : `Sobran ${pesos(-diferencia)}`}
          </Text>
        ) : (
          <Text style={[tipografia.cuerpo, tabular, { textAlign: 'center', color: paleta.peligroTexto }]}>
            Faltan {pesos(total)}
          </Text>
        )}

        {efectivoMonto > 0 ? (
          <View style={{ gap: espacio.xs }}>
            <CampoTexto
              etiqueta="Efectivo recibido"
              keyboardType="number-pad"
              value={recibido}
              onChangeText={t => setRecibido(soloEntero(t))}
              placeholder="¿Con cuánto paga?"
            />
            <Text style={[tipografia.h3, tabular, { color: paleta.exitoTexto }]}>
              Cambio: {pesos(cambio)}
            </Text>
          </View>
        ) : null}

        <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Datos del cliente (opcional)</Text>
        <CampoTexto placeholder="Nombre" value={cliente.nombre}
          onChangeText={t => setCliente(c => ({ ...c, nombre: t }))} />
        <CampoTexto placeholder="Apellido" value={cliente.apellido}
          onChangeText={t => setCliente(c => ({ ...c, apellido: t }))} />
        <CampoTexto placeholder="Teléfono" keyboardType="phone-pad" value={cliente.telefono}
          onChangeText={t => setCliente(c => ({ ...c, telefono: t }))} />

        <Boton
          titulo="Confirmar venta"
          onPress={confirmar}
          cargando={guardando}
          deshabilitado={!puedeConfirmar}
        />
      </ScrollView>
    )
  }

  // etapa === 'carrito'
  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m }}>
        <Presionable accessibilityRole="button" accessibilityLabel="Salir de la venta"
          onPress={salirDelFlujo} hitSlop={12}>
          <X size={24} color={paleta.texto} />
        </Presionable>
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Carrito</Text>
      </View>

      {items.length === 0 ? (
        <EstadoVacio
          icono={<X />}
          titulo="Tu carrito está vacío"
          mensaje="Agrega productos desde la pestaña Productos"
        />
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: espacio.xl }} keyboardShouldPersistTaps="handled">
          {items.map((i: ItemCarrito) => (
            <LineaCarrito key={`${i.producto.tipo}-${i.producto.id}`} item={i} dispatch={dispatch} />
          ))}
        </ScrollView>
      )}

      <Tarjeta estilo={{ borderRadius: 0, borderTopLeftRadius: radio.lg, borderTopRightRadius: radio.lg, borderBottomWidth: 0, paddingBottom: paddingInferior }}>
        <Boton
          titulo={total > 0 ? `Cobrar ${pesos(total)}` : 'Cobrar'}
          onPress={() => setEtapa('cobrar')}
          deshabilitado={items.length === 0}
        />
      </Tarjeta>
    </View>
  )
}
