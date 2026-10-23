import React, { useCallback, useSyncExternalStore } from 'react'
import { View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { NavigationBar } from 'expo-navigation-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTema } from '../lib/tema'

// Pantallas con foto a sangre bajo la barra de estado (la ficha del producto):
// mientras están enfocadas no se tapa la parte de arriba.
let inmersivas = 0
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((o) => o())
const suscribir = (o: () => void) => {
  oyentes.add(o)
  return () => { oyentes.delete(o) }
}

export function usePantallaInmersiva() {
  useFocusEffect(useCallback(() => {
    inmersivas += 1
    avisar()
    return () => {
      inmersivas -= 1
      avisar()
    }
  }, []))
}

// La app se dibuja detrás de la barra de estado y de la barra de navegación
// (borde a borde, obligatorio en Android 15+). Sin esto, al desplazarse el
// contenido se ve por detrás de las barras: con navegación de 3 botones pasa
// por debajo de ◁ ○ ▢, y con gestos por debajo de la línea de gestos.
//
// - Dos franjas del color del fondo, del alto exacto de cada barra (0 si no
//   hay), tapan lo que pasa por detrás. No reciben toques.
// - Los botones del sistema siguen el tema de la app: oscuros en claro y
//   claros en oscuro (con `enforceContrast: false` en app.json, Android no
//   pone su velo gris semitransparente detrás de los 3 botones).
//
// `navegacion={false}` dentro de una ventana (Modal), que tiene su propia
// ventana de Android y no hereda las franjas de la pantalla de abajo.
export function BarrasSistema({ navegacion = true }: { navegacion?: boolean }) {
  const insets = useSafeAreaInsets()
  const { paleta, esOscuro } = useTema()
  const inmersiva = useSyncExternalStore(suscribir, () => inmersivas > 0) && navegacion
  return (
    <>
      {navegacion ? <NavigationBar style={esOscuro ? 'dark' : 'light'} /> : null}
      <View
        pointerEvents="none"
        testID="franja-barra-estado"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: inmersiva ? 0 : insets.top, backgroundColor: paleta.fondo }}
      />
      <View
        pointerEvents="none"
        testID="franja-barra-navegacion"
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: insets.bottom, backgroundColor: paleta.fondo }}
      />
    </>
  )
}
