import React, { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { ArrowLeft, CircleAlert, FileText, Plus, Search } from 'lucide-react-native'
import { hoyEn } from '../../../shared/fechas'
import { pesos } from '../../../shared/formato'
import { useAuth, useRequireModulo } from '../../../lib/auth'
import { tienePermiso } from '../../../lib/permisos'
import { usePaddingInferior, MARGEN_SUPERIOR } from '../../../hooks/usePaddingInferior'
import {
  diasHasta, esPorPagar, estadoCompra, fechaDelNegocio, filtrarCompras, listarCompras, type CompraListado, type FiltroCompras,
} from '../../../lib/compras'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { Badge, Boton, CampoTexto, Chip, EstadoVacio, Presionable, Tarjeta } from '../../../components/ui'
import { fechaCorta } from '../../../components/compras/Campos'

const FILTROS: { clave: FiltroCompras; etiqueta: string }[] = [
  { clave: 'todas', etiqueta: 'Todas' },
  { clave: 'por_pagar', etiqueta: 'Por pagar' },
  { clave: 'pendientes', etiqueta: 'Pendientes de costos' },
]

// Compras (con `costos` o `deudas`: todas, con lo que se debe) y llegadas de
// mercancía pendientes (sin esos permisos: solo las propias por completar).
export default function ComprasScreen() {
  const requireModulo = useRequireModulo('recibir-mercancia')
  const { perfil } = useAuth()
  const router = useRouter()
  const { paleta } = useTema()
  const paddingInferior = usePaddingInferior(110)
  const bottomFab = usePaddingInferior(espacio.xl)
  const hoy = hoyEn()

  const verTodo = tienePermiso(perfil, 'costos') || tienePermiso(perfil, 'deudas')
  const conCostos = tienePermiso(perfil, 'costos')

  const [compras, setCompras] = useState<CompraListado[]>([])
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [error, setError] = useState(false)
  const [filtro, setFiltro] = useState<FiltroCompras>('todas')
  const [texto, setTexto] = useState('')

  const cargar = useCallback(async () => {
    setError(false)
    try {
      setCompras(await listarCompras())
    } catch {
      setError(true)
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  const visibles = useMemo(
    () => filtrarCompras(compras, verTodo ? filtro : 'pendientes', texto),
    [compras, filtro, texto, verTodo],
  )
  const porPagar = compras.filter(esPorPagar)
  const deuda = porPagar.reduce((s, c) => s + c.saldo_pendiente, 0)
  const vencido = porPagar
    .filter((c) => c.fecha_vencimiento && diasHasta(c.fecha_vencimiento, hoy) < 0)
    .reduce((s, c) => s + c.saldo_pendiente, 0)

  if (requireModulo) return requireModulo

  const cabecera = (
    <View style={{ gap: espacio.l, paddingBottom: espacio.m }}>
      {verTodo && tienePermiso(perfil, 'deudas') ? (
        <View style={{ flexDirection: 'row', gap: espacio.s }}>
          <Tarjeta estilo={{ flex: 1 }}>
            <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Por pagar</Text>
            <Text style={[tipografia.h3, tabular, { color: paleta.texto }]}>{pesos(deuda)}</Text>
          </Tarjeta>
          <Tarjeta estilo={{ flex: 1, ...(vencido ? { borderColor: paleta.salmonBorde, backgroundColor: paleta.salmonSoft } : {}) }}>
            <Text style={[tipografia.micro, { color: vencido ? paleta.salmonTexto : paleta.texto3 }]}>Vencido</Text>
            <Text style={[tipografia.h3, tabular, { color: vencido ? paleta.salmonTexto : paleta.texto }]}>{pesos(vencido)}</Text>
          </Tarjeta>
        </View>
      ) : null}
      {verTodo ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
            <Search size={18} color={paleta.texto3} />
            <View style={{ flex: 1 }}>
              <CampoTexto placeholder="Proveedor o número de factura" value={texto} onChangeText={setTexto} autoCorrect={false} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
            {FILTROS.map((x) => (
              <Chip key={x.clave} etiqueta={x.etiqueta} activo={filtro === x.clave} onPress={() => setFiltro(x.clave)} />
            ))}
          </View>
        </>
      ) : (
        <Text style={[tipografia.caption, { color: paleta.texto2 }]}>
          Tus llegadas de mercancía que esperan que se completen los costos.
        </Text>
      )}
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: espacio.m,
        paddingHorizontal: espacio.xl, paddingTop: MARGEN_SUPERIOR, paddingBottom: espacio.m,
      }}>
        <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={paleta.texto} />
        </Presionable>
        <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>{verTodo ? 'Compras' : 'Mercancía recibida'}</Text>
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: espacio.xxxl }} color={paleta.primario} />
      ) : error ? (
        <View style={{ padding: espacio.xl, gap: espacio.l }}>
          <EstadoVacio icono={<CircleAlert />} titulo="No se pudieron cargar las compras" />
          <Boton titulo="Reintentar" variante="secundario" onPress={() => { setCargando(true); cargar() }} />
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={cabecera}
          contentContainerStyle={{ paddingHorizontal: espacio.xl, paddingBottom: paddingInferior, gap: espacio.m }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={() => { setRefrescando(true); cargar() }} colors={[paleta.primario]} />}
          ListEmptyComponent={
            <EstadoVacio
              icono={<FileText />}
              titulo={compras.length ? 'Ninguna compra coincide' : verTodo ? 'Todavía no hay compras' : 'No tienes llegadas pendientes'}
              mensaje={compras.length ? undefined : 'Registra la primera con el botón +.'}
            />
          }
          renderItem={({ item }) => <FilaCompra compra={item} hoy={hoy} verMontos={verTodo} onPress={() => router.push(`/recibir-mercancia/${item.id}`)} />}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={conCostos ? 'Nueva compra' : 'Recibir mercancía'}
        testID="registrar-entrada-fab"
        onPress={() => router.push('/recibir-mercancia/nueva')}
        style={({ pressed }) => ({
          position: 'absolute', right: espacio.xl, bottom: bottomFab,
          flexDirection: 'row', alignItems: 'center', gap: espacio.s,
          height: 56, paddingHorizontal: espacio.xl, borderRadius: radio.full,
          backgroundColor: paleta.primario, opacity: pressed ? 0.85 : 1,
          shadowColor: paleta.sombraFab, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 6,
        })}
      >
        <Plus size={22} color={paleta.sobrePrimario} />
        <Text style={[tipografia.cuerpoLg, { color: paleta.sobrePrimario }]}>{conCostos ? 'Nueva compra' : 'Recibir'}</Text>
      </Pressable>
    </View>
  )
}

function FilaCompra({ compra: c, hoy, verMontos, onPress }: { compra: CompraListado; hoy: string; verMontos: boolean; onPress: () => void }) {
  const { paleta } = useTema()
  const estado = estadoCompra(c, hoy)
  const fecha = fechaCorta(c.fecha_factura ?? fechaDelNegocio(c.created_at))
  return (
    <Tarjeta onPress={onPress}>
      <View style={{ gap: espacio.s }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m }}>
          <View style={{ flex: 1 }}>
            <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]} numberOfLines={1}>{c.proveedor}</Text>
            <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
              {[fecha, c.numero_factura, c.pares ? `${c.pares} pares` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {verMontos && c.total != null ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[tipografia.h3, tabular, { color: paleta.texto }]}>{pesos(c.total)}</Text>
              {esPorPagar(c) && c.saldo_pendiente < (c.total ?? 0) ? (
                <Text style={[tipografia.caption, tabular, { color: paleta.texto3 }]}>debe {pesos(c.saldo_pendiente)}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Badge texto={estado.texto} tipo={estado.tipo} />
        </View>
      </View>
    </Tarjeta>
  )
}
