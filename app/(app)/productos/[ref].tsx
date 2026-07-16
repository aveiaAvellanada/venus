import React, { useCallback, useState } from 'react'
import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Footprints, ShoppingCart } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../../../lib/auth'
import { detalleCalzado } from '../../../lib/carrito'
import { useCarrito } from '../../../lib/carrito-contexto'
import { listarCalzado } from '../../../lib/inventario'
import { agruparPorReferencia } from '../../../lib/productos'
import type { ModeloCalzado } from '../../../lib/productos'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { Boton, ChipTalla, Esqueleto, EstadoVacio, PillColor, useToast } from '../../../components/ui'

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

export default function ProductoDetalleScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>()
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const { dispatch } = useCarrito()
  const { mostrar } = useToast()
  const router = useRouter()

  const [cargando, setCargando] = useState(true)
  const [modelo, setModelo] = useState<ModeloCalzado | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [varianteId, setVarianteId] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!ref) return
      listarCalzado()
        .then((filas) => {
          const clave = decodeURIComponent(ref)
          const encontrado =
            agruparPorReferencia(filas).find((m) => m.clave.toLowerCase() === clave.toLowerCase()) ?? null
          setModelo(encontrado)
          if (encontrado && encontrado.colores.length === 1) setColor(encontrado.colores[0])
        })
        .catch(() => setModelo(null))
        .finally(() => setCargando(false))
    }, [ref])
  )

  if (!perfil) return null
  const esStaff = perfil.rol === 'dueno' || perfil.rol === 'admin'

  const variantesDelColor = modelo
    ? color
      ? modelo.variantes.filter((v) => (v.color ?? '').trim() === color)
      : modelo.variantes
    : []
  const variante = variantesDelColor.find((v) => v.id === varianteId) ?? null

  const precio = variante
    ? formatear(Number(variante.precio_maximo))
    : modelo
      ? modelo.precioMin === modelo.precioMax
        ? formatear(modelo.precioMax)
        : `${formatear(modelo.precioMin)} – ${formatear(modelo.precioMax)}`
      : ''

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView contentContainerStyle={{ padding: espacio.xl, paddingTop: 56, gap: espacio.l }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" hitSlop={12} onPress={() => router.back()}>
          <ArrowLeft size={24} color={paleta.texto2} />
        </Pressable>

        {cargando ? (
          <View style={{ gap: espacio.m }}>
            <Esqueleto alto={200} radio={radio.lg} />
            <Esqueleto alto={28} ancho={220} />
            <Esqueleto alto={72} />
          </View>
        ) : !modelo ? (
          <EstadoVacio
            icono={<Footprints />}
            titulo="No encontramos este producto"
            textoAccion="Volver"
            onAccion={() => router.back()}
          />
        ) : (
          <>
            <View
              style={{
                height: 200,
                borderRadius: radio.lg,
                backgroundColor: paleta.superficie2,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {modelo.foto ? (
                <Image source={{ uri: modelo.foto }} style={{ width: '100%', height: 200 }} resizeMode="cover" />
              ) : (
                <Footprints size={48} color={paleta.textoDeshabilitado} />
              )}
            </View>

            <View style={{ gap: 4 }}>
              <Text style={[tipografia.h2, { color: paleta.texto }]}>{modelo.nombre}</Text>
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                {[modelo.marca, modelo.referencia ? `Ref ${modelo.referencia}` : null].filter(Boolean).join(' · ')}
              </Text>
              <Text style={[tipografia.display, tabular, { color: paleta.texto, fontSize: 28, lineHeight: 34 }]}>
                {precio}
              </Text>
              {variante && esStaff ? (
                <Text style={[tipografia.caption, tabular, { color: paleta.texto3 }]}>
                  {`Precio de venta · mínimo ${formatear(Number(variante.precio_minimo))}`}
                </Text>
              ) : null}
            </View>

            {modelo.colores.length > 1 ? (
              <View style={{ gap: espacio.s }}>
                <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Color</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
                  {modelo.colores.map((c) => (
                    <PillColor
                      key={c}
                      nombre={c}
                      seleccionado={color === c}
                      onPress={() => {
                        setColor(color === c ? null : c)
                        setVarianteId(null)
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ gap: espacio.s }}>
              <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Talla</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
                {variantesDelColor.map((v) => (
                  <ChipTalla
                    key={v.id}
                    talla={v.talla ?? '—'}
                    stock={Number(v.stock_actual)}
                    seleccionada={varianteId === v.id}
                    onPress={() => setVarianteId(varianteId === v.id ? null : v.id)}
                  />
                ))}
              </View>
            </View>

            <Boton
              titulo="Agregar al carrito"
              icono={<ShoppingCart size={20} color={paleta.sobrePrimario} />}
              deshabilitado={!variante || Number(variante.stock_actual) <= 0}
              onPress={() => {
                if (!variante || !modelo) return
                dispatch({
                  tipo: 'agregar',
                  producto: {
                    tipo: 'calzado',
                    id: variante.id,
                    titulo: modelo.nombre,
                    detalle: detalleCalzado({
                      marca: modelo.marca,
                      talla: variante.talla,
                      color: variante.color,
                    }),
                    precio: Number(variante.precio_maximo),
                    stock: Number(variante.stock_actual),
                    precioMin: Number(variante.precio_minimo),
                    precioMax: Number(variante.precio_maximo),
                  },
                })
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                mostrar(`Agregado: talla ${variante.talla} · ${variante.color}`)
                router.push('/ventas/nueva')
              }}
            />
            {esStaff ? (
              <Boton
                titulo="Ver ficha"
                variante="secundario"
                tamano="md"
                deshabilitado={!variante}
                onPress={() => {
                  if (variante) router.push(`/inventario/calzado/${variante.id}`)
                }}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}
