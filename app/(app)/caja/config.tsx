import { useEffect, useState } from 'react'
import { View, Text, Switch, ActivityIndicator, ScrollView } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { ArrowLeft, History } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { supabase } from '../../../lib/supabase'
import { DIAS_SEMANA, type DiaSemana, type HorarioSemanal } from '../../../lib/cajaScheduler'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, tipografia } from '../../../lib/theme'
import { Boton, CampoTexto, CirculoIcono, ControlSegmentado, FilaLista, Presionable, Tarjeta, useToast } from '../../../components/ui'

const ETIQUETA_DIA: Record<DiaSemana, string> = {
  domingo: 'Domingo', lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado',
}

const ORDEN_DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

type ModoCierre = 'con_diferencia' | 'sin_diferencia'

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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Caja</Text>
    </View>
  )
}

const validHora = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

export default function CajaConfig() {
  const { perfil } = useAuth()
  const router = useRouter()
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const paddingInferior = usePaddingInferior(espacio.xxxl)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [auto, setAuto] = useState(false)
  const [horario, setHorario] = useState<HorarioSemanal>({})
  const [modoCierre, setModoCierre] = useState<ModoCierre>('con_diferencia')
  const [basePredeterminada, setBasePredeterminada] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('caja_config').select('*').limit(1).single()
      if (data) {
        setAuto(data.modo_automatico)
        setHorario((data.horario_semanal ?? {}) as HorarioSemanal)
        setModoCierre((data.modo_cierre ?? 'con_diferencia') as ModoCierre)
        setBasePredeterminada(data.base_predeterminada ? String(data.base_predeterminada) : '')
      }
      setCargando(false)
    }
    if (perfil?.rol === 'dueno') load()
  }, [perfil])

  if (perfil?.rol !== 'dueno') return <Redirect href="/" />

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

  function actualizarDia(dia: DiaSemana, campo: 'apertura' | 'cierre', valor: string) {
    setHorario((prev) => ({ ...prev, [dia]: { ...(prev[dia] ?? { apertura: '', cierre: '' }), [campo]: valor } }))
  }

  async function guardar() {
    if (auto) {
      for (const dia of DIAS_SEMANA) {
        const h = horario[dia]
        if (!h?.apertura || !h?.cierre) continue // día sin horario = la tienda no automatiza ese día
        if (!validHora(h.apertura) || !validHora(h.cierre)) {
          mostrar(`Usa el formato HH:MM para ${ETIQUETA_DIA[dia]} (ej. 06:00 y 23:00).`, 'error')
          return
        }
        if (h.cierre <= h.apertura) {
          mostrar(`En ${ETIQUETA_DIA[dia]}, la hora de cierre debe ser posterior a la de apertura.`, 'error')
          return
        }
      }
    }
    setGuardando(true)
    const { error } = await supabase.from('caja_config').update({
      modo_automatico: auto,
      horario_semanal: horario as unknown as Record<string, never>,
      modo_cierre: modoCierre,
      base_predeterminada: basePredeterminada.trim() === '' ? 0 : Number(basePredeterminada),
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
        <Text style={[tipografia.h3, { color: paleta.texto }]}>Horario automático</Text>

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
            <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
              El cierre automático calcula los totales del sistema y envía el reporte por correo. No cuenta el efectivo físico.
              Deja un día sin horario si esa tienda no abre ese día.
            </Text>
            {ORDEN_DIAS.map((dia) => (
              <Tarjeta key={dia}>
                <Text style={[tipografia.etiqueta, { color: paleta.texto, marginBottom: espacio.s }]}>
                  {ETIQUETA_DIA[dia]}
                </Text>
                <View style={{ flexDirection: 'row', gap: espacio.m }}>
                  <View style={{ flex: 1 }}>
                    <CampoTexto
                      etiqueta="Apertura"
                      placeholder="06:00"
                      value={horario[dia]?.apertura ?? ''}
                      onChangeText={(v) => actualizarDia(dia, 'apertura', v)}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <CampoTexto
                      etiqueta="Cierre"
                      placeholder="23:00"
                      value={horario[dia]?.cierre ?? ''}
                      onChangeText={(v) => actualizarDia(dia, 'cierre', v)}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
              </Tarjeta>
            ))}
          </>
        )}

        <Text style={[tipografia.h3, { color: paleta.texto, marginTop: espacio.m }]}>Base de caja</Text>
        <CampoTexto
          etiqueta="Base predeterminada (sencillo con que abre el cajón)"
          keyboardType="number-pad"
          placeholder="0"
          value={basePredeterminada}
          onChangeText={(v) => setBasePredeterminada(v.replace(/[^0-9]/g, ''))}
        />
        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
          Se propone al abrir la caja (se puede cambiar ese día) y la usa la apertura automática. Se suma al efectivo
          esperado del cierre.
        </Text>

        <Text style={[tipografia.h3, { color: paleta.texto, marginTop: espacio.m }]}>Modo de cierre</Text>
        <ControlSegmentado
          opciones={['Con diferencia', 'Sin diferencia']}
          indice={modoCierre === 'sin_diferencia' ? 1 : 0}
          onCambio={(i) => setModoCierre(i === 1 ? 'sin_diferencia' : 'con_diferencia')}
        />
        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
          {modoCierre === 'sin_diferencia'
            ? 'Al cerrar caja desde el menú solo se confirma; el sistema calcula el efectivo esperado, sin contar caja.'
            : 'Al cerrar caja desde el menú se pide el efectivo contado y, si hay diferencia, una justificación.'}
        </Text>

        <Tarjeta estilo={{ paddingVertical: espacio.xs, marginTop: espacio.m }}>
          <FilaLista
            icono={
              <CirculoIcono tono="primario">
                <History />
              </CirculoIcono>
            }
            titulo="Historial de cierres"
            subtitulo="Ver cierres anteriores"
            chevron
            onPress={() => router.push('/caja/historial')}
          />
        </Tarjeta>

        <Boton titulo="Guardar" onPress={guardar} cargando={guardando} deshabilitado={guardando} />
      </ScrollView>
    </View>
  )
}
