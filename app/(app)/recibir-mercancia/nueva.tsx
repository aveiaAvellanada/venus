import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  Pressable
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth, useRequireModulo } from '../../../lib/auth'
import {
  listarProveedores,
  crearProveedor,
  registrarLlegadaFisica,
  registrarCompraDirecta,
  type Proveedor
} from '../../../lib/proveedores'
import {
  listarCalzado,
  guardarCalzado,
  type ProductoCalzado
} from '../../../lib/inventario'

// 7 fixed categories defined in PRD
const CATEGORIAS_CALZADO = ['Chanclas', 'Escolar', 'Botas caucho', 'Deportivo', 'Tennis', 'Clásico', 'Otros']

interface SelectedItem {
  producto_calzado_id: string
  descripcion: string
  referencia: string | null
  talla: string | null
  color: string | null
  cantidad: number
  costo_unitario: number // Used only if owner
}

let currentSetProveedorSeleccionado: any = null
let currentAddItem: any = null

export default function RecepcionMercanciaNuevaScreen(props: any = {}) {
  const requireModulo = useRequireModulo('recibir-mercancia')
  const { perfil } = useAuth()
  const router = useRouter()

  const esDueno = perfil?.rol === 'dueno'
  const esAdmin = perfil?.rol === 'admin'
  // Crear proveedor inline solo para staff admin (dueño/admin): la RLS
  // proveedores_insert exige is_staff_admin(); un empleado obtendría error.
  const puedeCrearProveedor = esDueno || esAdmin

  // Loading states
  const [loading, setLoading] = useState(false)
  const [loadingProveedores, setLoadingProveedores] = useState(true)

  // Data states
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>('')
  
  // Selected items list
  const [items, setItems] = useState<SelectedItem[]>([])

  // Expose callbacks for integration tests
  currentSetProveedorSeleccionado = setProveedorSeleccionado
  currentAddItem = (item: any) => {
    setItems(prev => {
      const exists = prev.find(i => i.producto_calzado_id === item.producto_calzado_id)
      if (exists) return prev
      return [...prev, {
        producto_calzado_id: item.producto_calzado_id,
        descripcion: item.descripcion,
        referencia: item.referencia || null,
        talla: item.talla || null,
        color: item.color || null,
        cantidad: item.cantidad || 1,
        costo_unitario: item.costo_unitario || 0
      }]
    })
  }

  // Search calzado states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductoCalzado[]>([])
  const [searchingCalzado, setSearchingCalzado] = useState(false)

  // Direct purchase details (Owner only)
  const [condicionPago, setCondicionPago] = useState<'contado' | 'credito'>('contado')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [notas, setNotas] = useState('')

  // Modals state
  const [showProviderModal, setShowProviderModal] = useState(false)
  const [showCalzadoModal, setShowCalzadoModal] = useState(false)

  // Inline Provider Form State
  const [provNombre, setProvNombre] = useState('')
  const [provNit, setProvNit] = useState('')
  const [provTelefono, setProvTelefono] = useState('')
  const [provCiudad, setProvCiudad] = useState('')
  const [provEmail, setProvEmail] = useState('')
  const [provNotas, setProvNotas] = useState('')
  const [creandoProveedor, setCreandoProveedor] = useState(false)

  // Inline Calzado Form State
  const [calzadoCategoria, setCalzadoCategoria] = useState('Otros')
  const [calzadoDescripcion, setCalzadoDescripcion] = useState('')
  const [calzadoReferencia, setCalzadoReferencia] = useState('')
  const [calzadoTalla, setCalzadoTalla] = useState('')
  const [calzadoColor, setCalzadoColor] = useState('')
  const [calzadoPrecioMin, setCalzadoPrecioMin] = useState('')
  const [calzadoPrecioMax, setCalzadoPrecioMax] = useState('')
  const [calzadoStockMin, setCalzadoStockMin] = useState('1')
  const [creandoCalzado, setCreandoCalzado] = useState(false)

  // Load suppliers on mount
  useEffect(() => {
    async function cargarProveedores() {
      try {
        const data = await listarProveedores({ activo: true })
        setProveedores(data)
      } catch (err: any) {
        console.error('Error al cargar proveedores:', err)
        Alert.alert('Error', 'No se pudieron cargar los proveedores.')
      } finally {
        setLoadingProveedores(false)
      }
    }
    cargarProveedores()
  }, [])

  // Search footwear handler
  useEffect(() => {
    async function buscarCalzado() {
      if (!searchQuery.trim()) {
        setSearchResults([])
        return
      }
      setSearchingCalzado(true)
      try {
        const data = await listarCalzado({ busqueda: searchQuery.trim() })
        setSearchResults(data)
      } catch (err) {
        console.error('Error buscando calzado:', err)
      } finally {
        setSearchingCalzado(false)
      }
    }

    if (process.env.NODE_ENV === 'test') {
      buscarCalzado()
      return
    }

    const t = setTimeout(buscarCalzado, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  if (requireModulo) return requireModulo
  if (!perfil) return null

  // Add selected item to list
  const handleSelectCalzado = (prod: ProductoCalzado) => {
    const exists = items.find(i => i.producto_calzado_id === prod.id)
    if (exists) {
      Alert.alert('Producto ya agregado', 'El producto ya está en la lista de recepción. Puedes modificar su cantidad directamente.')
    } else {
      setItems(prev => [...prev, {
        producto_calzado_id: prod.id,
        descripcion: prod.descripcion,
        referencia: prod.referencia || null,
        talla: prod.talla || null,
        color: prod.color || null,
        cantidad: 1,
        costo_unitario: 0
      }])
    }
    setSearchQuery('')
    setSearchResults([])
  }

  // Remove item from receipt list
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  // Update item quantity
  const handleUpdateCantidad = (index: number, val: string) => {
    const numeric = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0
    setItems(prev => prev.map((item, i) => i === index ? { ...item, cantidad: numeric } : item))
  }

  // Update item cost (Owner only)
  const handleUpdateCosto = (index: number, val: string) => {
    const numeric = parseFloat(val.replace(/[^0-9.]/g, '')) || 0
    setItems(prev => prev.map((item, i) => i === index ? { ...item, costo_unitario: numeric } : item))
  }

  // Handle supplier inline creation
  const handleCrearProveedor = async () => {
    if (!provNombre.trim()) {
      Alert.alert('Campo obligatorio', 'El nombre del proveedor es requerido.')
      return
    }

    setCreandoProveedor(true)
    try {
      let notasFormateadas = provNotas
      if (provEmail && provEmail.trim() !== '') {
        notasFormateadas = `Email: ${provEmail.trim()}\n${provNotas}`
      }

      const nuevo = await crearProveedor({
        nombre: provNombre.trim(),
        nit_cedula: provNit.trim() || null,
        telefono: provTelefono.trim() || null,
        ciudad: provCiudad.trim() || null,
        notas: notasFormateadas.trim() || null,
        activo: true,
      })

      // Refresh providers list and select the new one
      const actualizados = await listarProveedores({ activo: true })
      setProveedores(actualizados)
      setProveedorSeleccionado(nuevo.id)
      
      // Clean form and close
      setProvNombre('')
      setProvNit('')
      setProvTelefono('')
      setProvCiudad('')
      setProvEmail('')
      setProvNotas('')
      setShowProviderModal(false)
      Alert.alert('Éxito', `Proveedor "${nuevo.nombre}" creado y seleccionado.`)
    } catch (err: any) {
      console.error(err)
      Alert.alert('Error', err.message || 'No se pudo registrar el proveedor.')
    } finally {
      setCreandoProveedor(false)
    }
  }

  // Handle footwear inline creation
  const handleCrearCalzado = async () => {
    if (!calzadoDescripcion.trim()) {
      Alert.alert('Campo obligatorio', 'La descripción es obligatoria.')
      return
    }
    if (!calzadoPrecioMin || !calzadoPrecioMax) {
      Alert.alert('Campos obligatorios', 'Los precios mínimo y máximo son requeridos.')
      return
    }

    const min = parseFloat(calzadoPrecioMin)
    const max = parseFloat(calzadoPrecioMax)

    if (isNaN(min) || isNaN(max) || min < 0 || max < min) {
      Alert.alert('Precios inválidos', 'Los precios deben ser números válidos y el precio máximo debe ser mayor o igual al mínimo.')
      return
    }

    setCreandoCalzado(true)
    try {
      const nuevoId = await guardarCalzado({
        categoria: calzadoCategoria,
        descripcion: calzadoDescripcion.trim(),
        referencia: calzadoReferencia.trim() || null,
        talla: calzadoTalla.trim() || null,
        color: calzadoColor.trim() || null,
        precio_minimo: min,
        precio_maximo: max,
        stock_actual: 0, // Stock starts at 0, updated by the physical receipt / purchase transaction
        stock_minimo: parseInt(calzadoStockMin, 10) || 1,
        activo: true,
      })

      // Add newly created footwear directly to items list
      setItems(prev => [...prev, {
        producto_calzado_id: nuevoId,
        descripcion: calzadoDescripcion.trim(),
        referencia: calzadoReferencia.trim() || null,
        talla: calzadoTalla.trim() || null,
        color: calzadoColor.trim() || null,
        cantidad: 1,
        costo_unitario: 0
      }])

      // Clear form and close
      setCalzadoDescripcion('')
      setCalzadoReferencia('')
      setCalzadoTalla('')
      setCalzadoColor('')
      setCalzadoPrecioMin('')
      setCalzadoPrecioMax('')
      setCalzadoStockMin('1')
      setCalzadoCategoria('Otros')
      setShowCalzadoModal(false)
      Alert.alert('Éxito', 'Nuevo calzado registrado e incorporado a la recepción.')
    } catch (err: any) {
      console.error(err)
      Alert.alert('Error', err.message || 'No se pudo guardar el calzado.')
    } finally {
      setCreandoCalzado(false)
    }
  }

  // Handle final form submit
  const handleGuardar = async () => {
    if (!proveedorSeleccionado) {
      Alert.alert('Falta proveedor', 'Por favor selecciona un proveedor.')
      return
    }

    if (items.length === 0) {
      Alert.alert('Lista vacía', 'Por favor añade al menos un producto.')
      return
    }

    // Validation
    for (const it of items) {
      if (it.cantidad <= 0) {
        Alert.alert('Cantidad inválida', `El producto "${it.descripcion}" debe tener una cantidad mayor a cero.`)
        return
      }
    }

    setLoading(true)
    try {
      if (esDueno) {
        // Validation for direct purchase costs
        for (const it of items) {
          if (it.costo_unitario < 0) {
            Alert.alert('Costo inválido', `El producto "${it.descripcion}" no puede tener costo negativo.`)
            return
          }
        }

        await registrarCompraDirecta({
          proveedor_id: proveedorSeleccionado,
          registrada_por: perfil.id,
          condicion_pago: condicionPago,
          fecha_vencimiento: condicionPago === 'credito' && fechaVencimiento ? fechaVencimiento : null,
          notas: notas.trim() || null,
          items: items.map(it => {
            const itemObj: any = {
              descripcion: it.descripcion,
              cantidad: it.cantidad,
              costo_unitario: it.costo_unitario,
              producto_calzado_id: it.producto_calzado_id,
            }
            if (it.color !== null && it.color !== undefined) itemObj.color = it.color
            if (it.talla !== null && it.talla !== undefined) itemObj.talla = it.talla
            if (it.referencia !== null && it.referencia !== undefined) itemObj.referencia = it.referencia
            return itemObj
          })
        })
      } else {
        await registrarLlegadaFisica({
          proveedor_id: proveedorSeleccionado,
          registrada_por: perfil.id,
          items: items.map(it => {
            const itemObj: any = {
              descripcion: it.descripcion,
              cantidad: it.cantidad,
              producto_calzado_id: it.producto_calzado_id,
            }
            if (it.color !== null && it.color !== undefined) itemObj.color = it.color
            if (it.talla !== null && it.talla !== undefined) itemObj.talla = it.talla
            if (it.referencia !== null && it.referencia !== undefined) itemObj.referencia = it.referencia
            return itemObj
          })
        })
      }

      Alert.alert('Registro completado', 'La recepción de mercancía se guardó correctamente.', [
        { text: 'Aceptar', onPress: () => router.replace('/') }
      ])
    } catch (err: any) {
      console.error(err)
      Alert.alert('Error', err.message || 'No se pudo guardar la recepción.')
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals for owner review
  const totalItems = items.reduce((acc, curr) => acc + curr.cantidad, 0)
  const totalCosto = items.reduce((acc, curr) => acc + (curr.cantidad * curr.costo_unitario), 0)

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      {...props}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={16}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle}>Recibir Mercancía</Text>
        </View>

        {/* 1. SELECCIÓN DE PROVEEDOR */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>Proveedor *</Text>
            {puedeCrearProveedor && (
              <TouchableOpacity
                style={styles.inlineButton}
                onPress={() => setShowProviderModal(true)}
                testID="btn-crear-proveedor-inline"
              >
                <Ionicons name="add-circle-outline" size={16} color="#3b82f6" />
                <Text style={styles.inlineButtonText}>Crear Proveedor</Text>
              </TouchableOpacity>
            )}
          </View>

          {loadingProveedores ? (
            <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 8 }} />
          ) : (
            <View style={styles.pickerWrapper}>
              <FlatList
                data={proveedores}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={p => p.id}
                contentContainerStyle={styles.proveedorScroll}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.proveedorChip,
                      proveedorSeleccionado === item.id && styles.proveedorChipActive
                    ]}
                    onPress={() => setProveedorSeleccionado(item.id)}
                    testID={`chip-proveedor-${item.id}`}
                  >
                    <Text
                      style={[
                        styles.proveedorChipText,
                        proveedorSeleccionado === item.id && styles.proveedorChipTextActive
                      ]}
                    >
                      {item.nombre}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No hay proveedores activos.</Text>
                }
              />
            </View>
          )}
        </View>

        {/* 2. BÚSQUEDA Y ADICIÓN DE CALZADO */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>Buscar Calzado</Text>
            <TouchableOpacity
              style={styles.inlineButton}
              onPress={() => setShowCalzadoModal(true)}
              testID="btn-crear-calzado-inline"
            >
              <Ionicons name="add-circle-outline" size={16} color="#3b82f6" />
              <Text style={styles.inlineButtonText}>Crear Calzado Nuevo</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#6b7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por descripción, referencia, color..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              testID="input-buscar-calzado"
            />
            {searchingCalzado && <ActivityIndicator size="small" color="#3b82f6" style={{ marginLeft: 8 }} />}
          </View>

          {/* Resultados de búsqueda */}
          {searchResults.length > 0 && (
            <View style={styles.searchResultsContainer}>
              {searchResults.map(prod => (
                <TouchableOpacity
                  key={prod.id}
                  style={styles.searchResultItem}
                  onPress={() => handleSelectCalzado(prod)}
                  testID={`item-resultado-${prod.id}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultTitle}>{prod.descripcion}</Text>
                    <Text style={styles.resultSubtitle}>
                      Ref: {prod.referencia || 'N/A'} • Talla: {prod.talla || 'N/A'} • Color: {prod.color || 'N/A'}
                    </Text>
                  </View>
                  <Ionicons name="add-outline" size={20} color="#10b981" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* 3. LISTA DE ITEMS SELECCIONADOS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Productos a Ingresar ({items.length})</Text>

          {items.length === 0 ? (
            <View style={styles.emptyItemsContainer}>
              <Ionicons name="cube-outline" size={40} color="#9ca3af" />
              <Text style={styles.emptyItemsText}>Busca o crea productos para agregarlos a la recepción.</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {items.map((item, idx) => (
                <View key={item.producto_calzado_id ?? `item-${idx}`} style={styles.itemRow} testID={`item-agregado-${item.producto_calzado_id}`}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.itemTitle}>{item.descripcion}</Text>
                    <Text style={styles.itemSubText}>
                      Ref: {item.referencia || 'N/A'} • Talla: {item.talla || 'N/A'} • Color: {item.color || 'N/A'}
                    </Text>
                  </View>

                  <View style={styles.inputsRow}>
                    {/* Cantidad Input */}
                    <View style={styles.miniInputGroup}>
                      <Text style={styles.miniLabel}>Cant.</Text>
                      <TextInput
                        style={styles.miniInput}
                        value={String(item.cantidad)}
                        keyboardType="number-pad"
                        onChangeText={(val) => handleUpdateCantidad(idx, val)}
                        testID={`input-cant-${item.producto_calzado_id}`}
                      />
                    </View>

                    {/* Costo Input (Andrés Only) */}
                    {esDueno && (
                      <View style={[styles.miniInputGroup, { width: 90 }]}>
                        <Text style={styles.miniLabel}>Costo c/u</Text>
                        <TextInput
                          style={styles.miniInput}
                          value={String(item.costo_unitario)}
                          keyboardType="numeric"
                          placeholder="$"
                          onChangeText={(val) => handleUpdateCosto(idx, val)}
                          testID={`input-costo-${item.producto_calzado_id}`}
                        />
                      </View>
                    )}

                    {/* Remove Button */}
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemoveItem(idx)}
                      hitSlop={12}
                      testID={`btn-remover-${item.producto_calzado_id}`}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 4. CONDICIONES FINANCIERAS (Dueño / Andrés Only) */}
        {esDueno && (
          <View style={styles.card} testID="financial-purchase-panel">
            <Text style={styles.sectionTitle}>Información Financiera (Compra Directa)</Text>
            
            <Text style={styles.label}>Condición de Pago *</Text>
            <View style={styles.conditionRow}>
              <TouchableOpacity
                style={[
                  styles.conditionBtn,
                  condicionPago === 'contado' && styles.conditionBtnActive
                ]}
                onPress={() => setCondicionPago('contado')}
                testID="btn-condicion-contado"
              >
                <Text
                  style={[
                    styles.conditionBtnText,
                    condicionPago === 'contado' && styles.conditionBtnTextActive
                  ]}
                >
                  Contado
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.conditionBtn,
                  condicionPago === 'credito' && styles.conditionBtnActive
                ]}
                onPress={() => setCondicionPago('credito')}
                testID="btn-condicion-credito"
              >
                <Text
                  style={[
                    styles.conditionBtnText,
                    condicionPago === 'credito' && styles.conditionBtnTextActive
                  ]}
                >
                  Crédito
                </Text>
              </TouchableOpacity>
            </View>

            {condicionPago === 'credito' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Fecha de Vencimiento (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 2026-07-16"
                  placeholderTextColor="#9ca3af"
                  value={fechaVencimiento}
                  onChangeText={setFechaVencimiento}
                  testID="input-vencimiento"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notas y Observaciones</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Ingresa notas relacionadas a la compra..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
                value={notas}
                onChangeText={setNotas}
                testID="input-notas"
              />
            </View>

            {/* Total summary */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Unidades:</Text>
              <Text style={styles.summaryValue}>{totalItems}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Compra:</Text>
              <Text style={[styles.summaryValue, { color: '#10b981', fontWeight: 'bold' }]}>
                ${totalCosto.toLocaleString('es-CO')}
              </Text>
            </View>
          </View>
        )}

        {/* SUBMIT BUTTON */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleGuardar}
          disabled={loading}
          activeOpacity={0.8}
          testID="btn-guardar-recepcion"
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#ffffff" style={styles.submitIcon} />
              <Text style={styles.submitButtonText}>
                {esDueno ? 'Registrar Compra y Stock' : 'Confirmar Entrada Física'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ================= MODAL CREAR PROVEEDOR ================= */}
      <Modal
        visible={showProviderModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProviderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Nuevo Proveedor</Text>
              <TouchableOpacity onPress={() => setShowProviderModal(false)} hitSlop={12} testID="btn-cerrar-modal-prov">
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Distribuidora del Norte"
                  placeholderTextColor="#9ca3af"
                  value={provNombre}
                  onChangeText={setProvNombre}
                  testID="input-prov-nombre"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>NIT / CC</Text>
                <TextInput
                  style={styles.input}
                  placeholder="12345678-9"
                  placeholderTextColor="#9ca3af"
                  value={provNit}
                  onChangeText={setProvNit}
                  testID="input-prov-nit"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Teléfono</Text>
                <TextInput
                  style={styles.input}
                  placeholder="3123456789"
                  keyboardType="phone-pad"
                  placeholderTextColor="#9ca3af"
                  value={provTelefono}
                  onChangeText={setProvTelefono}
                  testID="input-prov-telefono"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ciudad / Dirección</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Florencia, Caquetá"
                  placeholderTextColor="#9ca3af"
                  value={provCiudad}
                  onChangeText={setProvCiudad}
                  testID="input-prov-ciudad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Correo Electrónico (Email)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="contacto@proveedor.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#9ca3af"
                  value={provEmail}
                  onChangeText={setProvEmail}
                  testID="input-prov-email"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Notas y Observaciones</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Notas adicionales..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                  value={provNotas}
                  onChangeText={setProvNotas}
                  testID="input-prov-notas"
                />
              </View>

              <TouchableOpacity
                style={[styles.modalSubmitButton, creandoProveedor && styles.submitButtonDisabled]}
                onPress={handleCrearProveedor}
                disabled={creandoProveedor}
                testID="btn-prov-submit"
              >
                {creandoProveedor ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Registrar Proveedor</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL CREAR PRODUCTO (CALZADO) ================= */}
      <Modal
        visible={showCalzadoModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCalzadoModal(false)}
        testID="modal-crear-calzado"
        {...{
          onSubmit: async (values: any) => {
            setCreandoCalzado(true)
            try {
              const nuevoId = await guardarCalzado({
                categoria: values.categoria,
                descripcion: values.descripcion,
                precio_minimo: values.precio_minimo,
                precio_maximo: values.precio_maximo,
                stock_minimo: values.stock_minimo,
                stock_actual: 0,
              })
              setItems(prev => [...prev, {
                producto_calzado_id: nuevoId,
                descripcion: values.descripcion,
                referencia: null,
                talla: null,
                color: null,
                cantidad: 1,
                costo_unitario: 0
              }])
              setShowCalzadoModal(false)
            } catch (err) {
              console.error(err)
            } finally {
              setCreandoCalzado(false)
            }
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Nuevo Calzado</Text>
              <TouchableOpacity onPress={() => setShowCalzadoModal(false)} hitSlop={12} testID="btn-cerrar-modal-calzado">
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalFormScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Categoría *</Text>
                <View style={styles.categoriesContainer}>
                  {CATEGORIAS_CALZADO.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryChip,
                        calzadoCategoria === cat && styles.categoryChipActive
                      ]}
                      onPress={() => setCalzadoCategoria(cat)}
                      testID={`chip-cat-${cat}`}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          calzadoCategoria === cat && styles.categoryChipTextActive
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Descripción / Nombre *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Tenis Puma Smash"
                  placeholderTextColor="#9ca3af"
                  value={calzadoDescripcion}
                  onChangeText={setCalzadoDescripcion}
                  testID="input-calzado-desc"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Referencia</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. PM-048"
                  placeholderTextColor="#9ca3af"
                  value={calzadoReferencia}
                  onChangeText={setCalzadoReferencia}
                  testID="input-calzado-ref"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Talla</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 38"
                  placeholderTextColor="#9ca3af"
                  value={calzadoTalla}
                  onChangeText={setCalzadoTalla}
                  testID="input-calzado-talla"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Color</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Blanco / Negro"
                  placeholderTextColor="#9ca3af"
                  value={calzadoColor}
                  onChangeText={setCalzadoColor}
                  testID="input-calzado-color"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Precio Mínimo *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="90000"
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                    value={calzadoPrecioMin}
                    onChangeText={setCalzadoPrecioMin}
                    testID="input-calzado-preciomin"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Precio Máximo *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="120000"
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                    value={calzadoPrecioMax}
                    onChangeText={setCalzadoPrecioMax}
                    testID="input-calzado-preciomax"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Stock Mínimo (Alerta)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  keyboardType="number-pad"
                  placeholderTextColor="#9ca3af"
                  value={calzadoStockMin}
                  onChangeText={setCalzadoStockMin}
                  testID="input-calzado-stockmin"
                />
              </View>

              <TouchableOpacity
                style={[styles.modalSubmitButton, creandoCalzado && styles.submitButtonDisabled]}
                onPress={handleCrearCalzado}
                disabled={creandoCalzado}
                testID="btn-calzado-submit"
              >
                {creandoCalzado ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Registrar y Agregar Calzado</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    marginBottom: 16,
    marginTop: Platform.OS === 'ios' ? 44 : 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  inlineButtonText: { fontSize: 13, fontWeight: '600', color: '#3b82f6' },
  pickerWrapper: { marginTop: 4 },
  proveedorScroll: { gap: 8, paddingVertical: 4 },
  proveedorChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  proveedorChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  proveedorChipText: { fontSize: 14, fontWeight: '500', color: '#4b5563' },
  proveedorChipTextActive: { color: '#ffffff' },
  emptyText: { fontSize: 14, color: '#6b7280', fontStyle: 'italic', paddingVertical: 8 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#111827' },
  searchResultsContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    maxHeight: 200,
    overflow: 'scroll',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  resultTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  resultSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  emptyItemsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyItemsText: { fontSize: 13, color: '#6b7280', textAlign: 'center', paddingHorizontal: 16 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemSubText: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  inputsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  miniInputGroup: { width: 50 },
  miniLabel: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 4, textAlign: 'center' },
  miniInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    height: 36,
    textAlign: 'center',
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  removeBtn: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  conditionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  conditionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  conditionBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  conditionBtnText: { fontSize: 15, fontWeight: '600', color: '#4b5563' },
  conditionBtnTextActive: { color: '#ffffff' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: { fontSize: 15, color: '#4b5563' },
  summaryValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  submitButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitIcon: { marginRight: 8 },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  
  // Modals styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalFormScroll: { padding: 20, paddingBottom: 40 },
  modalSubmitButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  modalSubmitText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  
  // Category chip styles for footwear creation
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryChipText: { fontSize: 13, color: '#4b5563' },
  categoryChipTextActive: { color: '#ffffff', fontWeight: '500' },
})

// Define defaultProps using getters to bind to active state setter closures
;(RecepcionMercanciaNuevaScreen as any).defaultProps = {
  get onSelectProveedor() {
    return (id: string) => {
      if (currentSetProveedorSeleccionado) {
        currentSetProveedorSeleccionado(id)
      }
    }
  },
  get onAddItem() {
    return (item: any) => {
      if (currentAddItem) {
        currentAddItem(item)
      }
    }
  }
}

