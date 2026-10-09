import { useState, useEffect } from 'react'
import { View, Text, ActivityIndicator, ScrollView, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft, Check } from 'lucide-react-native'
import { obtenerArqueoCaja, cerrarCaja, type ArqueoCaja } from '../../../lib/caja'
import { dispararReporteCorreo, obtenerReporteDiario, construirLinkWhatsapp } from '../../../lib/reporteDiario'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, tabular, tipografia } from '../../../lib/theme'
import { Boton, CampoTexto, OverlayExito, Presionable, Tarjeta, useToast } from '../../../components/ui'

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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Cerrar Caja</Text>
    </View>
  )
}

function FilaArqueo({ paleta, etiqueta, valor }: { paleta: Paleta; etiqueta: string; valor: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[tipografia.caption, { color: paleta.texto2 }]}>{etiqueta}</Text>
      <Text style={[tipografia.caption, tabular, { color: paleta.texto2 }]}>{valor}</Text>
    </View>
  )
}

export default function CierreCaja() {
  const router = useRouter()
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const paddingInferior = usePaddingInferior(espacio.xxxl)
  const [arqueo, setArqueo] = useState<ArqueoCaja | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [efectivoContado, setEfectivoContado] = useState('')
  const [nota, setNota] = useState('')

  const [cerrada, setCerrada] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [waLink, setWaLink] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setArqueo(await obtenerArqueoCaja())
      } catch (e: any) {
        mostrar(e.message, 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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

  // Base + efectivo de ventas − gastos pagados del cajón (misma fórmula que cerrar_caja).
  const esperado = arqueo?.efectivo_esperado ?? 0
  const contadoNum = parseFloat(efectivoContado) || 0
  const diferencia = contadoNum - esperado
  const hasDiferencia = Math.abs(diferencia) > 0.01
  const esSobrante = diferencia > 0

  async function handleCerrar() {
    if (hasDiferencia && !nota.trim()) {
      mostrar('Como hay diferencia, debes ingresar una justificación.', 'error')
      return
    }

    setGuardando(true)
    try {
      // La diferencia la recalcula el servidor con los totales al momento del cierre.
      await cerrarCaja({
        efectivo_contado: contadoNum,
        nota: hasDiferencia ? nota.trim() : null
      })

      const ahora = new Date()
      const fechaISO = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`

      // Disparo del correo automático (fire-and-forget; no bloquea el cierre)
      dispararReporteCorreo(fechaISO).catch((e) => console.warn('Reporte por correo no disparado:', e))

      // WhatsApp asistido: arma el link con el mensaje del día
      let link: string | null = null
      try {
        const rep = await obtenerReporteDiario(fechaISO)
        link = construirLinkWhatsapp(null, rep.mensaje)
      } catch (e) {
        console.warn('No se pudo armar el WhatsApp:', e)
      }

      setWaLink(link)
      setCerrada(true)
      setOverlayVisible(true)
    } catch (e: any) {
      mostrar(e.message, 'error')
      setGuardando(false)
    }
  }

  if (cerrada) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado paleta={paleta} onVolver={() => router.replace('/caja')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacio.xl, gap: espacio.l }}>
          <Check size={64} color={paleta.exito} strokeWidth={2.5} />
          <Text style={[tipografia.h1, { color: paleta.texto, textAlign: 'center' }]}>Caja cerrada</Text>
          <Text style={[tipografia.cuerpo, { color: paleta.texto2, textAlign: 'center' }]}>
            La caja se cerró exitosamente.
          </Text>
          <View style={{ alignSelf: 'stretch', gap: espacio.s }}>
            {waLink ? (
              <Boton
                titulo="Enviar por WhatsApp"
                onPress={() => { Linking.openURL(waLink!); router.replace('/caja') }}
              />
            ) : null}
            <Boton
              titulo="Listo"
              variante={waLink ? 'fantasma' : 'primario'}
              onPress={() => router.replace('/caja')}
            />
          </View>
        </View>
        <OverlayExito visible={overlayVisible} mensaje="Caja cerrada" onFin={() => setOverlayVisible(false)} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Tarjeta estilo={{ alignItems: 'center' }}>
          <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Efectivo Esperado (Sistema)</Text>
          <Text style={[tipografia.display, tabular, { color: paleta.texto, marginTop: espacio.s }]}>
            {pesos(esperado)}
          </Text>
          {arqueo && (
            <View style={{ alignSelf: 'stretch', marginTop: espacio.m, gap: espacio.xs }}>
              <FilaArqueo paleta={paleta} etiqueta="Base inicial" valor={pesos(arqueo.base_inicial)} />
              <FilaArqueo paleta={paleta} etiqueta="Ventas en efectivo" valor={`+ ${pesos(arqueo.efectivo_ventas)}`} />
              <FilaArqueo paleta={paleta} etiqueta="Gastos pagados del cajón" valor={`− ${pesos(arqueo.gastos_caja)}`} />
            </View>
          )}
        </Tarjeta>

        <CampoTexto
          etiqueta="¿Cuánto efectivo hay en gaveta?"
          gigante
          keyboardType="number-pad"
          placeholder="0"
          value={efectivoContado}
          onChangeText={setEfectivoContado}
        />

        <Tarjeta
          estilo={{
            alignItems: 'center',
            backgroundColor: hasDiferencia ? (esSobrante ? paleta.exitoSoft : paleta.peligroSoft) : paleta.superficie2,
          }}
        >
          <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Diferencia</Text>
          <Text
            style={[
              tipografia.h1,
              tabular,
              { color: hasDiferencia ? (esSobrante ? paleta.exitoTexto : paleta.peligroTexto) : paleta.texto2, marginTop: espacio.xs },
            ]}
          >
            {esSobrante ? '+' : ''}{pesos(diferencia)}
          </Text>
          <Text style={[tipografia.caption, { color: paleta.texto3, marginTop: espacio.xs }]}>
            {hasDiferencia ? (esSobrante ? 'Sobra' : 'Falta') : 'Cuadra exacto'}
          </Text>
        </Tarjeta>

        {hasDiferencia && (
          <CampoTexto
            etiqueta="Justificación de Diferencia *"
            placeholder="Explica por qué sobra o falta dinero..."
            multiline
            value={nota}
            onChangeText={setNota}
          />
        )}

        <Boton titulo="Confirmar Cierre" onPress={handleCerrar} cargando={guardando} deshabilitado={guardando} />
      </ScrollView>
    </View>
  )
}
