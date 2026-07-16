import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router'
import { ArrowLeft, CircleCheckBig, Wallet } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { obtenerCompraPorId, completarInformacionFinanciera } from '../../../lib/proveedores'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { Boton, CampoTexto, Presionable, Tarjeta, useToast } from '../../../components/ui'

export default function RecepcionDetalleFinancieroScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { perfil, cargando } = useAuth()
  const { paleta } = useTema()
  const { mostrar } = useToast()

  const [compra, setCompra] = useState<any>(null)
  const [cargandoCompra, setCargandoCompra] = useState(true)
  const [itemsCostos, setItemsCostos] = useState<Array<{ item_id: string; costo_unitario: number }>>([])
  const [condicionPago, setCondicionPago] = useState<'contado' | 'credito'>('contado')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Gating access control: Only owner (dueno) can access this detail page
  if (!cargando && (!perfil || perfil.rol !== 'dueno')) {
    return <Redirect href="/" />
  }

  useEffect(() => {
    async function cargarCompra() {
      if (!id) return
      try {
        setCargandoCompra(true)
        const data = await obtenerCompraPorId(id)
        if (data) {
          setCompra(data)
          setCondicionPago(data.condicion_pago === 'credito' ? 'credito' : 'contado')
          setFechaVencimiento(data.fecha_vencimiento || '')
          setNotas(data.notas || '')

          // Initialise item costs
          const initialCostos = (data.items || []).map((item: any) => ({
            item_id: item.id,
            costo_unitario: item.costo_unitario || 0,
          }))
          setItemsCostos(initialCostos)
        } else {
          mostrar('No se encontró la recepción física seleccionada.', 'error')
          router.back()
        }
      } catch (err: any) {
        console.error('Error al cargar la recepción:', err)
        mostrar('No se pudo cargar la información de la recepción.', 'error')
      } finally {
        setCargandoCompra(false)
      }
    }
    cargarCompra()
  }, [id])

  const handleCostoChange = (itemId: string, text: string) => {
    const val = text.replace(/[^0-9]/g, '')
    const num = parseInt(val, 10) || 0
    setItemsCostos(prev =>
      prev.map(c => (c.item_id === itemId ? { ...c, costo_unitario: num } : c))
    )
  }

  const calcularTotal = () => {
    if (!compra || !compra.items) return 0
    return compra.items.reduce((sum: number, item: any) => {
      const costObj = itemsCostos.find(c => c.item_id === item.id)
      const cost = costObj ? costObj.costo_unitario : 0
      return sum + item.cantidad * cost
    }, 0)
  }

  const handleCompletarFinanzas = async () => {
    if (!perfil || !id) return

    // Validations
    const inputsInvalidos = itemsCostos.some(c => c.costo_unitario <= 0)
    if (inputsInvalidos) {
      mostrar('El costo unitario de todos los productos debe ser mayor a cero.', 'error')
      return
    }

    if (condicionPago === 'credito' && !fechaVencimiento.trim()) {
      mostrar('La fecha de vencimiento es requerida para compras a crédito.', 'error')
      return
    }

    // Basic date format check YYYY-MM-DD
    if (condicionPago === 'credito') {
      const regexFecha = /^\d{4}-\d{2}-\d{2}$/
      if (!regexFecha.test(fechaVencimiento)) {
        mostrar('La fecha de vencimiento debe tener el formato AAAA-MM-DD.', 'error')
        return
      }
    }

    try {
      setGuardando(true)
      await completarInformacionFinanciera({
        compra_id: id,
        revisada_por: perfil.id,
        condicion_pago: condicionPago,
        fecha_vencimiento: condicionPago === 'credito' ? fechaVencimiento : null,
        notas: notas.trim() || null,
        itemsCostos: itemsCostos.map(c => ({
          item_id: c.item_id,
          costo_unitario: c.costo_unitario
        }))
      })

      mostrar('Información financiera guardada correctamente.')
      router.replace('/recibir-mercancia')
    } catch (err: any) {
      console.error('Error al guardar finanzas:', err)
      mostrar(err.message || 'Ocurrió un error al guardar los datos.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  if (cargandoCompra || cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, justifyContent: 'center', alignItems: 'center', padding: espacio.xl, gap: espacio.m }}>
        <ActivityIndicator size="large" color={paleta.primario} />
        <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Cargando recepción...</Text>
      </View>
    )
  }

  if (compra && compra.estado !== 'pendiente_revision') {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo, justifyContent: 'center', alignItems: 'center', padding: espacio.xl, gap: espacio.m }}>
        <CircleCheckBig size={64} color={paleta.exito} />
        <Text style={[tipografia.h2, { color: paleta.texto, textAlign: 'center' }]}>Recepción Completada</Text>
        <Text style={[tipografia.cuerpo, { color: paleta.texto2, textAlign: 'center' }]}>
          Esta mercancía ya cuenta con información financiera registrada.
        </Text>
        <Boton titulo="Volver al listado" variante="secundario" tamano="md" onPress={() => router.back()} />
      </View>
    )
  }

  const formatMoneda = (val: number) => {
    return `$${val.toLocaleString('es-CO')}`
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: paleta.fondo }}
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
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Completar Entrada</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: 120, gap: espacio.l }}>
        {/* Card de cabecera */}
        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.s }]}>Detalles de Recepción</Text>
          <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>
            Proveedor: {compra?.proveedor_nombre || 'Desconocido'}
          </Text>
          <Text style={[tipografia.cuerpo, { color: paleta.texto2, marginTop: 4 }]}>
            Fecha Entrada: {compra ? new Date(compra.created_at).toLocaleDateString('es-CO') : ''}
          </Text>
          <Text style={[tipografia.cuerpo, { color: paleta.texto2, marginTop: 4 }]}>
            Registrado por: {compra?.registrada_por_nombre || 'Empleado'}
          </Text>
        </Tarjeta>

        {/* Card de items */}
        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.m, borderBottomWidth: 1, borderBottomColor: paleta.borde, paddingBottom: espacio.s }]}>
            Productos Recibidos
          </Text>
          {(compra?.items || []).map((item: any, idx: number) => {
            const costObj = itemsCostos.find(c => c.item_id === item.id)
            const unitCost = costObj ? costObj.costo_unitario : 0
            return (
              <View
                key={item.id}
                style={{
                  borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: paleta.borde,
                  paddingTop: idx > 0 ? espacio.m : 0, marginTop: idx > 0 ? espacio.m : 0,
                  gap: espacio.s,
                }}
              >
                <View>
                  <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>{item.descripcion}</Text>
                  <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                    {item.color ? `Color: ${item.color}` : ''}
                    {item.talla ? ` | Talla: ${item.talla}` : ''}
                    {item.referencia ? ` | Ref: ${item.referencia}` : ''}
                  </Text>
                  <Text style={[tipografia.etiqueta, { color: paleta.texto2, marginTop: 2 }]}>
                    Cantidad recibida: {item.cantidad}
                  </Text>
                </View>

                <CampoTexto
                  etiqueta="Costo Unitario ($)"
                  keyboardType="number-pad"
                  placeholder="0"
                  value={unitCost > 0 ? String(unitCost) : ''}
                  onChangeText={(text) => handleCostoChange(item.id, text)}
                  testID={`cost-input-${item.id}`}
                />
                <Text style={[tipografia.caption, tabular, { color: paleta.exitoTexto, textAlign: 'right' }]}>
                  Subtotal: {formatMoneda(item.cantidad * unitCost)}
                </Text>
              </View>
            )
          })}
        </Tarjeta>

        {/* Card de condiciones financieras */}
        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.m }]}>Condiciones de Factura</Text>

          <Text style={[tipografia.etiqueta, { color: paleta.texto2, marginBottom: espacio.s }]}>Condición de Pago</Text>
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
                    backgroundColor: activo ? paleta.primarioSoft : paleta.superficie2,
                    borderWidth: 1, borderColor: activo ? paleta.primario : paleta.borde,
                  }}
                >
                  <Text style={[tipografia.cuerpoLg, { color: activo ? paleta.primario : paleta.texto2 }]}>
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
                placeholder="2026-07-16"
                value={fechaVencimiento}
                onChangeText={setFechaVencimiento}
                maxLength={10}
                testID="date-input"
              />
            </View>
          )}

          <CampoTexto
            etiqueta="Notas de la compra (Opcional)"
            placeholder="Ej. Factura #9812, pendiente descuento..."
            value={notas}
            onChangeText={setNotas}
            multiline
            numberOfLines={3}
            testID="notes-input"
          />
        </Tarjeta>

        {/* Resumen del total */}
        <View style={{
          backgroundColor: paleta.texto, borderRadius: radio.md, padding: espacio.xl, alignItems: 'center',
        }}>
          <Text style={[tipografia.micro, { color: paleta.textoDeshabilitado }]}>TOTAL COSTO COMPRA</Text>
          <Text style={[tipografia.h1, tabular, { color: paleta.fondo, marginTop: 4 }]}>
            {formatMoneda(calcularTotal())}
          </Text>
        </View>
      </ScrollView>

      {/* Botón de guardado fijo al fondo */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: paleta.fondo, padding: espacio.l,
        paddingBottom: Platform.OS === 'ios' ? espacio.xxxl : espacio.l,
        borderTopWidth: 1, borderTopColor: paleta.borde,
      }}>
        <Boton
          titulo="Guardar y Completar Recepción"
          onPress={handleCompletarFinanzas}
          cargando={guardando}
          deshabilitado={guardando}
          icono={<Wallet size={20} color={paleta.sobrePrimario} />}
        />
      </View>
    </KeyboardAvoidingView>
  )
}
