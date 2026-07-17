import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ArrowLeft, CircleAlert, CircleCheckBig, FileSpreadsheet } from 'lucide-react-native';
import { useAuth } from '../../../lib/auth';
import { leerExcel, validarFilas } from '../../../lib/excel';
import { guardarCalzado } from '../../../lib/inventario';
import { usePaddingInferior } from '../../../hooks/usePaddingInferior';
import { useTema } from '../../../lib/tema';
import { espacio, radio, tipografia } from '../../../lib/theme';
import { Boton, Presionable, Tarjeta, useToast } from '../../../components/ui';

export default function CargaMasivaInventario() {
  const { perfil } = useAuth();
  const router = useRouter();
  const { paleta } = useTema();
  const { mostrar } = useToast();
  const paddingInferior = usePaddingInferior(espacio.xxxl);

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
      mostrar('No se pudo leer el archivo Excel: ' + error.message, 'error');
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
          marca: item.marca,
          referencia: item.referencia,
          talla: item.talla,
          color: item.color,
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

      mostrar(`Se han cargado ${guardados} productos correctamente.`);
      router.push('/productos');

      setFilasValidas([]);
      setErrores([]);
      setSeleccionado(false);
      setProgreso(0);

    } catch (error: any) {
      mostrar('Hubo un problema al guardar en la base de datos: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: espacio.m,
          paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m,
        }}
      >
        <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={paleta.texto} />
        </Presionable>
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Carga Inicial de Inventario</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.l }}
        showsVerticalScrollIndicator={false}
      >
        {!uploading && (
          <Boton
            titulo="Subir archivo Excel"
            onPress={seleccionarArchivo}
            cargando={loadingFile}
            icono={<FileSpreadsheet size={20} color={paleta.sobrePrimario} />}
          />
        )}

        {seleccionado && !uploading && (
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto }]}>Resumen de carga</Text>
            <Text style={[tipografia.cuerpo, { color: paleta.texto2, marginTop: espacio.m }]}>
              Productos listos para subir: {filasValidas.length}
            </Text>
            <Text style={[tipografia.cuerpo, { color: errores.length > 0 ? paleta.peligroTexto : paleta.exitoTexto, marginTop: 4 }]}>
              Errores encontrados: {errores.length}
            </Text>

            {errores.length > 0 && (
              <View style={{ marginTop: espacio.m, padding: espacio.m, borderRadius: radio.sm, backgroundColor: paleta.peligroSoft, gap: espacio.s }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
                  <CircleAlert size={16} color={paleta.peligroTexto} />
                  <Text style={[tipografia.etiqueta, { color: paleta.peligroTexto }]}>Detalle de errores</Text>
                </View>
                {errores.map((err, idx) => (
                  <View key={idx}>
                    <Text style={[tipografia.etiqueta, { color: paleta.peligroTexto }]}>Fila {err.fila}:</Text>
                    {err.errores.map((e: string, i: number) => (
                      <Text key={i} style={[tipografia.caption, { color: paleta.peligroTexto, marginLeft: espacio.s }]}>- {e}</Text>
                    ))}
                  </View>
                ))}
              </View>
            )}

            <View style={{ marginTop: espacio.l }}>
              <Boton
                titulo="Confirmar y subir"
                onPress={cargarMasivamente}
                deshabilitado={errores.length > 0 || filasValidas.length === 0}
                icono={<CircleCheckBig size={20} color={paleta.sobrePrimario} />}
              />
            </View>
          </Tarjeta>
        )}

        {uploading && (
          <View style={{ marginTop: espacio.xxxl, alignItems: 'center', gap: espacio.m }}>
            <ActivityIndicator size="large" color={paleta.primario} />
            <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>
              Cargando ({progreso}/{filasValidas.length})…
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
