import React, { useCallback, useState } from 'react'
import { Image, Pressable, RefreshControl, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Egg, Footprints, Package, Pencil, Search, SlidersHorizontal } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { tienePermiso } from '../../../lib/permisos'
import { useCarrito } from '../../../lib/carrito-contexto'
import { listarCalzado, listarVarios } from '../../../lib/inventario'
import type { ProductoVarios } from '../../../lib/inventario'
import {
  agruparPorReferencia,
  cantidadConUnidad,
  colorAHex,
  columnasGrid,
  FILTROS_VACIOS,
  filtroActivo,
  tarjetasFiltradas,
} from '../../../lib/productos'
import type { FiltrosProductos, ModeloCalzado, TarjetaProducto } from '../../../lib/productos'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import {
  Badge,
  CampoTexto,
  ControlSegmentado,
  Esqueleto,
  EstadoVacio,
  HojaProductoAnadido,
  HojaVenderGranja,
  PanelFiltrosProductos,
  TarjetaGrid,
} from '../../../components/ui'
import type { ProductoAnadido } from '../../../components/ui'

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// Grid (rediseño §2): el espacio entre columnas es el mismo margen lateral.
const GAP_GRID = espacio.s
const RELLENO_PANTALLA = espacio.xl

const iconoGranja = (nombre: string) => (/huevo/i.test(nombre) ? Egg : Package)

function Precio({ texto, etiqueta, color }: { texto: string; etiqueta?: string; color: string }) {
  const { paleta } = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
      <Text style={[tipografia.cuerpoLg, tabular, { color, fontSize: 15, lineHeight: 20 }]}>{texto}</Text>
      {etiqueta ? <Text style={[tipografia.caption, { color: paleta.texto3, fontSize: 11 }]}>{etiqueta}</Text> : null}
    </View>
  )
}

function CardCalzado({ tarjeta, ancho, onPress }: { tarjeta: TarjetaProducto; ancho: number; onPress: () => void }) {
  const { paleta } = useTema()
  const { modelo, color, agotado } = tarjeta
  const colorTexto = agotado ? paleta.texto3 : paleta.texto

  return (
    <TarjetaGrid
      ancho={ancho}
      accessibilityLabel={color ? `${modelo.nombre} · ${color}` : modelo.nombre}
      onPress={onPress}
      opaca={agotado}
      imagen={
        tarjeta.foto ? (
          <Image source={{ uri: tarjeta.foto }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Footprints size={Math.round(ancho * 0.38)} strokeWidth={1.5} color={paleta.textoDeshabilitado} />
        )
      }
      insignia={
        !modelo.activo ? (
          <Badge texto="DESCONTINUADO" tipo="neutro" />
        ) : agotado ? (
          <Badge texto="AGOTADO" tipo="peligro" />
        ) : null
      }
    >
      {tarjeta.precioMin === tarjeta.precioMax ? (
        <Precio texto={formatear(tarjeta.precioMax)} color={colorTexto} />
      ) : (
        <View>
          <Precio texto={formatear(tarjeta.precioMax)} etiqueta="Max" color={colorTexto} />
          <Precio texto={formatear(tarjeta.precioMin)} etiqueta="Min" color={colorTexto} />
        </View>
      )}
      <Text style={[tipografia.cuerpoLg, { color: colorTexto, fontSize: 15, lineHeight: 20, marginTop: 6 }]} numberOfLines={2}>
        {modelo.nombre}
      </Text>
      {modelo.marca ? (
        <Text style={[tipografia.etiqueta, { color: paleta.texto3 }]} numberOfLines={1}>
          {modelo.marca}
        </Text>
      ) : null}
      {color ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: radio.full,
              backgroundColor: colorAHex(color),
              borderWidth: 1,
              borderColor: paleta.bordeFuerte,
            }}
          />
          <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]} numberOfLines={1}>
            {color}
          </Text>
        </View>
      ) : null}
      <Text style={[tipografia.etiqueta, { color: paleta.texto3 }]}>
        {`${tarjeta.numColores} ${tarjeta.numColores === 1 ? 'color' : 'colores'}`}
      </Text>
    </TarjetaGrid>
  )
}

export default function Productos() {
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const router = useRouter()
  const { dispatch } = useCarrito()
  const { width: anchoVentana } = useWindowDimensions()

  const [modo, setModo] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [modelos, setModelos] = useState<ModeloCalzado[]>([])
  const [varios, setVarios] = useState<ProductoVarios[]>([])
  const [productoGranja, setProductoGranja] = useState<ProductoVarios | null>(null)
  const [anadido, setAnadido] = useState<ProductoAnadido | null>(null)
  const [filtrosVisibles, setFiltrosVisibles] = useState(false)
  const [filtros, setFiltros] = useState<FiltrosProductos>(FILTROS_VACIOS)
  const [anchoGrid, setAnchoGrid] = useState(0)

  const cargar = useCallback(async () => {
    if (!perfil) return
    try {
      if (modo === 0) setModelos(agruparPorReferencia(await listarCalzado(), { incluirInactivos: true }))
      else setVarios((await listarVarios()).filter((v) => v.activo))
    } catch {
      // estado vacío + pull-to-refresh para reintentar
    } finally {
      setCargando(false)
    }
  }, [perfil, modo])

  useFocusEffect(
    useCallback(() => {
      cargar()
    }, [cargar])
  )

  if (!perfil) return null

  // Columnas según el ancho real del contenedor; antes de medir, la ventana.
  const ancho = anchoGrid || anchoVentana
  const columnas = columnasGrid(ancho)
  const anchoCard = Math.max(0, Math.floor((ancho - GAP_GRID * 2 - GAP_GRID * (columnas - 1)) / columnas))

  const q = busqueda.trim().toLowerCase()
  const tarjetas = tarjetasFiltradas(modelos, busqueda, filtros)
  const variosVisibles = q ? varios.filter((v) => v.nombre.toLowerCase().includes(q)) : varios
  const puedeEditarGranja = tienePermiso(perfil, 'inventario')

  const refrescar = async () => {
    setRefrescando(true)
    await cargar()
    setRefrescando(false)
  }

  const grid = (hijos: React.ReactNode) => (
    <View
      onLayout={(e) => setAnchoGrid(e.nativeEvent.layout.width)}
      style={{
        marginHorizontal: -RELLENO_PANTALLA,
        paddingHorizontal: GAP_GRID,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GAP_GRID,
      }}
    >
      {hijos}
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView
        contentContainerStyle={{ padding: RELLENO_PANTALLA, paddingTop: 56, gap: espacio.l }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={paleta.primario} />
        }
      >
        <Text style={[tipografia.h1, { color: paleta.texto }]}>Productos</Text>

        <ControlSegmentado
          opciones={['Calzado', 'Granja']}
          indice={modo}
          onCambio={(i) => {
            setCargando(true)
            setModo(i)
          }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
          <Search size={18} color={paleta.texto3} />
          <View style={{ flex: 1 }}>
            <CampoTexto
              placeholder="Buscar por nombre, marca o ref…"
              value={busqueda}
              onChangeText={setBusqueda}
              autoCorrect={false}
            />
          </View>
          {modo === 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filtros"
              accessibilityState={{ selected: filtroActivo(filtros) }}
              onPress={() => setFiltrosVisibles(true)}
              hitSlop={8}
              style={{ padding: espacio.s }}
            >
              <SlidersHorizontal size={20} color={filtroActivo(filtros) ? paleta.primario : paleta.texto3} />
            </Pressable>
          ) : null}
        </View>

        {cargando ? (
          grid(
            Array.from({ length: columnas * 2 }, (_, i) => (
              <View key={i} style={{ width: anchoCard }}>
                <Esqueleto alto={anchoCard + 96} radio={0} />
              </View>
            ))
          )
        ) : modo === 0 ? (
          tarjetas.length === 0 ? (
            <EstadoVacio
              icono={<Footprints />}
              titulo="No hay productos que coincidan"
              mensaje="Prueba con otra búsqueda o con otros filtros"
            />
          ) : (
            grid(
              tarjetas.map((t) => (
                <CardCalzado
                  key={t.clave}
                  tarjeta={t}
                  ancho={anchoCard}
                  onPress={() =>
                    router.push(
                      `/productos/${encodeURIComponent(t.modelo.clave)}` +
                        (t.color ? `?color=${encodeURIComponent(t.color)}` : '')
                    )
                  }
                />
              ))
            )
          )
        ) : variosVisibles.length === 0 ? (
          <EstadoVacio icono={<Egg />} titulo="No hay productos de Granja" />
        ) : (
          grid(
            variosVisibles.map((v) => {
              const Icono = iconoGranja(v.nombre)
              return (
                <TarjetaGrid
                  key={v.id}
                  ancho={anchoCard}
                  accessibilityLabel={v.nombre}
                  onPress={() => setProductoGranja(v)}
                  imagen={
                    v.foto_url ? (
                      <Image source={{ uri: v.foto_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <Icono size={Math.round(anchoCard * 0.38)} strokeWidth={1.5} color={paleta.acento} />
                    )
                  }
                  esquina={
                    puedeEditarGranja ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Editar ${v.nombre}`}
                        hitSlop={6}
                        onPress={() => router.push(`/inventario/granja/editor?id=${v.id}`)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: radio.full,
                          backgroundColor: paleta.fondo,
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: paleta.sombra,
                          shadowOpacity: 0.12,
                          shadowRadius: 4,
                          shadowOffset: { width: 0, height: 1 },
                          elevation: 2,
                        }}
                      >
                        <Pencil size={18} color={paleta.texto2} />
                      </Pressable>
                    ) : null
                  }
                >
                  <Text style={[tipografia.cuerpoLg, { color: paleta.texto, fontSize: 15, lineHeight: 20 }]}>
                    Precio al vender
                  </Text>
                  <Text style={[tipografia.cuerpoLg, { color: paleta.texto, fontSize: 15, lineHeight: 20, marginTop: 6 }]} numberOfLines={2}>
                    {v.nombre}
                  </Text>
                  <Text style={[tipografia.etiqueta, { color: paleta.texto3 }]} numberOfLines={1}>
                    {`Por ${v.unidad_medida}`}
                  </Text>
                </TarjetaGrid>
              )
            })
          )
        )}
      </ScrollView>

      <HojaVenderGranja
        visible={productoGranja != null}
        producto={productoGranja}
        icono={
          productoGranja
            ? React.createElement(iconoGranja(productoGranja.nombre), { size: 56, strokeWidth: 1.5, color: paleta.acento })
            : null
        }
        onCerrar={() => setProductoGranja(null)}
        onAgregar={(cantidad, precio) => {
          if (!productoGranja) return
          const granja = productoGranja
          dispatch({
            tipo: 'agregarConCantidad',
            cantidad,
            producto: {
              tipo: 'varios',
              id: granja.id,
              titulo: granja.nombre,
              detalle: `por ${granja.unidad_medida}`,
              precio,
              stock: Number.POSITIVE_INFINITY,
              unidad: granja.unidad_medida,
            },
          })
          setProductoGranja(null)
          setAnadido({
            foto: granja.foto_url,
            icono: React.createElement(iconoGranja(granja.nombre), { size: 48, strokeWidth: 1.5, color: paleta.acento }),
            marca: 'Granja',
            nombre: granja.nombre,
            detalle: cantidadConUnidad(cantidad, granja.unidad_medida),
            precio: cantidad * precio,
          })
        }}
      />

      <HojaProductoAnadido
        producto={anadido}
        onCerrar={() => setAnadido(null)}
        onSeguir={() => setAnadido(null)}
        onIrAlCarrito={() => {
          setAnadido(null)
          router.push('/ventas/nueva')
        }}
      />

      <PanelFiltrosProductos
        visible={filtrosVisibles}
        modelos={modelos}
        busqueda={busqueda}
        filtros={filtros}
        onAplicar={(f) => {
          setFiltros(f)
          setFiltrosVisibles(false)
        }}
        onCerrar={() => setFiltrosVisibles(false)}
      />
    </View>
  )
}
