import React, { useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { guardarGastoFijo } from '../../../lib/gastos'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, tipografia } from '../../../lib/theme'
import { Boton, CampoTexto, Presionable, useToast } from '../../../components/ui'

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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Registrar Nuevo Contrato</Text>
    </View>
  )
}

export default function GastosFijosEditorScreen() {
  const router = useRouter()
  const { paleta } = useTema()
  const { mostrar } = useToast()

  const [nombre, setNombre] = useState('')
  const [montoAproximado, setMontoAproximado] = useState('')
  const [diaPago, setDiaPago] = useState('')
  const [beneficiario, setBeneficiario] = useState('')
  const [notas, setNotas] = useState('')

  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!nombre || !montoAproximado || !diaPago) {
      mostrar('Por favor llena los campos obligatorios: Nombre, Monto y Día de Pago', 'error')
      return
    }

    const dia = parseInt(diaPago, 10)
    if (isNaN(dia) || dia < 1 || dia > 31) {
      mostrar('El día de pago debe ser entre 1 y 31', 'error')
      return
    }

    setSaving(true)
    try {
      await guardarGastoFijo({
        nombre,
        monto_aproximado: parseFloat(montoAproximado),
        dia_pago: dia,
        beneficiario: beneficiario || null,
        notas: notas || null,
        activo: true,
      })

      mostrar('Contrato de gasto fijo guardado')
      router.back()
    } catch (error: any) {
      mostrar(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: paleta.fondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Encabezado paleta={paleta} onVolver={() => router.back()} />

      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: espacio.xxxl, gap: espacio.l }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Ej: Arriendo, Luz, Internet</Text>

        <CampoTexto
          etiqueta="Nombre del Gasto *"
          value={nombre}
          onChangeText={setNombre}
          placeholder="Ej: Arriendo Local"
        />

        <CampoTexto
          etiqueta="Monto Aproximado *"
          value={montoAproximado}
          onChangeText={setMontoAproximado}
          placeholder="1500000"
          keyboardType="number-pad"
        />

        <CampoTexto
          etiqueta="Día de Pago (1-31) *"
          value={diaPago}
          onChangeText={setDiaPago}
          placeholder="5"
          keyboardType="number-pad"
          maxLength={2}
        />

        <CampoTexto
          etiqueta="Beneficiario (Opcional)"
          value={beneficiario}
          onChangeText={setBeneficiario}
          placeholder="Ej: Inmobiliaria XYZ"
        />

        <CampoTexto
          etiqueta="Notas adicionales (Opcional)"
          value={notas}
          onChangeText={setNotas}
          placeholder="Alguna nota sobre el pago"
          multiline
          numberOfLines={3}
        />

        <Boton titulo="Guardar Contrato" onPress={handleSave} cargando={saving} deshabilitado={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
