import { useEffect, useState } from 'react'
import { View, Text, Switch, ActivityIndicator, ScrollView } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { supabase } from '../../../lib/supabase'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Configurar Caja</Text>
    </View>
  )
}

export default function CajaConfig() {
  const { perfil } = useAuth()
  const router = useRouter()
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const paddingInferior = usePaddingInferior(espacio.xxxl)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [auto, setAuto] = useState(false)
  const [apertura, setApertura] = useState('')   // 'HH:MM'
  const [cierre, setCierre] = useState('')        // 'HH:MM'

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('caja_config').select('*').limit(1).single()
      if (data) {
        setAuto(data.modo_automatico)
        setApertura((data.hora_apertura ?? '').slice(0, 5))
        setCierre((data.hora_cierre ?? '').slice(0, 5))
      }
      setCargando(false)
    }
    if (perfil?.rol === 'dueno') load()
  }, [perfil])

  if (perfil?.rol !== 'dueno') return <Redirect href="/caja" />

  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado paleta={paleta} onVolver={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      </View>
    )
  }

  const validHora = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

  async function guardar() {
    if (auto && (!validHora(apertura) || !validHora(cierre))) {
      mostrar('Usa el formato HH:MM (ej. 06:00 y 23:00).', 'error')
      return
    }
    if (auto && cierre <= apertura) {
      mostrar('La hora de cierre debe ser posterior a la de apertura.', 'error')
      return
    }
    setGuardando(true)
    const { error } = await supabase.from('caja_config').update({
      modo_automatico: auto,
      hora_apertura: auto ? apertura : null,
      hora_cierre: auto ? cierre : null,
    }).not('id', 'is', null)
    setGuardando(false)
    if (error) { mostrar(error.message, 'error'); return }
    mostrar('La configuración de caja se actualizó.')
    router.back()
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.l }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[tipografia.h3, { color: paleta.texto }]}>Horario automático de Caja</Text>

        <Tarjeta>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>Modo automático</Text>
            <Switch
              value={auto}
              onValueChange={setAuto}
              trackColor={{ false: paleta.borde, true: paleta.primarioSoft }}
              thumbColor={auto ? paleta.primario : paleta.superficie}
            />
          </View>
        </Tarjeta>

        {auto && (
          <>
            <CampoTexto
              etiqueta="Hora de apertura (HH:MM)"
              placeholder="06:00"
              value={apertura}
              onChangeText={setApertura}
              keyboardType="numbers-and-punctuation"
            />
            <CampoTexto
              etiqueta="Hora de cierre (HH:MM)"
              placeholder="23:00"
              value={cierre}
              onChangeText={setCierre}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
              El cierre automático calcula los totales del sistema y envía el reporte por correo. No cuenta el efectivo físico.
            </Text>
          </>
        )}

        <Boton titulo="Guardar" onPress={guardar} cargando={guardando} deshabilitado={guardando} />
      </ScrollView>
    </View>
  )
}
