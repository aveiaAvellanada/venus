import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Text, TextInput, View } from 'react-native'
import { ArrowLeft, Search, X } from 'lucide-react-native'
import { listarCalzado, type ProductoCalzado } from '../../lib/inventario'
import { rangoDeslizador } from '../../lib/carrito'
import {
  agruparPorReferencia, coloresDeModelo, maximoVitrina, variantesDeColor, type ModeloCalzado,
} from '../../lib/productos'
import { useTema } from '../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../lib/theme'
import { Boton } from './Boton'
import { ChipTalla } from './ChipTalla'
import { Chip } from './Chip'
import { EstadoVacio } from './EstadoVacio'
import { Presionable } from './Presionable'
import { ScreenWrapper } from './ScreenWrapper'
import { SliderPrecio } from './SliderPrecio'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')
const soloEntero = (t: string) => t.replace(/[^0-9]/g, '')

interface Props {
  visible: boolean
  onCerrar: () => void
  // Zapato elegido (color y talla) y el precio al que se da.
  onElegir: (variante: ProductoCalzado, precio: number) => void
}

// Buscador de zapato de reemplazo, igual que agregar al carrito: se busca la
// referencia, se elige color y talla y se fija el precio (deslizador entre el
// mínimo y el máximo, o precio escrito: es libre). Cualquier modelo sirve; la
// diferencia con lo pagado la calcula la pantalla de devolución.
export function HojaReemplazo({ visible, onCerrar, onElegir }: Props) {
  const { paleta } = useTema()
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<ProductoCalzado[]>([])
  const [modelo, setModelo] = useState<ModeloCalzado | null>(null)
  const [color, setColor] = useState<string | null>(null)
  const [varianteId, setVarianteId] = useState<string | null>(null)
  const [precioTxt, setPrecioTxt] = useState('')
  const peticion = useRef(0)

  // Cada vez que se abre arranca limpia.
  useEffect(() => {
    if (!visible) return
    setBusqueda(''); setResultados([]); setModelo(null); setColor(null); setVarianteId(null); setPrecioTxt('')
  }, [visible])

  const buscar = (q: string) => {
    setBusqueda(q)
    const mia = ++peticion.current
    if (!q.trim()) {
      setResultados([]); setBuscando(false)
      return
    }
    setBuscando(true)
    listarCalzado({ busqueda: q.trim() })
      .then((r) => { if (mia === peticion.current) setResultados(r) })
      .catch(() => { if (mia === peticion.current) setResultados([]) })
      .finally(() => { if (mia === peticion.current) setBuscando(false) })
  }

  // El modelo se muestra completo (todas sus tallas y colores), aunque la
  // búsqueda haya traído solo algunas filas (p. ej. al buscar una talla).
  const elegirModelo = async (m: ModeloCalzado) => {
    setModelo(m); setVarianteId(null); setPrecioTxt('')
    setColor(coloresDeModelo(m)[0] ?? '')
    try {
      const filas = await listarCalzado({ busqueda: m.referencia ?? m.nombre })
      const completo = agruparPorReferencia(filas).find((g) => g.clave.toLowerCase() === m.clave.toLowerCase())
      if (completo) {
        setModelo(completo)
        const colores = coloresDeModelo(completo)
        setColor((c) => (c != null && colores.includes(c) ? c : colores[0] ?? ''))
      }
    } catch {
      // se queda con las filas de la búsqueda
    }
  }

  const modelos = agruparPorReferencia(resultados)
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
        paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m,
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
        contentContainerStyle={{ paddingHorizontal: espacio.xl, paddingBottom: espacio.xxl, gap: espacio.m }}
        footer={
          modelo ? (
            <View style={{ padding: espacio.l, borderTopWidth: 1, borderTopColor: paleta.borde, backgroundColor: paleta.fondo }}>
              <Boton
                titulo={variante && precio > 0 ? `Usar este reemplazo · ${pesos(precio)}` : 'Elige color, talla y precio'}
                deshabilitado={!variante || precio <= 0}
                onPress={() => variante && onElegir(variante, precio)}
              />
            </View>
          ) : null
        }
      >
        {!modelo ? (
          <>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: espacio.s,
              backgroundColor: paleta.superficie2, borderRadius: radio.md, paddingHorizontal: espacio.m, height: 44,
            }}>
              <Search size={18} color={paleta.texto3} />
              <TextInput
                style={[tipografia.cuerpo, { flex: 1, color: paleta.texto }]}
                placeholder="Busca la referencia, marca o nombre…"
                placeholderTextColor={paleta.textoDeshabilitado}
                autoFocus
                value={busqueda}
                onChangeText={buscar}
                testID="input-buscar-reemplazo"
              />
              {buscando ? <ActivityIndicator size="small" color={paleta.primario} /> : null}
            </View>

            {!buscando && busqueda.trim() !== '' && modelos.length === 0 ? (
              <EstadoVacio icono={<Search />} titulo="Sin resultados" mensaje="Prueba con otra búsqueda." />
            ) : null}

            {modelos.map((m) => (
              <Presionable
                key={m.clave}
                accessibilityRole="button"
                accessibilityLabel={`Elegir ${m.nombre}`}
                testID={`resultado-reemplazo-${m.clave}`}
                onPress={() => elegirModelo(m)}
                style={{
                  borderWidth: 1, borderColor: paleta.borde, borderRadius: radio.md, backgroundColor: paleta.superficie,
                  padding: espacio.m, gap: 2,
                }}
              >
                <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>{m.nombre}</Text>
                <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                  {[m.marca, m.referencia ? `Ref ${m.referencia}` : null, `${m.colores.length || 1} ${m.colores.length === 1 ? 'color' : 'colores'}`]
                    .filter(Boolean).join(' · ')}
                </Text>
                <Text style={[tipografia.caption, tabular, { color: paleta.primario }]}>
                  {m.precioMin === m.precioMax ? pesos(m.precioMin) : `${pesos(m.precioMin)} – ${pesos(m.precioMax)}`}
                  {m.agotado ? '  ·  AGOTADO' : ''}
                </Text>
              </Presionable>
            ))}
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
                      value={precioTxt === '' ? '' : Number(soloEntero(precioTxt)).toLocaleString('es-CO')}
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
    </Modal>
  )
}
