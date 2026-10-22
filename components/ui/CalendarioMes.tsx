import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useTema } from '../../lib/tema'
import { radio, tabular, tipografia } from '../../lib/theme'
import type { VentasBucket } from '../../lib/dashboard'
import { celdasDelMes, etiquetaDia, tituloMes } from '../../lib/dashboard'

interface Props {
  // Día 1 del mes que se muestra (YYYY-MM-DD).
  primerDia: string
  datos: VentasBucket[]
  hoy: string
  onAnterior: () => void
  // Sin onSiguiente: es el mes en curso y no se puede avanzar.
  onSiguiente?: () => void
}

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
// Intensidad de cada día según lo vendido frente al mejor día del mes.
const NIVELES = [0.16, 0.34, 0.58, 0.86]

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

function nivel(total: number, max: number): number {
  if (total <= 0 || max <= 0) return -1
  return Math.min(NIVELES.length - 1, Math.floor((total / max) * NIVELES.length - 1e-9))
}

// Ventas del mes en calendario: el mes arriba, cada día numerado y más oscuro
// cuanto más se vendió. Tocar un día muestra su total; las flechas cambian de mes.
export function CalendarioMes({ primerDia, datos, hoy, onAnterior, onSiguiente }: Props) {
  const { paleta } = useTema()
  const [seleccion, setSeleccion] = useState<string | null>(null)

  const porDia = new Map(datos.map((d) => [d.inicio.slice(0, 10), d]))
  const max = datos.reduce((m, d) => Math.max(m, d.total), 0)
  const celdas = celdasDelMes(primerDia)
  const semanas = Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7))
  const elegido = seleccion ? porDia.get(seleccion) : undefined

  const flecha = (direccion: 'anterior' | 'siguiente') => {
    const Icono = direccion === 'anterior' ? ChevronLeft : ChevronRight
    const accion = direccion === 'anterior' ? onAnterior : onSiguiente
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={direccion === 'anterior' ? 'Mes anterior' : 'Mes siguiente'}
        accessibilityState={{ disabled: !accion }}
        disabled={!accion}
        hitSlop={8}
        onPress={() => {
          setSeleccion(null)
          accion?.()
        }}
        style={({ pressed }) => ({
          width: 34,
          height: 34,
          borderRadius: radio.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? paleta.superficie2 : paleta.superficie,
          opacity: accion ? 1 : 0.35,
        })}
      >
        <Icono size={18} color={paleta.texto} />
      </Pressable>
    )
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {flecha('anterior')}
        <Text style={[tipografia.h3, { color: paleta.texto, flex: 1, textAlign: 'center' }]}>{tituloMes(primerDia)}</Text>
        {flecha('siguiente')}
      </View>

      <View style={{ height: 28, justifyContent: 'center' }}>
        {seleccion ? (
          <View
            style={{
              alignSelf: 'center',
              backgroundColor: paleta.texto,
              borderRadius: radio.full,
              paddingVertical: 4,
              paddingHorizontal: 12,
            }}
          >
            <Text style={[tipografia.caption, { color: paleta.fondo }]}>
              {`${etiquetaDia(seleccion)} · `}
              <Text style={[tipografia.caption, tabular, { color: paleta.fondo }]}>
                {formatear(elegido?.total ?? 0)}
              </Text>
              {` · ${elegido?.num_ventas ?? 0} ${elegido?.num_ventas === 1 ? 'venta' : 'ventas'}`}
            </Text>
          </View>
        ) : (
          <Text style={[tipografia.caption, { color: paleta.texto3, textAlign: 'center' }]}>
            {max > 0 ? 'Toca un día para ver lo vendido' : 'Sin ventas en este mes'}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row' }}>
        {DIAS_SEMANA.map((d, i) => (
          <Text key={i} style={[tipografia.micro, { flex: 1, textAlign: 'center', color: paleta.texto3 }]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={{ gap: 4 }}>
        {semanas.map((semana, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 4 }}>
            {semana.map((fecha, j) => {
              if (!fecha) return <View key={j} style={{ flex: 1, aspectRatio: 1 }} />
              const dato = porDia.get(fecha)
              const futuro = fecha > hoy
              const n = futuro ? -1 : nivel(dato?.total ?? 0, max)
              const fuerte = n >= 2
              const esHoy = fecha === hoy
              const elegidoAhora = fecha === seleccion
              return (
                <Pressable
                  key={j}
                  accessibilityRole="button"
                  accessibilityLabel={`${etiquetaDia(fecha)}: ${formatear(dato?.total ?? 0)}`}
                  disabled={futuro}
                  onPress={() => setSeleccion(elegidoAhora ? null : fecha)}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderRadius: radio.sm,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: paleta.superficie,
                    borderWidth: esHoy || elegidoAhora ? 2 : 0,
                    borderColor: elegidoAhora ? paleta.acento : paleta.primario,
                  }}
                >
                  {n >= 0 ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: paleta.primario,
                        opacity: NIVELES[n],
                      }}
                    />
                  ) : null}
                  <Text
                    style={[
                      tipografia.etiqueta,
                      tabular,
                      {
                        color: futuro ? paleta.textoDeshabilitado : fuerte ? paleta.sobrePrimario : paleta.texto,
                      },
                    ]}
                  >
                    {Number(fecha.slice(8, 10))}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
        <Text style={[tipografia.caption, { color: paleta.texto3, marginRight: 2 }]}>Menos</Text>
        {[-1, 0, 1, 2, 3].map((n) => (
          <View
            key={n}
            style={{ width: 12, height: 12, borderRadius: 3, overflow: 'hidden', backgroundColor: paleta.superficie }}
          >
            {n >= 0 ? (
              <View style={{ flex: 1, backgroundColor: paleta.primario, opacity: NIVELES[n] }} />
            ) : null}
          </View>
        ))}
        <Text style={[tipografia.caption, { color: paleta.texto3, marginLeft: 2 }]}>Más</Text>
      </View>
    </View>
  )
}
