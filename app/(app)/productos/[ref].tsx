import React, { useCallback, useState } from 'react'
import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Footprints } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../../lib/auth'
import { tienePermiso } from '../../../lib/permisos'
import { detalleCalzado } from '../../../lib/carrito'
import { useCarrito } from '../../../lib/carrito-contexto'
import { listarCalzado } from '../../../lib/inventario'
import {
  agruparPorReferencia,
  colorInicial,
  coloresDeModelo,
  columnasTallas,
  maximoVitrina,
  resumenColor,
  variantesDeColor,
} from '../../../lib/productos'
import type { ModeloCalzado } from '../../../lib/productos'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import {
  BarraAccionInferior,
  ChipTalla,
  Esqueleto,
  EstadoVacio,
  HojaProductoAnadido,
  PuntoColor,
  RayaDiagonal,
} from '../../../components/ui'
import type { ProductoAnadido } from '../../../components/ui'

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

const ALTO_HERO = 300
const ANCHO_MINI = 96
const GAP_TALLAS = 6

export default function ProductoDetalleScreen() {
  const { ref, color: colorParam } = useLocalSearchParams<{ ref: string; color?: string }>()
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const { dispatch } = useCarrito()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [cargando, setCargando] = useState(true)
  const [modelo, setModelo] = useState<ModeloCalzado | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [varianteId, setVarianteId] = useState<string | null>(null)
  const [anchoTallas, setAnchoTallas] = useState(0)
  const [anadido, setAnadido] = useState<ProductoAnadido | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!ref) return
      listarCalzado()
        .then((filas) => {
          const clave = decodeURIComponent(ref)
          const encontrado =
            agruparPorReferencia(filas, { incluirInactivos: true }).find(
              (m) => m.clave.toLowerCase() === clave.toLowerCase()
            ) ?? null
          setModelo(encontrado)
          if (!encontrado) return
          // Conserva el color elegido al volver a la pantalla; si no, el de la
          // tarjeta tocada; si no, el primero con stock.
          const colores = coloresDeModelo(encontrado)
          setColor((actual) => {
            if (actual != null && colores.includes(actual)) return actual
            const pedido = colorParam ? decodeURIComponent(colorParam) : null
            return pedido != null && colores.includes(pedido) ? pedido : colorInicial(encontrado)
          })
        })
        .catch(() => setModelo(null))
        .finally(() => setCargando(false))
    }, [ref, colorParam])
  )

  if (!perfil) return null
  const esStaff = tienePermiso(perfil, 'inventario')

  const colores = modelo ? coloresDeModelo(modelo) : []
  const colorActual = color ?? ''
  const variantesDelColor = modelo ? variantesDeColor(modelo, colorActual) : []
  const variante = variantesDelColor.find((v) => v.id === varianteId) ?? null
  const resumen = modelo && variantesDelColor.length > 0 ? resumenColor(modelo, colorActual) : null
  const fotoHero = resumen?.foto ?? null
  const puedeAgregar = !!variante && Number(variante.stock_actual) > 0 && variante.activo

  const columnas = columnasTallas(anchoTallas, 52, GAP_TALLAS)
  const anchoTalla = anchoTallas > 0 ? Math.floor((anchoTallas - GAP_TALLAS * (columnas - 1)) / columnas) : undefined

  const elegirColor = (c: string) => {
    setColor(c)
    setVarianteId(null)
  }

  const agregar = () => {
    if (!variante || !modelo || !puedeAgregar) return
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
        precio: maximoVitrina(variante),
        stock: Number(variante.stock_actual),
        precioMin: Number(variante.precio_minimo),
        precioMax: variante.precio_maximo != null ? Number(variante.precio_maximo) : undefined,
        foto: variante.foto_url ?? fotoHero,
      },
    })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setAnadido({
      foto: variante.foto_url ?? fotoHero,
      icono: <Footprints size={48} strokeWidth={1.5} color={paleta.textoDeshabilitado} />,
      marca: modelo.marca ?? '',
      nombre: [modelo.nombre, colorActual].filter(Boolean).join(' '),
      detalle: `Talla ${variante.talla ?? '—'}`,
      precio: maximoVitrina(variante),
    })
  }

  const fichaId = variante?.id ?? variantesDelColor[0]?.id ?? modelo?.variantes[0]?.id ?? null

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView contentContainerStyle={{ paddingBottom: espacio.xxl }}>
        {cargando ? (
          <View style={{ gap: espacio.m, padding: espacio.xl, paddingTop: 96 }}>
            <Esqueleto alto={ALTO_HERO - 96} radio={radio.lg} />
            <Esqueleto alto={28} ancho={220} />
            <Esqueleto alto={72} />
          </View>
        ) : !modelo ? (
          <View style={{ padding: espacio.xl, paddingTop: 96 }}>
            <EstadoVacio
              icono={<Footprints />}
              titulo="No encontramos este producto"
              textoAccion="Volver"
              onAccion={() => router.back()}
            />
          </View>
        ) : (
          <>
            <View
              style={{
                height: ALTO_HERO,
                backgroundColor: paleta.superficie2,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {fotoHero ? (
                <Image source={{ uri: fotoHero }} style={{ width: '100%', height: ALTO_HERO }} resizeMode="cover" />
              ) : (
                <Footprints size={96} strokeWidth={1.25} color={paleta.textoDeshabilitado} />
              )}
            </View>

            {colores.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: espacio.s, paddingHorizontal: espacio.s, paddingTop: espacio.s }}
              >
                {colores.map((c) => {
                  const r = resumenColor(modelo, c)
                  const elegido = c === colorActual
                  return (
                    <Pressable
                      key={c || 'sin-color'}
                      accessibilityRole="button"
                      accessibilityLabel={c || 'Sin color'}
                      accessibilityState={{ selected: elegido }}
                      onPress={() => elegirColor(c)}
                      style={{
                        width: ANCHO_MINI,
                        height: 76,
                        backgroundColor: paleta.superficie2,
                        borderBottomWidth: 3,
                        borderBottomColor: elegido ? paleta.texto : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {r.foto ? (
                        <Image source={{ uri: r.foto }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Footprints size={32} strokeWidth={1.5} color={paleta.textoDeshabilitado} />
                      )}
                      {c ? (
                        <PuntoColor color={c} tamano={12} style={{ position: 'absolute', left: 6, bottom: 6 }} />
                      ) : null}
                      {r.agotado ? <RayaDiagonal /> : null}
                    </Pressable>
                  )
                })}
              </ScrollView>
            ) : null}

            <View style={{ padding: espacio.xl, gap: espacio.l }}>
              <View style={{ gap: 4 }}>
                <Text style={[tipografia.h2, { color: paleta.texto }]}>{modelo.nombre}</Text>
                <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                  {[modelo.marca, modelo.referencia ? `Ref ${modelo.referencia}` : null].filter(Boolean).join(' · ')}
                </Text>
                {colorActual ? (
                  <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>{`Color: ${colorActual}`}</Text>
                ) : null}
                {variante || !resumen || resumen.precioMin === resumen.precioMax ? (
                  <Text style={[tipografia.display, tabular, { color: paleta.texto, fontSize: 28, lineHeight: 34 }]}>
                    {formatear(variante ? maximoVitrina(variante) : resumen?.precioMax ?? 0)}
                  </Text>
                ) : (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      alignItems: 'baseline',
                      columnGap: espacio.l,
                      rowGap: 4,
                      marginTop: espacio.xs,
                    }}
                  >
                    {[
                      { valor: resumen.precioMax, etiqueta: 'Max' },
                      { valor: resumen.precioMin, etiqueta: 'Min' },
                    ].map((p) => (
                      <View key={p.etiqueta} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                        <Text style={[tipografia.h2, tabular, { color: paleta.texto, fontSize: 20 }]}>
                          {formatear(p.valor)}
                        </Text>
                        <Text style={[tipografia.caption, { color: paleta.texto3, fontSize: 11 }]}>{p.etiqueta}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {variante && esStaff ? (
                  <Text style={[tipografia.caption, tabular, { color: paleta.texto3 }]}>
                    {`Precio de venta · mínimo ${formatear(Number(variante.precio_minimo))}`}
                  </Text>
                ) : null}
              </View>

              <View style={{ gap: espacio.s }}>
                <Text style={[tipografia.micro, { color: paleta.texto3 }]}>
                  {colorActual ? `Talla · ${colorActual}` : 'Talla'}
                </Text>
                <View
                  onLayout={(e) => setAnchoTallas(e.nativeEvent.layout.width)}
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP_TALLAS }}
                >
                  {variantesDelColor.map((v) => (
                    <ChipTalla
                      key={v.id}
                      talla={v.talla ?? '—'}
                      stock={Number(v.stock_actual)}
                      seleccionada={varianteId === v.id}
                      ancho={anchoTalla}
                      onPress={() => setVarianteId(varianteId === v.id ? null : v.id)}
                    />
                  ))}
                </View>
              </View>

              {esStaff && fichaId ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Ver ficha"
                  hitSlop={8}
                  onPress={() => router.push(`/inventario/calzado/${fichaId}`)}
                  style={{ alignSelf: 'center', padding: espacio.xs }}
                >
                  <Text style={[tipografia.etiqueta, { color: paleta.texto2, fontSize: 14, textDecorationLine: 'underline' }]}>
                    Ver ficha
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver"
        hitSlop={8}
        onPress={() => router.back()}
        style={{
          position: 'absolute',
          top: 44,
          left: espacio.xl,
          width: 40,
          height: 40,
          borderRadius: radio.full,
          backgroundColor: paleta.fondo,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArrowLeft size={24} color={paleta.texto} />
      </Pressable>

      {!cargando && modelo ? (
        <BarraAccionInferior
          titulo="Agregar al carrito"
          deshabilitado={!puedeAgregar}
          inferior={insets.bottom}
          onPress={agregar}
        />
      ) : null}

      <HojaProductoAnadido
        producto={anadido}
        onCerrar={() => setAnadido(null)}
        onSeguir={() => {
          setAnadido(null)
          router.back()
        }}
        onIrAlCarrito={() => {
          setAnadido(null)
          router.push('/ventas/nueva')
        }}
      />
    </View>
  )
}
