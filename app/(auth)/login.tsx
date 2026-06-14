import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useAuth } from '../../lib/auth'
import { USUARIOS, type UsuarioPicker } from '../../lib/usuarios'

export default function Login() {
  const { iniciarSesion } = useAuth()
  const [usuario, setUsuario] = useState<UsuarioPicker | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function entrar() {
    if (!usuario || pin.length < 4) return
    setCargando(true)
    setError(null)
    try {
      const res = await iniciarSesion(usuario.email, pin)
      if (res.error) {
        setError(res.error)
        setPin('')
      }
      // Si entra bien, onAuthStateChange + (auth)/_layout redirigen a "/".
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.')
      setPin('')
    } finally {
      setCargando(false)
    }
  }

  if (!usuario) {
    return (
      <View style={styles.container}>
        <Text style={styles.titulo}>¿Quién eres?</Text>
        {USUARIOS.map(u => (
          <Pressable key={u.email} style={styles.userBtn} onPress={() => setUsuario(u)}>
            <Text style={styles.userBtnText}>{u.nombre}</Text>
          </Pressable>
        ))}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>{usuario.nombre}</Text>
      <Text style={styles.sub}>Escribe tu PIN</Text>
      <TextInput
        style={styles.pinInput}
        value={pin}
        onChangeText={t => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        autoFocus
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.primaryBtn, (cargando || pin.length < 4) && styles.btnDisabled]}
        onPress={entrar}
        disabled={cargando || pin.length < 4}
      >
        {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Entrar</Text>}
      </Pressable>
      <Pressable
        style={styles.linkBtn}
        onPress={() => {
          setUsuario(null)
          setPin('')
          setError(null)
          setCargando(false)
        }}
      >
        <Text style={styles.link}>← Cambiar usuario</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#fff' },
  titulo: { fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 18, textAlign: 'center', color: '#444' },
  userBtn: { backgroundColor: '#1E66F5', borderRadius: 16, paddingVertical: 24, alignItems: 'center' },
  userBtnText: { color: '#fff', fontSize: 24, fontWeight: '600' },
  pinInput: {
    borderWidth: 2, borderColor: '#1E66F5', borderRadius: 16, fontSize: 32,
    textAlign: 'center', letterSpacing: 12, paddingVertical: 16,
  },
  primaryBtn: { backgroundColor: '#1E66F5', borderRadius: 16, paddingVertical: 20, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  error: { color: '#D20F39', fontSize: 16, textAlign: 'center' },
  link: { color: '#1E66F5', fontSize: 16, textAlign: 'center', marginTop: 8 },
  linkBtn: { paddingVertical: 16, alignItems: 'center' },
})
