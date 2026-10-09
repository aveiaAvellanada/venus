import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import {
  ArrowLeft,
  CircleAlert,
  CircleCheckBig,
  CreditCard,
  MessageCircle,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  X,
} from 'lucide-react-native'
import { useAuth, useRequireModulo } from '../../../lib/auth'
import { tienePermiso } from '../../../lib/permisos'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import {
  obtenerProveedorPorId,
  listarCuentasBancarias,
  crearCuentaBancaria,
  eliminarCuentaBancaria,
  obtenerWhatsAppLink,
  obtenerDeudaProveedor,
  listarCompras,
  listarPagosProveedor,
  registrarPagoProveedor,
  type Proveedor,
  type CuentaBancaria,
  type Compra,
  type CompraPago,
} from '../../../lib/proveedores'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { Badge, Boton, CampoTexto, CirculoIcono, EstadoVacio, Presionable, Tarjeta, useToast } from '../../../components/ui'

export default function ProveedorDetailScreen() {
  const requireModulo = useRequireModulo('proveedores')
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const paddingInferior = usePaddingInferior(espacio.xxxl)
  const { mostrar } = useToast()

  // General States
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [email, setEmail] = useState('')
  const [parsedNotas, setParsedNotas] = useState('')
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([])
  const [loadingGeneral, setLoadingGeneral] = useState(true)

  // Bank Account Modal Form State
  const [cuentaModalVisible, setCuentaModalVisible] = useState(false)
  const [banco, setBanco] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState<'ahorros' | 'corriente'>('ahorros')
  const [numeroCuenta, setNumeroCuenta] = useState('')
  const [titular, setTitular] = useState('')
  const [guardandoCuenta, setGuardandoCuenta] = useState(false)

  // Financial States (Owner-Only)
  const [deudaTotal, setDeudaTotal] = useState<number>(0)
  const [comprasCredito, setComprasCredito] = useState<Compra[]>([])
  const [historialPagos, setHistorialPagos] = useState<CompraPago[]>([])
  const [loadingFinanzas, setLoadingFinanzas] = useState(false)

  // Payment Modal State
  const [pagoModalVisible, setPagoModalVisible] = useState(false)
  const [compraSeleccionada, setCompraSeleccionada] = useState<Compra | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [notasPago, setNotasPago] = useState('')
  const [guardandoPago, setGuardandoPago] = useState(false)

  // Load General Information
  const cargarInformacionGeneral = useCallback(async () => {
    if (!id) return
    try {
      setLoadingGeneral(true)
      const [dataProveedor, dataCuentas] = await Promise.all([
        obtenerProveedorPorId(id),
        listarCuentasBancarias(id),
      ])

      setProveedor(dataProveedor)
      setCuentas(dataCuentas)

      if (dataProveedor) {
        const dbNotes = dataProveedor.notas || ''
        const emailMatch = dbNotes.match(/^Email:\s*(.*?)(?:\n|$)/)
        if (emailMatch) {
          setEmail(emailMatch[1])
          setParsedNotas(dbNotes.slice(emailMatch[0].length))
        } else {
          setEmail('')
          setParsedNotas(dbNotes)
        }
      }
    } catch (err: any) {
      console.error('Error al cargar info general:', err)
      mostrar('No se pudo cargar la información general del proveedor.', 'error')
    } finally {
      setLoadingGeneral(false)
    }
  }, [id])

  // Información financiera (deuda, compras a crédito, pagos): permiso de deudas
  const cargarInformacionFinanciera = useCallback(async () => {
    if (!id || !tienePermiso(perfil, 'deudas')) return
    try {
      setLoadingFinanzas(true)
      const [totalDeuda, listaCompras, listaPagos] = await Promise.all([
        obtenerDeudaProveedor(id),
        listarCompras({ proveedor_id: id, estado: 'completada' }),
        listarPagosProveedor(id),
      ])

      setDeudaTotal(totalDeuda)

      // Filter purchases on client-side to only show completed credit purchases with pending balance
      const creditPurchases = listaCompras.filter(
        c => c.condicion_pago === 'credito' && Number(c.saldo_pendiente) > 0
      )
      setComprasCredito(creditPurchases)
      setHistorialPagos(listaPagos)
    } catch (err: any) {
      console.error('Error al cargar finanzas:', err)
      mostrar('No se pudo cargar la información financiera del proveedor.', 'error')
    } finally {
      setLoadingFinanzas(false)
    }
  }, [id, perfil])

  // Combined reloading on focus
  useFocusEffect(
    useCallback(() => {
      cargarInformacionGeneral()
      cargarInformacionFinanciera()
    }, [cargarInformacionGeneral, cargarInformacionFinanciera])
  )

  if (requireModulo) return requireModulo

  // WhatsApp contact trigger
  const handleWhatsAppContact = async (telefono: string | null) => {
    if (!telefono) {
      mostrar('Este proveedor no tiene teléfono registrado.', 'error')
      return
    }
    const defaultMessage = 'Hola, nos contactamos de la Tienda de Calzado Venus.'
    const url = obtenerWhatsAppLink(telefono, defaultMessage)
    if (!url) {
      mostrar('El formato del número de teléfono no es válido.', 'error')
      return
    }
    try {
      await Linking.openURL(url)
    } catch (error) {
      console.error('Error opening WhatsApp:', error)
      mostrar('No se pudo abrir WhatsApp. Por favor verifica si tienes la aplicación instalada.', 'error')
    }
  }

  // Create Bank Account
  const handleGuardarCuenta = async () => {
    if (!banco.trim() || !numeroCuenta.trim()) {
      mostrar('El banco y el número de cuenta son obligatorios.', 'error')
      return
    }
    if (!id) return

    try {
      setGuardandoCuenta(true)
      await crearCuentaBancaria({
        proveedor_id: id,
        banco: banco.trim(),
        tipo_cuenta: tipoCuenta,
        numero_cuenta: numeroCuenta.trim(),
        titular: titular.trim() || null,
      })
      mostrar('Cuenta bancaria agregada correctamente.')
      setCuentaModalVisible(false)
      // Reset form
      setBanco('')
      setTipoCuenta('ahorros')
      setNumeroCuenta('')
      setTitular('')
      // Reload accounts
      const updatedCuentas = await listarCuentasBancarias(id)
      setCuentas(updatedCuentas)
    } catch (err: any) {
      console.error('Error al guardar cuenta:', err)
      mostrar(err.message || 'No se pudo agregar la cuenta bancaria.', 'error')
    } finally {
      setGuardandoCuenta(false)
    }
  }

  // Delete Bank Account Prompt (confirmación destructiva: se mantiene en Alert.alert — Regla 9)
  const handleEliminarCuenta = (cuentaId: string) => {
    Alert.alert(
      'Eliminar Cuenta',
      '¿Estás seguro de que deseas eliminar esta cuenta bancaria?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarCuentaBancaria(cuentaId)
              mostrar('Cuenta bancaria eliminada.')
              if (id) {
                const updatedCuentas = await listarCuentasBancarias(id)
                setCuentas(updatedCuentas)
              }
            } catch (err: any) {
              console.error('Error al eliminar cuenta:', err)
              mostrar(err.message || 'No se pudo eliminar la cuenta.', 'error')
            }
          },
        },
      ]
    )
  }

  // Register Payment
  const handleGuardarPago = async () => {
    if (!compraSeleccionada || !perfil) return

    const monto = parseFloat(montoPago)
    if (isNaN(monto) || monto <= 0) {
      mostrar('El monto debe ser un número mayor a cero.', 'error')
      return
    }

    if (monto > Number(compraSeleccionada.saldo_pendiente)) {
      mostrar('El monto del pago supera el saldo pendiente de la compra.', 'error')
      return
    }

    try {
      setGuardandoPago(true)
      await registrarPagoProveedor({
        compra_id: compraSeleccionada.id,
        registrado_por: perfil.id,
        monto,
        notas: notasPago.trim() || null,
      })

      mostrar('Pago registrado correctamente.')
      setPagoModalVisible(false)
      setMontoPago('')
      setNotasPago('')
      setCompraSeleccionada(null)

      // Reload financial data
      await cargarInformacionFinanciera()
    } catch (err: any) {
      console.error('Error al guardar pago:', err)
      mostrar(err.message || 'No se pudo registrar el pago.', 'error')
    } finally {
      setGuardandoPago(false)
    }
  }

  const Encabezado = () => (
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
      <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} hitSlop={12}>
        <ArrowLeft size={24} color={paleta.texto} />
      </Presionable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]} numberOfLines={1}>
        {proveedor?.nombre || 'Detalle de Proveedor'}
      </Text>
    </View>
  )

  if (loadingGeneral) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: espacio.m }}>
          <ActivityIndicator size="large" color={paleta.primario} />
          <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Cargando detalle del proveedor...</Text>
        </View>
      </View>
    )
  }

  if (!proveedor) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: espacio.xl, gap: espacio.l }}>
          <EstadoVacio icono={<CircleAlert />} titulo="No se encontró el proveedor especificado." />
          <Boton titulo="Volver" variante="secundario" tamano="md" onPress={() => router.back()} />
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado />

      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.l }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Información General */}
        <Tarjeta>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.l }}>
            <Text style={[tipografia.h3, { color: paleta.texto }]}>Información General</Text>
            <Presionable
              accessibilityRole="button"
              accessibilityLabel="Editar información general"
              onPress={() => router.push(`/proveedores/editor?id=${proveedor.id}`)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}
            >
              <Pencil size={18} color={paleta.primario} />
              <Text style={[tipografia.etiqueta, { color: paleta.primario }]}>Editar</Text>
            </Presionable>
          </View>

          <View style={{ gap: espacio.l }}>
            <View>
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Nombre</Text>
              <Text style={[tipografia.cuerpo, { color: paleta.texto, marginTop: 2 }]}>{proveedor.nombre}</Text>
            </View>

            <View>
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>NIT / CC</Text>
              <Text style={[tipografia.cuerpo, { color: paleta.texto, marginTop: 2 }]}>
                {proveedor.nit_cedula || 'No registrado'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Teléfono</Text>
                <Text style={[tipografia.cuerpo, { color: paleta.texto, marginTop: 2 }]}>
                  {proveedor.telefono || 'No registrado'}
                </Text>
              </View>
              {proveedor.telefono && (
                <Presionable
                  accessibilityRole="button"
                  accessibilityLabel="Escribir por WhatsApp"
                  onPress={() => handleWhatsAppContact(proveedor.telefono)}
                  testID="whatsapp-btn"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: espacio.xs,
                    backgroundColor: paleta.exitoSoft,
                    paddingHorizontal: espacio.l,
                    paddingVertical: espacio.s,
                    borderRadius: radio.sm,
                  }}
                >
                  <MessageCircle size={18} color={paleta.exito} />
                  <Text style={[tipografia.etiqueta, { color: paleta.exitoTexto }]}>Escribir</Text>
                </Presionable>
              )}
            </View>

            <View>
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Ciudad / Dirección</Text>
              <Text style={[tipografia.cuerpo, { color: paleta.texto, marginTop: 2 }]}>
                {proveedor.ciudad || 'No registrado'}
              </Text>
            </View>

            {email ? (
              <View>
                <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Correo Electrónico (Email)</Text>
                <Text style={[tipografia.cuerpo, { color: paleta.texto, marginTop: 2 }]}>{email}</Text>
              </View>
            ) : null}

            {parsedNotas ? (
              <View>
                <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Notas</Text>
                <Text style={[tipografia.cuerpo, { color: paleta.texto, marginTop: 2 }]}>{parsedNotas}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m }}>
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Estado</Text>
              <Badge texto={proveedor.activo ? 'ACTIVO' : 'INACTIVO'} tipo={proveedor.activo ? 'exito' : 'peligro'} />
            </View>
          </View>
        </Tarjeta>

        {/* 2. Cuentas Bancarias */}
        <Tarjeta>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: espacio.l }}>
            <Text style={[tipografia.h3, { color: paleta.texto }]}>Cuentas Bancarias</Text>
            <Presionable
              accessibilityRole="button"
              accessibilityLabel="Agregar cuenta bancaria"
              onPress={() => setCuentaModalVisible(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}
            >
              <Plus size={18} color={paleta.primario} />
              <Text style={[tipografia.etiqueta, { color: paleta.primario }]}>Agregar</Text>
            </Presionable>
          </View>

          {cuentas.length === 0 ? (
            <EstadoVacio icono={<CreditCard />} titulo="No hay cuentas bancarias registradas." />
          ) : (
            cuentas.map((cuenta, idx) => (
              <View
                key={cuenta.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: espacio.m,
                  borderTopWidth: idx > 0 ? 1 : 0,
                  borderTopColor: paleta.borde,
                }}
              >
                <View style={{ flex: 1, marginRight: espacio.m }}>
                  <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>{cuenta.banco}</Text>
                  <Text style={[tipografia.caption, { color: paleta.texto2, marginTop: 2 }]}>
                    {cuenta.tipo_cuenta === 'ahorros' ? 'Ahorros' : 'Corriente'} · {cuenta.numero_cuenta}
                  </Text>
                  {cuenta.titular && (
                    <Text style={[tipografia.caption, { color: paleta.texto3, marginTop: 2 }]}>
                      Titular: {cuenta.titular}
                    </Text>
                  )}
                </View>
                <Presionable
                  accessibilityRole="button"
                  accessibilityLabel={`Eliminar cuenta ${cuenta.banco}`}
                  onPress={() => handleEliminarCuenta(cuenta.id)}
                  hitSlop={8}
                >
                  <Trash2 size={20} color={paleta.peligro} />
                </Presionable>
              </View>
            ))
          )}
        </Tarjeta>

        {/* 3. Panel financiero (permiso de deudas) */}
        {tienePermiso(perfil, 'deudas') && (
          <View testID="financial-panel" style={{ gap: espacio.l }}>
            {loadingFinanzas ? (
              <Tarjeta>
                <View style={{ alignItems: 'center', gap: espacio.s }}>
                  <ActivityIndicator size="small" color={paleta.primario} />
                  <Text style={[tipografia.caption, { color: paleta.texto2 }]}>
                    Cargando información financiera...
                  </Text>
                </View>
              </Tarjeta>
            ) : (
              <>
                {/* Deuda consolidada */}
                <Tarjeta estilo={{ backgroundColor: paleta.primarioSoft, borderColor: paleta.primario }}>
                  <Text style={[tipografia.etiqueta, { color: paleta.primario }]}>DEUDA TOTAL CONSOLIDADA</Text>
                  <Text style={[tipografia.h1, tabular, { color: paleta.texto, marginTop: 4 }]}>
                    ${deudaTotal.toLocaleString('es-CO')}
                  </Text>
                </Tarjeta>

                {/* Compras a crédito pendientes */}
                <Tarjeta>
                  <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.l }]}>
                    Compras a Crédito Pendientes
                  </Text>
                  {comprasCredito.length === 0 ? (
                    <EstadoVacio icono={<CircleCheckBig />} titulo="No hay compras con saldo pendiente." />
                  ) : (
                    comprasCredito.map((compra, idx) => (
                      <View
                        key={compra.id}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingVertical: espacio.m,
                          borderTopWidth: idx > 0 ? 1 : 0,
                          borderTopColor: paleta.borde,
                        }}
                      >
                        <View style={{ flex: 1, marginRight: espacio.m }}>
                          <Text style={[tipografia.caption, { color: paleta.texto2 }]}>
                            Fecha: {new Date(compra.created_at).toLocaleDateString('es-CO')}
                          </Text>
                          <Text style={[tipografia.caption, tabular, { color: paleta.texto3, marginTop: 2 }]}>
                            Total: ${Number(compra.total).toLocaleString('es-CO')}
                          </Text>
                          <Text style={[tipografia.cuerpo, tabular, { color: paleta.peligroTexto, marginTop: 2 }]}>
                            Saldo: ${Number(compra.saldo_pendiente).toLocaleString('es-CO')}
                          </Text>
                        </View>
                        <Boton
                          titulo="Registrar Pago"
                          variante="secundario"
                          tamano="md"
                          onPress={() => {
                            setCompraSeleccionada(compra)
                            setPagoModalVisible(true)
                          }}
                        />
                      </View>
                    ))
                  )}
                </Tarjeta>

                {/* Historial de pagos */}
                <Tarjeta>
                  <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.l }]}>Historial de Pagos</Text>
                  {historialPagos.length === 0 ? (
                    <EstadoVacio icono={<Receipt />} titulo="No se han registrado pagos para este proveedor." />
                  ) : (
                    historialPagos.map((pago, idx) => (
                      <View
                        key={pago.id}
                        style={{
                          paddingVertical: espacio.m,
                          borderTopWidth: idx > 0 ? 1 : 0,
                          borderTopColor: paleta.borde,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={[tipografia.cuerpoLg, tabular, { color: paleta.exitoTexto }]}>
                            ${Number(pago.monto).toLocaleString('es-CO')}
                          </Text>
                          <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{pago.fecha}</Text>
                        </View>
                        {pago.notas ? (
                          <Text style={[tipografia.caption, { color: paleta.texto2, marginTop: 2, fontStyle: 'italic' }]}>
                            {pago.notas}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  )}
                </Tarjeta>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* 4. Modal de nueva cuenta bancaria */}
      <Modal
        animationType="slide"
        transparent
        visible={cuentaModalVisible}
        onRequestClose={() => setCuentaModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ backgroundColor: paleta.fondo, borderTopLeftRadius: radio.xl, borderTopRightRadius: radio.xl, maxHeight: '85%' }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: espacio.xl,
                paddingVertical: espacio.l,
                borderBottomWidth: 1,
                borderBottomColor: paleta.borde,
              }}
            >
              <Text style={[tipografia.h3, { color: paleta.texto }]}>Nueva Cuenta Bancaria</Text>
              <Presionable
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={() => setCuentaModalVisible(false)}
                hitSlop={12}
              >
                <X size={24} color={paleta.texto2} />
              </Presionable>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: espacio.xl, paddingBottom: paddingInferior, gap: espacio.l }}
              showsVerticalScrollIndicator={false}
            >
              <CampoTexto
                etiqueta="Banco *"
                value={banco}
                onChangeText={setBanco}
                placeholder="ej: Bancolombia, Nequi, Daviplata"
                testID="input-banco"
              />

              <View>
                <Text style={[tipografia.etiqueta, { color: paleta.texto2, marginBottom: espacio.s }]}>
                  Tipo de Cuenta *
                </Text>
                <View style={{ flexDirection: 'row', gap: espacio.s }}>
                  {(['ahorros', 'corriente'] as const).map((tipo) => {
                    const activo = tipoCuenta === tipo
                    return (
                      <Presionable
                        key={tipo}
                        accessibilityRole="button"
                        accessibilityLabel={tipo === 'ahorros' ? 'Ahorros' : 'Corriente'}
                        accessibilityState={{ selected: activo }}
                        onPress={() => setTipoCuenta(tipo)}
                        style={{
                          flex: 1,
                          paddingVertical: espacio.m,
                          borderRadius: radio.sm,
                          alignItems: 'center',
                          backgroundColor: activo ? paleta.primarioSoft : paleta.superficie2,
                          borderWidth: 1,
                          borderColor: activo ? paleta.primario : paleta.borde,
                        }}
                      >
                        <Text style={[tipografia.cuerpo, { color: activo ? paleta.primario : paleta.texto2 }]}>
                          {tipo === 'ahorros' ? 'Ahorros' : 'Corriente'}
                        </Text>
                      </Presionable>
                    )
                  })}
                </View>
              </View>

              <CampoTexto
                etiqueta="Número de Cuenta *"
                value={numeroCuenta}
                onChangeText={setNumeroCuenta}
                placeholder="Número de cuenta"
                keyboardType="number-pad"
                testID="input-numero-cuenta"
              />

              <CampoTexto
                etiqueta="Titular (Opcional)"
                value={titular}
                onChangeText={setTitular}
                placeholder="Nombre del titular"
                testID="input-titular"
              />

              <Boton
                titulo="Guardar Cuenta"
                onPress={handleGuardarCuenta}
                cargando={guardandoCuenta}
                deshabilitado={guardandoCuenta}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* 5. Modal de registro de pago */}
      <Modal
        animationType="slide"
        transparent
        visible={pagoModalVisible}
        onRequestClose={() => {
          setPagoModalVisible(false)
          setCompraSeleccionada(null)
        }}
      >
        <View style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ backgroundColor: paleta.fondo, borderTopLeftRadius: radio.xl, borderTopRightRadius: radio.xl, maxHeight: '85%' }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: espacio.xl,
                paddingVertical: espacio.l,
                borderBottomWidth: 1,
                borderBottomColor: paleta.borde,
              }}
            >
              <Text style={[tipografia.h3, { color: paleta.texto }]}>Registrar Pago</Text>
              <Presionable
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                onPress={() => {
                  setPagoModalVisible(false)
                  setCompraSeleccionada(null)
                }}
                hitSlop={12}
              >
                <X size={24} color={paleta.texto2} />
              </Presionable>
            </View>

            {compraSeleccionada && (
              <ScrollView
                contentContainerStyle={{ padding: espacio.xl, paddingBottom: paddingInferior, gap: espacio.l }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ backgroundColor: paleta.superficie2, borderRadius: radio.sm, padding: espacio.l, gap: 4 }}>
                  <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>
                    Compra: {new Date(compraSeleccionada.created_at).toLocaleDateString('es-CO')}
                  </Text>
                  <Text style={[tipografia.cuerpo, tabular, { color: paleta.texto2 }]}>
                    Saldo Pendiente: ${Number(compraSeleccionada.saldo_pendiente).toLocaleString('es-CO')}
                  </Text>
                </View>

                <CampoTexto
                  etiqueta="Monto del Pago *"
                  value={montoPago}
                  onChangeText={setMontoPago}
                  placeholder="Monto en COP"
                  keyboardType="number-pad"
                  testID="input-monto-pago"
                />

                <CampoTexto
                  etiqueta="Notas / Observaciones"
                  value={notasPago}
                  onChangeText={setNotasPago}
                  placeholder="Comprobante, Nequi ref, etc."
                  multiline
                  numberOfLines={3}
                  testID="input-notas-pago"
                />

                <Boton
                  titulo="Registrar Pago"
                  onPress={handleGuardarPago}
                  cargando={guardandoPago}
                  deshabilitado={guardandoPago}
                />
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  )
}
