import React, { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, StickyNote, Undo2, UserRound } from 'lucide-react-native'
import { badgeEstadoVenta, obtenerVentaDetalle } from '../../../lib/movimientos'
import type { VentaDetalle } from '../../../lib/movimientos'
import { useTema } from '../../../lib/tema'
import { espacio, tabular, tipografia } from '../../../lib/theme'
import { Badge, Boton, CirculoIcono, Esqueleto, EstadoVacio, Tarjeta } from '../../../components/ui'

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

const NOMBRE_METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  bre_b: 'Bre-B',
  otro: 'Otro',
}

// Estados desde los que aún se puede devolver algo.
const PUEDE_DEVOLVER = ['completada', 'devuelta_parcial', 'cambiada_parcial']

function FilaMonto({ etiqueta, valor, destacado = false, peligro = false }: {
  etiqueta: string
  valor: string
  destacado?: boolean
  peligro?: boolean
}) {
  const { paleta } = useTema()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={[destacado ? tipografia.cuerpoLg : tipografia.etiqueta, { color: paleta.texto2 }]}>
        {etiqueta}
      </Text>
      <Text
        style={[
          destacado ? tipografia.h2 : tipografia.etiqueta,
          tabular,
          { color: peligro ? paleta.peligroTexto : paleta.texto },
        ]}
      >
        {valor}
      </Text>
    </View>
  )
}

export default function VentaDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { paleta } = useTema()
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [venta, setVenta] = useState<VentaDetalle | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      obtenerVentaDetalle(id)
        .then(setVenta)
        .catch(() => setVenta(null))
        .finally(() => setCargando(false))
    }, [id])
  )

  const badge = venta ? badgeEstadoVenta(venta.estado) : null

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView contentContainerStyle={{ padding: espacio.xl, paddingTop: 56, gap: espacio.l }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" hitSlop={12} onPress={() => router.back()}>
          <ArrowLeft size={24} color={paleta.texto2} />
        </Pressable>

        {cargando ? (
          <View style={{ gap: espacio.m }}>
            <Esqueleto alto={40} ancho={180} />
            <Esqueleto alto={120} />
            <Esqueleto alto={120} />
          </View>
        ) : !venta || !badge ? (
          <EstadoVacio titulo="No encontramos esta venta" textoAccion="Volver" onAccion={() => router.back()} />
        ) : (
          <>
            <View style={{ gap: espacio.s }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[tipografia.h1, { color: paleta.texto }]}>{`Venta #${venta.numero}`}</Text>
                <Badge texto={badge.texto} tipo={badge.tipo} />
              </View>
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                {[venta.fecha, venta.hora, venta.vendedor].filter(Boolean).join(' · ')}
              </Text>
            </View>

            {venta.cliente ? (
              <Tarjeta>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m }}>
                  <CirculoIcono tono="primario">
                    <UserRound />
                  </CirculoIcono>
                  <View style={{ flex: 1 }}>
                    <Text style={[tipografia.h3, { color: paleta.texto }]}>
                      {`${venta.cliente.nombre}${venta.cliente.apellido ? ` ${venta.cliente.apellido}` : ''}`}
                    </Text>
                    {venta.cliente.telefono ? (
                      <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                        {venta.cliente.telefono}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Tarjeta>
            ) : null}

            <Tarjeta>
              <View style={{ gap: espacio.s }}>
                <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Productos</Text>
                {venta.items.map((item, i) => (
                  <View key={`${item.descripcion}-${i}`}>
                    {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde }} /> : null}
                    <View style={{ paddingVertical: 6, gap: 2 }}>
                      <Text style={[tipografia.etiqueta, { color: paleta.texto }]}>{item.descripcion}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                          {[
                            item.talla ? `Talla ${item.talla}` : null,
                            item.color,
                            `${item.cantidad} × ${formatear(item.precio_unitario)}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                        <Text style={[tipografia.etiqueta, tabular, { color: paleta.texto }]}>
                          {formatear(item.subtotal)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </Tarjeta>

            <Tarjeta>
              <View style={{ gap: espacio.s }}>
                <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Pago</Text>
                <FilaMonto etiqueta="Total" valor={formatear(venta.total)} destacado />
                {venta.pagos.map((p) => (
                  <FilaMonto
                    key={p.metodo}
                    etiqueta={NOMBRE_METODO[p.metodo] ?? p.metodo}
                    valor={formatear(p.monto)}
                  />
                ))}
                {venta.efectivo_recibido > 0 ? (
                  <>
                    <View style={{ height: 1, backgroundColor: paleta.borde }} />
                    <FilaMonto etiqueta="Efectivo recibido" valor={formatear(venta.efectivo_recibido)} />
                    <FilaMonto etiqueta="Cambio" valor={formatear(venta.cambio)} />
                  </>
                ) : null}
                {venta.saldo_pendiente > 0 ? (
                  <FilaMonto etiqueta="Saldo pendiente" valor={formatear(venta.saldo_pendiente)} peligro />
                ) : null}
              </View>
            </Tarjeta>

            {venta.nota ? (
              <Tarjeta>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
                  <StickyNote size={16} color={paleta.texto3} />
                  <Text style={[tipografia.cuerpo, { color: paleta.texto2, fontStyle: 'italic', flex: 1 }]}>
                    {venta.nota}
                  </Text>
                </View>
              </Tarjeta>
            ) : null}

            {venta.corregida && venta.correccion_motivo ? (
              <Tarjeta estilo={{ borderColor: paleta.advertenciaSoft }}>
                <View style={{ gap: 4 }}>
                  <Text style={[tipografia.micro, { color: paleta.advertenciaTexto }]}>Corrección</Text>
                  <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>{venta.correccion_motivo}</Text>
                </View>
              </Tarjeta>
            ) : null}

            {PUEDE_DEVOLVER.includes(venta.estado) ? (
              <Boton
                titulo="Hacer devolución"
                variante="secundario"
                icono={<Undo2 size={20} color={paleta.primario} />}
                onPress={() => router.push(`/devoluciones/nueva?numero=${venta.numero}`)}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}
