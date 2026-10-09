import { useEffect, useState } from 'react'
import { View, Text, FlatList, ActivityIndicator } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { ArrowLeft, Clock } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { tienePermiso } from '../../../lib/permisos'
import { supabase } from '../../../lib/supabase'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { Badge, EstadoVacio, Presionable, Tarjeta } from '../../../components/ui'

const pesos = (n: number) => '$' + n.toLocaleString('es-CO')

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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Historial de Cierres</Text>
    </View>
  )
}

export default function HistorialCaja() {
  const { perfil } = useAuth()
  const router = useRouter()
  const { paleta } = useTema()
  const paddingInferior = usePaddingInferior(espacio.xxxl)
  const puedeVer = tienePermiso(perfil, 'reportes')
  const [cierres, setCierres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!puedeVer) return

      const { data, error } = await supabase
        .from('cierres_caja')
        .select('*, cerrado_por_user:users!cerrado_por(nombre)')
        .order('fecha', { ascending: false })

      if (!error && data) {
        setCierres(data)
      }
      setLoading(false)
    }
    load()
  }, [perfil])

  if (!puedeVer) {
    return <Redirect href="/caja" />
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado paleta={paleta} onVolver={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />
      <FlatList
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.m, flexGrow: 1 }}
        data={cierres}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => {
          const diff = item.diferencia || 0
          const isFaltante = diff < 0
          const hasDiff = Math.abs(diff) > 0.01

          return (
            <Tarjeta estilo={{ marginBottom: espacio.m }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.m }}>
                <Text style={[tipografia.h3, { color: paleta.texto }]}>{item.fecha}</Text>
                <Badge texto={item.estado.toUpperCase()} tipo={item.estado === 'abierta' ? 'exito' : 'neutro'} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View>
                  <Text style={[tipografia.caption, { color: paleta.texto3, marginBottom: espacio.xs }]}>Total General</Text>
                  <Text style={[tipografia.h2, tabular, { color: paleta.texto }]}>{pesos(item.total_general || 0)}</Text>
                </View>

                {item.estado === 'cerrada' && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[tipografia.caption, { color: paleta.texto3, marginBottom: espacio.xs }]}>Diferencia</Text>
                    <Text
                      style={[
                        tipografia.cuerpoLg,
                        tabular,
                        { color: hasDiff ? (isFaltante ? paleta.peligroTexto : paleta.exitoTexto) : paleta.texto2 },
                      ]}
                    >
                      {diff > 0 ? '+' : ''}{pesos(diff)}{hasDiff ? (isFaltante ? ' (falta)' : ' (sobra)') : ''}
                    </Text>
                  </View>
                )}
              </View>

              {item.estado === 'cerrada' && hasDiff && item.diferencia_nota && (
                <Text
                  style={[
                    tipografia.caption,
                    {
                      color: paleta.texto2,
                      fontStyle: 'italic',
                      marginTop: espacio.m,
                      backgroundColor: paleta.superficie2,
                      padding: espacio.s,
                      borderRadius: radio.sm,
                    },
                  ]}
                >
                  Nota: {item.diferencia_nota}
                </Text>
              )}

              {(Number(item.base_inicial) > 0 || Number(item.gastos_caja) > 0) && (
                <Text style={[tipografia.caption, tabular, { color: paleta.texto3, marginTop: espacio.s }]}>
                  Base {pesos(Number(item.base_inicial) || 0)} · Gastos del cajón {pesos(Number(item.gastos_caja) || 0)}
                </Text>
              )}

              {item.estado === 'cerrada' && (
                <Text style={[tipografia.caption, { color: paleta.texto3, marginTop: espacio.s }]}>
                  Cerró: {item.cerrado_por_user?.nombre ?? 'Automático'}
                </Text>
              )}
            </Tarjeta>
          )
        }}
        ListEmptyComponent={<EstadoVacio icono={<Clock />} titulo="No hay registros de caja" />}
      />
    </View>
  )
}
