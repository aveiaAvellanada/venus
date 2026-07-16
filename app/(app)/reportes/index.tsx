import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import {
  ArrowLeft,
  Banknote,
  Bell,
  CalendarDays,
  CircleAlert,
  CreditCard,
  Minus,
  Smartphone,
  TrendingDown,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react-native'
import { useRequireModulo, useAuth } from '../../../lib/auth'
import {
  obtenerResumenDia,
  listarStockBajo,
  obtenerDashboardDueno,
  compararConAyer,
  type ResumenDia,
  type ProductoStockBajo,
  type DashboardDueno,
} from '../../../lib/reportes'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, tabular, tipografia } from '../../../lib/theme'
import { CirculoIcono, EstadoVacio, FilaLista, Presionable, Tarjeta, TarjetaMetrica } from '../../../components/ui'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Reportes</Text>
    </View>
  )
}

export default function ReportesIndex() {
  const requireModulo = useRequireModulo('reportes')
  const { perfil } = useAuth()
  const router = useRouter()
  const { paleta } = useTema()
  const esDueno = perfil?.rol === 'dueno'

  const [hoy, setHoy] = useState<ResumenDia | null>(null)
  const [ayer, setAyer] = useState<ResumenDia | null>(null)
  const [stockBajo, setStockBajo] = useState<ProductoStockBajo[]>([])
  const [dashDueno, setDashDueno] = useState<DashboardDueno | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarDatos = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true)
      setError(null)
      try {
        const ahora = new Date()
        const fechaHoy = toISO(ahora)
        const fechaAyer = toISO(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1))

        const [rHoy, rAyer, stock, dash] = await Promise.all([
          obtenerResumenDia(fechaHoy),
          obtenerResumenDia(fechaAyer),
          listarStockBajo(),
          esDueno ? obtenerDashboardDueno(7) : Promise.resolve(null),
        ])

        setHoy(rHoy)
        setAyer(rAyer)
        setStockBajo(stock)
        setDashDueno(dash)
      } catch (err: unknown) {
        console.error('Error al cargar el dashboard:', err)
        setError('No se pudo cargar el dashboard. Intenta de nuevo.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [esDueno]
  )

  useFocusEffect(
    useCallback(() => {
      // No disparar la carga si el rol no tiene acceso (el guard redirige abajo).
      if (!requireModulo) cargarDatos()
    }, [cargarDatos, requireModulo])
  )

  if (requireModulo) return requireModulo

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos(true)
  }

  const cmp = hoy && ayer ? compararConAyer(hoy.total_general, ayer.total_general) : null

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: espacio.xl }}>
          <EstadoVacio icono={<CircleAlert />} titulo={error} textoAccion="Reintentar" onAccion={() => cargarDatos()} />
        </View>
      ) : hoy ? (
        <ScrollView
          contentContainerStyle={{ padding: espacio.xl, paddingBottom: espacio.xxxl, gap: espacio.m }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={paleta.primario} />}
        >
          {/* Acceso al reporte por semana / mes y configuración (solo dueño) */}
          <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
            <FilaLista
              icono={
                <CirculoIcono tono="primario">
                  <CalendarDays />
                </CirculoIcono>
              }
              titulo="Ver reporte por semana / mes"
              chevron
              onPress={() => router.push('/reportes/periodos')}
            />
            {esDueno && (
              <>
                <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} />
                <FilaLista
                  icono={
                    <CirculoIcono tono="primario">
                      <Bell />
                    </CirculoIcono>
                  }
                  titulo="Configurar reportes automáticos"
                  chevron
                  onPress={() => router.push('/reportes/config')}
                />
              </>
            )}
          </Tarjeta>

          {/* Ventas de hoy */}
          <Tarjeta>
            <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Ventas de hoy</Text>
            <Text style={[tipografia.display, tabular, { color: paleta.texto, marginTop: 2 }]}>
              {pesos(hoy.total_general)}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: espacio.xs }}>
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                {hoy.total_ventas} {hoy.total_ventas === 1 ? 'venta' : 'ventas'}
              </Text>
              {cmp && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
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
                        {cmp.pct}% vs ayer
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>
          </Tarjeta>

          <View style={{ flexDirection: 'row', gap: espacio.s }}>
            <TarjetaMetrica mini etiqueta="Efectivo" valor={pesos(hoy.total_efectivo)} icono={<Banknote size={16} color={paleta.primario} />} />
            <TarjetaMetrica mini etiqueta="Nequi" valor={pesos(hoy.total_nequi)} icono={<Smartphone size={16} color={paleta.primario} />} />
            <TarjetaMetrica mini etiqueta="Bre-B" valor={pesos(hoy.total_bre_b)} icono={<Zap size={16} color={paleta.primario} />} />
            <TarjetaMetrica mini etiqueta="Otro" valor={pesos(hoy.total_otro)} icono={<CreditCard size={16} color={paleta.primario} />} />
          </View>

          {/* Stock bajo (ambos roles) */}
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.s }]}>Stock bajo</Text>
            {stockBajo.length === 0 ? (
              <Text style={[tipografia.cuerpo, { color: paleta.texto3, paddingVertical: 4 }]}>Todo en orden con el stock.</Text>
            ) : (
              stockBajo.map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: espacio.s }}>
                  <Text style={[tipografia.cuerpo, { color: paleta.texto2, flex: 1, marginRight: espacio.s }]} numberOfLines={1}>
                    {p.descripcion}
                    {p.talla ? ` · talla ${p.talla}` : ''}
                  </Text>
                  <Text style={[tipografia.etiqueta, { color: paleta.advertenciaTexto }]}>quedan {p.stock_actual}</Text>
                </View>
              ))
            )}
          </Tarjeta>

          {/* Widgets solo-dueño */}
          {esDueno && dashDueno && (
            <>
              <Tarjeta>
                <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.s }]}>Proveedores por vencer</Text>
                {dashDueno.proveedores_por_vencer.length === 0 ? (
                  <Text style={[tipografia.cuerpo, { color: paleta.texto3, paddingVertical: 4 }]}>Sin pagos próximos a vencer.</Text>
                ) : (
                  dashDueno.proveedores_por_vencer.map((p, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: espacio.s }}>
                      <View style={{ flex: 1, marginRight: espacio.s }}>
                        <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]} numberOfLines={1}>
                          {p.proveedor}
                        </Text>
                        <Text style={[tipografia.caption, { color: p.vencida ? paleta.peligroTexto : paleta.texto3, marginTop: 2 }]}>
                          {p.vencida ? 'Vencida · ' : 'Vence '}
                          {p.fecha_vencimiento}
                        </Text>
                      </View>
                      <Text style={[tipografia.etiqueta, tabular, { color: p.vencida ? paleta.peligroTexto : paleta.texto }]}>
                        {pesos(p.saldo)}
                      </Text>
                    </View>
                  ))
                )}
              </Tarjeta>

              <Tarjeta>
                <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.s }]}>Empleados sin actividad hoy</Text>
                {dashDueno.empleados_sin_actividad.length === 0 ? (
                  <Text style={[tipografia.cuerpo, { color: paleta.texto3, paddingVertical: 4 }]}>Todos registraron actividad hoy.</Text>
                ) : (
                  dashDueno.empleados_sin_actividad.map((e) => (
                    <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingVertical: espacio.s }}>
                      <User size={14} color={paleta.texto3} />
                      <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>{e.nombre}</Text>
                    </View>
                  ))
                )}
              </Tarjeta>
            </>
          )}
        </ScrollView>
      ) : null}
    </View>
  )
}
