import { Stack, Redirect, useSegments } from 'expo-router';
import { useAuth } from '../../../lib/auth';
import { tienePermiso } from '../../../lib/permisos';

// Pantallas de gastos fijos (arriendo, servicios...): requieren ese permiso.
const PANTALLAS_FIJOS = ['fijos', 'fijos-editor', 'pagar'];

export default function GastosLayout() {
  const { perfil } = useAuth();
  const segmentos = useSegments() as string[];
  const verFijos = tienePermiso(perfil, 'gastos_fijos');

  // Registrar gastos (variables) o gestionar los fijos: con cualquiera de los dos se entra.
  if (!verFijos && !tienePermiso(perfil, 'gastos')) {
    return <Redirect href="/" />;
  }
  if (!verFijos && PANTALLAS_FIJOS.includes(segmentos[segmentos.length - 1])) {
    return <Redirect href="/gastos" />;
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
