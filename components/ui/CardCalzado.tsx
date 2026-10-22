import React from 'react'
import { Image, Text, View } from 'react-native'
import { Footprints } from 'lucide-react-native'
import type { TarjetaProducto } from '../../lib/productos'
import { useTema } from '../../lib/tema'
import { tabular, tipografia } from '../../lib/theme'
import { Badge } from './Badge'
import { PuntoColor } from './PuntoColor'
import { TarjetaGrid } from './TarjetaGrid'

const formatear = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

function Precio({ texto, etiqueta, color }: { texto: string; etiqueta?: string; color: string }) {
  const { paleta } = useTema()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
      <Text style={[tipografia.cuerpoLg, tabular, { color, fontSize: 15, lineHeight: 20 }]}>{texto}</Text>
      {etiqueta ? <Text style={[tipografia.caption, { color: paleta.texto3, fontSize: 11 }]}>{etiqueta}</Text> : null}
    </View>
  )
}

// Tarjeta de calzado del grid de Productos (una por color). La usa también el
// buscador del zapato de reemplazo, que se ve igual que Productos → Calzado.
export function CardCalzado({
  tarjeta,
  ancho,
  onPress,
  testID,
}: {
  tarjeta: TarjetaProducto
  ancho: number
  onPress: () => void
  testID?: string
}) {
  const { paleta } = useTema()
  const { modelo, color, agotado } = tarjeta
  const colorTexto = agotado ? paleta.texto3 : paleta.texto

  return (
    <TarjetaGrid
      ancho={ancho}
      accessibilityLabel={color ? `${modelo.nombre} · ${color}` : modelo.nombre}
      onPress={onPress}
      testID={testID}
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
          <PuntoColor color={color} tamano={10} />
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
