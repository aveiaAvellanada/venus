import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../../lib/auth';
import { leerExcel, validarFilas } from '../../../lib/excel';
import { guardarCalzado } from '../../../lib/inventario';

export default function CargaMasivaInventario() {
  const { perfil } = useAuth();
  const router = useRouter();

  const [loadingFile, setLoadingFile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progreso, setProgreso] = useState(0);

  const [filasValidas, setFilasValidas] = useState<any[]>([]);
  const [errores, setErrores] = useState<any[]>([]);
  const [seleccionado, setSeleccionado] = useState(false);

  // Proteger la ruta (solo dueño) usando perfil, emulando la intención de usePermisos
  if (!perfil || perfil.rol !== 'dueno') {
    return <Redirect href="/" />;
  }

  const seleccionarArchivo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setLoadingFile(true);
      const fileUri = result.assets[0].uri;

      const filas = await leerExcel(fileUri);
      const validadas = validarFilas(filas);

      setFilasValidas(validadas.validas);
      setErrores(validadas.errores);
      setSeleccionado(true);
    } catch (error: any) {
      Alert.alert('Error', 'No se pudo leer el archivo Excel: ' + error.message);
    } finally {
      setLoadingFile(false);
    }
  };

  const cargarMasivamente = async () => {
    if (errores.length > 0 || filasValidas.length === 0) {
      return;
    }

    setUploading(true);
    let guardados = 0;

    try {
      for (const item of filasValidas) {
        await guardarCalzado({
          categoria: item.categoria,
          descripcion: item.descripcion,
          precio_minimo: item.precio_min,
          precio_maximo: item.precio_max,
          costo_compra: item.costo,
          stock_actual: item.stock,
          stock_minimo: 0,
          activo: true
        });
        guardados++;
        setProgreso(guardados);
      }

      Alert.alert('Éxito', `Se han cargado ${guardados} productos correctamente.`, [
        { text: 'OK', onPress: () => router.push('/inventario/calzado') }
      ]);
      
      setFilasValidas([]);
      setErrores([]);
      setSeleccionado(false);
      setProgreso(0);

    } catch (error: any) {
      Alert.alert('Error', 'Hubo un problema al guardar en la base de datos: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Carga Inicial de Inventario</Text>

      {!uploading && (
        <TouchableOpacity style={styles.button} onPress={seleccionarArchivo} disabled={loadingFile}>
          {loadingFile ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Subir Archivo Excel</Text>}
        </TouchableOpacity>
      )}

      {seleccionado && !uploading && (
        <View style={styles.resumenContainer}>
          <Text style={styles.resumenTitle}>Resumen de Carga</Text>
          <Text>Productos listos para subir: {filasValidas.length}</Text>
          <Text style={{ color: errores.length > 0 ? 'red' : 'green', marginBottom: 10 }}>
            Errores encontrados: {errores.length}
          </Text>

          {errores.length > 0 && (
            <View style={styles.erroresList}>
              <Text style={styles.erroresTitle}>Detalle de Errores:</Text>
              {errores.map((err, idx) => (
                <View key={idx} style={styles.errorItem}>
                  <Text style={styles.errorText}>Fila {err.fila}:</Text>
                  {err.errores.map((e: string, i: number) => (
                     <Text key={i} style={styles.errorDetail}>- {e}</Text>
                  ))}
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity 
            style={[styles.button, (errores.length > 0 || filasValidas.length === 0) ? styles.buttonDisabled : null]} 
            onPress={cargarMasivamente}
            disabled={errores.length > 0 || filasValidas.length === 0}
          >
            <Text style={styles.buttonText}>Confirmar y Subir</Text>
          </TouchableOpacity>
        </View>
      )}

      {uploading && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.uploadingText}>Cargando ({progreso}/{filasValidas.length})...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resumenContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  resumenTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  erroresList: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#ffe6e6',
    borderRadius: 8,
  },
  erroresTitle: {
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 5,
  },
  errorItem: {
    marginBottom: 10,
  },
  errorText: {
    fontWeight: 'bold',
    color: '#b71c1c',
  },
  errorDetail: {
    marginLeft: 10,
    color: '#c62828',
  },
  uploadingContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 10,
    fontSize: 18,
    color: '#333',
  },
});
