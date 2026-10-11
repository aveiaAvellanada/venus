import React, { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Check, ChevronDown, X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CATEGORIAS } from '../../lib/excel'
import { contarModelos, FILTROS_VACIOS, tarjetasFiltradas } from '../../lib/productos'
import type { FiltrosProductos, ModeloCalzado } from '../../lib/productos'
import { useTema } from '../../lib/tema'
import { espacio, tipografia } from '../../lib/theme'
import { Boton } from './Boton'
import { SliderPrecio } from './SliderPrecio'

interface Props {
  visible: boolean
  // Todos los modelos (con descontinuados) y la búsqueda actual: el contador
  // "N artículos encontrados" se calcula en vivo con el borrador.
  modelos: ModeloCalzado[]
  busqueda: string
  filtros: FiltrosProductos
  onAplicar: (filtros: FiltrosProductos) => void
  onCerrar: () => void
}

type Seccion = 'categorias' | 'marcas' | 'precio' | 'estado'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// Panel de filtros a pantalla completa (rediseño Productos §3). Los filtros se
// aplican solo con "Mostrar artículos"; la X cierra sin aplicar.
export function PanelFiltrosProductos({ visible, modelos, busqueda, filtros, onAplicar, onCerrar }: Props) {
  const { paleta } = useTema()
  const insets = useSafeAreaInsets()
  const [borrador, setBorrador] = useState<FiltrosProductos>(filtros)
  const [abiertas, setAbiertas] = useState<Seccion[]>([])

  const precioTope = modelos.length > 0 ? Math.max(...modelos.map((m) => m.precioMax)) : 0
  const marcas = [...new Set(modelos.map((m) => m.marca).filter((m): m is string => !!m))].sort()

  // El panel se siembra con los filtros aplicados cada vez que se abre.
  useEffect(() => {
    if (visible) setBorrador(filtros)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const precioMax = borrador.precioMax ?? precioTope
  const nArticulos = tarjetasFiltradas(modelos, busqueda, borrador).length

  const alternarSeccion = (s: Seccion) =>
    setAbiertas((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  const alternar = (campo: 'categorias' | 'marcas', valor: string) =>
    setBorrador((b) => ({
      ...b,
      [campo]: b[campo].includes(valor) ? b[campo].filter((x) => x !== valor) : [...b[campo], valor],
    }))

  // Funciones de render (no componentes): así el slider no se remonta en cada cambio.
  const opcion = (etiqueta: string, activa: boolean, onPress: () => void, conteo?: number) => (
    <Pressable
      key={etiqueta}
      accessibilityRole="checkbox"
      accessibilityLabel={etiqueta}
      accessibilityState={{ checked: activa }}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: espacio.m }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderWidth: 1.5,
          borderColor: activa ? paleta.texto : paleta.texto3,
          backgroundColor: activa ? paleta.texto : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {activa ? <Check size={16} strokeWidth={3} color={paleta.fondo} /> : null}
      </View>
      <Text style={[tipografia.cuerpo, { color: paleta.texto, flex: 1 }]}>{etiqueta}</Text>
      {conteo != null ? <Text style={[tipografia.cuerpo, { color: paleta.texto3 }]}>{`[${conteo}]`}</Text> : null}
    </Pressable>
  )

  const seccion = (id: Seccion, titulo: string, resumen: string, contenido: React.ReactNode) => {
    const abierta = abiertas.includes(id)
    return (
      <View key={id} style={{ borderBottomWidth: 1, borderBottomColor: paleta.borde }}>
        {resumen ? (
          <View testID="filtro-activo" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: paleta.texto }} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={titulo}
          accessibilityState={{ expanded: abierta }}
          onPress={() => alternarSeccion(id)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.xl, paddingHorizontal: espacio.xl }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[tipografia.cuerpoLg, { color: paleta.texto, fontFamily: tipografia.h3.fontFamily }]}>{titulo}</Text>
            {resumen ? (
              <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]} numberOfLines={2}>{resumen}</Text>
            ) : null}
          </View>
          <View style={{ transform: [{ rotate: abierta ? '180deg' : '0deg' }] }}>
            <ChevronDown size={20} color={paleta.texto} />
          </View>
        </Pressable>
        {abierta ? <View style={{ paddingHorizontal: espacio.xl, paddingBottom: espacio.l }}>{contenido}</View> : null}
      </View>
    )
  }

  const etiquetaCategoria = (valor: string) => CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? valor

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View style={{ flex: 1, backgroundColor: paleta.fondo, paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: espacio.xl,
            paddingTop: espacio.xxl,
            paddingBottom: 14,
            borderBottomWidth: 1.5,
            borderBottomColor: paleta.texto,
          }}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Borrar todo" hitSlop={8} onPress={() => setBorrador(FILTROS_VACIOS)}>
            <Text style={[tipografia.etiqueta, { color: paleta.texto, fontSize: 14, textDecorationLine: 'underline' }]}>Borrar todo</Text>
          </Pressable>
          <Text style={[tipografia.cuerpo, { color: paleta.texto, fontFamily: tipografia.h3.fontFamily }]}>Filtrar resultados</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar filtros" hitSlop={8} onPress={onCerrar}>
            <X size={26} color={paleta.texto} />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }}>
          {seccion(
            'categorias',
            'Tipo de zapato',
            borrador.categorias.map(etiquetaCategoria).join(', '),
            CATEGORIAS.map((c) =>
              opcion(
                c.etiqueta,
                borrador.categorias.includes(c.valor),
                () => alternar('categorias', c.valor),
                contarModelos(modelos, borrador.verDescontinuados, (m) => m.categoria === c.valor)
              )
            )
          )}
          {seccion(
            'marcas',
            'Marca',
            borrador.marcas.join(', '),
            marcas.map((m) =>
              opcion(
                m,
                borrador.marcas.includes(m),
                () => alternar('marcas', m),
                contarModelos(modelos, borrador.verDescontinuados, (x) => x.marca === m)
              )
            )
          )}
          {seccion(
            'precio',
            'Precio',
            borrador.precioMax != null ? `Hasta ${pesos(borrador.precioMax)}` : '',
            <SliderPrecio
              valor={precioMax}
              minimo={0}
              maximo={precioTope}
              paso={5000}
              onCambio={(v) => setBorrador((b) => ({ ...b, precioMax: v >= precioTope ? null : v }))}
            />
          )}
          {seccion(
            'estado',
            'Estado',
            borrador.verDescontinuados ? 'Incluye descontinuados' : '',
            opcion('Ver descontinuados', borrador.verDescontinuados, () =>
              setBorrador((b) => ({ ...b, verDescontinuados: !b.verDescontinuados }))
            )
          )}
        </ScrollView>

        <View
          style={{
            borderTopWidth: 1.5,
            borderTopColor: paleta.texto,
            paddingHorizontal: espacio.xl,
            paddingTop: espacio.l,
            paddingBottom: espacio.xl + insets.bottom,
            gap: 14,
          }}
        >
          <Text style={[tipografia.etiqueta, { color: paleta.texto2, fontSize: 14 }]}>
            {`${nArticulos} ${nArticulos === 1 ? 'artículo encontrado' : 'artículos encontrados'}`}
          </Text>
          <Boton titulo="Mostrar artículos" variante="oscuro" pildora onPress={() => onAplicar(borrador)} />
        </View>
      </View>
    </Modal>
  )
}
