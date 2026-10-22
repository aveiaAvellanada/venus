import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { AlertTriangle, ArrowLeft, Camera, FileText, Footprints, Paperclip, Plus, X } from 'lucide-react-native'
import { COLORES_BASE, coloresDeNombre, nombreColores } from '../../../shared/colores'
import { hoyEn } from '../../../shared/fechas'
import { pesos } from '../../../shared/formato'
import { useAuth, useRequireModulo } from '../../../lib/auth'
import { tienePermiso } from '../../../lib/permisos'
import { listarProveedores, type Proveedor } from '../../../lib/proveedores'
import { listarCalzado } from '../../../lib/inventario'
import { generarClave } from '../../../lib/intentoVenta'
import {
  avisosFactura, claveRefColor, costosPorProducto, erroresFactura, erroresLlegada, filaVacia, fijarFotos, fotoDeFila,
  itemsLlegada, otroColor, registrarCompra, registrarLlegada, resumenFactura, subirFactura, subtotalFila,
  tallasConCantidad, unidadesFila, type Adjunto, type Factura, type FilaFactura,
} from '../../../lib/compras'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import {
  Badge, Boton, CampoTexto, ControlSegmentado, EstadoVacio, Presionable, PuntoColor, ScreenWrapper, Tarjeta, useToast,
} from '../../../components/ui'
import { CampoFecha, fechaCorta, Seccion } from '../../../components/compras/Campos'
import { EditorReferencia, type ReferenciaConocida } from '../../../components/compras/EditorReferencia'
import { SelectorProveedor } from '../../../components/compras/SelectorProveedor'

const BORRADOR = 'venus.compra.borrador'

interface Borrador {
  clave: string
  factura: Factura
}

const borradorNuevo = (hoy: string): Borrador => ({
  clave: generarClave(),
  factura: { proveedorId: '', numeroFactura: '', fechaFactura: hoy, condicion: 'contado', fechaVencimiento: '', notas: '', filas: [] },
})

const alfabetico = (a: string, b: string) => a.localeCompare(b, 'es')

// Recibir mercancía / Nueva compra. Con permiso de `costos` es la factura
// completa del proveedor, igual que en el panel web (costo, precios por rango,
// productos nuevos, crédito, foto de la factura). Sin él, la llegada física:
// cantidades de lo que ya existe, que alguien con costos completa después.
export default function NuevaCompraScreen() {
  const requireModulo = useRequireModulo('recibir-mercancia')
  const { perfil } = useAuth()
  const router = useRouter()
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const hoy = hoyEn()

  const conCostos = tienePermiso(perfil, 'costos')
  const puedeCrearProveedor = tienePermiso(perfil, 'proveedores')
  const puedeAdjuntar = conCostos && tienePermiso(perfil, 'proveedores')

  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [adjunto, setAdjunto] = useState<Adjunto | null>(null)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [conocidas, setConocidas] = useState<Map<string, ReferenciaConocida>>(new Map())
  const [listas, setListas] = useState({ referencias: [] as string[], marcas: [] as string[], colores: [] as string[], coloresSimples: [] as string[] })
  const [costos, setCostos] = useState<Map<string, { ultimo: number }> | undefined>()
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<FilaFactura | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // El borrador queda en el teléfono: una factura a medias no se pierde.
  useEffect(() => {
    AsyncStorage.getItem(BORRADOR)
      .then((v) => setBorrador(v ? (JSON.parse(v) as Borrador) : borradorNuevo(hoy)))
      .catch(() => setBorrador(borradorNuevo(hoy)))
  }, [hoy])
  useEffect(() => {
    if (borrador) AsyncStorage.setItem(BORRADOR, JSON.stringify(borrador)).catch(() => {})
  }, [borrador])

  const cargar = useCallback(async () => {
    try {
      const [provs, productos, cs] = await Promise.all([
        listarProveedores({ activo: true }),
        listarCalzado(),
        conCostos ? costosPorProducto().catch(() => undefined) : Promise.resolve(undefined),
      ])
      setProveedores(provs)
      setCostos(cs)
      const mapa = new Map<string, ReferenciaConocida>()
      for (const p of productos) {
        if (!p.referencia || !p.talla) continue
        const clave = claveRefColor(p.referencia, p.color)
        const r = mapa.get(clave) ?? {
          referencia: p.referencia, descripcion: p.descripcion, marca: p.marca ?? '', categoria: p.categoria,
          color: nombreColores(p.color) ?? '', existentes: {},
        }
        r.existentes[p.talla] = {
          id: p.id, precio_minimo: Number(p.precio_minimo), precio_maximo: Number(p.precio_maximo ?? p.precio_minimo), foto_url: p.foto_url,
        }
        mapa.set(clave, r)
      }
      setConocidas(mapa)
      const usados = [...new Set(productos.map((p) => nombreColores(p.color)).filter((c): c is string => !!c))]
      const simples = [...new Set([...COLORES_BASE, ...usados.flatMap((c) => coloresDeNombre(c).map((x) => nombreColores(x)!))])].sort(alfabetico)
      setListas({
        referencias: [...new Set([...mapa.values()].map((r) => r.referencia))].sort(alfabetico),
        marcas: [...new Set(productos.map((p) => p.marca?.trim()).filter((m): m is string => !!m))].sort(alfabetico),
        colores: [...usados.filter((c) => coloresDeNombre(c).length > 1).sort(alfabetico), ...simples],
        coloresSimples: simples,
      })
    } catch {
      mostrar('No se pudieron cargar los proveedores o el inventario.', 'error')
    } finally {
      setCargando(false)
    }
  }, [conCostos, mostrar])

  useEffect(() => { cargar() }, [cargar])

  const f = borrador?.factura
  const resumen = useMemo(() => (f ? resumenFactura(f) : null), [f])

  if (requireModulo) return requireModulo
  if (!perfil || !borrador || !f || !resumen) return null

  const cambiarFactura = (cambios: Partial<Factura>) =>
    setBorrador((b) => (b ? { ...b, factura: { ...b.factura, ...cambios } } : b))

  function guardarFila(fila: FilaFactura) {
    setBorrador((b) => {
      if (!b) return b
      const filas = b.factura.filas.some((x) => x.id === fila.id)
        ? b.factura.filas.map((x) => (x.id === fila.id ? fila : x))
        : [...b.factura.filas, fila]
      return { ...b, factura: { ...b.factura, filas } }
    })
  }

  const quitarFila = (id: string) =>
    setBorrador((b) => (b ? { ...b, factura: { ...b.factura, filas: b.factura.filas.filter((x) => x.id !== id) } } : b))

  function descartar() {
    Alert.alert('¿Descartar esta compra?', 'Se borra todo lo que llevas.', [
      { text: 'Seguir', style: 'cancel' },
      {
        text: 'Descartar', style: 'destructive', onPress: () => {
          AsyncStorage.removeItem(BORRADOR).catch(() => {})
          setBorrador(borradorNuevo(hoy))
          setAdjunto(null)
        },
      },
    ])
  }

  async function adjuntar(origen: 'camara' | 'galeria' | 'pdf') {
    if (origen === 'pdf') {
      const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true })
      if (!r.canceled) setAdjunto({ uri: r.assets[0].uri, nombre: r.assets[0].name, tipo: 'pdf' })
      return
    }
    const permiso = origen === 'camara'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permiso.granted) return
    const r = origen === 'camara'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
    if (!r.canceled) setAdjunto({ uri: r.assets[0].uri, nombre: r.assets[0].fileName ?? 'factura.jpg', tipo: 'imagen' })
  }

  const filas = f.filas
  const errores = conCostos ? erroresFactura(f, hoy) : erroresLlegada(f)
  const avisos = conCostos ? avisosFactura(f) : []
  const proveedor = proveedores.find((p) => p.id === f.proveedorId)

  async function guardar() {
    if (!f || !borrador || !perfil) return
    setGuardando(true)
    try {
      const destino = '/recibir-mercancia'
      let fotoFallo = false
      let archivoFallo = false
      if (conCostos) {
        const r = await registrarCompra(f, borrador.clave)

        try { await fijarFotos(r.compra_id, f) } catch { fotoFallo = true }
        if (adjunto) {
          try { await subirFactura(f.proveedorId, r.compra_id, adjunto) } catch { archivoFallo = true }
        }
      } else {
        const compraId = await registrarLlegada(f.proveedorId, perfil.id, itemsLlegada(f))
        try { await fijarFotos(compraId, f) } catch { fotoFallo = true }
      }
      await AsyncStorage.removeItem(BORRADOR).catch(() => {})
      setRevisando(false)
      mostrar(
        archivoFallo ? 'Compra guardada, pero la factura no se pudo subir. Adjúntala desde el detalle.'
          : fotoFallo ? 'Compra guardada, pero alguna foto no quedó. Ponla desde Productos.'
            : conCostos ? 'Compra guardada: el stock ya subió.' : 'Llegada registrada: el stock ya subió.',
        archivoFallo || fotoFallo ? 'info' : 'exito',
      )
      router.replace(destino as never)
    } catch (e) {
      mostrar(e instanceof Error ? e.message : 'No se pudo guardar. Si fue la señal, vuelve a intentar: no se duplica.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const cabecera = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: espacio.m,
      paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m,
    }}>
      <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} hitSlop={12}>
        <ArrowLeft size={24} color={paleta.texto} />
      </Presionable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>{conCostos ? 'Nueva compra' : 'Recibir mercancía'}</Text>
      {filas.length || f.proveedorId ? (
        <Pressable accessibilityRole="button" onPress={descartar} hitSlop={8}>
          <Text style={[tipografia.etiqueta, { color: paleta.texto3 }]}>Descartar</Text>
        </Pressable>
      ) : null}
    </View>
  )

  const pie = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: espacio.m,
      padding: espacio.l, borderTopWidth: 1, borderTopColor: paleta.borde, backgroundColor: paleta.fondo,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
          {resumen.referencias} ref. · {resumen.unidades} pares
        </Text>
        {conCostos ? (
          <Text style={[tipografia.h3, tabular, { color: paleta.texto }]}>{pesos(resumen.total)}</Text>
        ) : null}
      </View>
      <View style={{ minWidth: 150 }}>
        <Boton titulo="Revisar" onPress={() => setRevisando(true)} deshabilitado={resumen.unidades === 0}/>
      </View>
    </View>
  )

  return (
    <>
      <ScreenWrapper
        header={cabecera}
        footer={pie}
        contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, gap: espacio.l }}
      >
        <Tarjeta>
          <Seccion titulo={conCostos ? 'Factura' : 'Llegada'}>
            <SelectorProveedor
              proveedores={proveedores}
              valor={f.proveedorId}
              onElegir={(proveedorId) => cambiarFactura({ proveedorId })}
              puedeCrear={puedeCrearProveedor}
              onCreado={(p) => setProveedores((ps) => [...ps, p].sort((a, b) => alfabetico(a.nombre, b.nombre)))}
            />
            {conCostos ? (
              <>
                <View style={{ flexDirection: 'row', gap: espacio.s }}>
                  <View style={{ flex: 1 }}>
                    <CampoTexto etiqueta="Número de factura" placeholder="FV-1001" autoCapitalize="characters"
                      value={f.numeroFactura} onChangeText={(numeroFactura) => cambiarFactura({ numeroFactura })} testID="input-numero-factura" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <CampoFecha etiqueta="Fecha" valor={f.fechaFactura} maximo={hoy}
                      onCambio={(fechaFactura) => cambiarFactura({ fechaFactura })} />
                  </View>
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Pago</Text>
                  <ControlSegmentado
                    opciones={['Contado', 'Crédito']}
                    indice={f.condicion === 'contado' ? 0 : 1}
                    onCambio={(i) => cambiarFactura({ condicion: i === 0 ? 'contado' : 'credito' })}
                  />
                </View>
                {f.condicion === 'credito' ? (
                  <CampoFecha etiqueta="Vence" valor={f.fechaVencimiento} minimo={f.fechaFactura}
                    placeholder="¿Cuándo hay que pagarla?" onCambio={(fechaVencimiento) => cambiarFactura({ fechaVencimiento })} />
                ) : null}
                {puedeAdjuntar ? (
                  <View style={{ gap: 6 }}>
                    <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Foto o PDF de la factura</Text>
                    {adjunto ? (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: espacio.s, padding: espacio.m,
                        borderRadius: radio.sm, backgroundColor: paleta.superficie,
                      }}>
                        {adjunto.tipo === 'pdf' ? <FileText size={20} color={paleta.texto2} /> : (
                          <Image source={{ uri: adjunto.uri }} style={{ width: 36, height: 36, borderRadius: 6 }} />
                        )}
                        <Text style={[tipografia.cuerpo, { color: paleta.texto, flex: 1 }]} numberOfLines={1}>{adjunto.nombre}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel="Quitar adjunto" hitSlop={8} onPress={() => setAdjunto(null)}>
                          <X size={18} color={paleta.texto3} />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: espacio.s }}>
                        {([['camara', 'Cámara', Camera], ['galeria', 'Galería', Paperclip], ['pdf', 'PDF', FileText]] as const).map(([o, t, Icono]) => (
                          <Pressable key={o} accessibilityRole="button" accessibilityLabel={`Adjuntar desde ${t}`}
                            onPress={() => adjuntar(o)}
                            style={({ pressed }) => ({
                              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                              paddingVertical: espacio.m, borderRadius: radio.sm, borderWidth: 1, borderColor: paleta.borde,
                              backgroundColor: pressed ? paleta.superficie2 : paleta.superficie,
                            })}>
                            <Icono size={16} color={paleta.texto2} />
                            <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>{t}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ) : null}
                <CampoTexto etiqueta="Notas" placeholder="Opcional" value={f.notas} onChangeText={(notas) => cambiarFactura({ notas })} />
              </>
            ) : (
              <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                Registra lo que llegó. Los costos y el pago los completa quien maneja los costos.
              </Text>
            )}
          </Seccion>
        </Tarjeta>

        <Seccion
          titulo={`Mercancía${filas.length ? ` · ${filas.length}` : ''}`}
          accion={filas.length ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Agregar referencia" hitSlop={8}
              onPress={() => setEditando(filaVacia(generarClave()))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Plus size={16} color={paleta.primario} />
              <Text style={[tipografia.etiqueta, { color: paleta.primario }]}>Agregar</Text>
            </Pressable>
          ) : null}
        >
          {cargando ? (
            <ActivityIndicator color={paleta.primario} />
          ) : filas.length === 0 ? (
            <EstadoVacio
              icono={<Footprints />}
              titulo="Agrega la primera referencia"
              mensaje="Una por cada referencia y color, con la cantidad de cada talla."
              textoAccion="Agregar referencia"
              onAccion={() => setEditando(filaVacia(generarClave()))}
            />
          ) : (
            filas.map((fila) => (
              <TarjetaFila key={fila.id} fila={fila} conCostos={conCostos} onPress={() => setEditando(fila)} />
            ))
          )}
        </Seccion>
      </ScreenWrapper>

      <EditorReferencia
        fila={editando}
        conCostos={conCostos}
        conocidas={conocidas}
        referencias={listas.referencias}
        marcas={listas.marcas}
        colores={listas.colores}
        coloresSimples={listas.coloresSimples}
        costos={costos}
        onGuardar={(fila) => { guardarFila(fila); setEditando(null) }}
        onOtroColor={(fila) => { guardarFila(fila); setEditando(otroColor(fila, generarClave())) }}
        onQuitar={() => { if (editando) quitarFila(editando.id); setEditando(null) }}
        onCerrar={() => setEditando(null)}
      />

      {revisando ? (
        <Revision
          titulo={conCostos ? 'Confirmar compra' : 'Confirmar llegada'}
          filas={[
            ['Proveedor', proveedor?.nombre ?? '—'],
            ...(conCostos ? [
              ['Factura', `${f.numeroFactura.trim() || 'Sin número'} · ${fechaCorta(f.fechaFactura)}`],
              ['Pago', f.condicion === 'contado' ? 'Contado' : `Crédito${f.fechaVencimiento ? `, vence el ${fechaCorta(f.fechaVencimiento)}` : ''}`],
            ] as [string, string][] : []),
            ['Mercancía', `${resumen.referencias} referencias · ${resumen.unidades} pares`],
            ...(conCostos ? [
              ['Inventario', `${resumen.tallasNuevas ? `${resumen.tallasNuevas} talla${resumen.tallasNuevas === 1 ? '' : 's'} nueva${resumen.tallasNuevas === 1 ? '' : 's'}` : 'Sin tallas nuevas'}${resumen.preciosCambiados ? ` · ${resumen.preciosCambiados} cambio${resumen.preciosCambiados === 1 ? '' : 's'} de precio` : ''}`],
              ['Adjunto', adjunto?.nombre ?? 'Sin factura adjunta'],
            ] as [string, string][] : []),
          ]}
          total={conCostos ? resumen.total : null}
          avisos={avisos}
          errores={errores}
          guardando={guardando}
          textoBoton={conCostos ? 'Guardar y subir stock' : 'Confirmar llegada'}
          onGuardar={guardar}
          onCerrar={() => setRevisando(false)}
        />
      ) : null}
    </>
  )
}

function TarjetaFila({ fila, conCostos, onPress }: { fila: FilaFactura; conCostos: boolean; onPress: () => void }) {
  const { paleta } = useTema()
  const foto = fotoDeFila(fila)
  const tallas = tallasConCantidad(fila)
  const nuevas = tallas.filter((t) => !fila.existentes[t.talla]).length
  const color = nombreColores(fila.color)
  return (
    <Tarjeta onPress={onPress}>
      <View style={{ flexDirection: 'row', gap: espacio.m }}>
        <View style={{
          width: 64, height: 64, borderRadius: radio.sm, overflow: 'hidden',
          backgroundColor: paleta.superficie2, alignItems: 'center', justifyContent: 'center',
        }}>
          {foto ? <Image source={{ uri: foto }} style={{ width: 64, height: 64 }} /> : <Footprints size={24} color={paleta.texto3} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[tipografia.cuerpoLg, { color: paleta.texto, flexShrink: 1 }]} numberOfLines={1}>
              {fila.referencia.trim() || fila.descripcion.trim() || 'Sin referencia'}
            </Text>
            {color ? <PuntoColor color={color} tamano={12} /> : null}
            {color ? <Text style={[tipografia.caption, { color: paleta.texto2 }]} numberOfLines={1}>{color}</Text> : null}
          </View>
          <Text style={[tipografia.caption, { color: paleta.texto3 }]} numberOfLines={1}>
            {[fila.descripcion.trim(), fila.marca.trim()].filter(Boolean).join(' · ') || 'Toca para completar'}
          </Text>
          <Text style={[tipografia.caption, tabular, { color: paleta.texto2 }]} numberOfLines={2}>
            {tallas.length ? tallas.map((t) => `${t.talla}×${t.cantidad}`).join('  ') : 'Sin cantidades'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={[tipografia.etiqueta, tabular, { color: paleta.texto }]}>{unidadesFila(fila)} pares</Text>
          {conCostos ? <Text style={[tipografia.caption, tabular, { color: paleta.texto2 }]}>{pesos(subtotalFila(fila))}</Text> : null}
          {nuevas ? <Badge texto={`${nuevas} NUEVA${nuevas === 1 ? '' : 'S'}`} tipo="verde" /> : null}
        </View>
      </View>
    </Tarjeta>
  )
}

function Revision({ titulo, filas, total, avisos, errores, guardando, textoBoton, onGuardar, onCerrar }: {
  titulo: string
  filas: [string, string][]
  total: number | null
  avisos: string[]
  errores: string[]
  guardando: boolean
  textoBoton: string
  onGuardar: () => void
  onCerrar: () => void
}) {
  const { paleta } = useTema()
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} accessibilityLabel="Cerrar" onPress={onCerrar} />
      <View style={{
        backgroundColor: paleta.fondo, borderTopLeftRadius: radio.xl, borderTopRightRadius: radio.xl,
        padding: espacio.xl, paddingBottom: espacio.xxxl, gap: espacio.l, maxHeight: '88%',
      }} testID="revision-compra">
        <Text style={[tipografia.h2, { color: paleta.texto }]}>{titulo}</Text>
        <View style={{ gap: espacio.s }}>
          {filas.map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', gap: espacio.m }}>
              <Text style={[tipografia.cuerpo, { color: paleta.texto3, width: 96 }]}>{k}</Text>
              <Text style={[tipografia.cuerpo, { color: paleta.texto, flex: 1 }]}>{v}</Text>
            </View>
          ))}
          {total != null ? (
            <View style={{ flexDirection: 'row', gap: espacio.m, alignItems: 'baseline' }}>
              <Text style={[tipografia.cuerpo, { color: paleta.texto3, width: 96 }]}>Total</Text>
              <Text style={[tipografia.h2, tabular, { color: paleta.texto }]}>{pesos(total)}</Text>
            </View>
          ) : null}
        </View>
        {avisos.length ? (
          <View style={{ gap: 4, padding: espacio.m, borderRadius: radio.sm, backgroundColor: paleta.advertenciaSoft }}>
            {avisos.map((a) => (
              <View key={a} style={{ flexDirection: 'row', gap: 6 }}>
                <AlertTriangle size={14} color={paleta.advertenciaTexto} />
                <Text style={[tipografia.caption, { color: paleta.advertenciaTexto, flex: 1 }]}>{a}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {errores.length ? (
          <View style={{ gap: 4, padding: espacio.m, borderRadius: radio.sm, backgroundColor: paleta.peligroSoft }} testID="errores-compra">
            <Text style={[tipografia.etiqueta, { color: paleta.peligroTexto }]}>Falta corregir:</Text>
            {errores.slice(0, 8).map((e) => (
              <Text key={e} style={[tipografia.caption, { color: paleta.peligroTexto }]}>• {e}</Text>
            ))}
            {errores.length > 8 ? <Text style={[tipografia.caption, { color: paleta.peligroTexto }]}>… y {errores.length - 8} más</Text> : null}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: espacio.s }}>
          <View style={{ flex: 1 }}>
            <Boton titulo="Volver" variante="contorno" onPress={onCerrar} />
          </View>
          <View style={{ flex: 1.4 }}>
            <Boton titulo={textoBoton} onPress={onGuardar} cargando={guardando} deshabilitado={errores.length > 0 || guardando}/>
          </View>
        </View>
      </View>
    </View>
  )
}
