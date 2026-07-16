import { Tabs } from 'expo-router'
import { TabBar } from '../../../components/ui/TabBar'

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="movimientos" />
      <Tabs.Screen name="productos" />
      <Tabs.Screen name="perfil" />
    </Tabs>
  )
}
