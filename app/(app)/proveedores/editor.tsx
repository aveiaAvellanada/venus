import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, ActivityIndicator, Switch, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Save } from 'lucide-react-native'
import { obtenerProveedorPorId, crearProveedor, actualizarProveedor } from '../../../lib/proveedores'
import { useRequireModulo } from '../../../lib/auth'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tipografia } from '../../../lib/theme'
import { CampoTexto, Presionable, Tarjeta, useToast } from '../../../components/ui'

export default function ProveedorEditorScreen() {
  const requireModulo = useRequireModulo('proveedores')
  const { id } = useLocalSearchParams<{ id?: string }>()
  const router = useRouter()
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const paddingBarraInferior = usePaddingInferior(espacio.l)

  // Form Fields State
  const [nombre, setNombre] = useState('')
  const [nitCedula, setNitCedula] = useState('')
  const [telefono, setTelefono] = useState('')
  const [ciudad, setCiudad] = useState('') // Maps to "Ciudad" in DB (address equivalent)
  const [email, setEmail] = useState('') // DB does not support email; will append to notas
  const [notas, setNotas] = useState('')
  const [activo, setActivo] = useState(true)

  // Loading States
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(!!id)

  useEffect(() => {
    async function cargarProveedor() {
      if (!id) return
      try {
        const data = await obtenerProveedorPorId(id)
        if (!data) {
          mostrar('No se encontró el proveedor especificado.', 'error')
          router.back()
          return
        }
        setNombre(data.nombre)
        setNitCedula(data.nit_cedula || '')
        setTelefono(data.telefono || '')
        setCiudad(data.ciudad || '')
        setActivo(data.activo)

        // Parse email and clean notes if stored with email prefix
        const dbNotes = data.notas || ''
        const emailMatch = dbNotes.match(/^Email:\s*(.*?)(?:\n|$)/)
        if (emailMatch) {
          setEmail(emailMatch[1])
          setNotas(dbNotes.slice(emailMatch[0].length))
        } else {
          setNotas(dbNotes)
        }
      } catch (err: any) {
        console.error('Error al cargar proveedor:', err)
        mostrar('No se pudieron cargar los datos del proveedor.', 'error')
        router.back()
      } finally {
        setFetching(false)
      }
    }

    cargarProveedor()
  }, [id])

  if (requireModulo) return requireModulo

  const handleGuardar = async () => {
    if (!nombre || nombre.trim() === '') {
      mostrar('El nombre del proveedor es requerido.', 'error')
      return
    }

    // Since DB lacks email column, format email at top of notes
    let notasFormateadas = notas
    if (email && email.trim() !== '') {
      notasFormateadas = `Email: ${email.trim()}\n${notas}`
    }

    const payload = {
      nombre: nombre.trim(),
      nit_cedula: nitCedula.trim() || null,
      telefono: telefono.trim() || null,
      ciudad: ciudad.trim() || null,
      notas: notasFormateadas.trim() || null,
      activo,
    }

    try {
      setLoading(true)
      if (id) {
        await actualizarProveedor(id, payload)
        mostrar('El proveedor ha sido actualizado correctamente.')
        router.back()
      } else {
        await crearProveedor(payload)
        mostrar('El proveedor ha sido registrado correctamente.')
        router.back()
      }
    } catch (err: any) {
      console.error('Error al guardar proveedor:', err)
      mostrar(err.message || 'No se pudo guardar el proveedor.', 'error')
    } finally {
      setLoading(false)
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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>
        {id ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      </Text>
    </View>
  )

  if (fetching) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: espacio.m }}>
          <ActivityIndicator size="large" color={paleta.primario} />
          <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Cargando datos del proveedor...</Text>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: paleta.fondo }}
    >
      <Encabezado />

      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: 120, gap: espacio.l }}
        showsVerticalScrollIndicator={false}
      >
        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.l }]}>Datos Generales</Text>

          <View style={{ gap: espacio.l }}>
            <CampoTexto
              etiqueta="Nombre del Proveedor *"
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej. Distribuidora del Caquetá"
              testID="input-nombre"
            />

            <CampoTexto
              etiqueta="NIT / Cédula"
              value={nitCedula}
              onChangeText={setNitCedula}
              placeholder="Ej. 900123456-1"
              testID="input-nit"
            />
          </View>
        </Tarjeta>

        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.l }]}>Contacto y Ubicación</Text>

          <View style={{ gap: espacio.l }}>
            <CampoTexto
              etiqueta="Teléfono de Contacto"
              value={telefono}
              onChangeText={setTelefono}
              placeholder="Ej. 3123456789"
              keyboardType="phone-pad"
              testID="input-telefono"
            />

            <CampoTexto
              etiqueta="Dirección / Ciudad"
              value={ciudad}
              onChangeText={setCiudad}
              placeholder="Ej. Florencia, Caquetá"
              testID="input-ciudad"
            />

            <CampoTexto
              etiqueta="Correo Electrónico (Email)"
              value={email}
              onChangeText={setEmail}
              placeholder="Ej. compras@proveedor.com"
              keyboardType="email-address"
              autoCapitalize="none"
              testID="input-email"
            />
          </View>
        </Tarjeta>

        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.l }]}>Adicionales</Text>

          <CampoTexto
            etiqueta="Notas y Observaciones"
            value={notas}
            onChangeText={setNotas}
            placeholder="Ingresa notas adicionales..."
            multiline
            numberOfLines={4}
            testID="input-notas"
          />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: espacio.l,
              marginTop: espacio.l,
              borderTopWidth: 1,
              borderTopColor: paleta.borde,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>Proveedor Activo</Text>
              <Text style={[tipografia.caption, { color: paleta.texto3, marginTop: 2 }]}>
                Habilita o deshabilita este proveedor en compras
              </Text>
            </View>
            <Switch
              value={activo}
              onValueChange={setActivo}
              trackColor={{ false: paleta.borde, true: paleta.primarioSoft }}
              thumbColor={activo ? paleta.primario : paleta.superficie2}
              testID="switch-activo"
            />
          </View>
        </Tarjeta>
      </ScrollView>

      {/* Botón de guardado fijo al fondo */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: paleta.fondo,
          padding: espacio.l,
          paddingBottom: paddingBarraInferior,
          borderTopWidth: 1,
          borderTopColor: paleta.borde,
        }}
      >
        {/* Boton no acepta testID; se usa un Presionable con los mismos tokens (testID requerido por la suite) */}
        <Presionable
          accessibilityRole="button"
          accessibilityLabel={id ? 'Actualizar Proveedor' : 'Registrar Proveedor'}
          accessibilityState={{ disabled: loading, busy: loading }}
          disabled={loading}
          onPress={loading ? undefined : handleGuardar}
          testID="btn-guardar"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: espacio.s,
            height: 56,
            borderRadius: radio.md,
            backgroundColor: paleta.primario,
            opacity: loading ? 0.45 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color={paleta.sobrePrimario} />
          ) : (
            <Save size={20} color={paleta.sobrePrimario} />
          )}
          <Text style={[tipografia.cuerpoLg, { color: paleta.sobrePrimario }]}>
            {id ? 'Actualizar Proveedor' : 'Registrar Proveedor'}
          </Text>
        </Presionable>
      </View>
    </KeyboardAvoidingView>
  )
}
