import React, { useCallback, useState } from 'react'
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { ChevronRight, Egg, Footprints, PackagePlus, Pencil, Search, SlidersHorizontal } from 'lucide-react-native'
import { useAuth } from '../../../lib/auth'
import { useCarrito } from '../../../lib/carrito-contexto'
import { CATEGORIAS } from '../../../lib/excel'
import { listarCalzado, listarVarios } from '../../../lib/inventario'
import type { ProductoVarios } from '../../../lib/inventario'
import { agruparPorReferencia, filtrarModelos } from '../../../lib/productos'
import type { ModeloCalzado } from '../../../lib/productos'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import {
  Badge,
  CampoTexto,
  Chip,
  CirculoIcono,
  ControlSegmentado,
  Esqueleto,
  EstadoVacio,
  FilaLista,
  HojaFiltrosProductos,
  HojaVenderGranja,
  Tarjeta,
  useToast,
} from '../../../components/ui'

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// 'Todas' no es una categoría real: es el chip que desactiva el filtro.
const CHIPS_CATEGORIA = [{ valor: 'Todas', etiqueta: 'Todas' }, ...CATEGORIAS]

function CardModelo({ modelo, onPress }: { modelo: ModeloCalzado; onPress: () => void }) {
  const { paleta } = useTema()
  const rango =
    modelo.precioMin === modelo.precioMax
      ? formatear(modelo.precioMax)
      : `${formatear(modelo.precioMin)} – ${formatear(modelo.precioMax)}`

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={modelo.nombre}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        paddingVertical: espacio.s,
        backgroundColor: pressed ? paleta.superficie2 : 'transparent',
        borderRadius: radio.sm,
      })}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radio.sm,
          backgroundColor: paleta.superficie2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          opacity: modelo.agotado ? 0.5 : 1,
        }}
      >
        {modelo.foto ? (
          <Image source={{ uri: modelo.foto }} style={{ width: 56, height: 56 }} />
        ) : (
          <Footprints size={24} color={paleta.textoDeshabilitado} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[tipografia.h3, { color: modelo.agotado ? paleta.texto3 : paleta.texto }]}
          numberOfLines={1}
        >
          {modelo.nombre}
        </Text>
        <Text style={[tipografia.caption, { color: paleta.texto3 }]} numberOfLines={1}>
          {[
            modelo.marca,
            modelo.referencia ? `Ref ${modelo.referencia}` : null,
            `${modelo.colores.length || 1} ${modelo.colores.length === 1 ? 'color' : 'colores'}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      {!modelo.activo ? (
        <Badge texto="DESCONTINUADO" tipo="neutro" />
      ) : modelo.agotado ? (
        <Badge texto="AGOTADO" tipo="peligro" />
      ) : (
        <Text style={[tipografia.etiqueta, tabular, { color: paleta.primario }]}>{rango}</Text>
      )}
      <ChevronRight size={20} color={paleta.texto3} />
    </Pressable>
  )
}

export default function Productos() {
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const router = useRouter()
  const { dispatch } = useCarrito()
  const { mostrar } = useToast()

  const [modo, setModo] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('Todas')
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [modelos, setModelos] = useState<ModeloCalzado[]>([])
  const [varios, setVarios] = useState<ProductoVarios[]>([])
  const [productoGranja, setProductoGranja] = useState<ProductoVarios | null>(null)
  const [filtrosVisibles, setFiltrosVisibles] = useState(false)
  const [marcasFiltro, setMarcasFiltro] = useState<string[]>([])
  const [precioMaxFiltro, setPrecioMaxFiltro] = useState<number | null>(null)
  const [verDescontinuados, setVerDescontinuados] = useState(false)

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

  const q = busqueda.trim().toLowerCase()
  const modelosBase = verDescontinuados ? modelos : modelos.filter((m) => m.activo)
  const modelosVisibles = filtrarModelos(
    categoria === 'Todas' ? modelosBase : modelosBase.filter((m) => m.categoria === categoria),
    busqueda
  )
  const variosVisibles = q ? varios.filter((v) => v.nombre.toLowerCase().includes(q)) : varios

  const marcasDisponibles = [...new Set(modelos.map((m) => m.marca).filter((m): m is string => !!m))].sort()
  const precioMaxAbsoluto = modelos.length > 0 ? Math.max(...modelos.map((m) => m.precioMax)) : 0
  const modelosFiltrados = modelosVisibles.filter((m) => {
    const pasaMarca = marcasFiltro.length === 0 || (m.marca != null && marcasFiltro.includes(m.marca))
    const pasaPrecio = precioMaxFiltro == null || m.precioMin <= precioMaxFiltro
    return pasaMarca && pasaPrecio
  })

  const refrescar = async () => {
    setRefrescando(true)
    await cargar()
    setRefrescando(false)
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 56, gap: espacio.l }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={paleta.primario} />
        }
      >
        <Text style={[tipografia.h1, { color: paleta.texto }]}>Productos</Text>

        <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
          <FilaLista
            icono={
              <CirculoIcono tono="exito">
                <PackagePlus />
              </CirculoIcono>
            }
            titulo="Recibir mercancía"
            subtitulo="Entrada de mercancía nueva"
            chevron
            onPress={() => router.push('/recibir-mercancia')}
          />
        </Tarjeta>

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtros"
            onPress={() => setFiltrosVisibles(true)}
            hitSlop={8}
            style={{ padding: espacio.s }}
          >
            <SlidersHorizontal size={20} color={marcasFiltro.length > 0 || precioMaxFiltro != null ? paleta.primario : paleta.texto3} />
          </Pressable>
        </View>

        {modo === 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espacio.s }}>
            {CHIPS_CATEGORIA.map((c) => (
              <Chip
                key={c.valor}
                etiqueta={c.etiqueta}
                activo={categoria === c.valor}
                onPress={() => setCategoria(c.valor)}
              />
            ))}
            <Chip
              etiqueta="Ver descontinuados"
              activo={verDescontinuados}
              onPress={() => setVerDescontinuados((v) => !v)}
            />
          </ScrollView>
        ) : null}

        {cargando ? (
          <View style={{ gap: espacio.m }}>
            <Esqueleto alto={72} />
            <Esqueleto alto={72} />
            <Esqueleto alto={72} />
          </View>
        ) : modo === 0 ? (
          modelosFiltrados.length === 0 ? (
            <EstadoVacio
              icono={<Footprints />}
              titulo="No hay productos que coincidan"
              mensaje="Prueba con otra búsqueda o categoría"
            />
          ) : (
            <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
              {modelosFiltrados.map((m, i) => (
                <View key={m.clave}>
                  {i > 0 ? (
                    <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 68 }} />
                  ) : null}
                  <CardModelo
                    modelo={m}
                    onPress={() => router.push(`/productos/${encodeURIComponent(m.clave)}`)}
                  />
                </View>
              ))}
            </Tarjeta>
          )
        ) : variosVisibles.length === 0 ? (
          <EstadoVacio icono={<Egg />} titulo="No hay productos de Granja" />
        ) : (
          <Tarjeta estilo={{ paddingVertical: espacio.xs }}>
            {variosVisibles.map((v, i) => (
              <View key={v.id}>
                {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde, marginLeft: 56 }} /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <FilaLista
                      icono={
                        <CirculoIcono tono="acento">
                          <Egg />
                        </CirculoIcono>
                      }
                      titulo={v.nombre}
                      subtitulo={`Por ${v.unidad_medida} · precio al vender`}
                      onPress={() => setProductoGranja(v)}
                    />
                  </View>
                  {perfil.rol === 'dueno' || perfil.rol === 'admin' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${v.nombre}`}
                      hitSlop={8}
                      onPress={() => router.push(`/inventario/granja/editor?id=${v.id}`)}
                      style={{ padding: espacio.m }}
                    >
                      <Pencil size={18} color={paleta.texto3} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </Tarjeta>
        )}
      </ScrollView>

      <HojaVenderGranja
        visible={productoGranja != null}
        producto={productoGranja}
        onCerrar={() => setProductoGranja(null)}
        onAgregar={(cantidad, precio) => {
          if (!productoGranja) return
          dispatch({
            tipo: 'agregarConCantidad',
            cantidad,
            producto: {
              tipo: 'varios',
              id: productoGranja.id,
              titulo: productoGranja.nombre,
              detalle: `por ${productoGranja.unidad_medida}`,
              precio,
              stock: Number.POSITIVE_INFINITY,
              unidad: productoGranja.unidad_medida,
            },
          })
          setProductoGranja(null)
          mostrar(`Agregado: ${productoGranja.nombre}`)
        }}
        onCompraRapida={(cantidad, precio) => {
          if (!productoGranja) return
          dispatch({ tipo: 'limpiar' })
          dispatch({
            tipo: 'agregarConCantidad',
            cantidad,
            producto: {
              tipo: 'varios',
              id: productoGranja.id,
              titulo: productoGranja.nombre,
              detalle: `por ${productoGranja.unidad_medida}`,
              precio,
              stock: Number.POSITIVE_INFINITY,
              unidad: productoGranja.unidad_medida,
            },
          })
          setProductoGranja(null)
          router.push('/ventas/nueva?modo=rapida')
        }}
      />

      <HojaFiltrosProductos
        visible={filtrosVisibles}
        marcas={marcasDisponibles}
        marcasSeleccionadas={marcasFiltro}
        precioMinAbsoluto={0}
        precioMaxAbsoluto={precioMaxAbsoluto}
        precioSeleccionado={[0, precioMaxFiltro ?? precioMaxAbsoluto]}
        onAplicar={(marcas, [, max]) => {
          setMarcasFiltro(marcas)
          setPrecioMaxFiltro(max)
          setFiltrosVisibles(false)
        }}
        onCerrar={() => setFiltrosVisibles(false)}
      />
    </View>
  )
}
