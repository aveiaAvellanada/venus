import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { View, Text, ActivityIndicator, ScrollView, RefreshControl } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useRequireModulo } from '../../../lib/auth'
import { obtenerCajaHoy, abrirCaja, reabrirCaja } from '../../../lib/caja'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, tipografia } from '../../../lib/theme'
import { Badge, Boton, Presionable, TarjetaMetrica, useToast } from '../../../components/ui'

const pesos = (n: number) => '$' + n.toLocaleString('es-CO')

// Encabezado a nivel de módulo: no se remonta en cada render (Regla 2).
function Encabezado({ paleta, onVolver, derecha }: { paleta: Paleta; onVolver: () => void; derecha?: ReactNode }) {
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
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const paddingInferior = usePaddingInferior(espacio.xxxl)

  const [estadoCaja, setEstadoCaja] = useState<any>(null)
  const [resumen, setResumen] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [abriendo, setAbriendo] = useState(false)

  const cargarDatos = useCallback(async () => {
    try {
      const caja = await obtenerCajaHoy()
      setEstadoCaja(caja)
      if (caja && caja.estado === 'cerrada') {
        setResumen({
          total_general: caja.total_general,
          total_ventas: caja.total_ventas,
          total_efectivo: caja.total_efectivo,
          total_nequi: caja.total_nequi,
          total_bre_b: caja.total_bre_b,
          total_otro: caja.total_otro,
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

  // Ya no hay dashboard para la caja abierta: el ícono de Caja en el menú
  // navega directo a /caja/cierre o muestra el modal de confirmación
  // "sin diferencia" — si de todas formas se llega aquí con la caja
  // abierta (deep link, back del navegador), se redirige al cierre.
  if (estadoCaja?.estado === 'abierta') {
    return <Redirect href="/caja/cierre" />
  }

  async function handleAbrir() {
    setAbriendo(true)
    try {
      await abrirCaja()
      await cargarDatos()
    } catch (e) {
      mostrar(e instanceof Error ? e.message : 'No se pudo actualizar la caja.', 'error')
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
      mostrar(e instanceof Error ? e.message : 'No se pudo actualizar la caja.', 'error')
    } finally {
      setAbriendo(false)
    }
  }

  if (!estadoCaja) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado paleta={paleta} onVolver={() => router.back()} />
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

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos()
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.xl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={paleta.primario} />}
      >
        <View style={{ alignItems: 'center', gap: espacio.m }}>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Resumen Final de Caja</Text>
          <Badge texto="CERRADA" tipo="peligro" />
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

        <Boton titulo="Abrir caja de nuevo" onPress={handleReabrir} cargando={abriendo} deshabilitado={abriendo} />
      </ScrollView>
    </View>
  )
}
