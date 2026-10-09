import React from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Camera, ChartColumn, KeyRound, LogOut, Scale, Sparkles, SunMoon, Truck, Users, Wallet } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { esDueno as esDuenoPerfil, puedeAcceder, resumenPermisos } from '../../../lib/permisos'
import { useTema } from '../../../lib/tema'
import type { ModoTema } from '../../../lib/theme'
import { espacio, radio, tipografia } from '../../../lib/theme'
import { Badge, CirculoIcono, ControlSegmentado, FilaLista, Presionable, Tarjeta, useToast } from '../../../components/ui'

const MODOS: ModoTema[] = ['claro', 'oscuro', 'sistema']

const NEGOCIO = [
  { id: 'proveedores', titulo: 'Proveedores', sub: 'Datos, cuentas y deudas', ruta: '/proveedores', Icono: Truck },
  { id: 'reportes', titulo: 'Reportes', sub: 'El negocio a fondo', ruta: '/reportes', Icono: ChartColumn },
  { id: 'balance', titulo: 'Balance', sub: 'Ingresos − egresos', ruta: '/balance', Icono: Scale },
  { id: 'analisis-ia', titulo: 'Análisis IA', sub: 'Recomendaciones de compra', ruta: undefined, Icono: Sparkles },
  { id: 'carga-inicial', titulo: 'Carga inicial', sub: 'Plantilla Excel o cámara', ruta: '/inventario/carga', Icono: Camera },
] as const

export default function Perfil() {
  const { perfil, cerrarSesion } = useAuth()
  const { paleta, modo, setModo } = useTema()
  const router = useRouter()
  const { mostrar } = useToast()

  if (!perfil) return null
  const esDueno = esDuenoPerfil(perfil)
  const accesosNegocio = NEGOCIO.filter((a) => puedeAcceder(perfil, a.id))

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
          <Text style={[tipografia.caption, { color: paleta.texto3 }]}>@{perfil.usuario}</Text>
          <Badge texto={resumenPermisos(perfil)} tipo="neutro" />
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
                titulo="Caja"
                subtitulo="Horario, modo de cierre e historial"
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
                subtitulo="Cuentas, permisos, PIN, sueldos y pagos"
                chevron
                onPress={() => router.push('/empleados')}
              />
            </Tarjeta>
          </>
        ) : null}

        {accesosNegocio.length > 0 ? (
          <>
            <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Negocio</Text>
            <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
              {accesosNegocio.map((a, i) => (
                <View key={a.id}>
                  {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} /> : null}
                  <FilaLista
                    icono={
                      <CirculoIcono tono="primario">
                        <a.Icono />
                      </CirculoIcono>
                    }
                    titulo={a.titulo}
                    subtitulo={a.sub}
                    chevron
                    onPress={() => (a.ruta ? router.push(a.ruta) : mostrar('Análisis IA estará disponible pronto', 'info'))}
                  />
                </View>
              ))}
            </Tarjeta>
          </>
        ) : null}

        <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Mi cuenta</Text>
        <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
          <FilaLista
            icono={
              <CirculoIcono tono="primario">
                <KeyRound />
              </CirculoIcono>
            }
            titulo="Cambiar mi PIN"
            subtitulo="6 dígitos"
            chevron
            onPress={() => router.push('/cambiar-pin')}
          />
        </Tarjeta>

        <Tarjeta estilo={{ paddingVertical: espacio.xs, borderColor: paleta.peligroSoft }}>
          <Presionable
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
            onPress={confirmarSalida}
            style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, minHeight: 64, paddingVertical: espacio.s }}
          >
            <CirculoIcono tono="peligro"><LogOut /></CirculoIcono>
            <Text style={[tipografia.h3, { color: paleta.peligroTexto }]}>Cerrar sesión</Text>
          </Presionable>
        </Tarjeta>
      </ScrollView>
    </View>
  )
}
