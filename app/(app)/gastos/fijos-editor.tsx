import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { guardarGastoFijo } from '../../../lib/gastos';

export default function GastosFijosEditorScreen() {
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [montoAproximado, setMontoAproximado] = useState('');
  const [diaPago, setDiaPago] = useState('');
  const [beneficiario, setBeneficiario] = useState('');
  const [notas, setNotas] = useState('');
  
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nombre || !montoAproximado || !diaPago) {
      Alert.alert('Error', 'Por favor llena los campos obligatorios: Nombre, Monto y Día de Pago');
      return;
    }

    const dia = parseInt(diaPago, 10);
    if (isNaN(dia) || dia < 1 || dia > 31) {
      Alert.alert('Error', 'El día de pago debe ser entre 1 y 31');
      return;
    }

    setSaving(true);
    try {
      await guardarGastoFijo({
        nombre,
        monto_aproximado: parseFloat(montoAproximado),
        dia_pago: dia,
        beneficiario: beneficiario || null,
        notas: notas || null,
        activo: true,
      });
      
      Alert.alert('Éxito', 'Contrato de gasto fijo guardado', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Registrar Nuevo Contrato</Text>
        <Text style={styles.headerSubtitle}>Ej: Arriendo, Luz, Internet</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Nombre del Gasto *</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Ej: Arriendo Local"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Monto Aproximado *</Text>
          <TextInput
            style={styles.input}
            value={montoAproximado}
            onChangeText={setMontoAproximado}
            placeholder="1500000"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Día de Pago (1-31) *</Text>
          <TextInput
            style={styles.input}
            value={diaPago}
            onChangeText={setDiaPago}
            placeholder="5"
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Beneficiario (Opcional)</Text>
          <TextInput
            style={styles.input}
            value={beneficiario}
            onChangeText={setBeneficiario}
            placeholder="Ej: Inmobiliaria XYZ"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Notas adicionales (Opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notas}
            onChangeText={setNotas}
            placeholder="Alguna nota sobre el pago"
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar Contrato</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginBottom: 30,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#EAEAEE',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#A0CFFF',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
