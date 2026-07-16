import { useEffect, useState } from 'react'
import { View, Text, ScrollView, Image, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ArrowLeft, Camera, Pencil, Save } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { useAuth, useRequireModulo } from '../../../../lib/auth'
import { supabase } from '../../../../lib/supabase'
import { guardarCalzado } from '../../../../lib/inventario'
import { comprimirYSubirImagen } from '../../../../lib/imagenes'
import { CATEGORIAS } from '../../../../lib/excel'
import { useTema } from '../../../../lib/tema'
import { espacio, radio, tipografia } from '../../../../lib/theme'
import { Boton, CampoTexto, Chip, Presionable, Tarjeta, useToast } from '../../../../components/ui'

export default function CalzadoEditorScreen() {
  const requireModulo = useRequireModulo('inventario-calzado')
  const { id } = useLocalSearchParams<{ id?: string }>()
  const router = useRouter()
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const { mostrar } = useToast()

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(!!id)

  const [categoria, setCategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [marca, setMarca] = useState('')
  const [referencia, setReferencia] = useState('')
  const [talla, setTalla] = useState('')
  const [color, setColor] = useState('')
  const [precioMinimo, setPrecioMinimo] = useState('')
  const [precioMaximo, setPrecioMaximo] = useState('')
  const [costoCompra, setCostoCompra] = useState('')
  const [stockActual, setStockActual] = useState('')
  const [stockMinimo, setStockMinimo] = useState('1')
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  const esDueno = perfil?.rol === 'dueno'
  const esAdmin = perfil?.rol === 'admin'

  useEffect(() => {
    // Si ya cargó el perfil y no es dueño ni admin, expulsar
    if (perfil && !esDueno && !esAdmin) {
      router.replace('/productos')
    }
  }, [perfil, esDueno, esAdmin])

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
        setTalla(data.talla || '')
        setColor(data.color || '')
        setPrecioMinimo(data.precio_minimo?.toString() || '')
        setPrecioMaximo(data.precio_maximo?.toString() || '')
        setStockActual(data.stock_actual?.toString() || '')
        setStockMinimo(data.stock_minimo?.toString() || '')
        setFotoUrl(data.foto_url || null)

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

    if (perfil && (esDueno || esAdmin)) {
      fetchProducto()
    }
  }, [id, perfil, esDueno, esAdmin])

  if (requireModulo) return requireModulo

  if (!perfil || (!esDueno && !esAdmin)) {
    return null
  }

  const handleSeleccionarImagen = async () => {
    Alert.alert(
      'Seleccionar Foto',
      '¿Desde dónde quieres obtener la foto?',
      [
        {
          text: 'Cámara',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 1,
            })
            if (!result.canceled) {
              subirImagen(result.assets[0].uri)
            }
          }
        },
        {
          text: 'Galería',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 1,
            })
            if (!result.canceled) {
              subirImagen(result.assets[0].uri)
            }
          }
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    )
  }

  const subirImagen = async (uri: string) => {
    try {
      setLoading(true)
      const url = await comprimirYSubirImagen(uri)
      setFotoUrl(url)
    } catch (err: any) {
      console.error(err)
      mostrar('No se pudo subir la imagen: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleGuardar = async () => {
    if (!categoria || !descripcion || !precioMinimo || !precioMaximo || !stockActual || !stockMinimo) {
      mostrar('Por favor llena los campos obligatorios (*).', 'error')
      return
    }

    try {
      setLoading(true)
      await guardarCalzado({
        id: id || undefined,
        categoria,
        descripcion,
        marca: marca || null,
        referencia: referencia || null,
        talla: talla || null,
        color: color || null,
        precio_minimo: parseFloat(precioMinimo),
        precio_maximo: parseFloat(precioMaximo),
        costo_compra: costoCompra ? parseFloat(costoCompra) : null,
        stock_actual: parseInt(stockActual, 10),
        stock_minimo: parseInt(stockMinimo, 10),
        foto_url: fotoUrl || null,
      })

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
      <View style={{ flex: 1, backgroundColor: paleta.fondo, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={paleta.primario} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: espacio.m,
          paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m,
        }}
      >
        <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={paleta.texto} />
        </Presionable>
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>
          {id ? 'Editar Calzado' : 'Nuevo Calzado'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: espacio.xxxl, gap: espacio.l }}
        showsVerticalScrollIndicator={false}
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
            {fotoUrl ? (
              <Image source={{ uri: fotoUrl }} style={{ width: 140, height: 140, borderRadius: radio.full }} />
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
                <Chip key={cat} etiqueta={cat} activo={categoria === cat} onPress={() => setCategoria(cat)} />
              ))}
            </View>
          </View>
          <View style={{ marginTop: espacio.m }}>
            <CampoTexto etiqueta="Descripción *" value={descripcion} onChangeText={setDescripcion} placeholder="Ej. Air Max" />
          </View>
          <View style={{ marginTop: espacio.m }}>
            <CampoTexto etiqueta="Marca" value={marca} onChangeText={setMarca} placeholder="Ej. Nike" />
          </View>
          <View style={{ marginTop: espacio.m }}>
            <CampoTexto etiqueta="Referencia" value={referencia} onChangeText={setReferencia} placeholder="Ej. NK-001" />
          </View>
        </Tarjeta>

        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Variantes</Text>
          <View style={{ flexDirection: 'row', gap: espacio.m, marginTop: espacio.m }}>
            <View style={{ flex: 1 }}>
              <CampoTexto etiqueta="Talla" value={talla} onChangeText={setTalla} placeholder="Ej. 42" />
            </View>
            <View style={{ flex: 1 }}>
              <CampoTexto etiqueta="Color" value={color} onChangeText={setColor} placeholder="Ej. Blanco" />
            </View>
          </View>
        </Tarjeta>

        <Tarjeta>
          <Text style={[tipografia.h3, { color: paleta.texto }]}>Inventario</Text>
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
          {esDueno && (
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
                etiqueta="Precio máximo *"
                value={precioMaximo}
                onChangeText={setPrecioMaximo}
                placeholder="0.00"
                keyboardType="number-pad"
              />
            </View>
          </View>
        </Tarjeta>
      </ScrollView>

      <View style={{ padding: espacio.l, paddingBottom: espacio.xxxl, borderTopWidth: 1, borderTopColor: paleta.borde, backgroundColor: paleta.fondo }}>
        <Boton
          titulo={id ? 'Actualizar producto' : 'Guardar producto'}
          onPress={handleGuardar}
          cargando={loading}
          icono={<Save size={20} color={paleta.sobrePrimario} />}
        />
      </View>
    </View>
  )
}
