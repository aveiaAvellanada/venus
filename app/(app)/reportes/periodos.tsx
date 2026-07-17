import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import {
  ArrowLeft,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Minus,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react-native'
import { useRequireModulo } from '../../../lib/auth'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { rangoPeriodo } from '../../../lib/balance'
import { obtenerReportePeriodo, compararConAyer, type ReportePeriodo } from '../../../lib/reportes'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { EstadoVacio, Presionable, Tarjeta, TarjetaMetrica } from '../../../components/ui'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

type Tipo = 'semana' | 'mes'

const NOMBRE_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function etiquetaPeriodo(tipo: Tipo, refDate: Date): string {
  if (tipo === 'mes') return `${NOMBRE_MES[refDate.getMonth()]} ${refDate.getFullYear()}`
  const { desde, hasta } = rangoPeriodo('semana', refDate)
  return `${desde} → ${hasta}`
}

// Encabezado a nivel de módulo: no se remonta en cada render (Regla 2).
function Encabezado({ paleta, onVolver }: { paleta: Paleta; onVolver: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        paddingHorizontal: espacio.xl,
        paddingTop: 56,
        paddingBottom: espacio.m,
      }}
    >
      <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={onVolver} hitSlop={12}>
        <ArrowLeft size={24} color={paleta.texto} />
      </Presionable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Reporte de período</Text>
    </View>
  )
}

// Selector semana/mes: Presionable con testID (ControlSegmentado no acepta testID —
// se mantiene este control equivalente con tokens para no romper los tests existentes).
function SelectorTipo({ tipo, onCambio }: { tipo: Tipo; onCambio: (t: Tipo) => void }) {
  const { paleta } = useTema()
  const opciones: { valor: Tipo; etiqueta: string; testID: string }[] = [
    { valor: 'semana', etiqueta: 'Semana', testID: 'btn-tipo-semana' },
    { valor: 'mes', etiqueta: 'Mes', testID: 'btn-tipo-mes' },
  ]
  return (
    <View style={{ flexDirection: 'row', backgroundColor: paleta.superficie2, borderRadius: radio.full, padding: 4 }}>
      {opciones.map((o) => (
        <Presionable
          key={o.valor}
          testID={o.testID}
          accessibilityRole="tab"
          accessibilityLabel={o.etiqueta}
          accessibilityState={{ selected: tipo === o.valor }}
          onPress={() => onCambio(o.valor)}
          style={{
            flex: 1,
            height: 36,
            borderRadius: radio.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tipo === o.valor ? paleta.fondo : 'transparent',
          }}
        >
          <Text style={[tipografia.etiqueta, { color: tipo === o.valor ? paleta.primario : paleta.texto2 }]}>
            {o.etiqueta}
          </Text>
        </Presionable>
      ))}
    </View>
  )
}

export default function ReportesPeriodos() {
  const requireModulo = useRequireModulo('reportes')
  const router = useRouter()
  const { paleta } = useTema()
  const paddingInferior = usePaddingInferior(espacio.xxxl)

  const [tipo, setTipo] = useState<Tipo>('mes')
  const [refDate, setRefDate] = useState<Date>(new Date())
  const [data, setData] = useState<ReportePeriodo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarDatos = useCallback(async (t: Tipo, ref: Date, isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    setError(null)
    try {
      const { desde, hasta } = rangoPeriodo(t, ref)
      setData(await obtenerReportePeriodo(desde, hasta))
    } catch (err: unknown) {
      console.error('Error al cargar el reporte:', err)
      setError('No se pudo cargar el reporte. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (!requireModulo) cargarDatos(tipo, refDate)
    }, [cargarDatos, requireModulo, tipo, refDate])
  )

  if (requireModulo) return requireModulo

  const cambiarTipo = (t: Tipo) => {
    if (t === tipo) return
    setTipo(t)
    setRefDate(new Date())
  }

  const mover = (dir: -1 | 1) => {
    setRefDate((prev) => {
      if (tipo === 'mes') return new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
      return new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + dir * 7)
    })
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos(tipo, refDate, true)
  }

  const cmp = data ? compararConAyer(data.total_vendido, data.total_anterior) : null

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />

      <View
        style={{
          paddingHorizontal: espacio.xl,
          paddingBottom: espacio.m,
          borderBottomWidth: 1,
          borderBottomColor: paleta.borde,
        }}
      >
        <SelectorTipo tipo={tipo} onCambio={cambiarTipo} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: espacio.m }}>
          <Presionable
            testID="btn-nav-prev"
            accessibilityRole="button"
            accessibilityLabel="Período anterior"
            onPress={() => mover(-1)}
            hitSlop={12}
            style={{ padding: espacio.xs }}
          >
            <ChevronLeft size={22} color={paleta.texto2} />
          </Presionable>
          <Text style={[tipografia.cuerpoLg, { color: paleta.texto, textTransform: 'capitalize' }]}>
            {etiquetaPeriodo(tipo, refDate)}
          </Text>
          <Presionable
            testID="btn-nav-next"
            accessibilityRole="button"
            accessibilityLabel="Período siguiente"
            onPress={() => mover(1)}
            hitSlop={12}
            style={{ padding: espacio.xs }}
          >
            <ChevronRight size={22} color={paleta.texto2} />
          </Presionable>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: espacio.xl }}>
          <EstadoVacio
            icono={<CircleAlert />}
            titulo={error}
            textoAccion="Reintentar"
            onAccion={() => cargarDatos(tipo, refDate)}
          />
        </View>
      ) : data ? (
        <ScrollView
          contentContainerStyle={{ padding: espacio.xl, paddingBottom: paddingInferior, gap: espacio.m }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={paleta.primario} />}
        >
          {/* Total + comparación */}
          <Tarjeta>
            <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Total vendido</Text>
            <Text style={[tipografia.display, tabular, { color: paleta.texto, marginTop: 2 }]}>
              {pesos(data.total_vendido)}
            </Text>
            {cmp && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: espacio.xs }}>
                {cmp.sinBase ? (
                  <Text style={[tipografia.caption, { color: paleta.texto3 }]}>— sin comparación</Text>
                ) : (
                  <>
                    {cmp.direccion === 'sube' ? (
                      <TrendingUp size={14} color={paleta.exito} />
                    ) : cmp.direccion === 'baja' ? (
                      <TrendingDown size={14} color={paleta.peligro} />
                    ) : (
                      <Minus size={14} color={paleta.texto3} />
                    )}
                    <Text
                      style={[
                        tipografia.etiqueta,
                        {
                          color:
                            cmp.direccion === 'sube'
                              ? paleta.exitoTexto
                              : cmp.direccion === 'baja'
                                ? paleta.peligroTexto
                                : paleta.texto3,
                        },
                      ]}
                    >
                      {cmp.pct}% vs período anterior
                    </Text>
                  </>
                )}
              </View>
            )}
            <View style={{ borderTopWidth: 1, borderTopColor: paleta.borde, marginTop: espacio.m, paddingTop: espacio.m }}>
              <Fila etiqueta="Nº de ventas" valor={String(data.num_ventas)} />
            </View>
          </Tarjeta>

          <View style={{ flexDirection: 'row', gap: espacio.s }}>
            <TarjetaMetrica mini etiqueta="Efectivo" valor={pesos(data.efectivo)} icono={<Banknote size={16} color={paleta.primario} />} />
            <TarjetaMetrica mini etiqueta="Nequi" valor={pesos(data.nequi)} icono={<Smartphone size={16} color={paleta.primario} />} />
            <TarjetaMetrica mini etiqueta="Bre-B" valor={pesos(data.bre_b)} icono={<Zap size={16} color={paleta.primario} />} />
            <TarjetaMetrica mini etiqueta="Otro" valor={pesos(data.otro)} icono={<CreditCard size={16} color={paleta.primario} />} />
          </View>

          {/* Día con más ventas */}
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.s }]}>Día con más ventas</Text>
            {data.dia_top ? (
              <Fila etiqueta={data.dia_top.fecha} valor={pesos(data.dia_top.monto)} />
            ) : (
              <Text style={[tipografia.cuerpo, { color: paleta.texto3, paddingVertical: 4 }]}>Sin ventas en el período.</Text>
            )}
          </Tarjeta>

          {/* Top productos */}
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.s }]}>Top productos (por unidades)</Text>
            {data.top_productos.length === 0 ? (
              <Text style={[tipografia.cuerpo, { color: paleta.texto3, paddingVertical: 4 }]}>Sin ventas en el período.</Text>
            ) : (
              data.top_productos.map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: espacio.s }}>
                  <Text style={[tipografia.cuerpo, { color: paleta.texto2, flex: 1, marginRight: espacio.s }]} numberOfLines={1}>
                    {p.producto}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[tipografia.cuerpo, tabular, { color: paleta.texto }]}>{p.unidades} u.</Text>
                    <Text style={[tipografia.caption, tabular, { color: paleta.texto3 }]}>{pesos(p.monto)}</Text>
                  </View>
                </View>
              ))
            )}
          </Tarjeta>

          {/* Sin movimiento */}
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.s }]}>Calzado sin movimiento</Text>
            {data.sin_movimiento.length === 0 ? (
              <Text style={[tipografia.cuerpo, { color: paleta.texto3, paddingVertical: 4 }]}>Todo el catálogo tuvo movimiento.</Text>
            ) : (
              data.sin_movimiento.map((p) => (
                <Text key={p.id} style={[tipografia.cuerpo, { color: paleta.texto2, paddingVertical: espacio.s }]} numberOfLines={1}>
                  {p.producto}
                </Text>
              ))
            )}
          </Tarjeta>
        </ScrollView>
      ) : null}
    </View>
  )
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const { paleta } = useTema()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={[tipografia.cuerpo, { color: paleta.texto2, flex: 1, marginRight: espacio.s }]}>{etiqueta}</Text>
      <Text style={[tipografia.cuerpo, tabular, { color: paleta.texto }]}>{valor}</Text>
    </View>
  )
}
