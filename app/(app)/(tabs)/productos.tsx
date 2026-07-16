import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Camera, Egg, Footprints, PackagePlus } from 'lucide-react-native'
import type { LucideIcon } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { puedeAcceder } from '../../../lib/permisos'
import { useTema } from '../../../lib/tema'
import { espacio, tipografia } from '../../../lib/theme'
import { CirculoIcono, FilaLista, Tarjeta } from '../../../components/ui'
import type { TonoIcono } from '../../../components/ui'

interface Acceso {
  titulo: string
  sub: string
  ruta: string
  Icono: LucideIcon
  tono: TonoIcono
  permiso?: string
}

// Transicional (paso 3): la lista agrupada por referencia llega en el paso 7 (§7.4).
const INVENTARIO: Acceso[] = [
  { titulo: 'Calzado', sub: '7 categorías, tallas y colores', ruta: '/inventario/calzado', Icono: Footprints, tono: 'primario' },
  { titulo: 'Granja', sub: 'Precio al momento de vender', ruta: '/inventario/granja', Icono: Egg, tono: 'acento' },
]

const INGRESO: Acceso[] = [
  { titulo: 'Recibir mercancía', sub: 'Entrada de mercancía nueva', ruta: '/recibir-mercancia', Icono: PackagePlus, tono: 'exito' },
  { titulo: 'Carga inicial', sub: 'Plantilla Excel o cámara', ruta: '/inventario/carga', Icono: Camera, tono: 'primario', permiso: 'carga-inicial' },
]

export default function Productos() {
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const router = useRouter()

  if (!perfil) return null
  const ingreso = INGRESO.filter((a) => !a.permiso || puedeAcceder(perfil.rol, a.permiso))

  const seccion = (accesos: Acceso[]) => (
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
  )

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView contentContainerStyle={{ padding: espacio.xl, paddingTop: 56, gap: espacio.l }}>
        <Text style={[tipografia.h1, { color: paleta.texto }]}>Productos</Text>
        {seccion(INVENTARIO)}
        <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Ingresar mercancía</Text>
        {ingreso.length > 0 ? seccion(ingreso) : null}
      </ScrollView>
    </View>
  )
}
