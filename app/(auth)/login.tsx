import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useAuth } from '../../lib/auth'
import {
  leerUsuariosRecientes, normalizarUsuario, usuarioValido, type UsuarioReciente,
} from '../../lib/usuarios'
import { useTema } from '../../lib/tema'
import { espacio, motion, radio, tipografia } from '../../lib/theme'
import { Boton, CampoTexto, TecladoPin } from '../../components/ui'

const LONGITUD_PIN = 6
// Mientras quede alguna cuenta con el PIN viejo de 4 dígitos (debe cambiarlo al entrar).
const LONGITUD_PIN_ANTERIOR = 4

function Avatar({ nombre, tamano }: { nombre: string; tamano: number }) {
  const { paleta } = useTema()
  return (
    <View
      style={{
        width: tamano,
        height: tamano,
        borderRadius: radio.full,
        backgroundColor: paleta.primarioSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[tamano >= 56 ? tipografia.h2 : tipografia.h3, { color: paleta.primario }]}>
        {nombre.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  )
}

export default function Login() {
  const { iniciarSesion } = useAuth()
  const { paleta } = useTema()
  const [recientes, setRecientes] = useState<UsuarioReciente[]>([])
  const [escrito, setEscrito] = useState('')
  const [usuario, setUsuario] = useState<UsuarioReciente | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    leerUsuariosRecientes().then(setRecientes)
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [])

  function entrar(clave: string) {
    if (!usuario || cargando) return
    let vigente = true
    setCargando(true)
    setError(null)
    iniciarSesion(usuario.usuario, clave)
      .then((res) => {
        if (vigente && res.error) fallar(res.error)
        // Si entra bien, onAuthStateChange + (auth)/_layout redirigen a "/".
      })
      .catch(() => {
        if (vigente) fallar('No se pudo conectar. Intenta de nuevo.')
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }

  // Auto-envío al 6º dígito: sin botón "Entrar" para el PIN nuevo.
  useEffect(() => {
    if (pin.length === LONGITUD_PIN) return entrar(pin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  function fallar(mensaje: string) {
    setError(mensaje)
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      setPin('')
      setError(null)
    }, 600)
  }

  function elegir(u: UsuarioReciente) {
    setUsuario(u)
    setPin('')
    setError(null)
  }

  function continuarConEscrito() {
    const u = normalizarUsuario(escrito)
    if (!usuarioValido(u)) {
      setError('Escribe tu usuario (sin espacios ni tildes).')
      return
    }
    setError(null)
    elegir(recientes.find((r) => r.usuario === u) ?? { usuario: u, nombre: u })
  }

  function cambiarUsuario() {
    if (temporizador.current) clearTimeout(temporizador.current)
    setUsuario(null)
    setPin('')
    setError(null)
    setCargando(false)
  }

  if (!usuario) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: espacio.xxl, gap: espacio.m }}
        >
          <Text style={[tipografia.h1, { color: paleta.texto, textAlign: 'center', marginBottom: espacio.l }]}>
            ¿Quién eres?
          </Text>
          {recientes.map((u, i) => (
            <Animated.View key={u.usuario} entering={FadeInDown.duration(220).delay(i * 40)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={u.nombre}
                onPress={() => elegir(u)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: espacio.m,
                  minHeight: 64,
                  paddingHorizontal: espacio.l,
                  paddingVertical: espacio.m,
                  borderRadius: radio.md,
                  borderWidth: 1,
                  borderColor: paleta.borde,
                  backgroundColor: pressed ? paleta.superficie2 : paleta.superficie,
                  transform: [{ scale: pressed ? motion.escalaPress : 1 }],
                })}
              >
                <Avatar nombre={u.nombre} tamano={44} />
                <View style={{ flex: 1 }}>
                  <Text style={[tipografia.h3, { color: paleta.texto }]}>{u.nombre}</Text>
                  <Text style={[tipografia.caption, { color: paleta.texto3 }]}>@{u.usuario}</Text>
                </View>
                <ChevronRight size={20} color={paleta.texto3} />
              </Pressable>
            </Animated.View>
          ))}

          <View style={{ gap: espacio.m, marginTop: recientes.length ? espacio.l : 0 }}>
            <CampoTexto
              etiqueta={recientes.length ? 'Otro usuario' : 'Tu usuario'}
              placeholder="ej: luisa"
              value={escrito}
              onChangeText={(v) => {
                setEscrito(v)
                setError(null)
              }}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={continuarConEscrito}
              returnKeyType="next"
            />
            {error ? (
              <Text style={[tipografia.caption, { color: paleta.peligroTexto }]}>{error}</Text>
            ) : null}
            <Boton titulo="Continuar" onPress={continuarConEscrito} deshabilitado={escrito.trim() === ''} />
          </View>
        </ScrollView>
      </View>
    )
  }

  const pinAnterior = pin.length === LONGITUD_PIN_ANTERIOR && !cargando

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo, padding: espacio.xxl, paddingTop: 56 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cambiar usuario"
        hitSlop={12}
        onPress={cambiarUsuario}
        style={{ alignSelf: 'flex-start' }}
      >
        <Text style={[tipografia.etiqueta, { color: paleta.primario }]}>← Cambiar usuario</Text>
      </Pressable>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacio.l }}>
        <Avatar nombre={usuario.nombre} tamano={56} />
        <View style={{ alignItems: 'center', gap: espacio.xs }}>
          <Text style={[tipografia.h2, { color: paleta.texto }]}>
            {`Hola, ${usuario.nombre.split(' ')[0]}`}
          </Text>
          <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
            Escribe tu PIN de 6 dígitos
          </Text>
        </View>

        <TecladoPin
          valor={pin}
          longitud={LONGITUD_PIN}
          error={!!error}
          deshabilitado={cargando}
          onDigito={(d) => {
            if (pin.length < LONGITUD_PIN && !cargando) setPin(pin + d)
          }}
          onBorrar={() => setPin(pin.slice(0, -1))}
        />

        <View style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', gap: espacio.s }}>
          {cargando ? (
            <ActivityIndicator color={paleta.primario} />
          ) : error ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[tipografia.caption, { color: paleta.peligroTexto, textAlign: 'center' }]}
            >
              {error}
            </Text>
          ) : pinAnterior ? (
            <Boton titulo="Entrar con mi PIN de 4" variante="fantasma" onPress={() => entrar(pin)} />
          ) : null}
        </View>
      </View>
    </View>
  )
}
