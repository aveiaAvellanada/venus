import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { obtenerResumenEnVivo, cerrarCaja } from '../../../lib/caja'

const pesos = (n: number) => '$' + n.toLocaleString('es-CO')

export default function CierreCaja() {
  const router = useRouter()
  const [resumen, setResumen] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  
  const [efectivoContado, setEfectivoContado] = useState('')
  const [nota, setNota] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await obtenerResumenEnVivo()
        setResumen(res)
      } catch (e: any) {
        Alert.alert('Error', e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <View style={[styles.container, styles.centro]}>
        <ActivityIndicator size="large" color="#1E66F5" />
      </View>
    )
  }

  const esperado = resumen?.total_efectivo || 0
  const contadoNum = parseFloat(efectivoContado) || 0
  const diferencia = contadoNum - esperado
  const hasDiferencia = Math.abs(diferencia) > 0.01

  async function handleCerrar() {
    if (hasDiferencia && !nota.trim()) {
      Alert.alert('Nota requerida', 'Como hay diferencia, debes ingresar una justificación.')
      return
    }

    setGuardando(true)
    try {
      await cerrarCaja({
        efectivo_contado: contadoNum,
        diferencia,
        nota: hasDiferencia ? nota.trim() : null
      })
      Alert.alert('Caja Cerrada', 'La caja se cerró exitosamente.', [
        { text: 'OK', onPress: () => router.replace('/caja') }
      ])
    } catch (e: any) {
      Alert.alert('Error al cerrar caja', e.message)
      setGuardando(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.titulo}>Calculadora de Cierre</Text>

      <View style={styles.resumenBox}>
        <Text style={styles.label}>Efectivo Esperado (Sistema)</Text>
        <Text style={styles.valorEsperado}>{pesos(esperado)}</Text>
      </View>

      <Text style={styles.labelInput}>¿Cuánto efectivo hay en gaveta?</Text>
      <TextInput
        style={styles.inputGigante}
        keyboardType="numeric"
        placeholder="0"
        value={efectivoContado}
        onChangeText={setEfectivoContado}
      />

      <View style={[styles.diferenciaBox, hasDiferencia ? (diferencia > 0 ? styles.bgSobrante : styles.bgFaltante) : styles.bgCuadre]}>
        <Text style={styles.labelDiferencia}>Diferencia</Text>
        <Text style={[styles.valorDiferencia, hasDiferencia ? (diferencia > 0 ? styles.textVerde : styles.textRojo) : styles.textGris]}>
          {diferencia > 0 ? '+' : ''}{pesos(diferencia)}
        </Text>
      </View>

      {hasDiferencia && (
        <View style={styles.notaBox}>
          <Text style={styles.labelInput}>Justificación de Diferencia *</Text>
          <TextInput
            style={[styles.input, styles.inputArea]}
            placeholder="Explica por qué sobra o falta dinero..."
            multiline
            numberOfLines={3}
            value={nota}
            onChangeText={setNota}
          />
        </View>
      )}

      <Pressable style={[styles.btnCerrar, guardando && styles.btnDisabled]} onPress={handleCerrar} disabled={guardando}>
        {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirmar Cierre</Text>}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centro: { justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 24, gap: 24 },
  titulo: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  resumenBox: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  label: { fontSize: 16, color: '#64748B', fontWeight: '600' },
  valorEsperado: { fontSize: 32, fontWeight: '800', color: '#0F172A', marginTop: 8 },
  labelInput: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 8 },
  inputGigante: { fontSize: 40, fontWeight: '700', textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#CBD5E1', paddingVertical: 12, color: '#1E66F5' },
  diferenciaBox: { padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  bgCuadre: { backgroundColor: '#F1F5F9' },
  bgFaltante: { backgroundColor: '#FEF2F2' },
  bgSobrante: { backgroundColor: '#F0FDF4' },
  labelDiferencia: { fontSize: 16, fontWeight: '600', color: '#64748B' },
  valorDiferencia: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  textGris: { color: '#64748B' },
  textRojo: { color: '#DC2626' },
  textVerde: { color: '#16A34A' },
  notaBox: { marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#CBD5E1', padding: 16, borderRadius: 12, fontSize: 16, backgroundColor: '#fff' },
  inputArea: { height: 100, textAlignVertical: 'top' },
  btnCerrar: { backgroundColor: '#1E66F5', paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
})
