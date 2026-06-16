import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { Database } from '../../../lib/database.types';

type GastoFijoRow = Database['public']['Tables']['gastos_fijos']['Row'];
type GastoFijoPagoRow = Database['public']['Tables']['gastos_fijos_pagos']['Row'];

interface GastoConPagos extends GastoFijoRow {
  gastos_fijos_pagos: GastoFijoPagoRow[];
}

export default function GastosFijosScreen() {
  const router = useRouter();
  
  const [gastos, setGastos] = useState<GastoConPagos[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      // Traer gastos fijos activos y sus pagos en el mes actual
      const { data, error } = await supabase
        .from('gastos_fijos')
        .select(`
          *,
          gastos_fijos_pagos (
            *
          )
        `)
        .eq('activo', true)
        .gte('gastos_fijos_pagos.fecha_pago', startOfMonth.toISOString())
        .lte('gastos_fijos_pagos.fecha_pago', endOfMonth.toISOString())
        .order('nombre', { ascending: true });

      if (error) throw error;
      setGastos(data as unknown as GastoConPagos[]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const renderItem = ({ item }: { item: GastoConPagos }) => {
    const yaPagado = item.gastos_fijos_pagos && item.gastos_fijos_pagos.length > 0;
    
    let statusColor = '#E0E0E0';
    let statusText = 'Desconocido';
    
    if (yaPagado) {
      statusColor = '#34C759'; // Verde
      statusText = 'Pagado';
    } else {
      const hoy = new Date().getDate();
      const diaPago = item.dia_pago || 1;
      const diasRestantes = diaPago - hoy;
      
      if (diasRestantes < 0) {
        statusColor = '#FF3B30'; // Rojo
        statusText = 'Atrasado';
      } else if (diasRestantes <= 5) {
        statusColor = '#FFCC00'; // Amarillo
        statusText = `Vence en ${diasRestantes} días`;
      } else {
        statusColor = '#8E8E93'; // Gris
        statusText = `Vence el ${diaPago}`;
      }
    }

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => {
          if (!yaPagado) {
            router.push(`/gastos/pagar?id=${item.id}&nombre=${encodeURIComponent(item.nombre)}&monto=${item.monto_aproximado}`);
          }
        }}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardInfo}>
            <Text style={styles.nombreText}>{item.nombre}</Text>
            <Text style={styles.montoText}>Aprox. ${item.monto_aproximado.toLocaleString()}</Text>
            <Text style={styles.beneficiarioText}>{item.beneficiario || 'Sin beneficiario'}</Text>
          </View>
          <View style={styles.statusContainer}>
            <View style={[styles.semaforo, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor === '#FFCC00' ? '#D4A000' : statusColor }]}>
              {statusText}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity style={styles.tab} onPress={() => router.replace('/gastos')}>
          <Text style={styles.tabLabel}>Variables</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, styles.activeTab]} disabled>
          <Text style={[styles.tabLabel, styles.activeTabLabel]}>Fijos</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />
      ) : (
        <FlatList
          data={gastos}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="documents-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>No hay contratos/gastos fijos registrados</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/gastos/fijos-editor')}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEE',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activeTabLabel: {
    color: '#fff',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  nombreText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  montoText: {
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
    marginBottom: 4,
  },
  beneficiarioText: {
    fontSize: 13,
    color: '#A0A0A0',
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 90,
  },
  semaforo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    color: '#8E8E93',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#007AFF',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
});
