import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  FileText,
  Hash,
  Info,
  Plus,
  ShieldCheck,
  User,
} from 'lucide-react-native'
import { useAuth, useRequireModulo } from '../../../lib/auth'
import { listarCompras, listarProveedores, type Compra } from '../../../lib/proveedores'
import { supabase } from '../../../lib/supabase'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { Badge, Boton, CirculoIcono, EstadoVacio, Presionable, Tarjeta } from '../../../components/ui'

export default function RecibirMercanciaIndex() {
  const requireModulo = useRequireModulo('recibir-mercancia')
  const { perfil } = useAuth()
  const router = useRouter()
  const { paleta } = useTema()

  const [compras, setCompras] = useState<Compra[]>([])
  const [proveedoresMap, setProveedoresMap] = useState<Record<string, string>>({})
  const [usuariosMap, setUsuariosMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargarDatos = useCallback(async (isRefresh = false) => {
    if (!perfil) return
    if (!isRefresh) setLoading(true)
    setError(null)
    try {
      // 1. Fetch active/inactive providers for name mapping
      const provList = await listarProveedores()
      const provMap: Record<string, string> = {}
      provList.forEach((p) => {
        provMap[p.id] = p.nombre
      })
      setProveedoresMap(provMap)

      // 2. Fetch users for registrar mapping (only if owner/admin)
      if (perfil.rol === 'dueno' || perfil.rol === 'admin') {
        const { data: userList, error: userError } = await supabase
          .from('users')
          .select('id, nombre')

        if (userError) {
          console.error('Error al cargar nombres de usuarios:', userError.message)
        } else if (userList) {
          const userMap: Record<string, string> = {}
          userList.forEach((u) => {
            userMap[u.id] = u.nombre
          })
          setUsuariosMap(userMap)
        }
      }

      // 3. Fetch pending arrivals
      const comprasList = await listarCompras({ estado: 'pendiente_revision' })

      // RLS already filters at the DB level, but we add client-side check for redundancy and safety
      if (perfil.rol === 'empleado') {
        setCompras(comprasList.filter((c) => c.registrada_por === perfil.id))
      } else {
        setCompras(comprasList)
      }
    } catch (err: any) {
      console.error('Error al cargar entradas de mercancía:', err)
      setError('No se pudieron cargar las entradas de mercancía. Intenta de nuevo.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [perfil])

  // Trigger reloading on focus to ensure dynamic list updates
  useFocusEffect(
    useCallback(() => {
      cargarDatos()
    }, [cargarDatos])
  )

  const onRefresh = () => {
    setRefreshing(true)
    cargarDatos(true)
  }

  // Early redirect if permissions check fails
  if (requireModulo) return requireModulo

  const renderCompra = ({ item }: { item: Compra }) => {
    const isOwner = perfil?.rol === 'dueno'
    const isAdmin = perfil?.rol === 'admin'
    const isStaff = isOwner || isAdmin
    const providerName = proveedoresMap[item.proveedor_id] || 'Proveedor desconocido'
    const dateFormatted = new Date(item.created_at).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    // Resolve registrar name
    let registeredByText = 'Cargando...'
    if (item.registrada_por === perfil?.id) {
      registeredByText = 'Registrado por ti'
    } else if (item.registrada_por) {
      registeredByText = usuariosMap[item.registrada_por] || 'Otro empleado'
    }

    const contenido = (
      <Tarjeta>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m }}>
          <CirculoIcono tono="primario">
            <Building2 />
          </CirculoIcono>
          <View style={{ flex: 1 }}>
            <Text style={[tipografia.h3, { color: paleta.texto }]} numberOfLines={1}>
              {providerName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs, marginTop: 2 }}>
              <CalendarDays size={13} color={paleta.texto3} />
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{dateFormatted}</Text>
            </View>
          </View>
          {isStaff && <ChevronRight size={20} color={paleta.texto3} />}
        </View>

        <View style={{
          gap: espacio.xs, borderTopWidth: 1, borderTopColor: paleta.borde,
          paddingTop: espacio.m, marginTop: espacio.m,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
            <Hash size={13} color={paleta.texto3} />
            <Text style={[tipografia.caption, { color: paleta.texto2 }]}>
              ID: {item.id.substring(0, 8).toUpperCase()}
            </Text>
          </View>

          {isStaff && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs }}>
              <User size={13} color={paleta.texto3} />
              <Text style={[tipografia.caption, { color: paleta.texto2 }]}>{registeredByText}</Text>
            </View>
          )}
        </View>

        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          borderTopWidth: 1, borderTopColor: paleta.borde, paddingTop: espacio.m, marginTop: espacio.m,
        }}>
          <Badge texto="Pendiente revisión" tipo="advertencia" punto />
          {/*
            Only Andrés (owner) gets financial indicators.
            Sandra (admin) and employees do not see costs or total values on cards.
          */}
          {isOwner && item.total !== null && (
            <Text style={[tipografia.h3, tabular, { color: paleta.exitoTexto }]}>
              Total: ${item.total.toLocaleString()}
            </Text>
          )}
        </View>
      </Tarjeta>
    )

    return (
      <View style={{ marginBottom: espacio.m }}>
        {isStaff ? (
          <Presionable
            accessibilityRole="button"
            accessibilityLabel={`Ver recepción de ${providerName}`}
            onPress={() => router.push(`/recibir-mercancia/${item.id}`)}
          >
            {contenido}
          </Presionable>
        ) : (
          contenido
        )}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: espacio.m,
        paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m,
      }}>
        <Presionable accessibilityRole="button" accessibilityLabel="Volver"
          onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={paleta.texto} />
        </Presionable>
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Entradas de Mercancía</Text>
      </View>

      {/* Banner message based on user role */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: espacio.s,
        backgroundColor: paleta.primarioSoft, marginHorizontal: espacio.xl,
        padding: espacio.m, borderRadius: radio.md,
      }}>
        {perfil?.rol === 'empleado' ? (
          <Info size={20} color={paleta.primario} />
        ) : (
          <ShieldCheck size={20} color={paleta.primario} />
        )}
        <Text style={[tipografia.caption, { color: paleta.texto2, flex: 1 }]}>
          {perfil?.rol === 'dueno' && 'Revisa y completa los costos unitarios y plazos de pago para ingresar stock.'}
          {perfil?.rol === 'admin' && 'Completa los datos de las recepciones físicas pendientes.'}
          {perfil?.rol === 'empleado' && 'Lista de tus recepciones de calzado enviadas a revisión.'}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: espacio.xl }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: espacio.xl, gap: espacio.l }}>
          <EstadoVacio icono={<CircleAlert />} titulo={error} />
          <Boton titulo="Reintentar" variante="secundario" tamano="md" onPress={() => cargarDatos()} />
        </View>
      ) : (
        <>
          {perfil?.rol !== 'empleado' && (
            <View style={{ paddingHorizontal: espacio.xl, marginTop: espacio.l }}>
              <Text style={[tipografia.h3, { color: paleta.texto }]}>Pendientes de Revisión</Text>
            </View>
          )}
          <FlatList
            data={compras}
            keyExtractor={(item) => item.id}
            renderItem={renderCompra}
            contentContainerStyle={{ padding: espacio.xl, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[paleta.primario]} />
            }
            ListEmptyComponent={
              <EstadoVacio
                icono={<FileText />}
                titulo={
                  perfil?.rol === 'empleado'
                    ? 'No has registrado entradas pendientes.'
                    : 'No hay entradas de mercancía pendientes de revisión.'
                }
              />
            }
          />
        </>
      )}

      {/* Floating Action Button (FAB) para registrar una nueva llegada */}
      <Presionable
        accessibilityRole="button"
        accessibilityLabel="Registrar entrada de mercancía"
        onPress={() => router.push('/recibir-mercancia/nueva')}
        hitSlop={8}
        testID="registrar-entrada-fab"
        style={{
          position: 'absolute',
          bottom: espacio.xl,
          right: espacio.xl,
          width: 56,
          height: 56,
          borderRadius: radio.full,
          backgroundColor: paleta.primario,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: paleta.sombraFab,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <Plus size={28} color={paleta.sobrePrimario} />
      </Presionable>
    </View>
  )
}
