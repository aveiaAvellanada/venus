import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { crearEmpleado } from '../../../lib/empleados'
import { PLANTILLAS, type Permiso } from '../../../lib/permisos'
import { normalizarUsuario, pinValido, usuarioValido } from '../../../lib/usuarios'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, tipografia } from '../../../lib/theme'
import { Boton, CampoTexto, Presionable, Tarjeta, useToast } from '../../../components/ui'
import { SelectorPermisos } from '../../../components/SelectorPermisos'

// Encabezado a nivel de módulo: no se remonta en cada render (Regla 2).
function Encabezado({ paleta, onVolver }: { paleta: Paleta; onVolver: () => void }) {
  return (
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
      <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={onVolver} hitSlop={12}>
        <ArrowLeft size={24} color={paleta.texto} />
      </Presionable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Nuevo empleado</Text>
    </View>
  )
}

const soloDigitos = (t: string) => t.replace(/[^0-9]/g, '').slice(0, 6)

export default function NuevoEmpleado() {
  const router = useRouter()
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const paddingInferior = usePaddingInferior(espacio.xxxl)

  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirmado, setPinConfirmado] = useState('')
  const [permisos, setPermisos] = useState<Permiso[]>([...PLANTILLAS.operativo.permisos])
  const [guardando, setGuardando] = useState(false)

  async function crear() {
    if (!nombre.trim()) return mostrar('Escribe el nombre.', 'error')
    if (!usuarioValido(usuario)) {
      return mostrar('El usuario debe tener de 3 a 20 letras o números, sin espacios ni tildes.', 'error')
    }
    if (!pinValido(pin)) return mostrar('El PIN debe tener exactamente 6 números.', 'error')
    if (pin !== pinConfirmado) return mostrar('Los dos PIN no coinciden.', 'error')

    setGuardando(true)
    try {
      const id = await crearEmpleado({ nombre: nombre.trim(), usuario: normalizarUsuario(usuario), pin, permisos })
      mostrar(`Listo: ${nombre.trim()} entra con el usuario "${normalizarUsuario(usuario)}".`)
      // Al detalle, para configurar sueldo y días.
      router.replace(`/empleados/${id}`)
    } catch (e) {
      mostrar(e instanceof Error ? e.message : 'No se pudo crear el empleado.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.l }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Tarjeta>
            <View style={{ gap: espacio.m }}>
              <CampoTexto etiqueta="Nombre *" placeholder="Nombre completo" value={nombre} onChangeText={setNombre} />
              <CampoTexto
                etiqueta="Usuario *"
                placeholder="ej: luisa"
                value={usuario}
                onChangeText={(t) => setUsuario(t.replace(/\s/g, '').toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                Con esto entra a la app. Sin espacios ni tildes; no se puede cambiar después.
              </Text>
              <CampoTexto
                etiqueta="PIN de 6 dígitos *"
                placeholder="••••••"
                value={pin}
                onChangeText={(t) => setPin(soloDigitos(t))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
              <CampoTexto
                etiqueta="Repite el PIN *"
                placeholder="••••••"
                value={pinConfirmado}
                onChangeText={(t) => setPinConfirmado(soloDigitos(t))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
              />
            </View>
          </Tarjeta>

          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.l }]}>¿Qué puede hacer?</Text>
            <SelectorPermisos valor={permisos} onCambio={setPermisos} deshabilitado={guardando} />
          </Tarjeta>

          <Boton titulo="Crear empleado" onPress={crear} cargando={guardando} deshabilitado={guardando} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
