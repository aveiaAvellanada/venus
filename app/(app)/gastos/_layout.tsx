import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../../lib/auth';

export default function GastosLayout() {
  const { perfil } = useAuth();

  if (!perfil || perfil.rol !== 'dueno') {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerTitleAlign: 'center', headerBackVisible: false }}>
      <Stack.Screen name="index" options={{ title: 'Gastos Variables' }} />
      <Stack.Screen name="fijos" options={{ title: 'Gastos Fijos' }} />
      <Stack.Screen name="fijos-editor" options={{ title: 'Nuevo Gasto Fijo', presentation: 'modal' }} />
      <Stack.Screen name="pagar" options={{ title: 'Pagar Gasto Fijo', presentation: 'modal' }} />
    </Stack>
  );
}
