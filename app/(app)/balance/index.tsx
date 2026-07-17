import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleArrowDown,
  CircleArrowUp,
  TrendingUp,
} from 'lucide-react-native'
import { useRequireModulo } from '../../../lib/auth'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { obtenerBalance, rangoPeriodo, proyeccionMes, type Balance } from '../../../lib/balance'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { CirculoIcono, EstadoVacio, Presionable, SelectorRango, Tarjeta, TarjetaMetrica } from '../../../components/ui'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

type Tipo = 'semana' | 'mes' | 'anio' | 'rango'

const NOMBRE_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// Etiqueta legible del período que contiene refDate
function etiquetaPeriodo(tipo: Tipo, refDate: Date, rangoCustom: { desde: string; hasta: string } | null): string {
  if (tipo === 'mes') {
    return `${NOMBRE_MES[refDate.getMonth()]} ${refDate.getFullYear()}`
  }
  if (tipo === 'anio') {
    return String(refDate.getFullYear())
  }
  if (tipo === 'rango') {
    return rangoCustom ? `${rangoCustom.desde} → ${rangoCustom.hasta}` : 'Elige un rango'
  }
  const { desde, hasta } = rangoPeriodo('semana', refDate)
  return `${desde} → ${hasta}`
}

// ¿El período seleccionado es el mes en curso? (única condición para mostrar proyección)
function esMesEnCurso(tipo: Tipo, refDate: Date): boolean {
  if (tipo !== 'mes') return false
  const hoy = new Date()
  return refDate.getFullYear() === hoy.getFullYear() && refDate.getMonth() === hoy.getMonth()
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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Balance</Text>
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
    { valor: 'anio', etiqueta: 'Año', testID: 'btn-tipo-anio' },
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

export default function BalanceIndex() {
  const requireModulo = useRequireModulo('balance')
  const router = useRouter()
  const { paleta } = useTema()
  const paddingInferior = usePaddingInferior(espacio.xxxl)

  const [tipo, setTipo] = useState<Tipo>('mes')
  const [refDate, setRefDate] = useState<Date>(new Date())
  const [rangoCustom, setRangoCustom] = useState<{ desde: string; hasta: string } | null>(null)
  const [data, setData] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarDatos = useCallback(async (t: Tipo, ref: Date, custom: { desde: string; hasta: string } | null, isRefresh = false) => {
    if (t === 'rango' && !custom) return
    if (!isRefresh) setLoading(true)
    setError(null)
    try {
      const { desde, hasta } = rangoPeriodo(t, ref, custom ?? undefined)
      const bal = await obtenerBalance(desde, hasta)
      setData(bal)
    } catch (err: unknown) {
      console.error('Error al cargar balance:', err)
      setError('No se pudo cargar el balance. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      // No disparar la petición si el rol no tiene acceso (el guard redirige abajo).
      if (!requireModulo) cargarDatos(tipo, refDate, rangoCustom)
    }, [cargarDatos, requireModulo, tipo, refDate, rangoCustom])
  )

  if (requireModulo) return requireModulo

  const cambiarTipo = (t: Tipo) => {
    if (t === tipo) return
    setTipo(t)
    setRefDate(new Date())
  }

  // Mueve refDate un año, un mes o una semana atrás (-1) o adelante (+1). No aplica a 'rango'.
  const mover = (dir: -1 | 1) => {
    setRefDate((prev) => {
      if (tipo === 'anio') {
        return new Date(prev.getFullYear() + dir, prev.getMonth(), 1)
      }
      if (tipo === 'mes') {
        return new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
      }
      return new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + dir * 7)
    })
  }

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos(tipo, refDate, rangoCustom, true)
  }

  const balanceNum = data?.balance ?? 0
  const esPerdida = balanceNum < 0

  // Proyección: solo cuando el período es el mes en curso
  const mostrarProyeccion = esMesEnCurso(tipo, refDate) && data != null
  let proyeccion = 0
  if (mostrarProyeccion) {
    const hoy = new Date()
    const diaActual = hoy.getDate()
    const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
    proyeccion = proyeccionMes(balanceNum, diaActual, diasDelMes)
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />

      {/* Selector de período */}
      <View
        style={{
          paddingHorizontal: espacio.xl,
          paddingBottom: espacio.m,
          borderBottomWidth: 1,
          borderBottomColor: paleta.borde,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
          <View style={{ flex: 1 }}>
            <SelectorTipo tipo={tipo} onCambio={cambiarTipo} />
          </View>
          <SelectorRango
            activo={tipo === 'rango'}
            onAplicar={(desde, hasta) => {
              setRangoCustom({ desde, hasta })
              setTipo('rango')
            }}
          />
        </View>

        {tipo === 'rango' ? (
          <Text style={[tipografia.cuerpoLg, { color: paleta.texto, textTransform: 'capitalize', marginTop: espacio.m, textAlign: 'center' }]}>
            {etiquetaPeriodo(tipo, refDate, rangoCustom)}
          </Text>
        ) : (
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
              {etiquetaPeriodo(tipo, refDate, rangoCustom)}
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
        )}
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
            onAccion={() => cargarDatos(tipo, refDate, rangoCustom)}
          />
        </View>
      ) : data ? (
        <ScrollView
          contentContainerStyle={{ padding: espacio.xl, paddingBottom: paddingInferior, gap: espacio.m }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={paleta.primario} />}
        >
          {/* Tarjeta Balance */}
          <Tarjeta
            estilo={{
              alignItems: 'center',
              backgroundColor: esPerdida ? paleta.peligroSoft : paleta.exitoSoft,
              borderColor: esPerdida ? paleta.peligro : paleta.exito,
            }}
          >
            <Text style={[tipografia.etiqueta, { color: paleta.texto2, marginBottom: 4 }]}>
              {esPerdida ? 'Pérdida' : 'Ganancia'}
            </Text>
            <Text style={[tipografia.display, tabular, { color: esPerdida ? paleta.peligroTexto : paleta.exitoTexto }]}>
              {pesos(balanceNum)}
            </Text>
          </Tarjeta>

          {/* Ingresos / Egresos */}
          <View style={{ flexDirection: 'row', gap: espacio.s }}>
            <TarjetaMetrica
              mini
              etiqueta="Ingresos netos"
              valor={pesos(data.ingresos.total_neto)}
              icono={<CircleArrowDown size={16} color={paleta.exito} />}
            />
            <TarjetaMetrica
              mini
              etiqueta="Egresos"
              valor={pesos(data.egresos.total)}
              icono={<CircleArrowUp size={16} color={paleta.peligro} />}
            />
          </View>

          {/* Desglose de ingresos */}
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.s }]}>Ingresos</Text>
            <Fila etiqueta="Efectivo" valor={pesos(data.ingresos.efectivo)} />
            <Fila etiqueta="Nequi" valor={pesos(data.ingresos.nequi)} />
            <Fila etiqueta="Bre-B" valor={pesos(data.ingresos.bre_b)} />
            <Fila etiqueta="Otro" valor={pesos(data.ingresos.otro)} />
            <Fila etiqueta="Reembolsos" valor={'- ' + pesos(data.ingresos.reembolsos)} />
            <Fila etiqueta="Cobros de cambios" valor={pesos(data.ingresos.cobros_cambios)} />
            <Fila etiqueta="Total neto" valor={pesos(data.ingresos.total_neto)} total />
          </Tarjeta>

          {/* Desglose de egresos */}
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.s }]}>Egresos</Text>
            <Fila etiqueta="Gastos fijos" valor={pesos(data.egresos.gastos_fijos)} />
            <Fila etiqueta="Gastos variables" valor={pesos(data.egresos.gastos_variables)} />
            <Fila etiqueta="Pagos a proveedores" valor={pesos(data.egresos.pagos_proveedores)} />
            <Fila etiqueta="Sueldos" valor={pesos(data.egresos.sueldos)} />
            <Fila etiqueta="Total" valor={pesos(data.egresos.total)} total />
          </Tarjeta>

          {/* Proyección del mes en curso */}
          {mostrarProyeccion && (
            <Tarjeta estilo={{ flexDirection: 'row', alignItems: 'center', backgroundColor: paleta.primarioSoft, borderColor: paleta.primarioSoft }}>
              <CirculoIcono tono="primario" tamano={36}>
                <TrendingUp />
              </CirculoIcono>
              <View style={{ flex: 1, marginLeft: espacio.m }}>
                <Text style={[tipografia.etiqueta, { color: paleta.texto }]}>Proyección de cierre del mes</Text>
                <Text style={[tipografia.caption, { color: paleta.texto2, marginTop: 2 }]}>
                  Según el promedio diario de lo que va del mes
                </Text>
              </View>
              <Text
                style={[
                  tipografia.h3,
                  tabular,
                  { color: proyeccion < 0 ? paleta.peligroTexto : paleta.exitoTexto, marginLeft: espacio.s },
                ]}
              >
                {pesos(proyeccion)}
              </Text>
            </Tarjeta>
          )}
        </ScrollView>
      ) : null}
    </View>
  )
}

function Fila({ etiqueta, valor, total }: { etiqueta: string; valor: string; total?: boolean }) {
  const { paleta } = useTema()
  return (
    <View
      style={[
        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: espacio.s },
        total ? { borderTopWidth: 1, borderTopColor: paleta.borde, marginTop: espacio.xs, paddingTop: espacio.m } : null,
      ]}
    >
      <Text style={[total ? tipografia.h3 : tipografia.cuerpo, { color: total ? paleta.texto : paleta.texto2 }]}>
        {etiqueta}
      </Text>
      <Text style={[total ? tipografia.h3 : tipografia.cuerpo, tabular, { color: paleta.texto }]}>{valor}</Text>
    </View>
  )
}
