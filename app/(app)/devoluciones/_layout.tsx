import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function DevolucionesLayout() {
  const requireModulo = useRequireModulo('devoluciones')
  if (requireModulo) return requireModulo
  return (
    <Stack screenOptions={{ headerShown: false }} />
  )
}
