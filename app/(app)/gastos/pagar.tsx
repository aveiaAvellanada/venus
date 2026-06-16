import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { registrarPagoFijo } from '../../../lib/gastos';

export default function PagarGastoFijoScreen() {
  const router = useRouter();
  const { id, nombre, monto } = useLocalSearchParams();

  const [montoPagado, setMontoPagado] = useState(monto ? String(monto) : '');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    
    if (!result.canceled) {
      setFotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!montoPagado) {
      Alert.alert('Error', 'Por favor ingresa el monto pagado');
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      // Periodo: ej. '2026-06'
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      await registrarPagoFijo({
        gasto_fijo_id: id as string,
        monto_pagado: parseFloat(montoPagado),
        fecha_pago: now.toISOString(),
        periodo: periodo
      }, fotoUri || undefined);
      
      Alert.alert('Éxito', 'Pago registrado correctamente', [
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
        <View style={styles.headerInfo}>
          <Text style={styles.headerSubtitle}>Registrando pago para:</Text>
          <Text style={styles.headerTitle}>{nombre}</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Monto exacto pagado *</Text>
          <TextInput
            style={styles.input}
            value={montoPagado}
            onChangeText={setMontoPagado}
            placeholder="0.00"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Foto del Recibo (Opcional pero recomendado)</Text>
          <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
            <Ionicons name="camera-outline" size={24} color="#007AFF" />
            <Text style={styles.photoButtonText}>
              {fotoUri ? 'Cambiar Foto' : 'Tomar Foto'}
            </Text>
          </TouchableOpacity>
          {fotoUri && (
            <Image source={{ uri: fotoUri }} style={styles.previewImage} />
          )}
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Guardar Pago</Text>
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
  headerInfo: {
    backgroundColor: '#F0F7FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#007AFF',
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
    fontWeight: 'bold',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5F1FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B3D4FF',
    borderStyle: 'dashed',
  },
  photoButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 15,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
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
