import TopTabs, { type MaterialTopTabBarProps } from 'expo-router/js-top-tabs'
import { TabBar } from '../../../components/ui/TabBar'
import { useTema } from '../../../lib/tema'

// Pestañas con swipe: deslizar de lado pasa entre Menú, Movimientos, Productos
// y Perfil, y la pantalla sigue al dedo. Es el paginador nativo
// (react-native-pager-view); la barra flotante sigue siendo la misma.
export default function TabsLayout() {
  const { paleta } = useTema()
  return (
    <TopTabs
      tabBarPosition="bottom"
      tabBar={(props: MaterialTopTabBarProps) => <TabBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
        lazy: true,
        // La pestaña vecina se prepara antes: al deslizar no se ve en blanco.
        lazyPreloadDistance: 1,
        sceneStyle: { backgroundColor: paleta.fondo },
      }}
    >
      <TopTabs.Screen name="index" />
      <TopTabs.Screen name="movimientos" />
      <TopTabs.Screen name="productos" />
      <TopTabs.Screen name="perfil" />
    </TopTabs>
  )
}
