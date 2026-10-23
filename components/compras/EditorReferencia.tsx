import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Modal, Pressable, Text, TextInput, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Camera, CopyPlus, Scissors, Trash2, X } from 'lucide-react-native'
import { CATEGORIAS } from '../../shared/excel'
import { leerPesos, pesos } from '../../shared/formato'
import {
  claveRefColor, claveSinReferencia, dividirRango, enRango, fotoDeFila, miles, partesColor, rangosDesdeExistentes, subirFotoColor,
  subtotalFila, TALLAS, unidadesFila, unirColores, unirRango, type FilaFactura, type TallaExistente,
} from '../../lib/compras'
import { useTema } from '../../lib/tema'
import { espacio, fuentes, radio, tabular, tipografia } from '../../lib/theme'
import { Badge, Boton, CampoTexto, Chip, PuntoColor, ScreenWrapper } from '../ui'
import { Seccion, Sugerencias } from './Campos'
import { BarrasSistema } from '../BarrasSistema'
import { MARGEN_SUPERIOR } from '../../hooks/usePaddingInferior'

export interface ReferenciaConocida {
  referencia: string
  descripcion: string
  marca: string
  categoria: string
  color: string
  existentes: Record<string, TallaExistente>
}

interface Props {
  // La referencia que se edita (null = cerrado). Se edita una copia: "Listo" la guarda.
  fila: FilaFactura | null
  // Con permiso de costos: costo, precios y productos nuevos. Sin él, solo
  // cantidades de tallas que ya existen (llegada física).
  conCostos: boolean
  conocidas: Map<string, ReferenciaConocida>
  referencias: string[]
  marcas: string[]
  colores: string[]
  coloresSimples: string[]
  costos?: Map<string, { ultimo: number }>
  // Si el inventario no cargó no se reconoce nada (y no se borra lo que la fila ya sabía).
  inventarioListo: boolean
  onGuardar: (fila: FilaFactura) => void
  onOtroColor: (fila: FilaFactura) => void
  onQuitar: () => void
  onCerrar: () => void
}

const COLUMNAS = 6
const soloDigitos = (t: string) => t.replace(/\D/g, '')
const conMiles = (t: string) => (soloDigitos(t) ? miles(Number(soloDigitos(t))) : '')

// Una referencia y color de la factura en pantalla completa: foto, datos,
// cantidad por talla (20–45) y costo/precios por rango de tallas.
export function EditorReferencia({
  fila: inicial, conCostos, conocidas, referencias, marcas, colores, coloresSimples, costos, inventarioListo,
  onGuardar, onOtroColor, onQuitar, onCerrar,
}: Props) {
  const { paleta } = useTema()
  const insets = useSafeAreaInsets()
  const [fila, setFila] = useState<FilaFactura | null>(inicial)
  const [color1, setColor1] = useState('')
  const [color2, setColor2] = useState('')
  const [enfocado, setEnfocado] = useState<'referencia' | 'color1' | 'color2' | 'marca' | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [dividiendo, setDividiendo] = useState<number | null>(null)
  const [anchoTallas, setAnchoTallas] = useState(0)
  const campos = useRef<Record<string, TextInput | null>>({})

  useEffect(() => {
    setFila(inicial)
    const [a, b] = partesColor(inicial?.color ?? '')
    setColor1(a)
    setColor2(b)
    setDividiendo(null)
    // Solo al abrir otra referencia: mientras se edita, la copia local manda.
  }, [inicial?.id])

  if (!fila) return null
  const f = fila
  const cambiar = (cambios: Partial<FilaFactura>) => setFila((x) => (x ? { ...x, ...cambios } : x))

  // Al escribir referencia y color de algo que ya existe: trae descripción,
  // marca, categoría, sus tallas y precios (y el último costo).
  function reconocer(base: FilaFactura) {
    if (!inventarioListo) {
      setFila(base)
      return
    }
    // Sin referencia se busca por la descripción, como hace la base.
    const r = conocidas.get(claveRefColor(base.referencia, base.color))
      ?? (base.referencia.trim() ? undefined : conocidas.get(claveSinReferencia(base.descripcion, base.color)))
    if (!r) {
      // Sin costos solo se cuentan tallas existentes: lo escrito para algo que
      // no está en el inventario no se podría guardar, así que no se esconde.
      setFila({ ...base, existentes: {}, cantidades: conCostos ? base.cantidades : {} })
      return
    }
    // ¿Es el mismo zapato que la fila ya tenía? Si cambió a otro que existe
    // (otra referencia u otro color), se traen sus propios datos y precios.
    const ids = new Set(Object.values(r.existentes).map((e) => e.id))
    const mismo = Object.values(base.existentes).some((e) => ids.has(e.id))
    const sinPrecios = base.rangos.every((x) => !x.costo && !x.minimo && !x.maximo)
    const cantidades = conCostos
      ? base.cantidades
      : Object.fromEntries(Object.entries(base.cantidades).filter(([t]) => r.existentes[t]))
    const [a, b] = partesColor(r.color)
    setColor1(a)
    setColor2(b)
    setFila({
      ...base,
      referencia: r.referencia || base.referencia,
      color: r.color,
      descripcion: mismo ? base.descripcion || r.descripcion : r.descripcion,
      marca: mismo ? base.marca || r.marca : r.marca,
      categoria: mismo ? base.categoria || r.categoria : r.categoria,
      existentes: r.existentes,
      cantidades,
      rangos: sinPrecios || !mismo ? rangosDesdeExistentes(r.existentes, costos) : base.rangos,
    })
  }

  function cambiarColor(primero: string, segundo: string) {
    setColor1(primero)
    setColor2(segundo)
    cambiar({ color: unirColores(primero, segundo) })
  }

  function salirDelColor() {
    let a = color1
    let b = color2
    if (!b.trim()) [a, b] = partesColor(color1)
    setColor1(a)
    setColor2(b)
    setEnfocado(null)
    reconocer({ ...f, color: unirColores(a, b) })
  }

  async function elegirFoto(origen: 'camara' | 'galeria') {
    const permiso = origen === 'camara'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permiso.granted) {
      Alert.alert('Sin permiso', origen === 'camara' ? 'Activa el permiso de la cámara.' : 'Activa el permiso de las fotos.')
      return
    }
    const resultado = origen === 'camara'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    if (resultado.canceled) return
    setSubiendoFoto(true)
    try {
      const url = await subirFotoColor(resultado.assets[0].uri)
      setFila((x) => (x ? { ...x, foto: url } : x))
    } catch (e) {
      Alert.alert('No se subió la foto', e instanceof Error ? e.message : 'Intenta de nuevo.')
    } finally {
      setSubiendoFoto(false)
    }
  }

  const foto = fotoDeFila(f)
  const conocida = Object.keys(f.existentes).length > 0
  const nuevas = TALLAS.filter((t) => Number(f.cantidades[t]) > 0 && !f.existentes[t]).length
  const ancho = anchoTallas ? (anchoTallas - espacio.s * (COLUMNAS - 1)) / COLUMNAS : 0
  // Sin costos solo se cuentan las tallas que ya existen.
  const tallaHabilitada = (t: string) => conCostos || !!f.existentes[t]
  const tallasVisibles = TALLAS.filter(tallaHabilitada)

  const siguienteTalla = (t: string) => {
    const i = tallasVisibles.indexOf(t)
    const destino = tallasVisibles[i + 1]
    if (destino) campos.current[destino]?.focus()
  }

  const cabecera = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: espacio.m,
      paddingHorizontal: espacio.xl, paddingTop: MARGEN_SUPERIOR, paddingBottom: espacio.m,
    }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sin guardar" hitSlop={12} onPress={onCerrar}>
        <X size={24} color={paleta.texto} />
      </Pressable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]} numberOfLines={1}>
        {f.referencia.trim() || 'Referencia'}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Quitar referencia" hitSlop={12} onPress={onQuitar}>
        <Trash2 size={22} color={paleta.texto3} />
      </Pressable>
    </View>
  )

  const pie = (
    <View style={{
      padding: espacio.l, paddingBottom: espacio.l + insets.bottom, gap: espacio.m,
      borderTopWidth: 1, borderTopColor: paleta.borde, backgroundColor: paleta.fondo,
    }}>
      <Text style={[tipografia.etiqueta, tabular, { color: paleta.texto2 }]}>
        {unidadesFila(f)} pares{conCostos ? ` · subtotal ${pesos(subtotalFila(f))}` : ''}
      </Text>
      <View style={{ flexDirection: 'row', gap: espacio.s }}>
        <View style={{ flex: 1 }}>
          <Boton
            titulo="Otro color"
            variante="contorno"
            icono={<CopyPlus size={18} color={paleta.texto} />}
            onPress={() => onOtroColor(f)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Boton titulo="Listo" onPress={() => onGuardar(f)} />
        </View>
      </View>
    </View>
  )

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar} testID="editor-referencia">
      <ScreenWrapper
        header={cabecera}
        footer={pie}
        contentContainerStyle={{ paddingHorizontal: espacio.xl, paddingBottom: espacio.xxl, gap: espacio.xl }}
      >
        <View style={{ flexDirection: 'row', gap: espacio.l, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={foto ? 'Cambiar la foto de este color' : 'Agregar la foto de este color'}
            onPress={() => Alert.alert('Foto de este color', 'Queda en todas sus tallas al guardar la compra.', [
              { text: 'Cámara', onPress: () => elegirFoto('camara') },
              { text: 'Galería', onPress: () => elegirFoto('galeria') },
              { text: 'Cancelar', style: 'cancel' },
            ])}
            style={{
              width: 96, height: 96, borderRadius: radio.md, overflow: 'hidden',
              backgroundColor: paleta.superficie2, alignItems: 'center', justifyContent: 'center',
            }}
          >
            {foto ? <Image source={{ uri: foto }} style={{ width: 96, height: 96 }} /> : (
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Camera size={26} color={paleta.texto3} />
                <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Foto</Text>
              </View>
            )}
            {subiendoFoto ? (
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: paleta.overlay, alignItems: 'center', justifyContent: 'center',
              }}>
                <ActivityIndicator color={paleta.sobreOscura} />
              </View>
            ) : null}
          </Pressable>
          <View style={{ flex: 1, gap: espacio.s }}>
            {conocida ? <Badge texto="EN INVENTARIO" tipo="neutro" /> : f.referencia.trim() ? <Badge texto="NUEVA" tipo="verde" /> : null}
            <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
              {f.foto ? 'Foto nueva: queda en todas las tallas de este color.' : foto ? 'Foto actual de este color.' : 'Sin foto todavía.'}
            </Text>
          </View>
        </View>

        <Seccion titulo="Zapato">
          <View style={{ gap: espacio.s }}>
            <CampoTexto
              etiqueta="Referencia"
              placeholder="Ej. TR-1"
              autoCapitalize="characters"
              autoCorrect={false}
              value={f.referencia}
              onChangeText={(referencia) => cambiar({ referencia })}
              onFocus={() => setEnfocado('referencia')}
              onBlur={() => { setEnfocado(null); reconocer(f) }}
              testID="input-referencia"
            />
            {enfocado === 'referencia' ? (
              <Sugerencias opciones={referencias} texto={f.referencia} onElegir={(referencia) => reconocer({ ...f, referencia })} />
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: espacio.s }}>
            <View style={{ flex: 1, gap: espacio.s }}>
              <CampoTexto
                etiqueta="Color"
                placeholder="Ej. Negro"
                value={color1}
                onChangeText={(v) => cambiarColor(v, color2)}
                onFocus={() => setEnfocado('color1')}
                onBlur={salirDelColor}
                testID="input-color"
              />
            </View>
            <View style={{ flex: 1, gap: espacio.s }}>
              <CampoTexto
                etiqueta="Segundo color"
                placeholder="Opcional"
                value={color2}
                editable={!!color1.trim()}
                onChangeText={(v) => cambiarColor(color1, v)}
                onFocus={() => setEnfocado('color2')}
                onBlur={salirDelColor}
                testID="input-color2"
              />
            </View>
          </View>
          {enfocado === 'color1' ? (
            <Sugerencias
              opciones={colores}
              texto={color1}
              onElegir={(c) => {
                const [a, b] = partesColor(c)
                setColor1(a)
                setColor2(b)
                reconocer({ ...f, color: c })
              }}
            />
          ) : enfocado === 'color2' ? (
            <Sugerencias opciones={coloresSimples} texto={color2} onElegir={(c) => cambiarColor(color1, c)} />
          ) : f.color.trim() ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
              <PuntoColor color={f.color} tamano={14} />
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Hasta dos colores. Puedes escribir uno nuevo.</Text>
            </View>
          ) : null}

          <CampoTexto
            etiqueta="Descripción"
            placeholder="Ej. Tennis running"
            value={f.descripcion}
            onChangeText={(descripcion) => cambiar({ descripcion })}
            // Un zapato sin referencia se reconoce por su descripción.
            onBlur={() => { if (!f.referencia.trim()) reconocer(f) }}
            testID="input-descripcion"
          />

          <View style={{ gap: espacio.s }}>
            <CampoTexto
              etiqueta="Marca"
              placeholder="Ej. Verlon"
              value={f.marca}
              onChangeText={(marca) => cambiar({ marca })}
              onFocus={() => setEnfocado('marca')}
              onBlur={() => setEnfocado(null)}
              testID="input-marca"
            />
            {enfocado === 'marca' ? (
              <Sugerencias opciones={marcas} texto={f.marca} onElegir={(marca) => cambiar({ marca })} />
            ) : null}
          </View>

          <View style={{ gap: espacio.s }}>
            <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Categoría</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
              {CATEGORIAS.map((c) => (
                <Chip key={c.valor} etiqueta={c.etiqueta} activo={f.categoria === c.valor} onPress={() => cambiar({ categoria: c.valor })} />
              ))}
            </View>
          </View>
        </Seccion>

        <Seccion
          titulo={`Cantidad por talla${nuevas ? ` · ${nuevas} nueva${nuevas === 1 ? '' : 's'}` : ''}`}
        >
          {!conCostos && !conocida ? (
            <Text style={[tipografia.cuerpo, { color: paleta.texto3 }]}>
              Escribe la referencia y el color de un zapato que ya esté en el inventario. Los productos nuevos los registra quien maneja los costos.
            </Text>
          ) : (
            <View
              onLayout={(e) => setAnchoTallas(e.nativeEvent.layout.width)}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}
            >
              {tallasVisibles.map((t) => {
                const lleno = Number(f.cantidades[t]) > 0
                const existe = !!f.existentes[t]
                return (
                  <View key={t} style={{ width: ancho || 48, gap: 2, alignItems: 'center' }}>
                    <Text style={[tipografia.caption, { color: existe ? paleta.texto : paleta.texto3, fontFamily: existe ? fuentes.negrita : fuentes.media }]}>
                      {t}{existe ? '' : '·'}
                    </Text>
                    <TextInput
                      ref={(r) => { campos.current[t] = r }}
                      accessibilityLabel={`Talla ${t}`}
                      testID={`talla-${t}`}
                      value={f.cantidades[t] ?? ''}
                      onChangeText={(v) => cambiar({ cantidades: { ...f.cantidades, [t]: soloDigitos(v) } })}
                      keyboardType="number-pad"
                      returnKeyType="next"
                      selectTextOnFocus
                      blurOnSubmit={false}
                      onSubmitEditing={() => siguienteTalla(t)}
                      style={[tipografia.cuerpoLg, tabular, {
                        width: '100%', height: 44, textAlign: 'center', borderRadius: radio.sm,
                        borderWidth: 1,
                        borderColor: lleno ? paleta.primario : paleta.borde,
                        backgroundColor: lleno ? paleta.primarioSoft : paleta.superficie,
                        color: paleta.texto,
                      }]}
                    />
                  </View>
                )
              })}
            </View>
          )}
          {conCostos ? (
            <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
              En negrita, las tallas que ya están en el inventario; con punto, las que se crean al guardar.
            </Text>
          ) : null}
        </Seccion>

        {conCostos ? (
          <Seccion titulo="Costo y precios por rango de tallas">
            {f.rangos.map((r, i) => {
              const usadas = TALLAS.filter((t) => enRango(r, t) && Number(f.cantidades[t]) > 0).length
              const posibles = TALLAS.filter((t) => enRango(r, t) && t !== r.desde)
              const tramo = r.desde === r.hasta ? `Talla ${r.desde}` : `Tallas ${r.desde}–${r.hasta}`
              return (
                <View key={`${r.desde}-${r.hasta}`} style={{
                  gap: espacio.m, padding: espacio.m, borderRadius: radio.md, backgroundColor: paleta.superficie,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={[tipografia.etiqueta, { color: paleta.texto }]}>{tramo}</Text>
                      <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                        {usadas ? `${usadas} con cantidad` : 'sin cantidades'}
                      </Text>
                    </View>
                    {f.rangos.length > 1 ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Unir ${tramo} con el rango vecino`} hitSlop={10}
                        onPress={() => setFila(unirRango(f, i))}>
                        <X size={18} color={paleta.texto3} />
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: espacio.s }}>
                    {(['costo', 'minimo', 'maximo'] as const).map((c) => (
                      <View key={c} style={{ flex: 1 }}>
                        <CampoTexto
                          compacto
                          etiqueta={c === 'costo' ? 'Costo' : c === 'minimo' ? 'Mínimo' : 'Máximo'}
                          keyboardType="number-pad"
                          placeholder="$"
                          value={r[c]}
                          onChangeText={(v) => cambiar({ rangos: f.rangos.map((x, j) => (j === i ? { ...x, [c]: conMiles(v) } : x)) })}
                          testID={`${c}-${r.desde}`}
                        />
                      </View>
                    ))}
                  </View>
                  {!Number.isNaN(leerPesos(r.costo)) && !Number.isNaN(leerPesos(r.minimo)) && leerPesos(r.minimo) < leerPesos(r.costo) ? (
                    <Text style={[tipografia.caption, { color: paleta.advertenciaTexto }]}>El mínimo queda por debajo del costo.</Text>
                  ) : null}
                  {posibles.length ? (
                    dividiendo === i ? (
                      <View style={{ gap: espacio.s }}>
                        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Precio distinto desde la talla:</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
                          {posibles.map((t) => (
                            <Chip key={t} etiqueta={t} activo={false} onPress={() => { setFila(dividirRango(f, t)); setDividiendo(null) }} />
                          ))}
                        </View>
                      </View>
                    ) : (
                      <Pressable accessibilityRole="button" onPress={() => setDividiendo(i)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Scissors size={14} color={paleta.texto2} />
                        <Text style={[tipografia.caption, { color: paleta.texto2, textDecorationLine: 'underline' }]}>
                          Precio distinto desde una talla
                        </Text>
                      </Pressable>
                    )
                  ) : null}
                </View>
              )
            })}
          </Seccion>
        ) : null}
      </ScreenWrapper>
      <BarrasSistema navegacion={false} />
    </Modal>
  )
}
