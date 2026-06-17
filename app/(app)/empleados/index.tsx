import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRequireModulo } from '../../../lib/auth'
import { listarEmpleados, diasTrabajadosMes, type Empleado } from '../../../lib/empleados'

const pesos = (n: number) => '$' + n.toLocaleString('es-CO')

type EmpleadoConDias = Empleado & { diasEsteMes: number }

export default function EmpleadosIndex() {
  const requireModulo = useRequireModulo('gestion-empleado')
  const router = useRouter()

  const [empleados, setEmpleados] = useState<EmpleadoConDias[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarDatos = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    setError(null)
    try {
      const ahora = new Date()
      const anio = ahora.getFullYear()
      const mes = ahora.getMonth() + 1 // getMonth() es 0-11; diasTrabajadosMes espera 1-12

      const lista = await listarEmpleados()

      const conDias = await Promise.all(
        lista.map(async (emp) => {
          let diasEsteMes = 0
          try {
            diasEsteMes = await diasTrabajadosMes(emp.id, anio, mes)
          } catch {
            // Si falla para un empleado, mostrar 0 y no romper toda la lista
            diasEsteMes = 0
          }
          return { ...emp, diasEsteMes }
        })
      )

      setEmpleados(conDias)
    } catch (err: unknown) {
      console.error('Error al cargar empleados:', err)
      setError('No se pudieron cargar los empleados. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      cargarDatos()
    }, [cargarDatos])
  )

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos(true)
  }

  if (requireModulo) return requireModulo

  const rolLabel = (rol: Empleado['rol']) => {
    if (rol === 'admin') return 'Administrativo'
    return 'Operativo'
  }

  const renderEmpleado = ({ item }: { item: EmpleadoConDias }) => {
    const sueldo = item.config?.sueldo_mensual

    return (
      <View style={styles.cardWrapper}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/empleados/' + item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={styles.nameRow}>
              <Ionicons name="person-circle-outline" size={20} color="#4b5563" style={styles.iconMargin} />
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.nombre}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </View>

          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="briefcase-outline" size={14} color="#6b7280" style={styles.iconMargin} />
              <Text style={styles.detailText}>{rolLabel(item.rol)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="cash-outline" size={14} color="#6b7280" style={styles.iconMargin} />
              <Text style={styles.detailText}>
                {sueldo != null ? pesos(sueldo) + '/mes' : 'Sueldo no configurado'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={14} color="#6b7280" style={styles.iconMargin} />
              <Text style={styles.detailText}>Días este mes: {item.diasEsteMes}</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={[styles.badge, item.activo ? styles.badgeActivo : styles.badgeInactivo]}>
              <View style={[styles.badgeDot, item.activo ? styles.dotActivo : styles.dotInactivo]} />
              <Text style={[styles.badgeText, item.activo ? styles.badgeTextActivo : styles.badgeTextInactivo]}>
                {item.activo ? 'Activo' : 'Inactivo'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.banner}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#0d9488" />
        <Text style={styles.bannerText}>
          Gestiona el equipo: sueldo, días trabajados, activar/desactivar y pagos.
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
        <FlatList
          data={empleados}
          keyExtractor={(item) => item.id}
          renderItem={renderEmpleado}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3b82f6']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={56} color="#9ca3af" />
              <Text style={styles.emptyText}>No hay empleados registrados.</Text>
            </View>
          }
        />
      )}
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
    gap: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  listContent: { padding: 16, paddingBottom: 40 },
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  iconMargin: { marginRight: 6 },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  cardDetails: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 13,
    color: '#4b5563',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeActivo: { backgroundColor: '#dcfce7' },
  badgeInactivo: { backgroundColor: '#fee2e2' },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotActivo: { backgroundColor: '#16a34a' },
  dotInactivo: { backgroundColor: '#dc2626' },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextActivo: { color: '#15803d' },
  badgeTextInactivo: { color: '#b91c1c' },
  errorText: {
    fontSize: 15,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
})
