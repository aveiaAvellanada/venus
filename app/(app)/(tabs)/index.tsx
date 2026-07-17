import React, { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Banknote,
  ChartColumn,
  CreditCard,
  Scale,
  Smartphone,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { obtenerCajaHoy } from '../../../lib/caja'
import {
  granularidadParaRango,
  obtenerGastosPeriodo,
  obtenerVentasPorSubperiodo,
  rangoParaPeriodo,
} from '../../../lib/dashboard'
import type { GastosPeriodo, Granularidad, Periodo, VentasBucket } from '../../../lib/dashboard'
import {
  compararConAyer,
  obtenerReportePeriodo,
  obtenerResumenDia,
} from '../../../lib/reportes'
import type { ReportePeriodo, ResumenDia } from '../../../lib/reportes'
import { puedeAcceder } from '../../../lib/permisos'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import {
  Badge,
  Chip,
  CirculoIcono,
  ContadorDinero,
  Esqueleto,
  FilaLista,
  GraficoBarras,
  SelectorRango,
  Tarjeta,
  TarjetaMetrica,
  useToast,
} from '../../../components/ui'
import type { TipoBadge, TonoIcono } from '../../../components/ui'

type EstadoCaja = 'cargando' | 'sin-abrir' | 'abierta' | 'cerrada'

const BADGE_CAJA: Record<EstadoCaja, { texto: string; tipo: TipoBadge; punto: boolean }> = {
  cargando: { texto: '···', tipo: 'neutro', punto: false },
  'sin-abrir': { texto: 'SIN ABRIR', tipo: 'neutro', punto: false },
  abierta: { texto: 'ABIERTA', tipo: 'exito', punto: true },
  cerrada: { texto: 'CERRADA', tipo: 'peligro', punto: false },
}

const ACCESOS: { id: string; titulo: string; sub: string; ruta?: string; Icono: LucideIcon; tono: TonoIcono }[] = [
  { id: 'proveedores', titulo: 'Proveedores', sub: 'Datos, cuentas y deudas', ruta: '/proveedores', Icono: Truck, tono: 'primario' },
  { id: 'reportes', titulo: 'Reportes', sub: 'El negocio a fondo', ruta: '/reportes', Icono: ChartColumn, tono: 'primario' },
  { id: 'balance', titulo: 'Balance', sub: 'Ingresos − egresos', ruta: '/balance', Icono: Scale, tono: 'primario' },
  { id: 'analisis-ia', titulo: 'Análisis IA', sub: 'Recomendaciones de compra', Icono: Sparkles, tono: 'acento' },
]

const PERIODOS: { clave: Periodo; etiqueta: string }[] = [
  { clave: 'hoy', etiqueta: 'Hoy' },
  { clave: 'semana', etiqueta: 'Semana' },
  { clave: 'mes', etiqueta: 'Mes' },
  { clave: 'anio', etiqueta: 'Año' },
]

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

interface Metodo {
  clave: string
  etiqueta: string
  monto: number
  Icono: LucideIcon
}

function metodosDe(efectivo: number, nequi: number, breB: number, otro: number): Metodo[] {
  return [
    { clave: 'efectivo', etiqueta: 'Efectivo', monto: efectivo, Icono: Banknote },
    { clave: 'nequi', etiqueta: 'Nequi', monto: nequi, Icono: Smartphone },
    { clave: 'bre_b', etiqueta: 'Bre-B', monto: breB, Icono: Zap },
    { clave: 'otro', etiqueta: 'Otro', monto: otro, Icono: CreditCard },
  ]
}

export default function Menu() {
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const router = useRouter()
  const { mostrar } = useToast()

  const esStaff = perfil?.rol === 'dueno' || perfil?.rol === 'admin'

  const [estadoCaja, setEstadoCaja] = useState<EstadoCaja>('cargando')
  const [periodo, setPeriodo] = useState<Periodo | 'rango'>('hoy')
  const [rangoCustom, setRangoCustom] = useState<{ desde: string; hasta: string } | null>(null)
  const [granularidad, setGranularidad] = useState<Granularidad>('dia')
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [errorCarga, setErrorCarga] = useState(false)
  const [reporte, setReporte] = useState<ReportePeriodo | null>(null)
  const [buckets, setBuckets] = useState<VentasBucket[]>([])
  const [gastos, setGastos] = useState<GastosPeriodo | null>(null)
  const [resumenHoy, setResumenHoy] = useState<ResumenDia | null>(null)

  const cargarCaja = useCallback(() => {
    obtenerCajaHoy()
      .then((caja) => {
        if (!caja) setEstadoCaja('sin-abrir')
        else setEstadoCaja(caja.estado === 'abierta' ? 'abierta' : 'cerrada')
      })
      .catch(() => setEstadoCaja('sin-abrir'))
  }, [])

  const cargarDatos = useCallback(async () => {
    if (!perfil) return
    setErrorCarga(false)
    try {
      if (esStaff) {
        const rango =
          periodo === 'rango' && rangoCustom
            ? { ...rangoCustom, granularidad: granularidadParaRango(rangoCustom.desde, rangoCustom.hasta) }
            : rangoParaPeriodo(periodo === 'rango' ? 'hoy' : periodo)
        setGranularidad(rango.granularidad)
        const [rep, vb, g] = await Promise.all([
          obtenerReportePeriodo(rango.desde, rango.hasta),
          obtenerVentasPorSubperiodo(rango.desde, rango.hasta, rango.granularidad),
          obtenerGastosPeriodo(rango.desde, rango.hasta),
        ])
        setReporte(rep)
        setBuckets(vb)
        setGastos(g)
      } else {
        const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
        setResumenHoy(await obtenerResumenDia(hoy))
      }
    } catch {
      setErrorCarga(true)
    } finally {
      setCargando(false)
    }
  }, [perfil, esStaff, periodo, rangoCustom])

  useFocusEffect(
    useCallback(() => {
      cargarCaja()
      cargarDatos()
    }, [cargarCaja, cargarDatos])
  )

  if (!perfil) return null

  const badge = BADGE_CAJA[estadoCaja]
  const accesos = ACCESOS.filter((a) => puedeAcceder(perfil.rol, a.id))
  const total = esStaff ? (reporte?.total_vendido ?? 0) : (resumenHoy?.total_general ?? 0)
  const numVentas = esStaff ? (reporte?.num_ventas ?? 0) : (resumenHoy?.total_ventas ?? 0)
  const metodos = esStaff
    ? metodosDe(reporte?.efectivo ?? 0, reporte?.nequi ?? 0, reporte?.bre_b ?? 0, reporte?.otro ?? 0)
    : metodosDe(
        resumenHoy?.total_efectivo ?? 0,
        resumenHoy?.total_nequi ?? 0,
        resumenHoy?.total_bre_b ?? 0,
        resumenHoy?.total_otro ?? 0
      )
  const delta = esStaff && reporte ? compararConAyer(reporte.total_vendido, reporte.total_anterior) : null
  const gastosVisibles = gastos?.gastos.slice(0, 5) ?? []

  const refrescar = async () => {
    setRefrescando(true)
    cargarCaja()
    await cargarDatos()
    setRefrescando(false)
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 56, gap: espacio.l }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={paleta.primario} />
        }
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[tipografia.h2, { color: paleta.texto }]}>
            {`Hola, ${perfil.nombre.split(' ')[0]}`}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Estado de caja" hitSlop={8} onPress={() => router.push('/caja')}>
            <Badge texto={badge.texto} tipo={badge.tipo} punto={badge.punto} />
          </Pressable>
        </View>

        {esStaff ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espacio.s }}>
            {PERIODOS.map((p) => (
              <View key={p.clave} accessibilityLabel={p.etiqueta}>
                <Chip
                  etiqueta={p.etiqueta}
                  activo={periodo === p.clave}
                  onPress={() => {
                    if (periodo !== p.clave) {
                      setCargando(true)
                      setPeriodo(p.clave)
                    }
                  }}
                />
              </View>
            ))}
            <SelectorRango
              activo={periodo === 'rango'}
              onAplicar={(desde, hasta) => {
                setCargando(true)
                setRangoCustom({ desde, hasta })
                setPeriodo('rango')
              }}
            />
          </ScrollView>
        ) : null}

        {cargando ? (
          <View style={{ gap: espacio.l }}>
            <Esqueleto alto={128} radio={radio.lg} />
            <View style={{ flexDirection: 'row', gap: espacio.s }}>
              <Esqueleto alto={76} radio={radio.md} />
            </View>
            <Esqueleto alto={160} radio={radio.md} />
          </View>
        ) : (
          <>
            {errorCarga ? (
              <Text style={[tipografia.caption, { color: paleta.texto3, textAlign: 'center' }]}>
                No se pudo cargar el resumen. Desliza hacia abajo para reintentar.
              </Text>
            ) : null}

            <LinearGradient
              colors={paleta.gradienteHero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: radio.lg, padding: espacio.l, gap: 4 }}
            >
              <Text style={[tipografia.micro, { color: 'rgba(255,255,255,0.7)' }]}>
                {esStaff ? 'Total vendido' : 'Vendido hoy'}
              </Text>
              <ContadorDinero
                valor={total}
                color="#FFFFFF"
                estilo={[tipografia.displayXL, { fontSize: 36, lineHeight: 44 }]}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
                {delta && !delta.sinBase && delta.direccion !== 'igual' ? (
                  <View
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.18)',
                      borderRadius: radio.full,
                      paddingVertical: 3,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text
                      style={[
                        tipografia.caption,
                        tabular,
                        { color: delta.direccion === 'sube' ? '#B9F6CE' : '#FFC9C9' },
                      ]}
                    >
                      {`${delta.direccion === 'sube' ? '▲' : '▼'} ${delta.pct}%`}
                    </Text>
                  </View>
                ) : null}
                <Text style={[tipografia.caption, { color: 'rgba(255,255,255,0.7)' }]}>
                  {`${numVentas} ${numVentas === 1 ? 'venta' : 'ventas'}`}
                </Text>
              </View>
            </LinearGradient>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: espacio.s }}>
              {metodos.map((m) => (
                <View key={m.clave} style={{ width: '48%' }}>
                  <TarjetaMetrica
                    mini
                    etiqueta={m.etiqueta}
                    valor={formatear(m.monto)}
                    icono={<m.Icono size={16} color={paleta.primario} />}
                  />
                </View>
              ))}
            </View>

            {esStaff && periodo !== 'hoy' ? (
              <Tarjeta>
                <View style={{ gap: espacio.m }}>
                  <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Ventas por período</Text>
                  <GraficoBarras datos={buckets} granularidad={granularidad} />
                </View>
              </Tarjeta>
            ) : null}

            {esStaff && gastos ? (
              <Tarjeta>
                <View style={{ gap: espacio.s }}>
                  <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Gastos del período</Text>
                  {gastosVisibles.length === 0 ? (
                    <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                      Sin gastos en este período
                    </Text>
                  ) : (
                    gastosVisibles.map((g, i) => (
                      <View key={`${g.tipo}-${g.nombre}-${g.fecha}-${i}`}>
                        {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde }} /> : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingVertical: 6 }}>
                          <Text style={[tipografia.etiqueta, { color: paleta.texto, flex: 1 }]} numberOfLines={1}>
                            {g.nombre}
                          </Text>
                          <Badge texto={g.tipo === 'fijo' ? 'FIJO' : 'VARIABLE'} tipo="neutro" />
                          <Text style={[tipografia.etiqueta, tabular, { color: paleta.texto }]}>
                            {formatear(g.monto)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                  <View style={{ height: 1, backgroundColor: paleta.borde }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>Total gastos</Text>
                    <Text style={[tipografia.cuerpoLg, tabular, { color: paleta.peligroTexto }]}>
                      {formatear(gastos.total)}
                    </Text>
                  </View>
                </View>
              </Tarjeta>
            ) : null}
          </>
        )}

        {accesos.length > 0 ? (
          <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
            {accesos.map((a, i) => (
              <View key={a.id}>
                {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} /> : null}
                <FilaLista
                  icono={
                    <CirculoIcono tono={a.tono}>
                      <a.Icono />
                    </CirculoIcono>
                  }
                  titulo={a.titulo}
                  subtitulo={a.sub}
                  chevron
                  onPress={() => (a.ruta ? router.push(a.ruta) : mostrar('Análisis IA estará disponible pronto', 'info'))}
                />
              </View>
            ))}
          </Tarjeta>
        ) : null}
      </ScrollView>
    </View>
  )
}
