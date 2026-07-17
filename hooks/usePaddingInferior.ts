import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Padding inferior real de cada pantalla: espaciado base + el inset del
// sistema (barra de gestos de Android, home indicator de iOS). Reemplaza
// los `paddingBottom` fijos (100 / espacio.xxxl) que no consideraban el
// inset y quedaban tapados por la barra de gestos en algunos dispositivos.
export function usePaddingInferior(base: number): number {
  const insets = useSafeAreaInsets()
  return insets.bottom + base
}
