import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { View, Text, ActivityIndicator, ScrollView, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft, History, Settings } from 'lucide-react-native'
import { useAuth, useRequireModulo } from '../../../lib/auth'
import { obtenerCajaHoy, abrirCaja, reabrirCaja, obtenerResumenEnVivo } from '../../../lib/caja'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, tipografia } from '../../../lib/theme'
import { Badge, Boton, Presionable, TarjetaMetrica } from '../../../components/ui'

const pesos = (n: number) => '$' + n.toLocaleString('es-CO')

// Encabezado a nivel de módulo: no se remonta en cada render (Regla 2).
function Encabezado({
  paleta,
  onVolver,
  derecha,
}: {
  paleta: Paleta
  onVolver: () => void
  derecha?: ReactNode
}) {
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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Caja del Día</Text>
      {derecha}
    </View>
  )
}

export default function CajaDashboard() {
  const redir = useRequireModulo('caja')
  const router = useRouter()
  const { perfil } = useAuth()
  const { paleta } = useTema()

  const [estadoCaja, setEstadoCaja] = useState<any>(null)
  const [resumen, setResumen] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [abriendo, setAbriendo] = useState(false)

  const cargarDatos = useCallback(async () => {
    try {
      const caja = await obtenerCajaHoy()
      setEstadoCaja(caja)
      if (caja && caja.estado === 'abierta') {
        const res = await obtenerResumenEnVivo()
        setResumen(res)
      } else if (caja && caja.estado === 'cerrada') {
        setResumen({
          total_general: caja.total_general,
          total_ventas: caja.total_ventas,
          total_efectivo: caja.total_efectivo,
          total_nequi: caja.total_nequi,
          total_bre_b: caja.total_bre_b,
          total_otro: caja.total_otro
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  if (redir) return redir

  const esDuenoAdmin = perfil?.rol === 'dueno' || perfil?.rol === 'admin'
  const derecha = esDuenoAdmin ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.l }}>
      {perfil?.rol === 'dueno' && (
        <Presionable accessibilityRole="button" accessibilityLabel="Configurar caja" onPress={() => router.push('/caja/config')} hitSlop={10}>
          <Settings size={22} color={paleta.primario} />
        </Presionable>
      )}
      <Presionable accessibilityRole="button" accessibilityLabel="Ver historial de cierres" onPress={() => router.push('/caja/historial')} hitSlop={10}>
        <History size={22} color={paleta.primario} />
      </Presionable>
    </View>
  ) : undefined

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado paleta={paleta} onVolver={() => router.back()} derecha={derecha} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      </View>
    )
  }

  async function handleAbrir() {
    setAbriendo(true)
    try {
      await abrirCaja()
      await cargarDatos()
    } catch (e) {
      console.error(e)
    } finally {
      setAbriendo(false)
    }
  }

  async function handleReabrir() {
    setAbriendo(true)
    try {
      await reabrirCaja()
      await cargarDatos()
    } catch (e) {
      console.error(e)
    } finally {
      setAbriendo(false)
    }
  }

  if (!estadoCaja) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado paleta={paleta} onVolver={() => router.back()} derecha={derecha} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: espacio.xl, gap: espacio.xl }}>
          <Text style={[tipografia.h1, { color: paleta.texto, textAlign: 'center' }]}>Caja del Día</Text>
          <Text style={[tipografia.cuerpo, { color: paleta.texto2, textAlign: 'center' }]}>
            Aún no se ha abierto la caja para hoy.
          </Text>
          <View style={{ alignSelf: 'stretch' }}>
            <Boton titulo="Abrir Caja del Día" onPress={handleAbrir} cargando={abriendo} deshabilitado={abriendo} />
          </View>
        </View>
      </View>
    )
  }

  const isAbierto = estadoCaja.estado === 'abierta'

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos()
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} derecha={derecha} />
      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: espacio.xxxl, gap: espacio.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={paleta.primario} />}
      >
        <View style={{ alignItems: 'center', gap: espacio.m }}>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>
            {isAbierto ? 'Dashboard de Caja' : 'Resumen Final de Caja'}
          </Text>
          <Badge texto={isAbierto ? 'ABIERTA' : 'CERRADA'} tipo={isAbierto ? 'exito' : 'peligro'} punto={isAbierto} />
        </View>

        {resumen && (
          <View style={{ gap: espacio.m }}>
            <TarjetaMetrica
              etiqueta="Total General"
              valor={pesos(resumen.total_general)}
              sub={`${resumen.total_ventas} ventas en total`}
            />
            <View style={{ flexDirection: 'row', gap: espacio.m, flexWrap: 'wrap' }}>
              <TarjetaMetrica mini etiqueta="Efectivo" valor={pesos(resumen.total_efectivo)} />
              <TarjetaMetrica mini etiqueta="Nequi" valor={pesos(resumen.total_nequi)} />
              <TarjetaMetrica mini etiqueta="Bre-B" valor={pesos(resumen.total_bre_b)} />
              <TarjetaMetrica mini etiqueta="Otro" valor={pesos(resumen.total_otro)} />
            </View>
          </View>
        )}

        {isAbierto ? (
          <Boton titulo="Ir a Cerrar Caja" variante="peligro" onPress={() => router.push('/caja/cierre')} />
        ) : (
          <Boton titulo="Abrir caja de nuevo" onPress={handleReabrir} cargando={abriendo} deshabilitado={abriendo} />
        )}
      </ScrollView>
    </View>
  )
}
