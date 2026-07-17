import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, TextInput, ActivityIndicator } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  CircleAlert,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react-native'
import { listarProveedores, type Proveedor } from '../../../lib/proveedores'
import { useRequireModulo } from '../../../lib/auth'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tipografia } from '../../../lib/theme'
import { Boton, CirculoIcono, ControlSegmentado, EstadoVacio, Presionable, Tarjeta } from '../../../components/ui'

export default function ProveedoresIndex() {
  const requireModulo = useRequireModulo('proveedores')
  const router = useRouter()
  const { paleta } = useTema()
  const paddingInferior = usePaddingInferior(100)
  const bottomFab = usePaddingInferior(espacio.xl)

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
    <View style={{ marginBottom: espacio.m }}>
      <Tarjeta>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m }}>
          <Presionable
            accessibilityRole="button"
            accessibilityLabel={`Ver detalle de ${item.nombre}`}
            onPress={() => router.push(`/proveedores/${item.id}`)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacio.m }}
          >
            <CirculoIcono tono="primario">
              <Building2 />
            </CirculoIcono>
            <View style={{ flex: 1 }}>
              <Text style={[tipografia.h3, { color: paleta.texto }]} numberOfLines={1}>
                {item.nombre}
              </Text>
              <Text style={[tipografia.caption, { color: paleta.texto3 }]} numberOfLines={1}>
                NIT/CC: {item.nit_cedula || 'No registrado'}
              </Text>
            </View>
            <ChevronRight size={18} color={paleta.texto3} />
          </Presionable>
          <Presionable
            accessibilityRole="button"
            accessibilityLabel={`Editar ${item.nombre}`}
            onPress={() => router.push(`/proveedores/editor?id=${item.id}`)}
            hitSlop={12}
          >
            <Pencil size={20} color={paleta.primario} />
          </Presionable>
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            borderTopWidth: 1,
            borderTopColor: paleta.borde,
            paddingTop: espacio.m,
            marginTop: espacio.m,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
            <Phone size={14} color={paleta.texto3} />
            <Text style={[tipografia.caption, { color: paleta.texto2 }]}>
              {item.telefono || 'Sin teléfono'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
            <MapPin size={14} color={paleta.texto3} />
            <Text style={[tipografia.caption, { color: paleta.texto2 }]}>
              {item.ciudad || 'Sin dirección'}
            </Text>
          </View>
        </View>
      </Tarjeta>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: espacio.m,
          paddingHorizontal: espacio.xl,
          paddingTop: 56,
          paddingBottom: espacio.m,
        }}
      >
        <Presionable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          hitSlop={12}
        >
          <ArrowLeft size={24} color={paleta.texto} />
        </Presionable>
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Proveedores</Text>
      </View>

      {/* Búsqueda y filtro */}
      <View style={{ paddingHorizontal: espacio.xl, gap: espacio.m, marginBottom: espacio.m }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.s,
            backgroundColor: paleta.superficie2,
            borderRadius: radio.md,
            paddingHorizontal: espacio.m,
            height: 44,
          }}
        >
          <Search size={18} color={paleta.texto3} />
          <TextInput
            style={[tipografia.cuerpo, { flex: 1, color: paleta.texto }]}
            placeholder="Buscar por nombre o NIT..."
            placeholderTextColor={paleta.textoDeshabilitado}
            value={busqueda}
            onChangeText={setBusqueda}
          />
          {busqueda.length > 0 && (
            <Presionable
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
              onPress={() => setBusqueda('')}
              hitSlop={8}
            >
              <X size={18} color={paleta.texto3} />
            </Presionable>
          )}
        </View>

        <ControlSegmentado
          opciones={['Activos', 'Inactivos']}
          indice={verActivos ? 0 : 1}
          onCambio={(i) => setVerActivos(i === 0)}
        />
      </View>

      {/* Contenido principal */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: espacio.xl, gap: espacio.l }}>
          <EstadoVacio icono={<CircleAlert />} titulo={error} />
          <Boton titulo="Reintentar" variante="secundario" tamano="md" onPress={cargarProveedores} />
        </View>
      ) : (
        <FlatList
          data={proveedores}
          keyExtractor={(item) => item.id}
          renderItem={renderProveedor}
          contentContainerStyle={{ padding: espacio.xl, paddingBottom: paddingInferior }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EstadoVacio icono={<Users />} titulo="No se encontraron proveedores." />
          }
        />
      )}

      {/* Botón flotante para agregar un nuevo proveedor */}
      <Presionable
        accessibilityRole="button"
        accessibilityLabel="Agregar proveedor"
        onPress={() => router.push('/proveedores/editor')}
        hitSlop={8}
        testID="add-provider-btn"
        style={{
          position: 'absolute',
          bottom: bottomFab,
          right: espacio.xl,
          width: 56,
          height: 56,
          borderRadius: radio.full,
          backgroundColor: paleta.primario,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: paleta.sombraFab,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Plus size={28} color={paleta.sobrePrimario} />
      </Presionable>
    </View>
  )
}
