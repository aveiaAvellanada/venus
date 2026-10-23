import React, { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { ChevronRight, CircleX, Search, ShoppingCart, Undo2 } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { tienePermiso } from '../../../lib/permisos'
import { rangoParaPeriodo } from '../../../lib/dashboard'
import type { Periodo } from '../../../lib/dashboard'
import {
  agruparPorDia,
  analizarConsulta,
  badgeTipoDevolucion,
  buscarDevoluciones,
  buscarProductos,
  detalleProducto,
  diaBogota,
  estadoProducto,
  etiquetaDia,
  listarDevoluciones,
  listarVentasPeriodo,
  segmentos,
} from '../../../lib/movimientos'
import type { DevolucionListado, Pieza, ProductoVendido, VentaListado } from '../../../lib/movimientos'
import { useTema } from '../../../lib/tema'
import { espacio, fuentes, radio, tabular, tipografia } from '../../../lib/theme'
import {
  Badge,
  Chip,
  CirculoIcono,
  ControlSegmentado,
  Esqueleto,
  EstadoVacio,
  FilaLista,
  SelectorRango,
  Tarjeta,
  useEspacioTabBar,
} from '../../../components/ui'
import { MARGEN_SUPERIOR } from '../../../hooks/usePaddingInferior'

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

const PERIODOS: { clave: Periodo; etiqueta: string }[] = [
  { clave: 'hoy', etiqueta: 'Hoy' },
  { clave: 'semana', etiqueta: 'Semana' },
  { clave: 'mes', etiqueta: 'Mes' },
]

// Piezas unidas con " · " y lo buscado en negrita (texto plano si no hay nada que resaltar).
function resaltar(piezas: Pieza[], color: string): React.ReactNode {
  const tramos = piezas.map((p) => segmentos(p.texto, p.marcas))
  if (!tramos.some((t) => t.some((s) => s.resaltado))) return piezas.map((p) => p.texto).join(' · ')
  return tramos.map((t, i) => (
    <React.Fragment key={i}>
      {i > 0 ? ' · ' : null}
      {t.map((s, j) =>
        s.resaltado ? (
          <Text key={j} style={{ color, fontFamily: fuentes.extra }}>
            {s.texto}
          </Text>
        ) : (
          s.texto
        )
      )}
    </React.Fragment>
  ))
}

// Una fila por producto vendido: nombre (hasta 2 líneas), talla · color y hora,
// y el precio o su estado. Al tocarla abre la venta, donde están los demás.
function FilaProducto({
  venta,
  producto,
  marcas,
  extra,
  onPress,
}: {
  venta: VentaListado
  producto: ProductoVendido
  marcas: string[]
  extra: Pieza[]
  onPress: () => void
}) {
  const { paleta } = useTema()
  const estado = estadoProducto(venta.estado, producto)
  const subtitulo = [{ texto: detalleProducto(producto), marcas }, ...extra, { texto: venta.hora, marcas: [] }].filter(
    (p) => p.texto
  )

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={producto.descripcion} onPress={onPress}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.m,
            minHeight: 64,
            paddingVertical: espacio.s,
            backgroundColor: pressed ? paleta.superficie2 : 'transparent',
            borderRadius: radio.sm,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{ color: paleta.texto, fontFamily: fuentes.negrita, fontSize: 15, lineHeight: 20 }}
              numberOfLines={2}
            >
              {resaltar([{ texto: producto.descripcion, marcas }], paleta.texto)}
            </Text>
            <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
              {resaltar(subtitulo, paleta.texto)}
            </Text>
          </View>
          {estado ? (
            <Badge texto={estado.texto} tipo={estado.tipo} />
          ) : (
            <Text style={[tipografia.cuerpoLg, tabular, { color: paleta.texto }]}>
              {producto.cantidad > 1 ? (
                <Text style={[tipografia.etiqueta, { color: paleta.texto3 }]}>{`${producto.cantidad} × `}</Text>
              ) : null}
              {formatear(producto.precio)}
            </Text>
          )}
          <ChevronRight size={20} color={paleta.texto3} />
        </View>
      )}
    </Pressable>
  )
}

export default function Movimientos() {
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const router = useRouter()
  const espacioTabBar = useEspacioTabBar()

  // Otros días: el historial (reportes) o buscar la venta de otro día para una
  // devolución o un cambio (devoluciones). La base aplica la misma regla.
  const verPeriodos = tienePermiso(perfil, 'reportes') || tienePermiso(perfil, 'devoluciones')

  const [vista, setVista] = useState(0)
  const [periodo, setPeriodo] = useState<Periodo | 'rango'>('hoy')
  const [rangoCustom, setRangoCustom] = useState<{ desde: string; hasta: string } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [ventas, setVentas] = useState<VentaListado[]>([])
  const [devoluciones, setDevoluciones] = useState<DevolucionListado[]>([])

  const rango =
    verPeriodos && periodo === 'rango' && rangoCustom
      ? rangoCustom
      : rangoParaPeriodo(verPeriodos && periodo !== 'rango' ? periodo : 'hoy')

  const cargar = useCallback(async () => {
    if (!perfil) return
    try {
      if (vista === 0) setVentas(await listarVentasPeriodo(rango.desde, rango.hasta))
      else if (vista === 1) setDevoluciones(await listarDevoluciones(rango.desde, rango.hasta))
    } catch {
      // la vista muestra su estado vacío; pull-to-refresh reintenta
    } finally {
      setCargando(false)
    }
  }, [perfil, vista, rango.desde, rango.hasta])

  useFocusEffect(
    useCallback(() => {
      cargar()
    }, [cargar])
  )

  if (!perfil) return null

  const hoy = diaBogota(new Date().toISOString())
  // Con Semana / Mes / Rango la lista se agrupa por día; en un solo día no hace falta.
  const porDias = rango.desde !== rango.hasta
  // El buscador filtra lo del período elegido.
  const q = busqueda.trim()
  const consulta = q ? analizarConsulta(q) : null

  const ventasValidas = ventas.filter((v) => v.estado !== 'cancelada')
  const unidades = ventasValidas.reduce((s, v) => s + v.items.reduce((u, i) => u + i.cantidad, 0), 0)
  const totalDevuelto = devoluciones.reduce((s, d) => s + d.monto_devuelto, 0)

  const filasVentas = consulta
    ? buscarProductos(ventas, consulta)
    : ventas.flatMap((v) => v.items.map((producto) => ({ venta: v, producto, marcas: [] as string[], extra: [] as Pieza[] })))
  const filasDevoluciones = consulta
    ? buscarDevoluciones(devoluciones, consulta)
    : devoluciones.map((d) => ({ devolucion: d, piezas: null as Pieza[] | null }))
  const numResultados = vista === 0 ? filasVentas.length : filasDevoluciones.length

  const resumen = consulta
    ? `${numResultados} ${numResultados === 1 ? 'resultado' : 'resultados'}`
    : vista === 0
      ? `${unidades} ${unidades === 1 ? 'producto' : 'productos'} · ${ventasValidas.length} ${ventasValidas.length === 1 ? 'venta' : 'ventas'}`
      : `${formatear(totalDevuelto)} devueltos · ${devoluciones.length}`

  const refrescar = async () => {
    setRefrescando(true)
    await cargar()
    setRefrescando(false)
  }

  const cambiarVista = (i: number) => {
    setCargando(true)
    setVista(i)
  }

  // Una tarjeta por día con su título, o una sola tarjeta si el período es un día.
  function porDia<T>(filas: T[], diaDe: (x: T) => string, fila: (x: T) => React.ReactNode, sangria: number) {
    const tarjeta = (xs: T[]) => (
      <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
        {xs.map((x, i) => (
          <View key={i}>
            {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: sangria }} /> : null}
            {fila(x)}
          </View>
        ))}
      </Tarjeta>
    )
    if (!porDias) return tarjeta(filas)
    return (
      <View style={{ gap: espacio.l }}>
        {agruparPorDia(filas, diaDe).map((g) => (
          <View key={g.dia} style={{ gap: espacio.s }}>
            <Text style={[tipografia.etiqueta, { color: paleta.texto2, paddingLeft: espacio.xs }]}>
              {etiquetaDia(g.dia, hoy)}
            </Text>
            {tarjeta(g.xs)}
          </View>
        ))}
      </View>
    )
  }

  const sinResultados = (
    <EstadoVacio
      icono={<Search />}
      titulo="Sin resultados"
      mensaje="Busca por número de venta, cliente, cédula, teléfono, zapato o monto."
    />
  )

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: MARGEN_SUPERIOR, gap: espacio.l, paddingBottom: espacioTabBar }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={paleta.primario} />
        }
      >
        <Text style={[tipografia.h1, { color: paleta.texto }]}>Movimientos</Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.s,
            backgroundColor: paleta.superficie2,
            borderRadius: radio.md,
            paddingHorizontal: espacio.m,
            height: 44,
          }}
        >
          <Search size={18} color={paleta.texto3} />
          <TextInput
            style={[tipografia.cuerpo, { flex: 1, color: paleta.texto, padding: 0 }]}
            placeholder="Buscar"
            placeholderTextColor={paleta.textoDeshabilitado}
            value={busqueda}
            onChangeText={setBusqueda}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar"
            testID="input-buscar-movimientos"
          />
          {q ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Borrar búsqueda"
              hitSlop={10}
              onPress={() => setBusqueda('')}
            >
              <CircleX size={18} color={paleta.texto3} />
            </Pressable>
          ) : null}
        </View>

        <ControlSegmentado
          opciones={['Ventas', 'Devoluciones']}
          indice={vista}
          onCambio={cambiarVista}
        />

        {verPeriodos ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
            {PERIODOS.map((p) => (
              <Chip
                key={p.clave}
                etiqueta={p.etiqueta}
                activo={periodo === p.clave}
                onPress={() => {
                  if (periodo !== p.clave) {
                    setCargando(true)
                    setPeriodo(p.clave)
                  }
                }}
              />
            ))}
            <SelectorRango
              activo={periodo === 'rango'}
              onAplicar={(desde, hasta) => {
                setCargando(true)
                setRangoCustom({ desde, hasta })
                setPeriodo('rango')
              }}
            />
          </View>
        ) : null}

        {!cargando ? (
          <Text style={[tipografia.etiqueta, tabular, { color: paleta.texto2 }]}>{resumen}</Text>
        ) : null}

        {cargando ? (
          <View style={{ gap: espacio.m }}>
            <Esqueleto alto={64} />
            <Esqueleto alto={64} />
            <Esqueleto alto={64} />
          </View>
        ) : vista === 0 ? (
          filasVentas.length === 0 ? (
            consulta ? (
              sinResultados
            ) : (
              <EstadoVacio
                icono={<ShoppingCart />}
                titulo="Aún no hay ventas en este período"
                mensaje="Toca + para registrar la primera"
              />
            )
          ) : (
            porDia(
              filasVentas,
              (x) => x.venta.dia,
              (x) => (
                <FilaProducto
                  venta={x.venta}
                  producto={x.producto}
                  marcas={x.marcas}
                  extra={x.extra}
                  onPress={() => router.push(`/ventas/${x.venta.id}`)}
                />
              ),
              0
            )
          )
        ) : filasDevoluciones.length === 0 ? (
          consulta ? (
            sinResultados
          ) : (
            <EstadoVacio icono={<Undo2 />} titulo="Sin devoluciones en este período" />
          )
        ) : (
          porDia(
            filasDevoluciones,
            (x) => x.devolucion.dia,
            ({ devolucion: d, piezas }) => {
              const badge = badgeTipoDevolucion(d.tipo)
              const monto = d.tipo === 'cambio' ? d.monto_cobrado : d.monto_devuelto
              const prefijo = d.tipo === 'cambio' ? 'Cobrado' : 'Devuelto'
              return (
                <FilaLista
                  icono={
                    <CirculoIcono tono="peligro">
                      <Undo2 />
                    </CirculoIcono>
                  }
                  titulo={`Devolución venta #${d.numero_venta}`}
                  subtitulo={
                    piezas ? (
                      // En la búsqueda: lo que coincidió primero, luego la hora.
                      resaltar([...piezas.slice(0, 1), { texto: d.hora, marcas: [] }, ...piezas.slice(1)], paleta.texto)
                    ) : (
                      `${prefijo} ${formatear(monto)} · ${d.hora}`
                    )
                  }
                  derecha={<Badge texto={badge.texto} tipo={badge.tipo} />}
                  chevron
                  onPress={() => router.push(`/devoluciones/${d.id}`)}
                />
              )
            },
            56
          )
        )}
      </ScrollView>
    </View>
  )
}
