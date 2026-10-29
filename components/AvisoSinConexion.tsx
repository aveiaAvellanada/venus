import React from 'react'
import { Alert, Text, View } from 'react-native'
import { CloudOff, RefreshCw } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTema } from '../lib/tema'
import { fuentes, radio } from '../lib/theme'
import { useVentasPendientes } from '../lib/ventasPendientes-contexto'
import { Presionable } from './ui'

const ventas = (n: number) => (n === 1 ? '1 venta' : `${n} ventas`)

export function textoAviso(sinConexion: boolean, enviando: boolean, porMandar: number, rechazadas: number): string | null {
  if (enviando) return 'Mandando ventas…'
  const partes = [
    sinConexion ? 'Sin conexión' : null,
    porMandar ? `${ventas(porMandar)} por mandar` : null,
    rechazadas ? `${ventas(rechazadas)} con error` : null,
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : null
}

// Píldora arriba, debajo de la barra de estado: sin internet, o con ventas
// hechas sin conexión que aún no llegan a la base.
export function AvisoSinConexion() {
  const { paleta } = useTema()
  const insets = useSafeAreaInsets()
  const { pendientes, sinConexion, enviando, mandar } = useVentasPendientes()
  const rechazadas = pendientes.filter((v) => v.error).length
  const porMandar = pendientes.length - rechazadas
  const texto = textoAviso(sinConexion, enviando, porMandar, rechazadas)
  if (!texto) return null

  const tocar = () => {
    if (enviando) return
    if (rechazadas && !porMandar) {
      Alert.alert('Ventas con error', 'El servidor no recibió estas ventas. Ábrelas en Movimientos para reintentar.')
    } else if (sinConexion) {
      Alert.alert(
        'Sin conexión',
        porMandar
          ? 'Las ventas quedaron guardadas en el teléfono y se mandan solas cuando vuelva el internet.'
          : 'Puedes seguir vendiendo: las ventas se guardan en el teléfono y se mandan solas cuando vuelva el internet.',
      )
    } else {
      mandar()
    }
  }

  const Icono = sinConexion ? CloudOff : RefreshCw
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 2, left: 0, right: 0, alignItems: 'center' }}>
      <Presionable
        accessibilityRole="button"
        accessibilityLabel={texto}
        testID="aviso-sin-conexion"
        onPress={tocar}
        hitSlop={6}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 6, height: 22, paddingHorizontal: 10,
          borderRadius: radio.full, backgroundColor: paleta.texto,
        }}
      >
        <Icono size={12} color={paleta.fondo} />
        <Text style={{ color: paleta.fondo, fontFamily: fuentes.negrita, fontSize: 11 }}>{texto}</Text>
      </Presionable>
    </View>
  )
}
