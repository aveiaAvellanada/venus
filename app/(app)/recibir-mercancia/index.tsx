import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  SafeAreaView
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, useRequireModulo } from '../../../lib/auth'
import { listarCompras, listarProveedores, type Compra } from '../../../lib/proveedores'
import { supabase } from '../../../lib/supabase'

export default function RecibirMercanciaIndex() {
  const requireModulo = useRequireModulo('recibir-mercancia')
  const { perfil } = useAuth()
  const router = useRouter()

  const [compras, setCompras] = useState<Compra[]>([])
  const [proveedoresMap, setProveedoresMap] = useState<Record<string, string>>({})
  const [usuariosMap, setUsuariosMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarDatos = useCallback(async (isRefresh = false) => {
    if (!perfil) return
    if (!isRefresh) setLoading(true)
    setError(null)
    try {
      // 1. Fetch active/inactive providers for name mapping
      const provList = await listarProveedores()
      const provMap: Record<string, string> = {}
      provList.forEach((p) => {
        provMap[p.id] = p.nombre
      })
      setProveedoresMap(provMap)

      // 2. Fetch users for registrar mapping (only if owner/admin)
      if (perfil.rol === 'dueno' || perfil.rol === 'admin') {
        const { data: userList, error: userError } = await supabase
          .from('users')
          .select('id, nombre')
        
        if (userError) {
          console.error('Error al cargar nombres de usuarios:', userError.message)
        } else if (userList) {
          const userMap: Record<string, string> = {}
          userList.forEach((u) => {
            userMap[u.id] = u.nombre
          })
          setUsuariosMap(userMap)
        }
      }

      // 3. Fetch pending arrivals
      const comprasList = await listarCompras({ estado: 'pendiente_revision' })
      
      // RLS already filters at the DB level, but we add client-side check for redundancy and safety
      if (perfil.rol === 'empleado') {
        setCompras(comprasList.filter((c) => c.registrada_por === perfil.id))
      } else {
        setCompras(comprasList)
      }
    } catch (err: any) {
      console.error('Error al cargar entradas de mercancía:', err)
      setError('No se pudieron cargar las entradas de mercancía. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [perfil])

  // Trigger reloading on focus to ensure dynamic list updates
  useFocusEffect(
    useCallback(() => {
      cargarDatos()
    }, [cargarDatos])
  )

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos(true)
  }

  // Early redirect if permissions check fails
  if (requireModulo) return requireModulo

  const renderCompra = ({ item }: { item: Compra }) => {
    const isOwner = perfil?.rol === 'dueno'
    const isAdmin = perfil?.rol === 'admin'
    const isStaff = isOwner || isAdmin
    const providerName = proveedoresMap[item.proveedor_id] || 'Proveedor desconocido'
    const dateFormatted = new Date(item.created_at).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    
    // Resolve registrar name
    let registeredByText = 'Cargando...'
    if (item.registrada_por === perfil?.id) {
      registeredByText = 'Registrado por ti'
    } else if (item.registrada_por) {
      registeredByText = usuariosMap[item.registrada_por] || 'Otro empleado'
    }

    return (
      <View style={styles.cardWrapper}>
        <TouchableOpacity
          style={[styles.card, !isStaff && styles.cardNonPressable]}
          disabled={!isStaff}
          onPress={() => router.push(`/recibir-mercancia/${item.id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={styles.providerRow}>
              <Ionicons name="business" size={18} color="#4b5563" style={styles.iconMargin} />
              <Text style={styles.cardTitle} numberOfLines={1}>
                {providerName}
              </Text>
            </View>
            {isStaff && (
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            )}
          </View>

          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="barcode-outline" size={14} color="#6b7280" style={styles.iconMargin} />
              <Text style={styles.detailText}>ID: {item.id.substring(0, 8).toUpperCase()}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={14} color="#6b7280" style={styles.iconMargin} />
              <Text style={styles.detailText}>{dateFormatted}</Text>
            </View>

            {isStaff && (
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={14} color="#6b7280" style={styles.iconMargin} />
                <Text style={styles.detailText}>{registeredByText}</Text>
              </View>
            )}
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Pendiente revisión</Text>
            </View>
            {/* 
              Only Andrés (owner) gets financial indicators. 
              Sandra (admin) and employees do not see costs or total values on cards.
            */}
            {isOwner && item.total !== null && (
              <Text style={styles.financialText}>
                Total: ${item.total.toLocaleString()}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Banner message based on user role */}
      <View style={styles.banner}>
        <Ionicons 
          name={perfil?.rol === 'empleado' ? 'information-circle-outline' : 'shield-checkmark-outline'} 
          size={20} 
          color={perfil?.rol === 'empleado' ? '#0284c7' : '#0d9488'} 
        />
        <Text style={styles.bannerText}>
          {perfil?.rol === 'dueno' && 'Revisa y completa los costos unitarios y plazos de pago para ingresar stock.'}
          {perfil?.rol === 'admin' && 'Completa los datos de las recepciones físicas pendientes.'}
          {perfil?.rol === 'empleado' && 'Lista de tus recepciones de calzado enviadas a revisión.'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => cargarDatos()}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {perfil?.rol !== 'empleado' && (
            <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#374151' }}>Pendientes de Revisión</Text>
            </View>
          )}
          <FlatList
            data={compras}
            keyExtractor={(item) => item.id}
          renderItem={renderCompra}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={56} color="#9ca3af" />
              <Text style={styles.emptyText}>
                {perfil?.rol === 'empleado'
                  ? 'No has registrado entradas pendientes.'
                  : 'No hay entradas de mercancía pendientes de revisión.'}
              </Text>
            </View>
          }
          />
        </>
      )}

      {/* Floating Action Button (FAB) for registering a new arrival */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/recibir-mercancia/nueva')}
        activeOpacity={0.9}
        testID="registrar-entrada-fab"
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  listContent: { padding: 16, paddingBottom: 100 },
  cardWrapper: { marginBottom: 12 },
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
  cardNonPressable: {
    shadowOpacity: 0,
    elevation: 0,
    backgroundColor: '#fafafa'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8
  },
  iconMargin: { marginRight: 6 },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1
  },
  cardDetails: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
    marginBottom: 10
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  detailText: {
    fontSize: 13,
    color: '#4b5563'
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d97706',
    marginRight: 6
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e'
  },
  financialText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669'
  },
  errorText: {
    fontSize: 15,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 20
  },
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
