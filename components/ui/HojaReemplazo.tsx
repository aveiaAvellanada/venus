import React, { useEffect, useState } from 'react'
import { Modal, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { ArrowLeft, Footprints, Search, SlidersHorizontal, X } from 'lucide-react-native'
import { listarCalzado, type ProductoCalzado } from '../../lib/inventario'
import { rangoDeslizador } from '../../lib/carrito'
import {
  agruparPorReferencia, coloresDeModelo, columnasGrid, FILTROS_VACIOS, filtroActivo, maximoVitrina,
  tarjetasFiltradas, variantesDeColor, type FiltrosProductos, type ModeloCalzado, type TarjetaProducto,
} from '../../lib/productos'
import { useTema } from '../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../lib/theme'
import { conPuntosDeMiles } from '../../shared/formato'
import { Boton } from './Boton'
import { CampoTexto } from './CampoTexto'
import { CardCalzado } from './CardCalzado'
import { ChipTalla } from './ChipTalla'
import { Chip } from './Chip'
import { EstadoVacio } from './EstadoVacio'
import { Esqueleto } from './Esqueleto'
import { PanelFiltrosProductos } from './PanelFiltrosProductos'
import { Presionable } from './Presionable'
import { ScreenWrapper } from './ScreenWrapper'
import { SliderPrecio } from './SliderPrecio'
import { MARGEN_SUPERIOR } from '../../hooks/usePaddingInferior'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BarrasSistema } from '../BarrasSistema'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')
const soloEntero = (t: string) => t.replace(/[^0-9]/g, '')

// Mismo grid que Productos: el espacio entre columnas es el mismo margen lateral.
const GAP_GRID = espacio.s
const RELLENO = espacio.xl

interface Props {
  visible: boolean
  onCerrar: () => void
  // Zapato elegido (color y talla) y el precio al que se da.
  onElegir: (variante: ProductoCalzado, precio: number) => void
}

// Buscador de zapato de reemplazo. El primer paso se ve igual que Productos →
// Calzado (mismo buscador, filtros y grid, con todo el catálogo a la vista); al
// tocar una tarjeta se elige talla y precio con ese color ya marcado (deslizador
// entre el mínimo y el máximo, o precio escrito: es libre). Cualquier modelo
// activo sirve; la diferencia con lo pagado la calcula la pantalla de devolución.
export function HojaReemplazo({ visible, onCerrar, onElegir }: Props) {
  const { paleta } = useTema()
  const insets = useSafeAreaInsets()
  const { width: anchoVentana } = useWindowDimensions()
  const [catalogo, setCatalogo] = useState<ModeloCalzado[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState<FiltrosProductos>(FILTROS_VACIOS)
  const [filtrosVisibles, setFiltrosVisibles] = useState(false)
  const [anchoGrid, setAnchoGrid] = useState(0)
  const [modelo, setModelo] = useState<ModeloCalzado | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [varianteId, setVarianteId] = useState<string | null>(null)
  const [precioTxt, setPrecioTxt] = useState('')

  // Cada vez que se abre arranca limpia y trae el catálogo activo.
  useEffect(() => {
    if (!visible) return
    setBusqueda(''); setFiltros(FILTROS_VACIOS); setModelo(null); setColor(null); setVarianteId(null); setPrecioTxt('')
    let vigente = true
    setCargando(true)
    listarCalzado()
      .then((filas) => { if (vigente) setCatalogo(agruparPorReferencia(filas)) })
      .catch(() => { if (vigente) setCatalogo([]) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [visible])

  const elegirTarjeta = (t: TarjetaProducto) => {
    setModelo(t.modelo); setColor(t.color); setVarianteId(null); setPrecioTxt('')
  }

  const ancho = anchoGrid || anchoVentana
  const columnas = columnasGrid(ancho)
  const anchoCard = Math.max(0, Math.floor((ancho - GAP_GRID * 2 - GAP_GRID * (columnas - 1)) / columnas))
  const tarjetas = tarjetasFiltradas(catalogo, busqueda, filtros)

  const grid = (hijos: React.ReactNode) => (
    <View
      onLayout={(e) => setAnchoGrid(e.nativeEvent.layout.width)}
      style={{ marginHorizontal: -RELLENO, paddingHorizontal: GAP_GRID, flexDirection: 'row', flexWrap: 'wrap', gap: GAP_GRID }}
    >
      {hijos}
    </View>
  )

  const colores = modelo ? coloresDeModelo(modelo) : []
  const variantes = modelo && color != null ? variantesDeColor(modelo, color) : []
  const variante = variantes.find((v) => v.id === varianteId) ?? null

  const elegirVariante = (v: ProductoCalzado) => {
    if (varianteId === v.id) { setVarianteId(null); setPrecioTxt(''); return }
    setVarianteId(v.id)
    setPrecioTxt(String(Math.round(Number(v.precio_minimo))))
  }

  const precio = Number(soloEntero(precioTxt)) || 0
  const rango = variante && variante.precio_maximo != null
    ? rangoDeslizador(Number(variante.precio_minimo), Number(variante.precio_maximo))
    : null

  const cabecera = (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: espacio.m,
        paddingHorizontal: espacio.xl, paddingTop: MARGEN_SUPERIOR, paddingBottom: espacio.m,
      }}
    >
      <Presionable
        accessibilityRole="button"
        accessibilityLabel={modelo ? 'Volver a los resultados' : 'Cerrar buscador de reemplazo'}
        hitSlop={12}
        onPress={modelo ? () => setModelo(null) : onCerrar}
      >
        {modelo ? <ArrowLeft size={24} color={paleta.texto} /> : <X size={24} color={paleta.texto} />}
      </Presionable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]} numberOfLines={1}>
        {modelo ? modelo.nombre : 'Zapato de reemplazo'}
      </Text>
    </View>
  )

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={modelo ? () => setModelo(null) : onCerrar}
      testID="modal-buscar-reemplazo">
      <ScreenWrapper
        header={cabecera}
        contentContainerStyle={{ paddingHorizontal: RELLENO, paddingBottom: espacio.xxl + (modelo ? 0 : insets.bottom), gap: modelo ? espacio.m : espacio.l }}
        footer={
          modelo ? (
            <View style={{ padding: espacio.l, paddingBottom: espacio.l + insets.bottom, borderTopWidth: 1, borderTopColor: paleta.borde, backgroundColor: paleta.fondo }}>
              <Boton
                titulo={variante && precio > 0 ? 'Usar este reemplazo' : 'Elige color, talla y precio'}
                deshabilitado={!variante || precio <= 0}
                onPress={() => variante && onElegir(variante, precio)}
              />
            </View>
          ) : null
        }
      >
        {!modelo ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
              <Search size={18} color={paleta.texto3} />
              <View style={{ flex: 1 }}>
                <CampoTexto
                  placeholder="Buscar por nombre, marca o ref…"
                  value={busqueda}
                  onChangeText={setBusqueda}
                  autoCorrect={false}
                  testID="input-buscar-reemplazo"
                />
              </View>
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
            </View>

            {cargando ? (
              grid(
                Array.from({ length: columnas * 2 }, (_, i) => (
                  <View key={i} style={{ width: anchoCard }}>
                    <Esqueleto alto={anchoCard + 96} radio={0} />
                  </View>
                ))
              )
            ) : tarjetas.length === 0 ? (
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
                    testID={`resultado-reemplazo-${t.clave}`}
                    onPress={() => elegirTarjeta(t)}
                  />
                ))
              )
            )}
          </>
        ) : (
          <>
            {colores.length > 1 || (colores.length === 1 && colores[0] !== '') ? (
              <View style={{ gap: espacio.s }}>
                <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Color</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
                  {colores.map((c) => (
                    <Chip
                      key={c || 'sin-color'}
                      etiqueta={c || 'Sin color'}
                      activo={color === c}
                      onPress={() => { setColor(c); setVarianteId(null); setPrecioTxt('') }}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ gap: espacio.s }}>
              <Text style={[tipografia.micro, { color: paleta.texto3 }]}>{color ? `Talla · ${color}` : 'Talla'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {variantes.map((v) => (
                  <ChipTalla
                    key={v.id}
                    talla={v.talla ?? '—'}
                    stock={Number(v.stock_actual)}
                    seleccionada={varianteId === v.id}
                    ancho={64}
                    onPress={() => elegirVariante(v)}
                  />
                ))}
              </View>
            </View>

            {variante ? (
              <View style={{
                borderWidth: 1, borderColor: paleta.borde, borderRadius: radio.md, backgroundColor: paleta.superficie,
                padding: espacio.m, gap: espacio.s,
              }}>
                <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Precio del reemplazo</Text>
                {rango ? (
                  <SliderPrecio
                    valor={Math.min(rango.maximo, Math.max(rango.minimo, precio))}
                    minimo={rango.minimo}
                    maximo={rango.maximo}
                    paso={rango.paso}
                    mostrarValores={false}
                    accessibilityLabel="Precio del reemplazo"
                    onCambio={(p) => setPrecioTxt(String(p))}
                  />
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espacio.s }}>
                  <Text style={[tipografia.caption, tabular, { color: paleta.texto3 }]}>
                    {`Mín ${pesos(Number(variante.precio_minimo))}`}
                  </Text>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 2, height: 38, paddingHorizontal: espacio.s,
                    borderWidth: 1.5, borderColor: paleta.bordeFuerte, borderRadius: radio.sm, backgroundColor: paleta.fondo,
                  }}>
                    <Text style={[tipografia.cuerpo, { color: paleta.texto }]}>$</Text>
                    <TextInput
                      accessibilityLabel="Precio del reemplazo"
                      testID="input-precio-hoja-reemplazo"
                      keyboardType="number-pad"
                      value={conPuntosDeMiles(soloEntero(precioTxt))}
                      onChangeText={(t) => setPrecioTxt(soloEntero(t))}
                      style={[tipografia.cuerpo, tabular, { color: paleta.texto, width: 96, textAlign: 'right', padding: 0 }]}
                    />
                  </View>
                  <Text style={[tipografia.caption, tabular, { color: paleta.texto3 }]}>
                    {variante.precio_maximo != null ? `Máx ${pesos(maximoVitrina(variante))}` : ''}
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScreenWrapper>

      <PanelFiltrosProductos
        visible={filtrosVisibles}
        modelos={catalogo}
        busqueda={busqueda}
        filtros={filtros}
        onAplicar={(f) => {
          setFiltros(f)
          setFiltrosVisibles(false)
        }}
        onCerrar={() => setFiltrosVisibles(false)}
      />
      <BarrasSistema navegacion={false} />
    </Modal>
  )
}
