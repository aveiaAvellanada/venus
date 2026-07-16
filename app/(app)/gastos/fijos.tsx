import React, { useState, useCallback } from 'react'
import { View, Text, FlatList, ActivityIndicator } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { ArrowLeft, FileText, Plus } from 'lucide-react-native'
import { supabase } from '../../../lib/supabase'
import { Database } from '../../../lib/database.types'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { Badge, ControlSegmentado, EstadoVacio, Presionable, Tarjeta, useToast } from '../../../components/ui'
import type { TipoBadge } from '../../../components/ui'

type GastoFijoRow = Database['public']['Tables']['gastos_fijos']['Row']
type GastoFijoPagoRow = Database['public']['Tables']['gastos_fijos_pagos']['Row']

interface GastoConPagos extends GastoFijoRow {
  gastos_fijos_pagos: GastoFijoPagoRow[]
}

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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Gastos Fijos</Text>
    </View>
  )
}

export default function GastosFijosScreen() {
  const router = useRouter()
  const { paleta } = useTema()
  const { mostrar } = useToast()

  const [gastos, setGastos] = useState<GastoConPagos[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const endOfMonth = new Date(startOfMonth)
      endOfMonth.setMonth(endOfMonth.getMonth() + 1)
      endOfMonth.setDate(0)
      endOfMonth.setHours(23, 59, 59, 999)

      // Traer gastos fijos activos y sus pagos en el mes actual
      const { data, error } = await supabase
        .from('gastos_fijos')
        .select(
          `
          *,
          gastos_fijos_pagos (
            *
          )
        `
        )
        .eq('activo', true)
        .gte('gastos_fijos_pagos.fecha_pago', startOfMonth.toISOString())
        .lte('gastos_fijos_pagos.fecha_pago', endOfMonth.toISOString())
        .order('nombre', { ascending: true })

      if (error) throw error
      setGastos(data as unknown as GastoConPagos[])
    } catch (error: any) {
      mostrar(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  const renderItem = ({ item }: { item: GastoConPagos }) => {
    const yaPagado = item.gastos_fijos_pagos && item.gastos_fijos_pagos.length > 0

    let tipoBadge: TipoBadge = 'neutro'
    let statusText = 'Desconocido'

    if (yaPagado) {
      tipoBadge = 'exito'
      statusText = 'Pagado'
    } else {
      const hoy = new Date().getDate()
      const diaPago = item.dia_pago || 1
      const diasRestantes = diaPago - hoy

      if (diasRestantes < 0) {
        tipoBadge = 'peligro'
        statusText = 'Atrasado'
      } else if (diasRestantes <= 5) {
        tipoBadge = 'advertencia'
        statusText = `Vence en ${diasRestantes} días`
      } else {
        tipoBadge = 'neutro'
        statusText = `Vence el ${diaPago}`
      }
    }

    const contenido = (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, marginRight: espacio.m }}>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>{item.nombre}</Text>
          <Text style={[tipografia.cuerpo, tabular, { color: paleta.texto2, marginTop: 2 }]}>
            Aprox. ${item.monto_aproximado.toLocaleString()}
          </Text>
          <Text style={[tipografia.caption, { color: paleta.texto3, marginTop: 2 }]}>
            {item.beneficiario || 'Sin beneficiario'}
          </Text>
        </View>
        <Badge texto={statusText} tipo={tipoBadge} />
      </View>
    )

    return (
      <Tarjeta estilo={{ marginBottom: espacio.m }}>
        {yaPagado ? (
          contenido
        ) : (
          <Presionable
            accessibilityRole="button"
            accessibilityLabel={`Pagar ${item.nombre}`}
            onPress={() =>
              router.push(`/gastos/pagar?id=${item.id}&nombre=${encodeURIComponent(item.nombre)}&monto=${item.monto_aproximado}`)
            }
          >
            {contenido}
          </Presionable>
        )}
      </Tarjeta>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />

      <View style={{ paddingHorizontal: espacio.xl, marginBottom: espacio.m }}>
        <ControlSegmentado
          opciones={['Variables', 'Fijos']}
          indice={1}
          onCambio={(i) => {
            if (i === 0) router.replace('/gastos')
          }}
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      ) : (
        <FlatList
          data={gastos}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: espacio.xl, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EstadoVacio icono={<FileText />} titulo="No hay contratos/gastos fijos registrados" />
          }
        />
      )}

      <Presionable
        accessibilityRole="button"
        accessibilityLabel="Agregar gasto fijo"
        onPress={() => router.push('/gastos/fijos-editor')}
        hitSlop={8}
        style={{
          position: 'absolute',
          bottom: espacio.xl,
          right: espacio.xl,
          width: 56,
          height: 56,
          borderRadius: radio.full,
          backgroundColor: paleta.primario,
          alignItems: 'center',
          justifyContent: 'center',
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
