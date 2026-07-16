import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../../lib/auth';

export default function GastosLayout() {
  const { perfil } = useAuth();

  if (!perfil || perfil.rol !== 'dueno') {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="fijos" />
      <Stack.Screen name="fijos-editor" options={{ presentation: 'modal' }} />
      <Stack.Screen name="pagar" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
