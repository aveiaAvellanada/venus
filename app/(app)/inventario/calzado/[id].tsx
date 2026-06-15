import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, useRequireModulo } from '../../../../lib/auth'
import { supabase } from '../../../../lib/supabase'
import type { ProductoCalzado } from '../../../../lib/inventario'

export default function CalzadoDetailScreen() {
  const requireModulo = useRequireModulo('inventario-calzado')
  const { id } = useLocalSearchParams<{ id: string }>()
  const [producto, setProducto] = useState<ProductoCalzado | null>(null)
  const [costoCompra, setCostoCompra] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const { perfil } = useAuth()
  const router = useRouter()

  const esDueno = perfil?.rol === 'dueno'
  const esEmpleado = perfil?.rol === 'empleado'

  if (requireModulo) return requireModulo

  useEffect(() => {
    async function fetchProducto() {
      try {
        const { data, error } = await supabase
          .from('productos_calzado')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw error
        setProducto(data)

        if (esDueno) {
          const { data: historial } = await supabase
            .from('historial_precios_calzado')
            .select('costo_compra')
            .eq('producto_id', id)
            .not('costo_compra', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          
          if (historial) {
            setCostoCompra(historial.costo_compra)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchProducto()
  }, [id, esDueno])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    )
  }

  if (!producto) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Producto no encontrado</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          {producto.foto_url ? (
            <Image source={{ uri: producto.foto_url }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.placeholderImage]}>
              <Ionicons name="image-outline" size={64} color="#9ca3af" />
            </View>
          )}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{producto.categoria}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.title}>{producto.descripcion}</Text>
          <Text style={styles.reference}>Ref: {producto.referencia || 'Sin referencia'}</Text>

          <View style={styles.attributesRow}>
            <View style={styles.attributeBox}>
              <Text style={styles.attributeLabel}>Talla</Text>
              <Text style={styles.attributeValue}>{producto.talla || '-'}</Text>
            </View>
            <View style={styles.attributeBox}>
              <Text style={styles.attributeLabel}>Color</Text>
              <Text style={styles.attributeValue}>{producto.color || '-'}</Text>
            </View>
            <View style={styles.attributeBox}>
              <Text style={styles.attributeLabel}>Stock</Text>
              <Text style={[styles.attributeValue, producto.stock_actual <= producto.stock_minimo && styles.warningText]}>
                {producto.stock_actual}
              </Text>
            </View>
          </View>

          <View style={styles.priceSection}>
            <Text style={styles.sectionTitle}>Precios de Venta</Text>
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.priceLabel}>Mínimo</Text>
                <Text style={styles.priceValue}>${producto.precio_minimo.toLocaleString()}</Text>
              </View>
              <View style={styles.priceDivider} />
              <View>
                <Text style={styles.priceLabel}>Máximo</Text>
                <Text style={styles.priceValue}>${producto.precio_maximo.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {esDueno && (
            <View style={styles.costSection}>
              <Text style={styles.sectionTitle}>Costo de Compra (Solo Dueño)</Text>
              <Text style={styles.costValue}>
                {costoCompra ? `$${costoCompra.toLocaleString()}` : 'No registrado'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {!esEmpleado && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => router.push(`/inventario/calzado/editor?id=${producto.id}`)}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={20} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.editButtonText}>Editar Producto</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#ef4444' },
  scrollContent: { paddingBottom: 100 },
  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  placeholderImage: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  infoCard: {
    backgroundColor: '#ffffff',
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 4 },
  reference: { fontSize: 15, color: '#6b7280', marginBottom: 24 },
  attributesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  attributeBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  attributeLabel: { fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: '500' },
  attributeValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  warningText: { color: '#ef4444' },
  priceSection: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  priceLabel: { fontSize: 13, color: '#166534', opacity: 0.8, marginBottom: 2, textAlign: 'center' },
  priceValue: { fontSize: 20, fontWeight: '700', color: '#166534', textAlign: 'center' },
  priceDivider: { width: 1, height: 30, backgroundColor: '#bbf7d0' },
  costSection: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 16,
  },
  costValue: { fontSize: 20, fontWeight: '700', color: '#b45309' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
  editButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonIcon: { marginRight: 8 },
  editButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
})
