import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context'

// Padding inferior real de cada pantalla: espaciado base + el inset del
// sistema (barra de gestos de Android, home indicator de iOS). Reemplaza
// los `paddingBottom` fijos (100 / espacio.xxxl) que no consideraban el
// inset y quedaban tapados por la barra de gestos en algunos dispositivos.
export function usePaddingInferior(base: number): number {
  const insets = useSafeAreaInsets()
  return insets.bottom + base
}

// Margen superior de las cabeceras: la app se dibuja detrás de la barra de
// estado (borde a borde, obligatorio en Android 15+), así que el título debe
// quedar debajo de ella. 56 era el valor fijo de siempre: se conserva donde la
// barra es baja y crece en los teléfonos con barra alta (cámara en la pantalla).
// La app es solo vertical: el alto de la barra no cambia mientras está abierta.
export const MARGEN_SUPERIOR = Math.max(56, (initialWindowMetrics?.insets.top ?? 0) + 20)
