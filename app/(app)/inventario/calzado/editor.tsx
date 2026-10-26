import { useEffect, useState } from 'react'
import { View, Text, Image, ActivityIndicator, Alert, Switch } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Camera, Pencil, Save } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { useAuth, useRequireModulo } from '../../../../lib/auth'
import { tienePermiso } from '../../../../lib/permisos'
import { supabase } from '../../../../lib/supabase'
import { fotoDeModeloColor, guardarCalzado, referenciaParaModelo } from '../../../../lib/inventario'
import { claveReferencia, fijarGarantiaReferencia } from '../../../../lib/tramos'
import { PreciosPorTalla } from '../../../../components/PreciosPorTalla'
import { subirFotoCalzado } from '../../../../lib/imagenes'
import { nombreFoto, urlMiniatura } from '../../../../shared/fotos'
import { describirReferencia } from '../../../../shared/referencias'
import { CATEGORIAS } from '../../../../lib/excel'
import { coloresDeNombre, MAX_COLORES, MENSAJE_MAX_COLORES } from '../../../../lib/productos'
import { usePaddingInferior, MARGEN_SUPERIOR } from '../../../../hooks/usePaddingInferior'
import { useTema } from '../../../../lib/tema'
import { espacio, radio, tipografia } from '../../../../lib/theme'
import { Boton, CampoTexto, Chip, Presionable, Tarjeta, useToast, ScreenWrapper } from '../../../../components/ui'

export default function CalzadoEditorScreen() {
  const requireModulo = useRequireModulo('inventario-calzado')
  const { id } = useLocalSearchParams<{ id?: string }>()
  const router = useRouter()
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const paddingInferior = usePaddingInferior(espacio.xxxl)
  const { mostrar } = useToast()

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(!!id)

  const [categoria, setCategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [marca, setMarca] = useState('')
  const [referencia, setReferencia] = useState('')
  const [garantia, setGarantia] = useState('')
  const [garantiaInicial, setGarantiaInicial] = useState('')
  const [referenciaInicial, setReferenciaInicial] = useState('')
  const [talla, setTalla] = useState('')
  const [color, setColor] = useState('')
  const [precioMinimo, setPrecioMinimo] = useState('')
  const [precioMaximo, setPrecioMaximo] = useState('')
  const [costoCompra, setCostoCompra] = useState('')
  const [stockActual, setStockActual] = useState('')
  const [stockMinimo, setStockMinimo] = useState('1')
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  // Foto elegida que falta subir: se sube al guardar, con el nombre de la
  // referencia y el color que queden.
  const [fotoNueva, setFotoNueva] = useState<string | null>(null)
  const [activo, setActivo] = useState(true)

  const puedeEditar = tienePermiso(perfil, 'inventario')
  const verCostos = tienePermiso(perfil, 'costos')

  useEffect(() => {
    // Si ya cargó el perfil y no tiene permiso de inventario, expulsar
    if (perfil && !puedeEditar) {
      router.replace('/productos')
    }
  }, [perfil, puedeEditar])

  useEffect(() => {
    async function fetchProducto() {
      if (!id) return
      try {
        const { data, error } = await supabase
          .from('productos_calzado')
          .select('*')
          .eq('id', id)
          .single()

        if (error) throw error

        setCategoria(data.categoria || '')
        setDescripcion(data.descripcion || '')
        setMarca(data.marca || '')
        setReferencia(data.referencia || '')
        setReferenciaInicial(data.referencia || '')
        setGarantia(data.garantia_dias != null ? String(data.garantia_dias) : '')
        setGarantiaInicial(data.garantia_dias != null ? String(data.garantia_dias) : '')
        setTalla(data.talla || '')
        setColor(data.color || '')
        setPrecioMinimo(data.precio_minimo?.toString() || '')
        setPrecioMaximo(data.precio_maximo?.toString() || '')
        setStockActual(data.stock_actual?.toString() || '')
        setStockMinimo(data.stock_minimo?.toString() || '')
        setFotoUrl(data.foto_url || null)
        setActivo(data.activo ?? true)

        if (verCostos) {
          const { data: historial } = await supabase
            .from('historial_precios_calzado')
            .select('costo_compra')
            .eq('producto_id', id)
            .not('costo_compra', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (historial) {
            setCostoCompra(historial.costo_compra?.toString() || '')
          }
        }
      } catch (err) {
        console.error(err)
        mostrar('No se pudo cargar el producto', 'error')
        router.back()
      } finally {
        setFetching(false)
      }
    }

    if (perfil && puedeEditar) {
      fetchProducto()
    }
    // Depende de perfil?.id y no del objeto: al volver de la cámara o la galería
    // la app relee el perfil (objeto nuevo) y volver a cargar pisaría la foto
    // recién subida y lo que no se ha guardado.
  }, [id, perfil?.id, puedeEditar, verCostos])

  if (requireModulo) return requireModulo

  if (!perfil || (!puedeEditar)) {
    return null
  }

  const Encabezado = () => (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: espacio.m,
        paddingHorizontal: espacio.xl, paddingTop: MARGEN_SUPERIOR, paddingBottom: espacio.m,
      }}
    >
      <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} hitSlop={12}>
        <ArrowLeft size={24} color={paleta.texto} />
      </Presionable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>
        {id ? 'Editar Calzado' : 'Nuevo Calzado'}
      </Text>
    </View>
  )

  const handleSeleccionarImagen = async () => {
    if (!descripcion.trim()) {
      mostrar('Escribe la descripción para poner la foto.', 'error')
      return
    }
    Alert.alert(
      'Seleccionar Foto',
      '¿Desde dónde quieres obtener la foto?',
      [
        {
          text: 'Cámara',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 1,
            })
            if (!result.canceled) {
              setFotoNueva(result.assets[0].uri)
            }
          }
        },
        {
          text: 'Galería',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 1,
            })
            if (!result.canceled) {
              setFotoNueva(result.assets[0].uri)
            }
          }
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    )
  }

  const handleGuardar = async () => {
    if (!categoria || !descripcion || !precioMinimo || !stockActual || !stockMinimo) {
      mostrar('Por favor llena los campos obligatorios (*).', 'error')
      return
    }
    const min = parseFloat(precioMinimo)
    const max = precioMaximo.trim() ? parseFloat(precioMaximo) : null
    if (max != null && max < min) {
      mostrar('El precio máximo no puede ser menor que el mínimo.', 'error')
      return
    }
    if (coloresDeNombre(color).length > MAX_COLORES) {
      mostrar(MENSAJE_MAX_COLORES, 'error')
      return
    }

    setLoading(true)
    // Un zapato no se crea sin foto (decisión del dueño, 2026-10-26); una talla
    // nueva de un color que ya tiene foto la toma de él.
    if (!id && !fotoNueva && !fotoUrl) {
      let existente: string | null = null
      try {
        existente = await fotoDeModeloColor(descripcion, marca || null, color || null)
      } catch (err) {
        console.error(err)
      }
      if (!existente) {
        mostrar('Pon la foto del zapato: es obligatoria para crearlo.', 'error')
        setLoading(false)
        return
      }
    }

    // La referencia la pone la base: la del modelo (misma descripción y marca)
    // o una nueva. Un zapato nuevo la pide siempre, así "Agregar otro similar"
    // con otra descripción no queda en el modelo anterior.
    let ref = referencia.trim()
    if (!id || !ref) {
      try {
        ref = await referenciaParaModelo(descripcion, marca || null, categoria)
        setReferencia(ref)
      } catch (err: any) {
        console.error(err)
        mostrar('No se pudo poner la referencia: ' + err.message, 'error')
        setLoading(false)
        return
      }
    }

    let foto = fotoUrl
    if (fotoNueva) {
      try {
        foto = await subirFotoCalzado(fotoNueva, nombreFoto(ref, descripcion, color))
        setFotoUrl(foto)
        setFotoNueva(null)
      } catch (err: any) {
        console.error(err)
        mostrar('No se pudo subir la foto: ' + err.message, 'error')
        setLoading(false)
        return
      }
    }

    try {
      await guardarCalzado({
        id: id || undefined,
        categoria,
        descripcion,
        marca: marca || null,
        referencia: ref,
        talla: talla || null,
        color: color || null,
        precio_minimo: min,
        precio_maximo: max,
        costo_compra: costoCompra ? parseFloat(costoCompra) : null,
        stock_actual: parseInt(stockActual, 10),
        stock_minimo: parseInt(stockMinimo, 10),
        foto_url: foto || null,
        activo,
      })

      // La garantía es de toda la referencia, no solo de esta talla y color.
      const cambioGarantia = garantia.trim() !== garantiaInicial.trim()
      if (cambioGarantia || (!id && garantia.trim())) {
        await fijarGarantiaReferencia(ref, garantia.trim() ? parseInt(garantia, 10) : null)
      }

      if (!id) {
        Alert.alert(
          'Guardado exitoso',
          '¿Agregar otro similar?',
          [
            {
              text: 'Sí',
              onPress: () => {
                setTalla('')
                setColor('')
                // La foto es de ese color: la del siguiente se pone aparte.
                setFotoUrl(null)
                mostrar('Ingresa la nueva talla y color.')
              }
            },
            {
              text: 'No',
              onPress: () => router.back()
            }
          ]
        )
      } else {
        mostrar('El producto ha sido actualizado.')
        router.back()
      }
    } catch (err: any) {
      console.error(err)
      mostrar('Hubo un error al guardar el producto.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={paleta.primario} />
        </View>
      </View>
    )
  }

  return (
    <ScreenWrapper
      header={<Encabezado />}
      contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.l }}
      footer={
      <View style={{ padding: espacio.l, paddingBottom: paddingInferior, borderTopWidth: 1, borderTopColor: paleta.borde, backgroundColor: paleta.fondo }}>
        <Boton
          titulo={id ? 'Actualizar producto' : 'Guardar producto'}
          onPress={handleGuardar}
          cargando={loading}
          icono={<Save size={20} color={paleta.sobrePrimario} />}
        />
      </View>
      }
    >
        <View style={{ alignItems: 'center' }}>
          <Presionable
            accessibilityRole="button"
            accessibilityLabel="Añadir foto"
            onPress={handleSeleccionarImagen}
            style={{
              width: 140, height: 140, borderRadius: radio.full,
              backgroundColor: paleta.superficie2, alignItems: 'center', justifyContent: 'center',
            }}
          >
            {fotoNueva || fotoUrl ? (
              <Image source={{ uri: fotoNueva ?? urlMiniatura(fotoUrl) ?? undefined }} style={{ width: 140, height: 140, borderRadius: radio.full }} />
            ) : (
              <View style={{ alignItems: 'center', gap: espacio.s }}>
                <Camera size={40} color={paleta.texto3} />
                <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Añadir foto</Text>
              </View>
            )}
            {loading && (
              <View
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: paleta.overlay, borderRadius: radio.full,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ActivityIndicator color={paleta.sobrePrimario} size="large" />
              </View>
            )}
            <View
              style={{
                position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRadius: radio.full,
                backgroundColor: paleta.primario, alignItems: 'center', justifyContent: 'center',
                borderWidth: 3, borderColor: paleta.fondo,
              }}
            >
              <Pencil size={16} color={paleta.sobrePrimario} />
            </View>
          </Presionable>
        </View>

        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Información principal</Text>
          <View style={{ gap: 6, marginTop: espacio.m }}>
            <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Categoría *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
              {CATEGORIAS.map((cat) => (
                <Chip
                  key={cat.valor}
                  etiqueta={cat.etiqueta}
                  activo={categoria === cat.valor}
                  onPress={() => setCategoria(cat.valor)}
                />
              ))}
            </View>
          </View>
          <View style={{ marginTop: espacio.m }}>
            <CampoTexto etiqueta="Descripción *" value={descripcion} onChangeText={setDescripcion} placeholder="Ej. Air Max" />
          </View>
          <View style={{ marginTop: espacio.m }}>
            <CampoTexto etiqueta="Marca" value={marca} onChangeText={setMarca} placeholder="Ej. Nike" />
          </View>
          <View style={{ marginTop: espacio.m, gap: 2 }}>
            <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Referencia</Text>
            {referencia.trim() ? (
              <>
                <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]} testID="referencia">{referencia.trim()}</Text>
                {describirReferencia(referencia) ? (
                  <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{describirReferencia(referencia)}</Text>
                ) : null}
              </>
            ) : (
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                Se pone sola al guardar: la misma de las otras tallas y colores de este zapato, o una nueva.
              </Text>
            )}
          </View>
          <View style={{ marginTop: espacio.m }}>
            <CampoTexto
              etiqueta="Garantía (días)"
              value={garantia}
              onChangeText={(t) => setGarantia(t.replace(/[^0-9]/g, ''))}
              placeholder="Sin garantía"
              keyboardType="number-pad"
            />
            <Text style={[tipografia.caption, { color: paleta.texto3, marginTop: 4 }]}>
              Aplica a todas las tallas y colores de la referencia.
            </Text>
          </View>
        </Tarjeta>

        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Variantes</Text>
          <View style={{ flexDirection: 'row', gap: espacio.m, marginTop: espacio.m }}>
            <View style={{ flex: 1 }}>
              <CampoTexto etiqueta="Talla" value={talla} onChangeText={setTalla} placeholder="Ej. 42" />
            </View>
            <View style={{ flex: 1 }}>
              <CampoTexto etiqueta="Color" value={color} onChangeText={setColor} placeholder="Ej. Rojo y blanco" />
            </View>
          </View>
        </Tarjeta>

        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Inventario</Text>
          {id ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: espacio.m, marginBottom: espacio.m }}>
              <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>Producto activo</Text>
              <Switch
                value={activo}
                onValueChange={setActivo}
                trackColor={{ false: paleta.borde, true: paleta.primarioSoft }}
                thumbColor={activo ? paleta.primario : paleta.superficie}
              />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: espacio.m, marginTop: espacio.m }}>
            <View style={{ flex: 1 }}>
              <CampoTexto
                etiqueta="Stock actual *"
                value={stockActual}
                onChangeText={setStockActual}
                placeholder="0"
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <CampoTexto
                etiqueta="Stock mínimo *"
                value={stockMinimo}
                onChangeText={setStockMinimo}
                placeholder="1"
                keyboardType="number-pad"
              />
            </View>
          </View>
        </Tarjeta>

        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Precios</Text>
          {verCostos && (
            <View style={{ marginTop: espacio.m }}>
              <CampoTexto
                etiqueta="Costo de compra"
                value={costoCompra}
                onChangeText={setCostoCompra}
                placeholder="0.00"
                keyboardType="number-pad"
              />
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: espacio.m, marginTop: espacio.m }}>
            <View style={{ flex: 1 }}>
              <CampoTexto
                etiqueta="Precio mínimo *"
                value={precioMinimo}
                onChangeText={setPrecioMinimo}
                placeholder="0.00"
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <CampoTexto
                etiqueta="Precio máximo (opcional)"
                value={precioMaximo}
                onChangeText={setPrecioMaximo}
                placeholder="0.00"
                keyboardType="number-pad"
              />
            </View>
          </View>
        </Tarjeta>

        {id && claveReferencia(referenciaInicial) ? (
          <PreciosPorTalla referencia={referenciaInicial} />
        ) : (
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto }]}>Precios por talla</Text>
            <Text style={[tipografia.caption, { color: paleta.texto3, marginTop: 4 }]}>
              Guarda el producto y luego podrás fijar precios distintos por rango de tallas.
            </Text>
          </Tarjeta>
        )}
    </ScreenWrapper>
  )
}
