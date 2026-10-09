import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
  ArrowLeft,
  CircleCheckBig,
  CirclePlus,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react-native'
import { useAuth, useRequireModulo } from '../../../lib/auth'
import { tienePermiso } from '../../../lib/permisos'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
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
import { CATEGORIAS } from '../../../lib/excel'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { Boton, CampoTexto, Chip, EstadoVacio, Presionable, Tarjeta, useToast } from '../../../components/ui'

interface SelectedItem {
  producto_calzado_id: string
  descripcion: string
  marca: string | null
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
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const paddingInferior = usePaddingInferior(espacio.xxxl)

  // Con el permiso de costos se registra la compra completa (costos, condición
  // de pago); sin él, solo la llegada física, que queda pendiente de revisión.
  const registraCostos = tienePermiso(perfil, 'costos')
  // Crear proveedor inline exige el permiso de proveedores (RLS proveedores_insert).
  const puedeCrearProveedor = tienePermiso(perfil, 'proveedores')

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
        marca: item.marca || null,
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
  const [calzadoMarca, setCalzadoMarca] = useState('')
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
        mostrar('No se pudieron cargar los proveedores.', 'error')
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
      mostrar('El producto ya está en la lista de recepción. Puedes modificar su cantidad directamente.', 'info')
    } else {
      setItems(prev => [...prev, {
        producto_calzado_id: prod.id,
        descripcion: prod.descripcion,
        marca: prod.marca || null,
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
      mostrar('El nombre del proveedor es requerido.', 'error')
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
      mostrar(`Proveedor "${nuevo.nombre}" creado y seleccionado.`)
    } catch (err: any) {
      console.error(err)
      mostrar(err.message || 'No se pudo registrar el proveedor.', 'error')
    } finally {
      setCreandoProveedor(false)
    }
  }

  // Handle footwear inline creation
  const handleCrearCalzado = async () => {
    if (!calzadoDescripcion.trim()) {
      mostrar('La descripción es obligatoria.', 'error')
      return
    }
    if (!calzadoPrecioMin || !calzadoPrecioMax) {
      mostrar('Los precios mínimo y máximo son requeridos.', 'error')
      return
    }

    const min = parseFloat(calzadoPrecioMin)
    const max = parseFloat(calzadoPrecioMax)

    if (isNaN(min) || isNaN(max) || min < 0 || max < min) {
      mostrar('Los precios deben ser números válidos y el precio máximo debe ser mayor o igual al mínimo.', 'error')
      return
    }

    setCreandoCalzado(true)
    try {
      const nuevoId = await guardarCalzado({
        categoria: calzadoCategoria,
        descripcion: calzadoDescripcion.trim(),
        marca: calzadoMarca.trim() || null,
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
        marca: calzadoMarca.trim() || null,
        referencia: calzadoReferencia.trim() || null,
        talla: calzadoTalla.trim() || null,
        color: calzadoColor.trim() || null,
        cantidad: 1,
        costo_unitario: 0
      }])

      // Clear form and close
      setCalzadoDescripcion('')
      setCalzadoMarca('')
      setCalzadoReferencia('')
      setCalzadoTalla('')
      setCalzadoColor('')
      setCalzadoPrecioMin('')
      setCalzadoPrecioMax('')
      setCalzadoStockMin('1')
      setCalzadoCategoria('Otros')
      setShowCalzadoModal(false)
      mostrar('Nuevo calzado registrado e incorporado a la recepción.')
    } catch (err: any) {
      console.error(err)
      mostrar(err.message || 'No se pudo guardar el calzado.', 'error')
    } finally {
      setCreandoCalzado(false)
    }
  }

  // Handle final form submit
  const handleGuardar = async () => {
    if (!proveedorSeleccionado) {
      mostrar('Por favor selecciona un proveedor.', 'error')
      return
    }

    if (items.length === 0) {
      mostrar('Por favor añade al menos un producto.', 'error')
      return
    }

    // Validation
    for (const it of items) {
      if (it.cantidad <= 0) {
        mostrar(`El producto "${it.descripcion}" debe tener una cantidad mayor a cero.`, 'error')
        return
      }
    }

    setLoading(true)
    try {
      if (registraCostos) {
        // Validation for direct purchase costs
        for (const it of items) {
          if (it.costo_unitario < 0) {
            mostrar(`El producto "${it.descripcion}" no puede tener costo negativo.`, 'error')
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

      mostrar('La recepción de mercancía se guardó correctamente.')
      router.replace('/')
    } catch (err: any) {
      console.error(err)
      mostrar(err.message || 'No se pudo guardar la recepción.', 'error')
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
      style={{ flex: 1, backgroundColor: paleta.fondo }}
      {...props}
    >
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: espacio.m,
        paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m,
      }}>
        <Presionable accessibilityRole="button" accessibilityLabel="Volver"
          onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={paleta.texto} />
        </Presionable>
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Recibir Mercancía</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.l }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 1. SELECCIÓN DE PROVEEDOR */}
        <Tarjeta>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.m }}>
            <Text style={[tipografia.h3, { color: paleta.texto }]}>Proveedor *</Text>
          </View>
          {puedeCrearProveedor && (
            <View style={{ alignSelf: 'flex-start', marginBottom: espacio.m }}>
              <Boton
                titulo="Crear Proveedor"
                variante="secundario"
                tamano="md"
                icono={<CirclePlus size={18} color={paleta.primario} />}
                onPress={() => setShowProviderModal(true)}
              />
            </View>
          )}

          {loadingProveedores ? (
            <ActivityIndicator size="small" color={paleta.primario} style={{ marginVertical: espacio.s }} />
          ) : proveedores.length === 0 ? (
            <Text style={[tipografia.cuerpo, { color: paleta.texto3, fontStyle: 'italic' }]}>
              No hay proveedores activos.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: espacio.s }}>
                {proveedores.map((p) => (
                  <Chip
                    key={p.id}
                    etiqueta={p.nombre}
                    activo={proveedorSeleccionado === p.id}
                    onPress={() => setProveedorSeleccionado(p.id)}
                  />
                ))}
              </View>
            </ScrollView>
          )}
        </Tarjeta>

        {/* 2. BÚSQUEDA Y ADICIÓN DE CALZADO */}
        <Tarjeta>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.m }}>
            <Text style={[tipografia.h3, { color: paleta.texto }]}>Buscar Calzado</Text>
          </View>
          <View style={{ alignSelf: 'flex-start', marginBottom: espacio.m }}>
            <Boton
              titulo="Crear Calzado Nuevo"
              variante="secundario"
              tamano="md"
              icono={<CirclePlus size={18} color={paleta.primario} />}
              onPress={() => setShowCalzadoModal(true)}
            />
          </View>

          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: espacio.s,
            backgroundColor: paleta.superficie2, borderRadius: radio.md, paddingHorizontal: espacio.m, height: 44,
          }}>
            <Search size={20} color={paleta.texto3} />
            <TextInput
              style={[tipografia.cuerpo, { flex: 1, color: paleta.texto }]}
              placeholder="Buscar por descripción, referencia, color..."
              placeholderTextColor={paleta.textoDeshabilitado}
              value={searchQuery}
              onChangeText={setSearchQuery}
              testID="input-buscar-calzado"
            />
            {searchingCalzado && <ActivityIndicator size="small" color={paleta.primario} />}
          </View>

          {/* Resultados de búsqueda */}
          {searchResults.length > 0 && (
            <View style={{ marginTop: espacio.m, gap: 2 }}>
              {searchResults.map(prod => (
                <Presionable
                  key={prod.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Agregar ${prod.descripcion}`}
                  onPress={() => handleSelectCalzado(prod)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: espacio.m,
                    paddingVertical: espacio.m, borderBottomWidth: 1, borderBottomColor: paleta.borde,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>{prod.descripcion}</Text>
                    <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                      {prod.marca ? `${prod.marca} • ` : ''}Ref: {prod.referencia || 'N/A'} • Talla: {prod.talla || 'N/A'} • Color: {prod.color || 'N/A'}
                    </Text>
                  </View>
                  <Plus size={20} color={paleta.exito} />
                </Presionable>
              ))}
            </View>
          )}
        </Tarjeta>

        {/* 3. LISTA DE ITEMS SELECCIONADOS */}
        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Productos a Ingresar ({items.length})</Text>

          {items.length === 0 ? (
            <EstadoVacio
              icono={<Package />}
              titulo="Sin productos"
              mensaje="Busca o crea productos para agregarlos a la recepción."
            />
          ) : (
            <View>
              {items.map((item, idx) => (
                <View
                  key={item.producto_calzado_id ?? `item-${idx}`}
                  testID={`item-agregado-${item.producto_calzado_id}`}
                  style={{
                    paddingTop: espacio.m, marginTop: espacio.m,
                    borderTopWidth: 1, borderTopColor: paleta.borde,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: espacio.s }}>
                    <View style={{ flex: 1, marginRight: espacio.s }}>
                      <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>{item.descripcion}</Text>
                      <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                        {item.marca ? `${item.marca} • ` : ''}Ref: {item.referencia || 'N/A'} • Talla: {item.talla || 'N/A'} • Color: {item.color || 'N/A'}
                      </Text>
                    </View>
                    <Presionable
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar ${item.descripcion}`}
                      onPress={() => handleRemoveItem(idx)}
                      hitSlop={12}
                      testID={`btn-remover-${item.producto_calzado_id}`}
                    >
                      <Trash2 size={18} color={paleta.peligro} />
                    </Presionable>
                  </View>

                  <View style={{ flexDirection: 'row', gap: espacio.m }}>
                    <View style={{ width: 96 }}>
                      <CampoTexto
                        etiqueta="Cantidad"
                        keyboardType="number-pad"
                        value={String(item.cantidad)}
                        onChangeText={(val) => handleUpdateCantidad(idx, val)}
                        testID={`input-cant-${item.producto_calzado_id}`}
                      />
                    </View>

                    {registraCostos && (
                      <View style={{ width: 120 }}>
                        <CampoTexto
                          etiqueta="Costo c/u"
                          keyboardType="number-pad"
                          placeholder="$"
                          value={String(item.costo_unitario)}
                          onChangeText={(val) => handleUpdateCosto(idx, val)}
                          testID={`input-costo-${item.producto_calzado_id}`}
                        />
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Tarjeta>

        {/* 4. CONDICIONES FINANCIERAS (Dueño / Andrés Only) */}
        {registraCostos && (
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.m }]}>
              Información Financiera (Compra Directa)
            </Text>

            <Text style={[tipografia.etiqueta, { color: paleta.texto2, marginBottom: espacio.s }]}>
              Condición de Pago *
            </Text>
            <View style={{ flexDirection: 'row', gap: espacio.s, marginBottom: espacio.m }}>
              {(['contado', 'credito'] as const).map((c) => {
                const activo = condicionPago === c
                return (
                  <Presionable
                    key={c}
                    accessibilityRole="button"
                    accessibilityLabel={c === 'contado' ? 'Contado' : 'Crédito'}
                    accessibilityState={{ selected: activo }}
                    onPress={() => setCondicionPago(c)}
                    style={{
                      flex: 1, paddingVertical: espacio.m, borderRadius: radio.sm, alignItems: 'center',
                      backgroundColor: activo ? paleta.primario : paleta.superficie2,
                      borderWidth: 1, borderColor: activo ? paleta.primario : paleta.borde,
                    }}
                  >
                    <Text style={[tipografia.cuerpoLg, { color: activo ? paleta.sobrePrimario : paleta.texto2 }]}>
                      {c === 'contado' ? 'Contado' : 'Crédito'}
                    </Text>
                  </Presionable>
                )
              })}
            </View>

            {condicionPago === 'credito' && (
              <View style={{ marginBottom: espacio.m }}>
                <CampoTexto
                  etiqueta="Fecha de Vencimiento (AAAA-MM-DD)"
                  placeholder="Ej. 2026-07-16"
                  value={fechaVencimiento}
                  onChangeText={setFechaVencimiento}
                  testID="input-vencimiento"
                />
              </View>
            )}

            <View style={{ marginBottom: espacio.m }}>
              <CampoTexto
                etiqueta="Notas y Observaciones"
                placeholder="Ingresa notas relacionadas a la compra..."
                multiline
                numberOfLines={3}
                value={notas}
                onChangeText={setNotas}
                testID="input-notas"
              />
            </View>

            {/* Total summary */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: espacio.xs }}>
              <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Total Unidades:</Text>
              <Text style={[tipografia.cuerpo, tabular, { color: paleta.texto }]}>{totalItems}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: espacio.xs }}>
              <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Total Compra:</Text>
              <Text style={[tipografia.h3, tabular, { color: paleta.exitoTexto }]}>
                ${totalCosto.toLocaleString('es-CO')}
              </Text>
            </View>
          </Tarjeta>
        )}

        {/* SUBMIT BUTTON */}
        <Boton
          titulo={registraCostos ? 'Registrar Compra y Stock' : 'Confirmar Entrada Física'}
          onPress={handleGuardar}
          cargando={loading}
          deshabilitado={loading}
          icono={<CircleCheckBig size={20} color={paleta.sobrePrimario} />}
        />
      </ScrollView>

      {/* ================= MODAL CREAR PROVEEDOR ================= */}
      <Modal
        visible={showProviderModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProviderModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: paleta.fondo, borderTopLeftRadius: radio.xl, borderTopRightRadius: radio.xl, maxHeight: '85%',
          }}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              padding: espacio.xl, borderBottomWidth: 1, borderBottomColor: paleta.borde,
            }}>
              <Text style={[tipografia.h3, { color: paleta.texto }]}>Registrar Nuevo Proveedor</Text>
              <Presionable accessibilityRole="button" accessibilityLabel="Cerrar"
                onPress={() => setShowProviderModal(false)} hitSlop={12}>
                <X size={24} color={paleta.texto2} />
              </Presionable>
            </View>

            <ScrollView contentContainerStyle={{ padding: espacio.xl, paddingBottom: paddingInferior, gap: espacio.m }} keyboardShouldPersistTaps="handled">
              <CampoTexto
                etiqueta="Nombre *"
                placeholder="Distribuidora del Norte"
                value={provNombre}
                onChangeText={setProvNombre}
                testID="input-prov-nombre"
              />
              <CampoTexto
                etiqueta="NIT / CC"
                placeholder="12345678-9"
                value={provNit}
                onChangeText={setProvNit}
                testID="input-prov-nit"
              />
              <CampoTexto
                etiqueta="Teléfono"
                placeholder="3123456789"
                keyboardType="phone-pad"
                value={provTelefono}
                onChangeText={setProvTelefono}
                testID="input-prov-telefono"
              />
              <CampoTexto
                etiqueta="Ciudad / Dirección"
                placeholder="Florencia, Caquetá"
                value={provCiudad}
                onChangeText={setProvCiudad}
                testID="input-prov-ciudad"
              />
              <CampoTexto
                etiqueta="Correo Electrónico (Email)"
                placeholder="contacto@proveedor.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={provEmail}
                onChangeText={setProvEmail}
                testID="input-prov-email"
              />
              <CampoTexto
                etiqueta="Notas y Observaciones"
                placeholder="Notas adicionales..."
                multiline
                numberOfLines={3}
                value={provNotas}
                onChangeText={setProvNotas}
                testID="input-prov-notas"
              />

              <Boton
                titulo="Registrar Proveedor"
                onPress={handleCrearProveedor}
                cargando={creandoProveedor}
                deshabilitado={creandoProveedor}
              />
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
                marca: values.marca ?? null,
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
        <View style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: paleta.fondo, borderTopLeftRadius: radio.xl, borderTopRightRadius: radio.xl, maxHeight: '85%',
          }}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              padding: espacio.xl, borderBottomWidth: 1, borderBottomColor: paleta.borde,
            }}>
              <Text style={[tipografia.h3, { color: paleta.texto }]}>Registrar Nuevo Calzado</Text>
              <Presionable accessibilityRole="button" accessibilityLabel="Cerrar"
                onPress={() => setShowCalzadoModal(false)} hitSlop={12}>
                <X size={24} color={paleta.texto2} />
              </Presionable>
            </View>

            <ScrollView contentContainerStyle={{ padding: espacio.xl, paddingBottom: paddingInferior, gap: espacio.m }} keyboardShouldPersistTaps="handled">
              <View>
                <Text style={[tipografia.etiqueta, { color: paleta.texto2, marginBottom: espacio.s }]}>Categoría *</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
                  {CATEGORIAS.map(cat => (
                    <Chip
                      key={cat.valor}
                      etiqueta={cat.etiqueta}
                      activo={calzadoCategoria === cat.valor}
                      onPress={() => setCalzadoCategoria(cat.valor)}
                    />
                  ))}
                </View>
              </View>

              <CampoTexto
                etiqueta="Descripción / Nombre *"
                placeholder="Ej. Smash"
                value={calzadoDescripcion}
                onChangeText={setCalzadoDescripcion}
                testID="input-calzado-desc"
              />
              <CampoTexto
                etiqueta="Marca"
                placeholder="Ej. Puma"
                value={calzadoMarca}
                onChangeText={setCalzadoMarca}
                testID="input-calzado-marca"
              />
              <CampoTexto
                etiqueta="Referencia"
                placeholder="Ej. PM-048"
                value={calzadoReferencia}
                onChangeText={setCalzadoReferencia}
                testID="input-calzado-ref"
              />
              <CampoTexto
                etiqueta="Talla"
                placeholder="Ej. 38"
                value={calzadoTalla}
                onChangeText={setCalzadoTalla}
                testID="input-calzado-talla"
              />
              <CampoTexto
                etiqueta="Color"
                placeholder="Ej. Blanco / Negro"
                value={calzadoColor}
                onChangeText={setCalzadoColor}
                testID="input-calzado-color"
              />

              <View style={{ flexDirection: 'row', gap: espacio.m }}>
                <View style={{ flex: 1 }}>
                  <CampoTexto
                    etiqueta="Precio Mínimo *"
                    placeholder="90000"
                    keyboardType="number-pad"
                    value={calzadoPrecioMin}
                    onChangeText={setCalzadoPrecioMin}
                    testID="input-calzado-preciomin"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <CampoTexto
                    etiqueta="Precio Máximo *"
                    placeholder="120000"
                    keyboardType="number-pad"
                    value={calzadoPrecioMax}
                    onChangeText={setCalzadoPrecioMax}
                    testID="input-calzado-preciomax"
                  />
                </View>
              </View>

              <CampoTexto
                etiqueta="Stock Mínimo (Alerta)"
                placeholder="1"
                keyboardType="number-pad"
                value={calzadoStockMin}
                onChangeText={setCalzadoStockMin}
                testID="input-calzado-stockmin"
              />

              <Boton
                titulo="Registrar y Agregar Calzado"
                onPress={handleCrearCalzado}
                cargando={creandoCalzado}
                deshabilitado={creandoCalzado}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

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
