import React, { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import {
  Banknote,
  CreditCard,
  ShoppingCart,
  Smartphone,
  Undo2,
  Zap,
} from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { tienePermiso } from '../../../lib/permisos'
import { rangoParaPeriodo } from '../../../lib/dashboard'
import type { Periodo } from '../../../lib/dashboard'
import {
  badgeEstadoVenta,
  badgeTipoDevolucion,
  listarDevoluciones,
  listarVentasPeriodo,
} from '../../../lib/movimientos'
import type { DevolucionListado, VentaListado } from '../../../lib/movimientos'
import { useTema } from '../../../lib/tema'
import { espacio, tabular, tipografia } from '../../../lib/theme'
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
} from '../../../components/ui'
import type { TonoIcono } from '../../../components/ui'

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

const PERIODOS: { clave: Periodo; etiqueta: string }[] = [
  { clave: 'hoy', etiqueta: 'Hoy' },
  { clave: 'semana', etiqueta: 'Semana' },
  { clave: 'mes', etiqueta: 'Mes' },
]

const ICONO_METODO: Record<string, { Icono: LucideIcon; tono: TonoIcono }> = {
  efectivo: { Icono: Banknote, tono: 'exito' },
  nequi: { Icono: Smartphone, tono: 'primario' },
  bre_b: { Icono: Zap, tono: 'primario' },
  otro: { Icono: CreditCard, tono: 'primario' },
}

const NOMBRE_METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  bre_b: 'Bre-B',
  otro: 'Otro',
}

export default function Movimientos() {
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const router = useRouter()

  // Otros días = historial (reportes); los gastos de todos = gastos_fijos.
  const esStaff = tienePermiso(perfil, 'reportes')

  const [vista, setVista] = useState(0)
  const [periodo, setPeriodo] = useState<Periodo | 'rango'>('hoy')
  const [rangoCustom, setRangoCustom] = useState<{ desde: string; hasta: string } | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [ventas, setVentas] = useState<VentaListado[]>([])
  const [devoluciones, setDevoluciones] = useState<DevolucionListado[]>([])

  const cargar = useCallback(async () => {
    if (!perfil) return
    const rango =
      esStaff && periodo === 'rango' && rangoCustom
        ? rangoCustom
        : rangoParaPeriodo(esStaff && periodo !== 'rango' ? periodo : 'hoy')
    try {
      if (vista === 0) setVentas(await listarVentasPeriodo(rango.desde, rango.hasta))
      else if (vista === 1) setDevoluciones(await listarDevoluciones(rango.desde, rango.hasta))
    } catch {
      // la vista muestra su estado vacío; pull-to-refresh reintenta
    } finally {
      setCargando(false)
    }
  }, [perfil, esStaff, periodo, rangoCustom, vista])

  useFocusEffect(
    useCallback(() => {
      cargar()
    }, [cargar])
  )

  if (!perfil) return null

  const ventasValidas = ventas.filter((v) => v.estado !== 'cancelada')
  const totalVentas = ventasValidas.reduce((s, v) => s + v.total, 0)
  const totalDevuelto = devoluciones.reduce((s, d) => s + d.monto_devuelto, 0)

  const resumen =
    vista === 0
      ? `${formatear(totalVentas)} · ${ventasValidas.length} ${ventasValidas.length === 1 ? 'venta' : 'ventas'}`
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

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 56, gap: espacio.l }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={paleta.primario} />
        }
      >
        <Text style={[tipografia.h1, { color: paleta.texto }]}>Movimientos</Text>

        <ControlSegmentado
          opciones={['Ventas', 'Devoluciones']}
          indice={vista}
          onCambio={cambiarVista}
        />

        {esStaff ? (
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

        {resumen && !cargando ? (
          <Text style={[tipografia.etiqueta, tabular, { color: paleta.texto2 }]}>{resumen}</Text>
        ) : null}

        {cargando ? (
          <View style={{ gap: espacio.m }}>
            <Esqueleto alto={64} />
            <Esqueleto alto={64} />
            <Esqueleto alto={64} />
          </View>
        ) : vista === 0 ? (
          ventas.length === 0 ? (
            <EstadoVacio
              icono={<ShoppingCart />}
              titulo="Aún no hay ventas en este período"
              mensaje="Toca + para registrar la primera"
            />
          ) : (
            <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
              {ventas.map((v, i) => {
                const metodo = ICONO_METODO[v.metodos[0]] ?? ICONO_METODO.otro
                const badge = badgeEstadoVenta(v.estado)
                return (
                  <View key={v.id}>
                    {i > 0 ? (
                      <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} />
                    ) : null}
                    <FilaLista
                      icono={
                        <CirculoIcono tono={metodo.tono}>
                          <metodo.Icono />
                        </CirculoIcono>
                      }
                      titulo={`Venta #${v.numero}`}
                      subtitulo={`${v.hora} · ${v.metodos.map((m) => NOMBRE_METODO[m] ?? m).join(' + ')}`}
                      derecha={
                        v.estado === 'completada' ? (
                          <Text style={[tipografia.cuerpoLg, tabular, { color: paleta.texto }]}>
                            {formatear(v.total)}
                          </Text>
                        ) : (
                          <Badge texto={badge.texto} tipo={badge.tipo} />
                        )
                      }
                      chevron
                      onPress={() => router.push(`/ventas/${v.id}`)}
                    />
                  </View>
                )
              })}
            </Tarjeta>
          )
        ) : (
          devoluciones.length === 0 ? (
            <EstadoVacio icono={<Undo2 />} titulo="Sin devoluciones en este período" />
          ) : (
            <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
              {devoluciones.map((d, i) => {
                const badge = badgeTipoDevolucion(d.tipo)
                const monto = d.tipo === 'cambio' ? d.monto_cobrado : d.monto_devuelto
                const prefijo = d.tipo === 'cambio' ? 'Cobrado' : 'Devuelto'
                return (
                  <View key={d.id}>
                    {i > 0 ? (
                      <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} />
                    ) : null}
                    <FilaLista
                      icono={
                        <CirculoIcono tono="peligro">
                          <Undo2 />
                        </CirculoIcono>
                      }
                      titulo={`Devolución venta #${d.numero_venta}`}
                      subtitulo={`${prefijo} ${formatear(monto)} · ${d.hora}`}
                      derecha={<Badge texto={badge.texto} tipo={badge.tipo} />}
                      chevron
                      onPress={() => router.push(`/devoluciones/${d.id}`)}
                    />
                  </View>
                )
              })}
            </Tarjeta>
          )
        )}
      </ScrollView>
    </View>
  )
}
