import React, { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CalendarClock, ReceiptText, ShoppingCart, Undo2, Wallet } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { puedeAcceder } from '../../../lib/permisos'
import { useTema } from '../../../lib/tema'
import { espacio, tipografia } from '../../../lib/theme'
import { CirculoIcono, ControlSegmentado, FilaLista, Tarjeta } from '../../../components/ui'
import type { TonoIcono } from '../../../components/ui'

interface Acceso {
  titulo: string
  sub: string
  ruta: string
  Icono: LucideIcon
  tono: TonoIcono
  permiso?: string
}

// Transicional (paso 3): accesos a los flujos existentes.
// El hub con historiales en línea llega en el paso 6 (redisign-visual.md §7.3).
const VISTAS: Acceso[][] = [
  [
    { titulo: 'Nueva venta', sub: 'Registrar una venta ahora', ruta: '/ventas/nueva', Icono: ShoppingCart, tono: 'primario' },
    { titulo: 'Ventas del día', sub: 'Módulo de ventas', ruta: '/ventas', Icono: Wallet, tono: 'exito' },
  ],
  [
    { titulo: 'Registrar devolución', sub: 'Total, parcial o cambio', ruta: '/devoluciones/nueva', Icono: Undo2, tono: 'peligro' },
    { titulo: 'Historial de devoluciones', sub: 'Lo devuelto y cobrado', ruta: '/devoluciones', Icono: Undo2, tono: 'primario' },
  ],
  [
    { titulo: 'Gastos variables', sub: 'Imprevistos por categoría', ruta: '/gastos', Icono: ReceiptText, tono: 'peligro' },
    { titulo: 'Gastos fijos', sub: 'Recurrentes y vencimientos', ruta: '/gastos/fijos', Icono: CalendarClock, tono: 'primario', permiso: 'gastos-fijos' },
  ],
]

export default function Movimientos() {
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const router = useRouter()
  const [vista, setVista] = useState(0)

  if (!perfil) return null
  const accesos = VISTAS[vista].filter((a) => !a.permiso || puedeAcceder(perfil.rol, a.permiso))

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView contentContainerStyle={{ padding: espacio.xl, paddingTop: 56, gap: espacio.l }}>
        <Text style={[tipografia.h1, { color: paleta.texto }]}>Movimientos</Text>
        <ControlSegmentado opciones={['Ventas', 'Devoluciones', 'Gastos']} indice={vista} onCambio={setVista} />
        <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
          {accesos.map((a, i) => (
            <View key={a.titulo}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} /> : null}
              <FilaLista
                icono={
                  <CirculoIcono tono={a.tono}>
                    <a.Icono />
                  </CirculoIcono>
                }
                titulo={a.titulo}
                subtitulo={a.sub}
                chevron
                onPress={() => router.push(a.ruta)}
              />
            </View>
          ))}
        </Tarjeta>
      </ScrollView>
    </View>
  )
}
