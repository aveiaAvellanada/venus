import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { ArrowLeft, Calendar, ChevronRight, CircleAlert, ShieldCheck, User, UserPlus, Users, Wallet } from 'lucide-react-native'
import { useRequireModulo } from '../../../lib/auth'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import { listarEmpleados, diasTrabajadosMes } from '../../../lib/empleados'
import { resumenPermisos } from '../../../lib/permisos'
import type { Empleado } from '../../../lib/empleados'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, tabular, tipografia } from '../../../lib/theme'
import { Badge, Boton, CirculoIcono, EstadoVacio, Presionable, Tarjeta } from '../../../components/ui'

const pesos = (n: number) => '$' + n.toLocaleString('es-CO')

type EmpleadoConDias = Empleado & { diasEsteMes: number }

// Encabezado a nivel de módulo: no se remonta en cada render (Regla 2).
function Encabezado({ paleta, onVolver }: { paleta: Paleta; onVolver: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        paddingHorizontal: espacio.xl,
        paddingTop: 56,
        paddingBottom: espacio.m,
      }}
    >
      <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={onVolver} hitSlop={12}>
        <ArrowLeft size={24} color={paleta.texto} />
      </Presionable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Empleados</Text>
    </View>
  )
}

export default function EmpleadosIndex() {
  const requireModulo = useRequireModulo('gestion-empleado')
  const router = useRouter()
  const { paleta } = useTema()
  const paddingInferior = usePaddingInferior(espacio.xxxl)

  const [empleados, setEmpleados] = useState<EmpleadoConDias[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarDatos = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    setError(null)
    try {
      const ahora = new Date()
      const anio = ahora.getFullYear()
      const mes = ahora.getMonth() + 1 // getMonth() es 0-11; diasTrabajadosMes espera 1-12

      const lista = await listarEmpleados()

      const conDias = await Promise.all(
        lista.map(async (emp) => {
          let diasEsteMes = 0
          try {
            diasEsteMes = await diasTrabajadosMes(emp.id, anio, mes)
          } catch {
            // Si falla para un empleado, mostrar 0 y no romper toda la lista
            diasEsteMes = 0
          }
          return { ...emp, diasEsteMes }
        })
      )

      setEmpleados(conDias)
    } catch (err: unknown) {
      console.error('Error al cargar empleados:', err)
      setError('No se pudieron cargar los empleados. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      // No disparar peticiones si el rol no tiene acceso (el guard redirige abajo).
      if (!requireModulo) cargarDatos()
    }, [cargarDatos, requireModulo])
  )

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos(true)
  }

  if (requireModulo) return requireModulo

  const renderEmpleado = ({ item }: { item: EmpleadoConDias }) => {
    const sueldo = item.config?.sueldo_mensual

    return (
      <Tarjeta estilo={{ marginBottom: espacio.m }} onPress={() => router.push('/empleados/' + item.id)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m }}>
          <CirculoIcono tono="primario">
            <User />
          </CirculoIcono>
          <View style={{ flex: 1 }}>
            <Text style={[tipografia.h3, { color: paleta.texto }]} numberOfLines={1}>
              {item.nombre}
            </Text>
            <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
              @{item.usuario} · {resumenPermisos(item)}
            </Text>
          </View>
          <ChevronRight size={20} color={paleta.texto3} />
        </View>

        <View
          style={{
            marginTop: espacio.m,
            paddingTop: espacio.m,
            borderTopWidth: 1,
            borderTopColor: paleta.borde,
            gap: espacio.s,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
            <Wallet size={14} color={paleta.texto3} />
            <Text style={[tipografia.cuerpo, tabular, { color: paleta.texto2 }]}>
              {sueldo != null ? pesos(sueldo) + '/mes' : 'Sueldo no configurado'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
            <Calendar size={14} color={paleta.texto3} />
            <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Días este mes: {item.diasEsteMes}</Text>
          </View>
        </View>

        <View style={{ marginTop: espacio.m, paddingTop: espacio.m, borderTopWidth: 1, borderTopColor: paleta.borde }}>
          <Badge texto={item.activo ? 'Activo' : 'Inactivo'} tipo={item.activo ? 'exito' : 'peligro'} punto={item.activo} />
        </View>
      </Tarjeta>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: espacio.xl, gap: espacio.l }}>
          <EstadoVacio icono={<CircleAlert />} titulo={error} />
          <Boton titulo="Reintentar" variante="secundario" tamano="md" onPress={() => cargarDatos()} />
        </View>
      ) : (
        <FlatList
          data={empleados}
          keyExtractor={(item) => item.id}
          renderItem={renderEmpleado}
          contentContainerStyle={{ padding: espacio.xl, paddingBottom: paddingInferior }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={paleta.primario} />
          }
          ListHeaderComponent={
            <Tarjeta estilo={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, marginBottom: espacio.m }}>
              <CirculoIcono tono="exito" tamano={36}>
                <ShieldCheck />
              </CirculoIcono>
              <Text style={[tipografia.cuerpo, { color: paleta.texto2, flex: 1 }]}>
                Crea las cuentas del equipo y decide qué puede hacer cada quien. También sueldos, días y pagos.
              </Text>
            </Tarjeta>
          }
          ListFooterComponent={
            <Boton
              titulo="Nuevo empleado"
              icono={<UserPlus />}
              onPress={() => router.push('/empleados/nuevo')}
            />
          }
          ListEmptyComponent={
            <EstadoVacio icono={<Users />} titulo="No hay empleados registrados." />
          }
        />
      )}
    </View>
  )
}
