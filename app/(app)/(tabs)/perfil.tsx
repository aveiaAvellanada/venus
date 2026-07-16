import React from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { LogOut, SunMoon, Users, Wallet } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import type { Rol } from '../../../lib/permisos'
import { useTema } from '../../../lib/tema'
import type { ModoTema } from '../../../lib/theme'
import { espacio, radio, tipografia } from '../../../lib/theme'
import { Badge, CirculoIcono, ControlSegmentado, FilaLista, Tarjeta } from '../../../components/ui'

const NOMBRE_ROL: Record<Rol, string> = {
  dueno: 'DUEÑO',
  admin: 'ADMINISTRATIVA',
  empleado: 'OPERATIVO',
}

const MODOS: ModoTema[] = ['claro', 'oscuro', 'sistema']

export default function Perfil() {
  const { perfil, cerrarSesion } = useAuth()
  const { paleta, modo, setModo } = useTema()
  const router = useRouter()

  if (!perfil) return null
  const esDueno = perfil.rol === 'dueno'

  const confirmarSalida = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () => {
          cerrarSesion().catch(() => {
            Alert.alert('Error', 'No se pudo cerrar sesión. Intenta de nuevo.')
          })
        },
      },
    ])
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView contentContainerStyle={{ padding: espacio.xl, paddingTop: 56, gap: espacio.l }}>
        <View style={{ alignItems: 'center', gap: espacio.s }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: radio.full,
              backgroundColor: paleta.primarioSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={[tipografia.h1, { color: paleta.primario }]}>
              {perfil.nombre.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[tipografia.h2, { color: paleta.texto }]}>{perfil.nombre}</Text>
          <Badge texto={NOMBRE_ROL[perfil.rol as Rol] ?? 'OPERATIVO'} tipo="neutro" />
        </View>

        <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Apariencia</Text>
        <Tarjeta>
          <View style={{ gap: espacio.m }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
              <SunMoon size={18} color={paleta.texto2} />
              <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Tema</Text>
            </View>
            <ControlSegmentado
              opciones={['Claro', 'Oscuro', 'Sistema']}
              indice={MODOS.indexOf(modo)}
              onCambio={(i) => setModo(MODOS[i])}
            />
          </View>
        </Tarjeta>

        {esDueno ? (
          <>
            <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Caja y equipo</Text>
            <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
              <FilaLista
                icono={
                  <CirculoIcono tono="exito">
                    <Wallet />
                  </CirculoIcono>
                }
                titulo="Automatización de caja"
                subtitulo="Apertura, cierre y correo"
                chevron
                onPress={() => router.push('/caja/config')}
              />
              <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} />
              <FilaLista
                icono={
                  <CirculoIcono tono="primario">
                    <Users />
                  </CirculoIcono>
                }
                titulo="Empleados"
                subtitulo="Sueldos, días y pagos"
                chevron
                onPress={() => router.push('/empleados')}
              />
            </Tarjeta>
          </>
        ) : null}

        <Tarjeta estilo={{ paddingVertical: espacio.xs, borderColor: paleta.peligroSoft }}>
          <FilaLista
            icono={
              <CirculoIcono tono="peligro">
                <LogOut />
              </CirculoIcono>
            }
            titulo="Cerrar sesión"
            onPress={confirmarSalida}
          />
        </Tarjeta>
      </ScrollView>
    </View>
  )
}
