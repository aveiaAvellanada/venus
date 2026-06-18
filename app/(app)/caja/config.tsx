import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TextInput, Switch, Pressable, ActivityIndicator, Alert } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { useAuth } from '../../../lib/auth'
import { supabase } from '../../../lib/supabase'

export default function CajaConfig() {
  const { perfil } = useAuth()
  const router = useRouter()
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
    return <View style={[styles.container, styles.centro]}><ActivityIndicator size="large" color="#1E66F5" /></View>
  }

  const validHora = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

  async function guardar() {
    if (auto && (!validHora(apertura) || !validHora(cierre))) {
      Alert.alert('Horas inválidas', 'Usa el formato HH:MM (ej. 06:00 y 23:00).'); return
    }
    if (auto && cierre <= apertura) {
      Alert.alert('Horario inválido', 'La hora de cierre debe ser posterior a la de apertura.'); return
    }
    setGuardando(true)
    const { error } = await supabase.from('caja_config').update({
      modo_automatico: auto,
      hora_apertura: auto ? apertura : null,
      hora_cierre: auto ? cierre : null,
    }).not('id', 'is', null)
    setGuardando(false)
    if (error) { Alert.alert('Error', error.message); return }
    Alert.alert('Guardado', 'La configuración de caja se actualizó.', [{ text: 'OK', onPress: () => router.back() }])
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Horario automático de Caja</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Modo automático</Text>
        <Switch value={auto} onValueChange={setAuto} />
      </View>
      {auto && (
        <>
          <Text style={styles.label}>Hora de apertura (HH:MM)</Text>
          <TextInput style={styles.input} placeholder="06:00" value={apertura} onChangeText={setApertura} keyboardType="numbers-and-punctuation" />
          <Text style={styles.label}>Hora de cierre (HH:MM)</Text>
          <TextInput style={styles.input} placeholder="23:00" value={cierre} onChangeText={setCierre} keyboardType="numbers-and-punctuation" />
          <Text style={styles.hint}>El cierre automático calcula los totales del sistema y envía el reporte por correo. No cuenta el efectivo físico.</Text>
        </>
      )}
      <Pressable style={[styles.btn, guardando && { opacity: 0.7 }]} onPress={guardar} disabled={guardando}>
        {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Guardar</Text>}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, gap: 16 },
  centro: { justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '600', color: '#334155' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', padding: 14, borderRadius: 12, fontSize: 18 },
  hint: { fontSize: 13, color: '#64748B' },
  btn: { backgroundColor: '#1E66F5', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
})
