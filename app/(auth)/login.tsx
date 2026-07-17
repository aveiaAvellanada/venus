import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useAuth } from '../../lib/auth'
import { USUARIOS, type UsuarioPicker } from '../../lib/usuarios'
import { useTema } from '../../lib/tema'
import { espacio, motion, radio, tipografia } from '../../lib/theme'
import { TecladoPin } from '../../components/ui'

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
  const [usuario, setUsuario] = useState<UsuarioPicker | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [])

  // Auto-envío al 4º dígito (spec §7.1): sin botón "Entrar".
  useEffect(() => {
    if (pin.length !== 4 || cargando || !usuario) return
    let vigente = true
    setCargando(true)
    setError(null)
    iniciarSesion(usuario.email, pin)
      .then((res) => {
        if (!vigente) return
        if (res.error) fallar(res.error)
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
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: espacio.xxl, gap: espacio.m }}
        >
          <Text style={[tipografia.h1, { color: paleta.texto, textAlign: 'center', marginBottom: espacio.l }]}>
            ¿Quién eres?
          </Text>
          {USUARIOS.map((u, i) => (
            <Animated.View key={u.email} entering={FadeInDown.duration(220).delay(i * 40)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={u.nombre}
                onPress={() => setUsuario(u)}
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
                <Text style={[tipografia.h3, { color: paleta.texto, flex: 1 }]}>{u.nombre}</Text>
                <ChevronRight size={20} color={paleta.texto3} />
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      </View>
    )
  }

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
            Escribe tu clave para entrar
          </Text>
        </View>

        <TecladoPin
          valor={pin}
          error={!!error}
          deshabilitado={cargando}
          onDigito={(d) => {
            if (pin.length < 4 && !cargando) setPin(pin + d)
          }}
          onBorrar={() => setPin(pin.slice(0, -1))}
        />

        <View style={{ minHeight: 24, justifyContent: 'center' }}>
          {cargando ? (
            <ActivityIndicator color={paleta.primario} />
          ) : error ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[tipografia.caption, { color: paleta.peligroTexto, textAlign: 'center' }]}
            >
              {error}
            </Text>
          ) : null}
        </View>
      </View>

    </View>
  )
}
