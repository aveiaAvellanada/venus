import { useEffect, useState } from 'react'
import { View, Text, Image, ScrollView, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, ImageOff, PackageX, Pencil } from 'lucide-react-native'
import { useAuth, useRequireModulo } from '../../../../lib/auth'
import { supabase } from '../../../../lib/supabase'
import type { ProductoCalzado } from '../../../../lib/inventario'
import { useTema } from '../../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../../lib/theme'
import { Badge, Boton, EstadoVacio, Presionable, Tarjeta } from '../../../../components/ui'

function formatCOP(n: number): string {
  return '$' + n.toLocaleString('es-CO')
}

export default function CalzadoDetailScreen() {
  const requireModulo = useRequireModulo('inventario-calzado')
  const { id } = useLocalSearchParams<{ id: string }>()
  const [producto, setProducto] = useState<ProductoCalzado | null>(null)
  const [costoCompra, setCostoCompra] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const { perfil } = useAuth()
  const router = useRouter()
  const { paleta } = useTema()

  const esDueno = perfil?.rol === 'dueno'
  const esEmpleado = perfil?.rol === 'empleado'

  if (requireModulo) return requireModulo

  const Encabezado = () => (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: espacio.m,
        paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m,
      }}
    >
      <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} hitSlop={12}>
        <ArrowLeft size={24} color={paleta.texto} />
      </Presionable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>Detalle del Calzado</Text>
    </View>
  )

  useEffect(() => {
    async function fetchProducto() {
      try {
        const { data, error } = await supabase
          .from('productos_calzado')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw error
        setProducto(data)

        if (esDueno) {
          const { data: historial } = await supabase
            .from('historial_precios_calzado')
            .select('costo_compra')
            .eq('producto_id', id)
            .not('costo_compra', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (historial) {
            setCostoCompra(historial.costo_compra)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchProducto()
  }, [id, esDueno])

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      </View>
    )
  }

  if (!producto) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado />
        <View style={{ flex: 1, justifyContent: 'center', padding: espacio.xl, gap: espacio.l }}>
          <EstadoVacio icono={<PackageX />} titulo="Producto no encontrado" />
          <Boton titulo="Volver" variante="fantasma" onPress={() => router.back()} />
        </View>
      </View>
    )
  }

  const stockBajo = producto.stock_actual <= producto.stock_minimo

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado />

      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: espacio.xxxl, gap: espacio.l }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', height: 260, borderRadius: radio.lg, overflow: 'hidden', backgroundColor: paleta.superficie2 }}>
          {producto.foto_url ? (
            <Image source={{ uri: producto.foto_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ImageOff size={56} color={paleta.texto3} />
            </View>
          )}
          <View style={{ position: 'absolute', top: espacio.m, right: espacio.m }}>
            <Badge texto={producto.categoria} tipo="neutro" />
          </View>
        </View>

        <Tarjeta>
          <Text style={[tipografia.h1, { color: paleta.texto }]}>{producto.descripcion}</Text>
          {producto.marca ? (
            <Text style={[tipografia.cuerpoLg, { color: paleta.primario, marginTop: 2 }]}>{producto.marca}</Text>
          ) : null}
          <Text style={[tipografia.cuerpo, { color: paleta.texto2, marginTop: 4 }]}>
            Ref: {producto.referencia || 'Sin referencia'}
          </Text>

          <View style={{ flexDirection: 'row', gap: espacio.s, marginTop: espacio.l }}>
            <View style={{ flex: 1, backgroundColor: paleta.superficie2, borderRadius: radio.sm, padding: espacio.m, alignItems: 'center', gap: 4 }}>
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Talla</Text>
              <Text style={[tipografia.h3, { color: paleta.texto }]}>{producto.talla || '-'}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: paleta.superficie2, borderRadius: radio.sm, padding: espacio.m, alignItems: 'center', gap: 4 }}>
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Color</Text>
              <Text style={[tipografia.h3, { color: paleta.texto }]}>{producto.color || '-'}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: paleta.superficie2, borderRadius: radio.sm, padding: espacio.m, alignItems: 'center', gap: 4 }}>
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Stock</Text>
              <Text style={[tipografia.h3, tabular, { color: stockBajo ? paleta.peligroTexto : paleta.texto }]}>
                {producto.stock_actual}
              </Text>
            </View>
          </View>
        </Tarjeta>

        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Precios de venta</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: espacio.m }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[tipografia.caption, { color: paleta.texto2 }]}>Mínimo</Text>
              <Text style={[tipografia.h2, tabular, { color: paleta.exitoTexto }]}>{formatCOP(producto.precio_minimo)}</Text>
            </View>
            <View style={{ width: 1, height: 32, backgroundColor: paleta.borde }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={[tipografia.caption, { color: paleta.texto2 }]}>Máximo</Text>
              <Text style={[tipografia.h2, tabular, { color: paleta.exitoTexto }]}>{formatCOP(producto.precio_maximo)}</Text>
            </View>
          </View>
        </Tarjeta>

        {esDueno && (
          <Tarjeta estilo={{ backgroundColor: paleta.advertenciaSoft, borderColor: paleta.advertenciaSoft }}>
            <Text style={[tipografia.etiqueta, { color: paleta.advertenciaTexto }]}>Costo de compra (solo dueño)</Text>
            <Text style={[tipografia.h2, tabular, { color: paleta.advertenciaTexto, marginTop: 4 }]}>
              {costoCompra ? formatCOP(costoCompra) : 'No registrado'}
            </Text>
          </Tarjeta>
        )}
      </ScrollView>

      {!esEmpleado && (
        <View style={{ padding: espacio.l, paddingBottom: espacio.xxxl, borderTopWidth: 1, borderTopColor: paleta.borde, backgroundColor: paleta.fondo }}>
          <Boton
            titulo="Editar producto"
            icono={<Pencil size={20} color={paleta.sobrePrimario} />}
            onPress={() => router.push(`/inventario/calzado/editor?id=${producto.id}`)}
          />
        </View>
      )}
    </View>
  )
}
