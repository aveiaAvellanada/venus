import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Alert, Image, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Egg, Footprints, Lock, Minus, Package, Plus, ShoppingBag, X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRequireModulo } from '../../../lib/auth'
import { useCarrito } from '../../../lib/carrito-contexto'
import {
  calcularCambio, fueraDeRango, montoEfectivo, numArticulos, pagosCuadran, puedeCobrar, rangoDeslizador,
  totalCarrito,
  type AccionCarrito, type ItemCarrito, type MetodoPago, type PagoInput,
} from '../../../lib/carrito'
import { registrarVenta, type RegistrarVentaInput } from '../../../lib/ventas'
import { intentoVenta } from '../../../lib/intentoVenta'
import { obtenerCajaHoy } from '../../../lib/caja'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografiaCompacta as tc } from '../../../lib/theme'
import {
  BarraAccionInferior, Boton, CampoTexto, Chip, OverlayExito, Presionable, ScreenWrapper, SliderPrecio,
} from '../../../components/ui'

type Etapa = 'carrito' | 'ajustarPrecio' | 'cobrar' | 'confirmacion'
const METODOS: MetodoPago[] = ['efectivo', 'nequi', 'bre_b', 'otro']
const ETIQUETA: Record<MetodoPago, string> = { efectivo: 'Efectivo', nequi: 'Nequi', bre_b: 'Bre-B', otro: 'Otro' }
const MONTOS_VACIOS: Record<MetodoPago, string> = { efectivo: '', nequi: '', bre_b: '', otro: '' }
const CLIENTE_VACIO = { nombre: '', apellido: '', telefono: '', documento: '' }
const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')
const miles = (n: number) => Math.round(n).toLocaleString('es-CO')
const soloEntero = (t: string) => t.replace(/[^0-9]/g, '')
const soloDecimal = (t: string) => {
  const limpio = t.replace(/[^0-9.]/g, '')
  const partes = limpio.split('.')
  return partes.length <= 1 ? limpio : partes[0] + '.' + partes.slice(1).join('')
}

// Botón redondo del encabezado (salir / volver).
function BotonCabecera({ etiqueta, onPress, children }: { etiqueta: string; onPress: () => void; children: ReactNode }) {
  const { paleta } = useTema()
  return (
    <Presionable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 40, height: 40, borderRadius: radio.full,
        backgroundColor: paleta.superficie2, alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </Presionable>
  )
}

function Cabecera({ titulo, derecha, boton }: { titulo: string; derecha?: string; boton: ReactNode }) {
  const { paleta } = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingHorizontal: espacio.xl, paddingTop: 52, paddingBottom: espacio.m }}>
      {boton}
      <Text style={[tc.titulo, { color: paleta.texto, flex: 1 }]}>{titulo}</Text>
      {derecha ? <Text style={[tc.etiqueta, { color: paleta.texto3, fontSize: 13 }]}>{derecha}</Text> : null}
    </View>
  )
}

function Paso({ onPress, etiqueta, deshabilitado = false, children }: {
  onPress: () => void; etiqueta: string; deshabilitado?: boolean; children: ReactNode
}) {
  const { paleta } = useTema()
  return (
    <Presionable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={deshabilitado ? undefined : onPress}
      hitSlop={8}
      style={{
        width: 30, height: 30, borderRadius: radio.full, opacity: deshabilitado ? 0.35 : 1,
        backgroundColor: paleta.superficie2, alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </Presionable>
  )
}

function Miniatura({ item }: { item: ItemCarrito }) {
  const { paleta } = useTema()
  const Icono = item.producto.tipo === 'calzado' ? Footprints : /huevo/i.test(item.producto.titulo) ? Egg : Package
  return (
    <View style={{
      width: 76, height: 76, borderRadius: radio.sm, backgroundColor: paleta.superficie2,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      {item.producto.foto ? (
        <Image source={{ uri: item.producto.foto }} style={{ width: 76, height: 76 }} resizeMode="cover" />
      ) : (
        <Icono size={34} strokeWidth={1.5} color={item.producto.tipo === 'calzado' ? paleta.textoDeshabilitado : paleta.acento} />
      )}
    </View>
  )
}

// Precio del calzado: deslizador de $1.000 en $1.000 entre mínimo y máximo, y caja
// para escribir el precio exacto. Ambos se sincronizan. Fuera de rango se avisa
// (el servidor lo rechazaría) y la pantalla no deja cobrar.
function AjustePrecio({ item, dispatch }: { item: ItemCarrito; dispatch: (a: AccionCarrito) => void }) {
  const { paleta } = useTema()
  const min = item.producto.precioMin ?? item.precio
  const max = item.producto.precioMax ?? item.precio
  const rango = rangoDeslizador(min, max)
  const [texto, setTexto] = useState(miles(item.precio))
  const [editando, setEditando] = useState(false)

  // El deslizador (u otra pantalla) cambió el precio: refleja el valor en la caja.
  useEffect(() => {
    if (!editando) setTexto(miles(item.precio))
  }, [item.precio, editando])

  const cambiar = (precio: number) => dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio })

  return (
    <View style={{ paddingHorizontal: 2 }}>
      <SliderPrecio
        valor={Math.min(rango.maximo, Math.max(rango.minimo, item.precio))}
        minimo={rango.minimo}
        maximo={rango.maximo}
        paso={rango.paso}
        mostrarValores={false}
        accessibilityLabel={`Precio de ${item.producto.titulo}`}
        onCambio={cambiar}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s, marginTop: 4 }}>
        <Text numberOfLines={1} style={[tc.detalle, tabular, { color: paleta.texto3, fontFamily: tc.etiqueta.fontFamily, flexShrink: 1 }]}>{`Mín ${pesos(min)}`}</Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 2, height: 34, paddingHorizontal: espacio.s,
          borderWidth: 1.5, borderColor: editando ? paleta.texto : paleta.bordeFuerte,
          borderRadius: radio.sm, backgroundColor: paleta.fondo,
        }}>
          <Text style={[tc.input, { color: paleta.texto, fontSize: 13 }]}>$</Text>
          <TextInput
            accessibilityLabel="Precio"
            keyboardType="number-pad"
            value={texto}
            onFocus={() => { setEditando(true); setTexto(soloEntero(texto)) }}
            onBlur={() => setEditando(false)}
            onChangeText={(t) => {
              const limpio = soloEntero(t)
              setTexto(limpio)
              cambiar(Number(limpio) || 0)
            }}
            style={[tc.input, tabular, { color: paleta.texto, fontSize: 13, width: 80, textAlign: 'right', padding: 0 }]}
          />
        </View>
        <Text numberOfLines={1} style={[tc.detalle, tabular, { color: paleta.texto3, fontFamily: tc.etiqueta.fontFamily, flexShrink: 1 }]}>{`Máx ${pesos(max)}`}</Text>
      </View>
    </View>
  )
}

function CamposGranja({ item, dispatch }: { item: ItemCarrito; dispatch: (a: AccionCarrito) => void }) {
  const { paleta } = useTema()
  const [cantTxt, setCantTxt] = useState(String(item.cantidad))
  const [precioTxt, setPrecioTxt] = useState(String(item.precio))
  const caja = {
    width: 76, height: 34, borderRadius: radio.sm, borderWidth: 1.5, borderColor: paleta.bordeFuerte,
    backgroundColor: paleta.fondo, paddingHorizontal: espacio.s, paddingVertical: 0, color: paleta.texto,
    ...tc.input, ...tabular,
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <TextInput
        accessibilityLabel="Cantidad"
        style={caja}
        keyboardType="decimal-pad"
        value={cantTxt}
        onChangeText={(t) => setCantTxt(soloDecimal(t))}
        // Al terminar de editar: una cantidad en 0 quita la línea.
        onEndEditing={() =>
          dispatch({ tipo: 'cambiarCantidad', id: item.producto.id, cantidad: Number(soloDecimal(cantTxt)) || 0 })
        }
      />
      <Text style={[tc.etiqueta, { color: paleta.texto2 }]}>{`${item.producto.unidad ?? ''} ×`}</Text>
      <TextInput
        accessibilityLabel="Precio unitario"
        style={caja}
        keyboardType="number-pad"
        value={precioTxt}
        onChangeText={(t) => {
          const limpio = soloEntero(t)
          setPrecioTxt(limpio)
          dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: Number(limpio) || 0 })
        }}
      />
    </View>
  )
}

function LineaCarrito({ item, dispatch }: { item: ItemCarrito; dispatch: (a: AccionCarrito) => void }) {
  const { paleta } = useTema()
  const esCalzado = item.producto.tipo === 'calzado'
  const fuera = fueraDeRango(item)
  const detalle = esCalzado ? item.producto.detalle : `Granja · por ${item.producto.unidad ?? ''}`

  return (
    <View style={{
      backgroundColor: paleta.superficie, borderWidth: 1, borderColor: paleta.borde,
      borderRadius: radio.md, padding: espacio.m, gap: espacio.m,
    }}>
      <View style={{ flexDirection: 'row', gap: espacio.m }}>
        <Miniatura item={item} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[tc.lineaTitulo, { color: paleta.texto }]} numberOfLines={2}>{item.producto.titulo}</Text>
          {detalle ? <Text style={[tc.detalle, { color: paleta.texto3 }]}>{detalle}</Text> : null}
          {fuera ? (
            <View style={{ alignSelf: 'flex-start', marginTop: 4, backgroundColor: paleta.peligroSoft, borderRadius: radio.full, paddingVertical: 3, paddingHorizontal: 10 }}>
              <Text accessibilityLiveRegion="polite" style={[tc.detalle, tabular, { color: paleta.peligroTexto, fontFamily: tc.etiqueta.fontFamily }]}>
                {`Fuera del rango: ${pesos(item.producto.precioMin ?? 0)} – ${pesos(item.producto.precioMax ?? 0)}`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {esCalzado ? <AjustePrecio item={item} dispatch={dispatch} /> : <CamposGranja item={item} dispatch={dispatch} />}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s }}>
        <Text style={[tc.lineaTitulo, tabular, { color: paleta.texto, fontFamily: tc.totalGrande.fontFamily }]}>
          {pesos(item.subtotal)}
        </Text>
        {esCalzado ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Paso etiqueta="Quitar uno"
              onPress={() => dispatch({ tipo: 'cambiarCantidad', id: item.producto.id, cantidad: item.cantidad - 1 })}>
              <Minus size={18} color={paleta.texto} />
            </Paso>
            <Text style={[tc.lineaTitulo, tabular, { color: paleta.texto, minWidth: 24, textAlign: 'center' }]}>
              {item.cantidad}
            </Text>
            <Paso etiqueta="Agregar uno" deshabilitado={item.cantidad >= item.producto.stock}
              onPress={() => dispatch({ tipo: 'agregar', producto: item.producto })}>
              <Plus size={18} color={paleta.texto} />
            </Paso>
          </View>
        ) : (
          <Presionable accessibilityRole="button" accessibilityLabel="Quitar" hitSlop={8}
            onPress={() => dispatch({ tipo: 'quitar', id: item.producto.id })}>
            <Text style={[tc.etiqueta, { color: paleta.texto3, textDecorationLine: 'underline' }]}>Quitar</Text>
          </Presionable>
        )}
      </View>
    </View>
  )
}

// Estado vacío / bloqueado a pantalla completa (círculo con ícono, título, texto y acciones).
function Vacio({ icono, titulo, mensaje, children }: { icono: ReactNode; titulo: string; mensaje: string; children?: ReactNode }) {
  const { paleta } = useTema()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacio.m, padding: espacio.xxl }}>
      <View style={{ width: 72, height: 72, borderRadius: radio.full, backgroundColor: paleta.superficie2, alignItems: 'center', justifyContent: 'center' }}>
        {icono}
      </View>
      <Text style={[tc.titulo, { color: paleta.texto, textAlign: 'center' }]}>{titulo}</Text>
      <Text style={[tc.cuerpo, { color: paleta.texto2, textAlign: 'center' }]}>{mensaje}</Text>
      {children ? <View style={{ alignSelf: 'stretch', gap: espacio.s, marginTop: espacio.s }}>{children}</View> : null}
    </View>
  )
}

export default function NuevaVenta() {
  const redir = useRequireModulo('ventas')
  const router = useRouter()
  const { modo } = useLocalSearchParams<{ modo?: string }>()
  const { paleta } = useTema()
  const insets = useSafeAreaInsets()

  // Carrito compartido: el detalle de producto (tab Productos) también agrega aquí.
  // `intento` conserva la clave entre reintentos fallidos para que el servidor no
  // duplique una venta que sí se guardó (ver lib/intentoVenta.ts).
  const { items, dispatch, intento: intentoRef } = useCarrito()
  const [etapa, setEtapa] = useState<Etapa>(modo === 'rapida' && items.length === 1 ? 'ajustarPrecio' : 'carrito')

  const [metodos, setMetodos] = useState<MetodoPago[]>([])
  const [montos, setMontos] = useState<Record<MetodoPago, string>>(MONTOS_VACIOS)
  const [recibido, setRecibido] = useState('')
  const [cliente, setCliente] = useState(CLIENTE_VACIO)
  const [guardando, setGuardando] = useState(false)
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

  const total = totalCarrito(items)
  const cobrable = puedeCobrar(items)
  const pagos: PagoInput[] = metodos.map(m => ({ metodo: m, monto: Number(montos[m]) || 0 }))
  const sumaPagos = pagos.reduce((s, p) => s + p.monto, 0)
  const diferencia = total - sumaPagos
  const efectivoMonto = montoEfectivo(pagos)
  const recibidoNum = Number(recibido) || 0
  const cambio = calcularCambio(recibidoNum, efectivoMonto)
  const puedeConfirmar = cobrable && pagosCuadran(pagos, total) && (efectivoMonto === 0 || recibidoNum >= efectivoMonto)

  function toggleMetodo(m: MetodoPago) {
    setMetodos(prev => {
      const next = prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
      if (next.length === 1) setMontos(mm => ({ ...mm, [next[0]]: String(total) }))
      return next
    })
  }

  function limpiarPago() {
    setMetodos([])
    setMontos(MONTOS_VACIOS)
    setRecibido('')
    setCliente(CLIENTE_VACIO)
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
        documento: cliente.documento.trim() || undefined,
      },
    }
    const intento = intentoVenta(intentoRef.current, venta)
    intentoRef.current = intento
    try {
      await registrarVenta(venta, intento.clave)
      intentoRef.current = null
      // La venta ya existe: vaciar el carrito y el pago YA (no al tocar "Nueva venta"),
      // así salir con "Listo" o con atrás no deja lo vendido listo para venderse otra vez.
      // Si el registro falla, no se limpia: el reintento usa la misma clave.
      dispatch({ tipo: 'limpiar' })
      limpiarPago()
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

  const botonSalir = (
    <BotonCabecera etiqueta="Salir de la venta" onPress={salirDelFlujo}>
      <X size={20} color={paleta.texto} />
    </BotonCabecera>
  )

  if (cajaEstado === 'bloqueado') {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, paddingBottom: insets.bottom }}>
        <Cabecera titulo="Carrito" boton={botonSalir} />
        <Vacio icono={<Lock size={32} color={paleta.textoDeshabilitado} />} titulo="Caja cerrada" mensaje="La caja de hoy no está abierta.">
          <Boton titulo="Ir a Caja" variante="oscuro" pildora compacto onPress={() => router.replace('/caja')} />
          <Boton titulo="Volver" variante="fantasma" compacto onPress={salirAtras} />
        </Vacio>
      </View>
    )
  }

  if (etapa === 'ajustarPrecio') {
    const item = items[0]
    return (
      <ScreenWrapper
        header={<Cabecera titulo="Ajustar precio" boton={botonSalir} />}
        contentContainerStyle={{ paddingHorizontal: espacio.xl, gap: espacio.m }}
        footer={
          <BarraAccionInferior
            titulo="Continuar a pago"
            deshabilitado={!cobrable}
            inferior={insets.bottom}
            onPress={() => setEtapa('cobrar')}
          />
        }
      >
        {item ? <LineaCarrito item={item} dispatch={dispatch} /> : null}
      </ScreenWrapper>
    )
  }

  if (etapa === 'confirmacion') {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <OverlayExito visible={overlayVisible} mensaje="Venta exitosa" onFin={() => { setOverlayVisible(false); router.replace('/') }} />
      </View>
    )
  }

  if (etapa === 'cobrar') {
    const estado =
      metodos.length === 0
        ? { texto: `Faltan ${pesos(total)}`, ok: false }
        : diferencia === 0
          ? { texto: '✓ Cuadra', ok: true }
          : diferencia > 0
            ? { texto: `Faltan ${pesos(diferencia)}`, ok: false }
            : { texto: `Sobran ${pesos(-diferencia)}`, ok: false }

    return (
      <ScreenWrapper
        header={
          <Cabecera
          titulo="Cobrar"
          boton={
            <BotonCabecera
              etiqueta="Volver al carrito"
              onPress={() => {
                setMetodos([])
                setMontos(MONTOS_VACIOS)
                setRecibido('')
                setEtapa('carrito')
              }}
            >
              <ArrowLeft size={20} color={paleta.texto} />
            </BotonCabecera>
          }
        />
        }
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: espacio.xl, paddingBottom: espacio.xl, gap: 10 }}
        footer={
          items.length > 0 ? (
            <BarraAccionInferior
              titulo="Confirmar venta"
              onPress={confirmar}
              cargando={guardando}
              deshabilitado={!puedeConfirmar}
              inferior={insets.bottom}
            />
          ) : null
        }
      >
        {items.length === 0 ? (
          <Vacio icono={<ShoppingBag size={32} color={paleta.textoDeshabilitado} />} titulo="Sin productos"
            mensaje="Agrega productos al carrito para cobrar." />
        ) : (
          <>
            <Text style={[tc.totalGrande, tabular, { color: paleta.texto, textAlign: 'center', paddingTop: 4, paddingBottom: espacio.s }]}>
              {pesos(total)}
            </Text>

            <Text style={[tc.etiqueta, { color: paleta.texto2, fontFamily: tc.lineaTitulo.fontFamily, marginTop: 6 }]}>Método de pago</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
              {METODOS.map(m => (
                <Chip key={m} etiqueta={ETIQUETA[m]} activo={metodos.includes(m)} onPress={() => toggleMetodo(m)} />
              ))}
            </View>

            {metodos.map(m => (
              <CampoTexto
                key={m}
                compacto
                etiqueta={ETIQUETA[m]}
                keyboardType="number-pad"
                value={montos[m]}
                onChangeText={t => setMontos(mm => ({ ...mm, [m]: soloEntero(t) }))}
                placeholder="0"
              />
            ))}

            <Text
              accessibilityLiveRegion="polite"
              style={[tc.cuerpoFuerte, tabular, {
                textAlign: 'center',
                paddingVertical: 4,
                color: estado.ok ? paleta.exitoTexto : paleta.peligroTexto,
              }]}
            >
              {estado.texto}
            </Text>

            {efectivoMonto > 0 ? (
              <View style={{ gap: 6 }}>
                <CampoTexto
                  compacto
                  etiqueta="Efectivo recibido"
                  keyboardType="number-pad"
                  value={recibido}
                  onChangeText={t => setRecibido(soloEntero(t))}
                  placeholder="¿Con cuánto paga?"
                />
                <Text style={[tc.cuerpoFuerte, tabular, { color: paleta.exitoTexto }]}>
                  {`Cambio: ${pesos(cambio)}`}
                </Text>
              </View>
            ) : null}

            <Text style={[tc.etiqueta, { color: paleta.texto2, fontFamily: tc.lineaTitulo.fontFamily, marginTop: 6 }]}>
              Datos del cliente (opcional)
            </Text>
            <CampoTexto compacto placeholder="Nombre" value={cliente.nombre}
              onChangeText={t => setCliente(c => ({ ...c, nombre: t }))} />
            <CampoTexto compacto placeholder="Apellido" value={cliente.apellido}
              onChangeText={t => setCliente(c => ({ ...c, apellido: t }))} />
            <CampoTexto compacto placeholder="Teléfono" keyboardType="phone-pad" value={cliente.telefono}
              onChangeText={t => setCliente(c => ({ ...c, telefono: t }))} />
            <CampoTexto compacto placeholder="Cédula o NIT" value={cliente.documento}
              onChangeText={t => setCliente(c => ({ ...c, documento: t }))} />
          </>
        )}
      </ScreenWrapper>
    )
  }

  // etapa === 'carrito'
  const hayCalzado = items.some(i => i.producto.tipo === 'calzado')
  return (
    <ScreenWrapper
      header={
        <Cabecera
        titulo="Carrito"
        derecha={`${items.length} ${items.length === 1 ? 'producto' : 'productos'}`}
        boton={botonSalir}
      />
      }
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: espacio.xl, paddingBottom: espacio.xl, gap: 10 }}
      footer={
        items.length > 0 ? (
          <BarraAccionInferior
            titulo={`Cobrar ${pesos(total)}`}
            deshabilitado={!cobrable}
            inferior={insets.bottom}
            onPress={() => setEtapa('cobrar')}
          />
        ) : null
      }
    >
      {items.length === 0 ? (
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          <Vacio icono={<ShoppingBag size={32} color={paleta.textoDeshabilitado} />} titulo="Tu carrito está vacío"
            mensaje="Agrega productos desde la pestaña Productos">
            <Boton titulo="Ver productos" variante="oscuro" pildora compacto onPress={() => router.replace('/productos')} />
          </Vacio>
        </View>
      ) : (
        <>
            {items.map((i: ItemCarrito) => (
              <LineaCarrito key={`${i.producto.tipo}-${i.producto.id}`} item={i} dispatch={dispatch} />
            ))}
            {hayCalzado ? (
              <Text style={[tc.etiqueta, { color: paleta.texto3, fontFamily: tc.cuerpo.fontFamily, paddingHorizontal: 4 }]}>
                Mueve el deslizador de $1.000 en $1.000 o escribe el precio exacto. Debe estar entre el mínimo y el
                máximo para poder cobrar.
              </Text>
            ) : null}
            <View style={{
              backgroundColor: paleta.superficie, borderWidth: 1, borderColor: paleta.borde,
              borderRadius: radio.md, padding: espacio.l, gap: espacio.s, marginTop: 4,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[tc.etiqueta, { color: paleta.texto2, fontSize: 13 }]}>Artículos</Text>
                <Text style={[tc.etiqueta, tabular, { color: paleta.texto2, fontSize: 13 }]}>{numArticulos(items)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: paleta.borde, paddingTop: 10 }}>
                <Text style={[tc.cuerpoFuerte, { color: paleta.texto, fontSize: 16, fontFamily: tc.totalGrande.fontFamily }]}>Total</Text>
                <Text style={[tc.cuerpoFuerte, tabular, { color: paleta.texto, fontSize: 16, fontFamily: tc.totalGrande.fontFamily }]}>
                  {pesos(total)}
                </Text>
              </View>
            </View>
        </>
      )}
    </ScreenWrapper>
  )
}
