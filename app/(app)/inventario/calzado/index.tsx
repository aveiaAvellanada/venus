import { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator, ScrollView, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { listarCalzado, type ProductoCalzado } from '../../../../lib/inventario'
import { useAuth, useRequireModulo } from '../../../../lib/auth'

const CATEGORIAS = ['Todas', 'Tenis', 'Botas', 'Sandalias', 'Casual', 'Deportivo']

export default function CalzadoListScreen() {
  const requireModulo = useRequireModulo('inventario-calzado')
  const [productos, setProductos] = useState<ProductoCalzado[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriaSel, setCategoriaSel] = useState('Todas')
  const [busqueda, setBusqueda] = useState('')
  const { perfil } = useAuth()
  const router = useRouter()

  if (requireModulo) return requireModulo

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const data = await listarCalzado({
        categoria: categoriaSel === 'Todas' ? undefined : categoriaSel,
        busqueda: busqueda || undefined,
      })
      setProductos(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [categoriaSel, busqueda])

  const renderItem = ({ item }: { item: ProductoCalzado }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/inventario/calzado/${item.id}`)}
      activeOpacity={0.8}
    >
      {item.foto_url ? (
        <Image source={{ uri: item.foto_url }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.placeholderImage]}>
          <Ionicons name="image-outline" size={32} color="#9ca3af" />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.descripcion}</Text>
        <Text style={styles.cardSubtitle}>
          Ref: {item.referencia || 'N/A'} • Talla: {item.talla || 'N/A'}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>${item.precio_minimo.toLocaleString()} - ${item.precio_maximo.toLocaleString()}</Text>
          <View style={[styles.stockBadge, item.stock_actual <= item.stock_minimo && styles.stockBadgeWarning]}>
            <Text style={[styles.stockText, item.stock_actual <= item.stock_minimo && styles.stockTextWarning]}>
              Stock: {item.stock_actual}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por referencia, descripción..."
            value={busqueda}
            onChangeText={setBusqueda}
          />
        </View>
        <View style={styles.chipsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {CATEGORIAS.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, categoriaSel === cat && styles.chipActive]}
                onPress={() => setCategoriaSel(cat)}
              >
                <Text style={[styles.chipText, categoriaSel === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={productos}
          keyExtractor={p => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>No se encontraron productos.</Text>
            </View>
          }
        />
      )}

      {perfil?.rol !== 'empleado' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/inventario/calzado/editor')}
          activeOpacity={0.9}
        >
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#ffffff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
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
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#111827' },
  chipsContainer: { height: 36 },
  chipsScroll: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#3b82f6' },
  chipText: { fontSize: 14, fontWeight: '500', color: '#4b5563' },
  chipTextActive: { color: '#ffffff' },
  listContent: { padding: 16, gap: 16, paddingBottom: 100 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#f3f4f6' },
  placeholderImage: { justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice: { fontSize: 15, fontWeight: '700', color: '#10b981' },
  stockBadge: { backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  stockBadgeWarning: { backgroundColor: '#fef08a' },
  stockText: { fontSize: 12, fontWeight: '600', color: '#0369a1' },
  stockTextWarning: { color: '#854d0e' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 48 },
  emptyText: { marginTop: 12, fontSize: 15, color: '#6b7280' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
})
