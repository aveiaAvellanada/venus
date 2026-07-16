import React, { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, ShoppingCart, StickyNote } from 'lucide-react-native'
import { badgeTipoDevolucion, obtenerDevolucionDetalle } from '../../../lib/movimientos'
import type { DevolucionDetalle } from '../../../lib/movimientos'
import { useTema } from '../../../lib/tema'
import { espacio, tabular, tipografia } from '../../../lib/theme'
import { Badge, CirculoIcono, Esqueleto, EstadoVacio, FilaLista, Tarjeta } from '../../../components/ui'

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

const NOMBRE_METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  bre_b: 'Bre-B',
  otro: 'Otro',
}

export default function DevolucionDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { paleta } = useTema()
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [devolucion, setDevolucion] = useState<DevolucionDetalle | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      obtenerDevolucionDetalle(id)
        .then(setDevolucion)
        .catch(() => setDevolucion(null))
        .finally(() => setCargando(false))
    }, [id])
  )

  const badge = devolucion ? badgeTipoDevolucion(devolucion.tipo) : null

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView contentContainerStyle={{ padding: espacio.xl, paddingTop: 56, gap: espacio.l }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" hitSlop={12} onPress={() => router.back()}>
          <ArrowLeft size={24} color={paleta.texto2} />
        </Pressable>

        {cargando ? (
          <View style={{ gap: espacio.m }}>
            <Esqueleto alto={40} ancho={200} />
            <Esqueleto alto={120} />
          </View>
        ) : !devolucion || !badge ? (
          <EstadoVacio
            titulo="No encontramos esta devolución"
            textoAccion="Volver"
            onAccion={() => router.back()}
          />
        ) : (
          <>
            <View style={{ gap: espacio.s }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[tipografia.h1, { color: paleta.texto }]}>Devolución</Text>
                <Badge texto={badge.texto} tipo={badge.tipo} />
              </View>
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                {`${devolucion.fecha} · ${devolucion.hora}`}
              </Text>
            </View>

            <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
              <FilaLista
                icono={
                  <CirculoIcono tono="primario">
                    <ShoppingCart />
                  </CirculoIcono>
                }
                titulo={`Venta #${devolucion.numero_venta}`}
                subtitulo="Ver la venta original"
                chevron
                onPress={() => router.push(`/ventas/${devolucion.venta_id}`)}
              />
            </Tarjeta>

            <Tarjeta>
              <View style={{ gap: espacio.s }}>
                <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Productos devueltos</Text>
                {devolucion.items.map((item, i) => (
                  <View key={`${item.descripcion}-${i}`}>
                    {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde }} /> : null}
                    <View style={{ paddingVertical: 6, gap: 2 }}>
                      <Text style={[tipografia.etiqueta, { color: paleta.texto }]}>{item.descripcion}</Text>
                      <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                        {[
                          item.talla ? `Talla ${item.talla}` : null,
                          item.color,
                          `Cantidad: ${item.cantidad}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Tarjeta>

            <Tarjeta>
              <View style={{ gap: espacio.s }}>
                <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Dinero</Text>
                {devolucion.monto_devuelto > 0 ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>
                      {`Devuelto${devolucion.metodo_reembolso ? ` (${NOMBRE_METODO[devolucion.metodo_reembolso] ?? devolucion.metodo_reembolso})` : ''}`}
                    </Text>
                    <Text style={[tipografia.etiqueta, tabular, { color: paleta.peligroTexto }]}>
                      {formatear(devolucion.monto_devuelto)}
                    </Text>
                  </View>
                ) : null}
                {devolucion.monto_cobrado > 0 ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>
                      {`Cobrado${devolucion.metodo_cobro ? ` (${NOMBRE_METODO[devolucion.metodo_cobro] ?? devolucion.metodo_cobro})` : ''}`}
                    </Text>
                    <Text style={[tipografia.etiqueta, tabular, { color: paleta.exitoTexto }]}>
                      {formatear(devolucion.monto_cobrado)}
                    </Text>
                  </View>
                ) : null}
                {devolucion.monto_devuelto === 0 && devolucion.monto_cobrado === 0 ? (
                  <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Sin movimiento de dinero</Text>
                ) : null}
              </View>
            </Tarjeta>

            {devolucion.motivo ? (
              <Tarjeta>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
                  <StickyNote size={16} color={paleta.texto3} />
                  <Text style={[tipografia.cuerpo, { color: paleta.texto2, fontStyle: 'italic', flex: 1 }]}>
                    {devolucion.motivo}
                  </Text>
                </View>
              </Tarjeta>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}
