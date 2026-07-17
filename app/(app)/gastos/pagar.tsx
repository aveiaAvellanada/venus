import React, { useState } from 'react'
import { View, Text, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { ArrowLeft, Camera } from 'lucide-react-native'
import { registrarPagoFijo } from '../../../lib/gastos'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, radio, tipografia } from '../../../lib/theme'
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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Pagar Gasto Fijo</Text>
    </View>
  )
}

export default function PagarGastoFijoScreen() {
  const router = useRouter()
  const { id, nombre, monto } = useLocalSearchParams()
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const paddingInferior = usePaddingInferior(espacio.xxxl)

  const [montoPagado, setMontoPagado] = useState(monto ? String(monto) : '')
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
    if (!montoPagado) {
      mostrar('Por favor ingresa el monto pagado', 'error')
      return
    }

    setSaving(true)
    try {
      const now = new Date()
      // Periodo: ej. '2026-06'
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      await registrarPagoFijo(
        {
          gasto_fijo_id: id as string,
          monto_pagado: parseFloat(montoPagado),
          fecha_pago: now.toISOString(),
          periodo: periodo,
        },
        fotoUri || undefined
      )

      mostrar('Pago registrado correctamente')
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
        <Tarjeta estilo={{ backgroundColor: paleta.primarioSoft, borderColor: paleta.primario }}>
          <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Registrando pago para:</Text>
          <Text style={[tipografia.h2, { color: paleta.primario, marginTop: 4 }]}>{nombre}</Text>
        </Tarjeta>

        <CampoTexto
          etiqueta="Monto exacto pagado *"
          value={montoPagado}
          onChangeText={setMontoPagado}
          placeholder="0.00"
          keyboardType="number-pad"
        />

        <View>
          <Text style={[tipografia.etiqueta, { color: paleta.texto2, marginBottom: espacio.s }]}>
            Foto del Recibo (Opcional pero recomendado)
          </Text>
          <Presionable
            accessibilityRole="button"
            accessibilityLabel={fotoUri ? 'Cambiar foto del recibo' : 'Tomar foto del recibo'}
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
          {fotoUri && (
            <Image
              source={{ uri: fotoUri }}
              style={{ width: '100%', height: 200, borderRadius: radio.sm, marginTop: espacio.m }}
            />
          )}
        </View>

        <Boton titulo="Guardar Pago" onPress={handleSave} cargando={saving} deshabilitado={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
