import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { listarProveedores, type Proveedor } from '../../../lib/proveedores'
import { useRequireModulo } from '../../../lib/auth'

export default function ProveedoresIndex() {
  const requireModulo = useRequireModulo('proveedores')
  const router = useRouter()

  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Search and Filter States
  const [busqueda, setBusqueda] = useState('')
  const [verActivos, setVerActivos] = useState(true)

  const cargarProveedores = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listarProveedores({
        buscar: busqueda.trim() || undefined,
        activo: verActivos,
      })
      // The backend 'listarProveedores' already orders alphabetically by name,
      // but let's double check by doing a client-side sort to be absolutely sure.
      const sorted = [...data].sort((a, b) => a.nombre.localeCompare(b.nombre))
      setProveedores(sorted)
    } catch (err: any) {
      console.error('Error al cargar proveedores:', err)
      setError('No se pudieron cargar los proveedores. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [busqueda, verActivos])

  useFocusEffect(
    useCallback(() => {
      cargarProveedores()
    }, [cargarProveedores])
  )

  if (requireModulo) return requireModulo

  const renderProveedor = ({ item }: { item: Proveedor }) => (
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/proveedores/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.nombre}
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push(`/proveedores/editor?id=${item.id}`)}
              hitSlop={12}
            >
              <Ionicons name="create-outline" size={20} color="#3b82f6" />
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </View>
        </View>
        
        <Text style={styles.cardSubtitle}>
          NIT/CC: {item.nit_cedula || 'No registrado'}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={14} color="#6b7280" />
            <Text style={styles.infoText}>{item.telefono || 'Sin teléfono'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color="#6b7280" />
            <Text style={styles.infoText}>{item.ciudad || 'Sin dirección'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Header / Search Controls */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o NIT..."
            value={busqueda}
            onChangeText={setBusqueda}
            placeholderTextColor="#9ca3af"
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => setBusqueda('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Toggle Row */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, verActivos && styles.tabButtonActive]}
            onPress={() => setVerActivos(true)}
          >
            <Text style={[styles.tabText, verActivos && styles.tabTextActive]}>Activos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, !verActivos && styles.tabButtonActive]}
            onPress={() => setVerActivos(false)}
          >
            <Text style={[styles.tabText, !verActivos && styles.tabTextActive]}>Inactivos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main List content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={cargarProveedores}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={proveedores}
          keyExtractor={(item) => item.id}
          renderItem={renderProveedor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={56} color="#9ca3af" />
              <Text style={styles.emptyText}>No se encontraron proveedores.</Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button for adding a new provider */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/proveedores/editor')}
        activeOpacity={0.9}
        testID="add-provider-btn"
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: { backgroundColor: '#ffffff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  tabButtonActive: { backgroundColor: '#3b82f6' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  tabTextActive: { color: '#ffffff' },
  listContent: { padding: 16, paddingBottom: 100 },
  cardWrapper: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editButton: {
    padding: 4,
  },
  cardSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: '#4b5563' },
  errorText: { fontSize: 15, color: '#ef4444', textAlign: 'center', marginTop: 12, marginBottom: 16 },
  retryButton: { backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  retryButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  emptyContainer: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { color: '#9ca3af', fontSize: 15, marginTop: 12 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#3b82f6',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
})
