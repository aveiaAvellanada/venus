import React, { useState } from 'react'
import { View, Text, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { ArrowLeft, Camera } from 'lucide-react-native'
import { guardarGastoFijo } from '../../../lib/gastos'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, radio, tipografia } from '../../../lib/theme'
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
  const paddingInferior = usePaddingInferior(espacio.xxxl)

  const [nombre, setNombre] = useState('')
  const [montoAproximado, setMontoAproximado] = useState('')
  const [diaPago, setDiaPago] = useState('')
  const [beneficiario, setBeneficiario] = useState('')
  const [notas, setNotas] = useState('')
  const [fotoUri, setFotoUri] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    })
    if (!result.canceled) {
      setFotoUri(result.assets[0].uri)
    }
  }

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
      await guardarGastoFijo(
        {
          nombre,
          monto_aproximado: parseFloat(montoAproximado),
          dia_pago: dia,
          beneficiario: beneficiario || null,
          notas: notas || null,
          activo: true,
        },
        fotoUri || undefined
      )

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
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.l }}
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

        <View>
          <Text style={[tipografia.etiqueta, { color: paleta.texto2, marginBottom: espacio.s }]}>
            Foto del Contrato/Recibo (Opcional)
          </Text>
          <Presionable
            accessibilityRole="button"
            accessibilityLabel={fotoUri ? 'Cambiar foto del contrato' : 'Tomar foto del contrato'}
            onPress={pickImage}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: espacio.s,
              backgroundColor: paleta.primarioSoft,
              padding: espacio.l,
              borderRadius: radio.sm,
              borderWidth: 1,
              borderColor: paleta.primario,
              borderStyle: 'dashed',
            }}
          >
            <Camera size={22} color={paleta.primario} />
            <Text style={[tipografia.cuerpoLg, { color: paleta.primario }]}>
              {fotoUri ? 'Cambiar Foto' : 'Tomar Foto'}
            </Text>
          </Presionable>
          {fotoUri ? (
            <Image
              source={{ uri: fotoUri }}
              style={{ width: '100%', height: 200, borderRadius: radio.sm, marginTop: espacio.m }}
            />
          ) : null}
        </View>

        <Boton titulo="Guardar Contrato" onPress={handleSave} cargando={saving} deshabilitado={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
