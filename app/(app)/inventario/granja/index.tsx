import { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator, TextInput } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { listarVarios, type ProductoVarios } from '../../../../lib/inventario'
import { useAuth, useRequireModulo } from '../../../../lib/auth'

export default function GranjaListScreen() {
  const requireModulo = useRequireModulo('granja')
  const [productos, setProductos] = useState<ProductoVarios[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const { perfil } = useAuth()
  const router = useRouter()

  if (requireModulo) return requireModulo

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const data = await listarVarios(busqueda || undefined)
      setProductos(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [busqueda])

  const renderItem = ({ item }: { item: ProductoVarios }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        if (perfil?.rol !== 'empleado') {
          router.push(`/inventario/granja/editor?id=${item.id}`)
        }
      }}
      activeOpacity={perfil?.rol !== 'empleado' ? 0.8 : 1}
    >
      {item.foto_url ? (
        <Image source={{ uri: item.foto_url }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.placeholderImage]}>
          <Ionicons name="image-outline" size={32} color="#9ca3af" />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre}</Text>
        <Text style={styles.cardSubtitle}>
          Unidad: {item.unidad_medida}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>
            {item.precio_sugerido ? `$${item.precio_sugerido.toLocaleString()}` : 'Precio no sugerido'}
          </Text>
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
            placeholder="Buscar producto de granja..."
            value={busqueda}
            onChangeText={setBusqueda}
          />
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
          onPress={() => router.push('/inventario/granja/editor')}
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
    height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#111827' },
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
