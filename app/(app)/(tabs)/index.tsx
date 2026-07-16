import React, { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { ChartColumn, Scale, Sparkles, Truck } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { obtenerCajaHoy } from '../../../lib/caja'
import { puedeAcceder } from '../../../lib/permisos'
import { useTema } from '../../../lib/tema'
import { espacio, tipografia } from '../../../lib/theme'
import { Badge, CirculoIcono, FilaLista, Tarjeta } from '../../../components/ui'
import type { TipoBadge, TonoIcono } from '../../../components/ui'

type EstadoCaja = 'cargando' | 'sin-abrir' | 'abierta' | 'cerrada'

const BADGE_CAJA: Record<EstadoCaja, { texto: string; tipo: TipoBadge; punto: boolean }> = {
  cargando: { texto: '···', tipo: 'neutro', punto: false },
  'sin-abrir': { texto: 'SIN ABRIR', tipo: 'neutro', punto: false },
  abierta: { texto: 'ABIERTA', tipo: 'exito', punto: true },
  cerrada: { texto: 'CERRADA', tipo: 'peligro', punto: false },
}

const ACCESOS: { id: string; titulo: string; sub: string; ruta: string; Icono: typeof Truck; tono: TonoIcono }[] = [
  { id: 'proveedores', titulo: 'Proveedores', sub: 'Datos, cuentas y deudas', ruta: '/proveedores', Icono: Truck, tono: 'primario' },
  { id: 'reportes', titulo: 'Reportes', sub: 'El negocio a fondo', ruta: '/reportes', Icono: ChartColumn, tono: 'primario' },
  { id: 'balance', titulo: 'Balance', sub: 'Ingresos − egresos', ruta: '/balance', Icono: Scale, tono: 'primario' },
  { id: 'analisis-ia', titulo: 'Análisis IA', sub: 'Recomendaciones de compra', ruta: '/modulo/analisis-ia', Icono: Sparkles, tono: 'acento' },
]

export default function Menu() {
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const router = useRouter()
  const [estadoCaja, setEstadoCaja] = useState<EstadoCaja>('cargando')

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      obtenerCajaHoy()
        .then((caja) => {
          if (!vigente) return
          if (!caja) setEstadoCaja('sin-abrir')
          else setEstadoCaja(caja.estado === 'abierta' ? 'abierta' : 'cerrada')
        })
        .catch(() => {
          if (vigente) setEstadoCaja('sin-abrir')
        })
      return () => {
        vigente = false
      }
    }, [])
  )

  if (!perfil) return null
  const badge = BADGE_CAJA[estadoCaja]
  const accesos = ACCESOS.filter((a) => puedeAcceder(perfil.rol, a.id))

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView contentContainerStyle={{ padding: espacio.xl, paddingTop: 56, gap: espacio.l }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[tipografia.h2, { color: paleta.texto }]}>
            {`Hola, ${perfil.nombre.split(' ')[0]}`}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Estado de caja" hitSlop={8} onPress={() => router.push('/caja')}>
            <Badge texto={badge.texto} tipo={badge.tipo} punto={badge.punto} />
          </Pressable>
        </View>

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
                  onPress={() => router.push(a.ruta)}
                />
              </View>
            ))}
          </Tarjeta>
        ) : null}
      </ScrollView>
    </View>
  )
}
