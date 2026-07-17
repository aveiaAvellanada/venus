import React, { useState, useCallback } from 'react'
import { View, Text, Switch, ActivityIndicator } from 'react-native'
import { useFocusEffect, useRouter, Redirect } from 'expo-router'
import { ArrowLeft, Info } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { obtenerReporteConfig, guardarReporteConfig } from '../../../lib/reporteDiario'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, tipografia } from '../../../lib/theme'
import { Boton, CampoTexto, Presionable, Tarjeta, useToast } from '../../../components/ui'

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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Reportes automáticos</Text>
    </View>
  )
}

export default function ReportesConfig() {
  const { perfil } = useAuth()
  const router = useRouter()
  const { paleta } = useTema()
  const { mostrar } = useToast()

  const [whatsappOn, setWhatsappOn] = useState(true)
  const [correoOn, setCorreoOn] = useState(false)
  const [correoDestino, setCorreoDestino] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const cfg = await obtenerReporteConfig()
      if (cfg) {
        setWhatsappOn(cfg.whatsapp_on)
        setCorreoOn(cfg.correo_on)
        setCorreoDestino(cfg.correo_destino ?? '')
      }
    } catch (e) {
      console.warn('No se pudo cargar la configuración:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (perfil?.rol === 'dueno') cargar()
    }, [cargar, perfil])
  )

  // Gate: solo el dueño
  if (perfil && perfil.rol !== 'dueno') return <Redirect href="/reportes" />

  const guardar = async () => {
    if (correoOn && !correoDestino.includes('@')) {
      mostrar('Ingresa un correo válido para el envío automático.', 'error')
      return
    }
    setSaving(true)
    try {
      await guardarReporteConfig({
        whatsapp_on: whatsappOn,
        correo_on: correoOn,
        correo_destino: correoDestino.trim() || null,
      })
      mostrar('La configuración se actualizó.')
    } catch (e: unknown) {
      mostrar('No se pudo guardar. Intenta de nuevo.', 'error')
      console.warn('Error al guardar config:', e)
    } finally {
      setSaving(false)
    }
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

      <View style={{ padding: espacio.xl, gap: espacio.l }}>
        <Tarjeta>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: espacio.m }}>
              <Text style={[tipografia.h3, { color: paleta.texto }]}>WhatsApp</Text>
              <Text style={[tipografia.caption, { color: paleta.texto3, marginTop: 2 }]}>
                Mostrar el resumen para enviar al cerrar la caja.
              </Text>
            </View>
            <Switch
              testID="sw-whatsapp"
              value={whatsappOn}
              onValueChange={setWhatsappOn}
              trackColor={{ false: paleta.borde, true: paleta.primarioSoft }}
              thumbColor={whatsappOn ? paleta.primario : paleta.superficie2}
            />
          </View>

          <View style={{ height: 1, backgroundColor: paleta.borde, marginVertical: espacio.m }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: espacio.m }}>
              <Text style={[tipografia.h3, { color: paleta.texto }]}>Correo automático</Text>
              <Text style={[tipografia.caption, { color: paleta.texto3, marginTop: 2 }]}>
                Enviar el resumen por correo al cerrar la caja.
              </Text>
            </View>
            <Switch
              testID="sw-correo"
              value={correoOn}
              onValueChange={setCorreoOn}
              trackColor={{ false: paleta.borde, true: paleta.primarioSoft }}
              thumbColor={correoOn ? paleta.primario : paleta.superficie2}
            />
          </View>

          {correoOn && (
            <View style={{ marginTop: espacio.m }}>
              <CampoTexto
                testID="input-correo"
                value={correoDestino}
                onChangeText={setCorreoDestino}
                placeholder="correo@ejemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}
        </Tarjeta>

        <View style={{ flexDirection: 'row', gap: espacio.s, alignItems: 'flex-start', paddingHorizontal: espacio.xs }}>
          <Info size={16} color={paleta.texto3} />
          <Text style={[tipografia.caption, { color: paleta.texto3, flex: 1 }]}>
            El correo automático requiere configurar la clave del proveedor de envío en el servidor.
          </Text>
        </View>

        <Boton titulo="Guardar" cargando={saving} onPress={guardar} />
      </View>
    </View>
  )
}
