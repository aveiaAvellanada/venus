import { Stack, useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { useAuth } from '../../../lib/auth'

export default function CajaLayout() {
  const { perfil } = useAuth()
  const router = useRouter()

  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Caja del Día', 
          headerRight: () => {
            const esDuenoAdmin = perfil?.rol === 'dueno' || perfil?.rol === 'admin'
            if (!esDuenoAdmin) return null
            return (
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {perfil?.rol === 'dueno' && (
                  <Pressable onPress={() => router.push('/caja/config')} hitSlop={10}>
                    <Text style={{ color: '#1E66F5', fontWeight: 'bold', fontSize: 16 }}>Config</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => router.push('/caja/historial')} hitSlop={10}>
                  <Text style={{ color: '#1E66F5', fontWeight: 'bold', fontSize: 16 }}>Historial</Text>
                </Pressable>
              </View>
            )
          }
        }}
      />
      <Stack.Screen name="cierre" options={{ title: 'Cerrar Caja', presentation: 'modal' }} />
      <Stack.Screen name="historial" options={{ title: 'Historial de Cierres' }} />
      <Stack.Screen name="config" options={{ title: 'Configurar Caja' }} />
    </Stack>
  )
}
