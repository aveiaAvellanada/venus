import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'
import {
  bajoMinimo, calcularCambio, carritoReducer, montoEfectivo, pagosCuadran, totalCarrito,
  type AccionCarrito, type ItemCarrito, type MetodoPago, type PagoInput, type ProductoVendible,
} from '../../../lib/carrito'
import { buscarProductos, registrarVenta } from '../../../lib/ventas'
import { obtenerCajaHoy } from '../../../lib/caja'

type Etapa = 'carrito' | 'cobrar' | 'confirmacion'
const METODOS: MetodoPago[] = ['efectivo', 'nequi', 'daviplata']
const ETIQUETA: Record<MetodoPago, string> = { efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata' }
const pesos = (n: number) => '$' + n.toLocaleString('es-CO')
const soloEntero = (t: string) => t.replace(/[^0-9]/g, '')
const soloDecimal = (t: string) => {
  const limpio = t.replace(/[^0-9.]/g, '')
  const partes = limpio.split('.')
  return partes.length <= 1 ? limpio : partes[0] + '.' + partes.slice(1).join('')
}

function LineaCarrito({
  item, dispatch,
}: {
  item: ItemCarrito
  dispatch: (a: AccionCarrito) => void
}) {
  const esCalzado = item.producto.tipo === 'calzado'
  const [precioTxt, setPrecioTxt] = useState(String(item.precio))
  const [cantTxt, setCantTxt] = useState(String(item.cantidad))
  const bajo = bajoMinimo(item)

  function commitPrecio() {
    dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: Number(soloEntero(precioTxt)) || 0 })
  }
  function commitCantidad() {
    dispatch({ tipo: 'cambiarCantidad', id: item.producto.id, cantidad: Number(soloDecimal(cantTxt)) || 0 })
  }

  return (
    <View style={styles.itemCarrito}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitulo}>{item.producto.titulo}</Text>
        {esCalzado ? (
          <>
            <View style={styles.precioFila}>
              <Text style={styles.itemSub}>Precio c/u </Text>
              <TextInput
                style={[styles.precioInput, bajo && styles.precioInputAlerta]}
                keyboardType="number-pad"
                value={precioTxt}
                onChangeText={t => setPrecioTxt(soloEntero(t))}
                onEndEditing={commitPrecio}
              />
            </View>
            <Text style={[styles.rango, bajo && styles.rangoAlerta]}>
              Rango {pesos(item.producto.precioMin ?? 0)}–{pesos(item.producto.precioMax ?? 0)}
              {bajo ? ' · bajo el mínimo' : ''}
            </Text>
          </>
        ) : (
          <View style={styles.precioFila}>
            <TextInput
              style={styles.precioInput}
              keyboardType="decimal-pad"
              value={cantTxt}
              onChangeText={t => setCantTxt(soloDecimal(t))}
              onEndEditing={commitCantidad}
            />
            <Text style={styles.itemSub}> {item.producto.unidad} × </Text>
            <TextInput
              style={styles.precioInput}
              keyboardType="number-pad"
              value={precioTxt}
              onChangeText={t => setPrecioTxt(soloEntero(t))}
              onEndEditing={commitPrecio}
            />
          </View>
        )}
        <Text style={styles.itemSub}>Subtotal {pesos(item.subtotal)}</Text>
      </View>
      {esCalzado ? (
        <>
          <Pressable hitSlop={12} style={styles.step}
            onPress={() => dispatch({ tipo: 'cambiarCantidad', id: item.producto.id, cantidad: item.cantidad - 1 })}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.cantidad}>{item.cantidad}</Text>
          <Pressable hitSlop={12} style={styles.step}
            onPress={() => dispatch({ tipo: 'agregar', producto: item.producto })}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </>
      ) : (
        <Pressable hitSlop={12} style={styles.step}
          onPress={() => dispatch({ tipo: 'quitar', id: item.producto.id })}>
          <Text style={styles.stepText}>×</Text>
        </Pressable>
      )}
    </View>
  )
}

export default function NuevaVenta() {
  const redir = useRequireModulo('ventas')
  const router = useRouter()

  const [etapa, setEtapa] = useState<Etapa>('carrito')
  const [items, dispatch] = useReducer(carritoReducer, [])
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<ProductoVendible[]>([])
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [metodos, setMetodos] = useState<MetodoPago[]>([])
  const [montos, setMontos] = useState<Record<MetodoPago, string>>({ efectivo: '', nequi: '', daviplata: '' })
  const [recibido, setRecibido] = useState('')
  const [cliente, setCliente] = useState({ nombre: '', apellido: '', telefono: '' })
  const [guardando, setGuardando] = useState(false)
  const [numeroVenta, setNumeroVenta] = useState<number | null>(null)
  const [cajaEstado, setCajaEstado] = useState<'loading' | 'ok' | 'bloqueado'>('loading')

  useEffect(() => {
    obtenerCajaHoy()
      .then(c => {
        if (!c || c.estado !== 'abierto') setCajaEstado('bloqueado')
        else setCajaEstado('ok')
      })
      .catch(() => setCajaEstado('bloqueado'))
  }, [])

  const buscar = useCallback((texto: string) => {
    setQuery(texto)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setBuscando(true)
      setErrorBusqueda(null)
      try {
        setResultados(await buscarProductos(texto))
      } catch {
        setErrorBusqueda('No se pudo buscar. Revisa tu conexión.')
      } finally {
        setBuscando(false)
      }
    }, 300)
  }, [])

  if (redir) return redir

  if (cajaEstado === 'loading') {
    return (
      <View style={[styles.container, styles.centro]}>
        <ActivityIndicator size="large" color="#1E66F5" />
      </View>
    )
  }

  if (cajaEstado === 'bloqueado') {
    return (
      <View style={[styles.container, styles.centro]}>
        <Text style={styles.okTitulo}>Caja cerrada</Text>
        <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>
          La caja de hoy no está abierta.
        </Text>
        <Pressable style={styles.primario} onPress={() => router.replace('/caja')}>
          <Text style={[styles.primarioText, { paddingHorizontal: 24 }]}>Ir a Caja</Text>
        </Pressable>
        <Pressable style={styles.secundario} onPress={() => router.replace('/ventas')}>
          <Text style={styles.secundarioText}>Volver a ventas</Text>
        </Pressable>
      </View>
    )
  }

  const total = totalCarrito(items)
  const pagos: PagoInput[] = metodos.map(m => ({ metodo: m, monto: Number(montos[m]) || 0 }))
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
    try {
      const { numero } = await registrarVenta({
        items,
        pagos,
        efectivoRecibido: efectivoMonto > 0 ? recibidoNum : null,
        cliente: {
          nombre: cliente.nombre || undefined,
          apellido: cliente.apellido || undefined,
          telefono: cliente.telefono || undefined,
        },
      })
      setNumeroVenta(numero)
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
        { text: 'Descartar', style: 'destructive', onPress: () => router.replace('/ventas') },
      ])
    } else {
      router.replace('/ventas')
    }
  }

  function nuevaVenta() {
    dispatch({ tipo: 'limpiar' })
    setMetodos([])
    setMontos({ efectivo: '', nequi: '', daviplata: '' })
    setRecibido('')
    setCliente({ nombre: '', apellido: '', telefono: '' })
    setNumeroVenta(null)
    setQuery('')
    setResultados([])
    setEtapa('carrito')
  }

  if (etapa === 'confirmacion') {
    return (
      <View style={[styles.container, styles.centro]}>
        <Text style={styles.check}>✓</Text>
        <Text style={styles.okTitulo}>Venta #{numeroVenta} registrada</Text>
        <Pressable style={styles.primario} onPress={nuevaVenta}>
          <Text style={styles.primarioText}>Nueva venta</Text>
        </Pressable>
        <Pressable style={styles.secundario} onPress={() => router.replace('/ventas')}>
          <Text style={styles.secundarioText}>Listo</Text>
        </Pressable>
      </View>
    )
  }

  if (etapa === 'cobrar') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 56, gap: 16 }}>
        <Pressable
          onPress={() => {
            setMetodos([])
            setMontos({ efectivo: '', nequi: '', daviplata: '' })
            setRecibido('')
            setEtapa('carrito')
          }}
          hitSlop={16}
        >
          <Text style={styles.volver}>← Carrito</Text>
        </Pressable>
        <Text style={styles.totalGrande}>{pesos(total)}</Text>

        <Text style={styles.label}>Método de pago</Text>
        <View style={styles.chips}>
          {METODOS.map(m => (
            <Pressable
              key={m}
              style={[styles.chip, metodos.includes(m) && styles.chipOn]}
              onPress={() => toggleMetodo(m)}
            >
              <Text style={[styles.chipText, metodos.includes(m) && styles.chipTextOn]}>{ETIQUETA[m]}</Text>
            </Pressable>
          ))}
        </View>

        {metodos.map(m => (
          <View key={m}>
            <Text style={styles.label}>{ETIQUETA[m]}</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={montos[m]}
              onChangeText={t => setMontos(mm => ({ ...mm, [m]: t.replace(/[^0-9]/g, '') }))}
              placeholder="0"
            />
          </View>
        ))}

        {efectivoMonto > 0 ? (
          <View>
            <Text style={styles.label}>Efectivo recibido</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={recibido}
              onChangeText={t => setRecibido(t.replace(/[^0-9]/g, ''))}
              placeholder="¿Con cuánto paga?"
            />
            <Text style={styles.cambio}>Cambio: {pesos(cambio)}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Datos del cliente (opcional)</Text>
        <TextInput style={styles.input} placeholder="Nombre" value={cliente.nombre}
          onChangeText={t => setCliente(c => ({ ...c, nombre: t }))} />
        <TextInput style={styles.input} placeholder="Apellido" value={cliente.apellido}
          onChangeText={t => setCliente(c => ({ ...c, apellido: t }))} />
        <TextInput style={styles.input} placeholder="Teléfono" keyboardType="phone-pad" value={cliente.telefono}
          onChangeText={t => setCliente(c => ({ ...c, telefono: t }))} />

        <Pressable
          style={[styles.primario, (!puedeConfirmar || guardando) && styles.deshab]}
          onPress={confirmar}
          disabled={!puedeConfirmar || guardando}
        >
          {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primarioText}>Confirmar venta</Text>}
        </Pressable>
      </ScrollView>
    )
  }

  // etapa === 'carrito'
  return (
    <View style={styles.container}>
      <View style={styles.barra}>
        <Pressable onPress={salirDelFlujo} hitSlop={16}>
          <Text style={styles.volver}>← Salir</Text>
        </Pressable>
        <Text style={styles.titulo}>Nueva venta</Text>
        <View style={{ width: 60 }} />
      </View>

      <TextInput
        style={styles.buscador}
        placeholder="Buscar producto"
        value={query}
        onChangeText={buscar}
        autoFocus
      />
      {buscando ? <ActivityIndicator style={{ marginVertical: 8 }} /> : null}
      {errorBusqueda ? <Text style={styles.error}>{errorBusqueda}</Text> : null}

      <ScrollView style={styles.resultados} keyboardShouldPersistTaps="handled">
        {resultados.map(p => (
          <Pressable key={`${p.tipo}-${p.id}`} style={styles.resultado}
            onPress={() => dispatch({ tipo: 'agregar', producto: p })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultadoTitulo}>{p.titulo}</Text>
              <Text style={styles.resultadoSub}>
                {p.detalle}{p.tipo === 'calzado' ? ` · Stock: ${p.stock}` : ''}
              </Text>
            </View>
            <Text style={styles.resultadoPrecio}>{pesos(p.precio)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.carrito}>
        <ScrollView style={styles.carritoLista}>
          {items.map(i => (
            <LineaCarrito key={`${i.producto.tipo}-${i.producto.id}`} item={i} dispatch={dispatch} />
          ))}
        </ScrollView>

        <Pressable
          style={[styles.primario, items.length === 0 && styles.deshab]}
          disabled={items.length === 0}
          onPress={() => setEtapa('cobrar')}
        >
          <Text style={styles.primarioText}>Cobrar {total > 0 ? pesos(total) : ''}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centro: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  barra: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, marginBottom: 12 },
  titulo: { fontSize: 20, fontWeight: '700' },
  volver: { fontSize: 16, color: '#1E66F5', fontWeight: '600' },
  buscador: { marginHorizontal: 20, borderWidth: 2, borderColor: '#1E66F5', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, fontSize: 18 },
  resultados: { flex: 1, marginTop: 8, paddingHorizontal: 20 },
  resultado: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEE', gap: 12 },
  resultadoTitulo: { fontSize: 17, fontWeight: '600' },
  resultadoSub: { fontSize: 13, color: '#888', marginTop: 2 },
  resultadoPrecio: { fontSize: 16, fontWeight: '700' },
  carrito: { borderTopWidth: 1, borderTopColor: '#DDD', padding: 20, gap: 10 },
  carritoLista: { maxHeight: 220 },
  itemCarrito: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  precioFila: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  precioInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, fontSize: 16, minWidth: 80 },
  precioInputAlerta: { borderColor: '#D20F39' },
  rango: { fontSize: 12, color: '#888', marginTop: 4 },
  rangoAlerta: { color: '#D20F39' },
  itemTitulo: { fontSize: 16, fontWeight: '600' },
  itemSub: { fontSize: 13, color: '#666', marginTop: 2 },
  step: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF5FF', alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 24, fontWeight: '700', color: '#1E66F5' },
  cantidad: { fontSize: 18, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  totalGrande: { fontSize: 40, fontWeight: '800', textAlign: 'center' },
  label: { fontSize: 15, fontWeight: '600', color: '#444' },
  chips: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1, borderWidth: 2, borderColor: '#1E66F5', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  chipOn: { backgroundColor: '#1E66F5' },
  chipText: { color: '#1E66F5', fontSize: 16, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, fontSize: 18, marginTop: 6 },
  cambio: { fontSize: 18, fontWeight: '700', marginTop: 8, color: '#1E7A34' },
  primario: { backgroundColor: '#1E66F5', borderRadius: 16, paddingVertical: 20, alignItems: 'center', marginTop: 8 },
  primarioText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  secundario: { paddingVertical: 16, alignItems: 'center' },
  secundarioText: { color: '#1E66F5', fontSize: 18, fontWeight: '600' },
  deshab: { opacity: 0.4 },
  error: { color: '#D20F39', textAlign: 'center', fontSize: 15, marginVertical: 4 },
  check: { fontSize: 80, color: '#1E7A34' },
  okTitulo: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
})
