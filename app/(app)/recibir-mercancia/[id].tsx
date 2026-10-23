import React, { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Pressable, Text, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { ArrowLeft, FileText, Image as IconoImagen, Paperclip, Wallet } from 'lucide-react-native'
import { hoyEn } from '../../../shared/fechas'
import { leerPesos, pesos } from '../../../shared/formato'
import { useAuth } from '../../../lib/auth'
import { tienePermiso } from '../../../lib/permisos'
import {
  agruparItems, documentosDeCompra, enlaceDocumento, esPorPagar, estadoCompra, fechaDelNegocio, miles, obtenerCompra, pagosDeCompra, registrarPago,
  subirFactura, textoTallas, type Adjunto, type CompraDetalle, type DocumentoCompra, type PagoCompra,
} from '../../../lib/compras'
import { useTema } from '../../../lib/tema'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { Badge, Boton, CampoTexto, EstadoVacio, Presionable, PuntoColor, ScreenWrapper, Tarjeta, useToast } from '../../../components/ui'
import { CampoFecha, fechaCorta, Seccion } from '../../../components/compras/Campos'

// Detalle de una compra o llegada: datos de la factura, lo que se debe, la
// mercancía por referencia y color, los pagos y la foto o PDF de la factura.
export default function DetalleCompraScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { perfil } = useAuth()
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const hoy = hoyEn()

  const conCostos = tienePermiso(perfil, 'costos')
  const conDeudas = tienePermiso(perfil, 'deudas')
  const conDocumentos = tienePermiso(perfil, 'proveedores')

  const [compra, setCompra] = useState<CompraDetalle | null | undefined>(undefined)
  const [pagos, setPagos] = useState<PagoCompra[] | null>(null)
  const [documentos, setDocumentos] = useState<DocumentoCompra[] | null>(null)
  const [pagando, setPagando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)

  const cargar = useCallback(async () => {
    if (!id) return
    try {
      setCompra(await obtenerCompra(id))
    } catch {
      setCompra(null)
    }
    if (conDeudas) pagosDeCompra(id).then(setPagos).catch(() => setPagos(null))
    if (conDocumentos) documentosDeCompra(id).then(setDocumentos).catch(() => setDocumentos(null))
  }, [id, conDeudas, conDocumentos])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  async function abrir(doc: DocumentoCompra) {
    try {
      await Linking.openURL(await enlaceDocumento(doc.url))
    } catch (e) {
      mostrar(e instanceof Error ? e.message : 'No se pudo abrir el archivo.', 'error')
    }
  }

  async function adjuntar(origen: 'camara' | 'galeria' | 'pdf') {
    if (!compra) return
    let adjunto: Adjunto | null = null
    if (origen === 'pdf') {
      const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true })
      if (!r.canceled) adjunto = { uri: r.assets[0].uri, nombre: r.assets[0].name, tipo: 'pdf' }
    } else {
      const permiso = origen === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permiso.granted) return
      const r = origen === 'camara'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
      if (!r.canceled) adjunto = { uri: r.assets[0].uri, nombre: r.assets[0].fileName ?? 'factura.jpg', tipo: 'imagen' }
    }
    if (!adjunto) return
    setSubiendo(true)
    try {
      await subirFactura(compra.proveedor_id, compra.id, adjunto)
      setDocumentos(await documentosDeCompra(compra.id))
      mostrar('Factura adjuntada.')
    } catch (e) {
      mostrar(e instanceof Error ? e.message : 'No se pudo subir el archivo.', 'error')
    } finally {
      setSubiendo(false)
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
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]} numberOfLines={1}>{compra?.proveedor ?? 'Compra'}</Text>
    </View>
  )

  if (compra === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        {cabecera}
        <ActivityIndicator style={{ marginTop: espacio.xxxl }} color={paleta.primario} />
      </View>
    )
  }
  if (compra === null) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        {cabecera}
        <EstadoVacio icono={<FileText />} titulo="No encontramos esta compra" mensaje="Puede que no tengas permiso para verla." />
      </View>
    )
  }

  const estado = estadoCompra(compra, hoy)
  const grupos = agruparItems(compra.items)
  const pendiente = compra.estado === 'pendiente_revision'
  const deuda = esPorPagar(compra)

  const dato = (k: string, v: string) => (
    <View key={k} style={{ flexDirection: 'row', gap: espacio.m }}>
      <Text style={[tipografia.cuerpo, { color: paleta.texto3, width: 92 }]}>{k}</Text>
      <Text style={[tipografia.cuerpo, { color: paleta.texto, flex: 1 }]}>{v}</Text>
    </View>
  )

  return (
    <>
      <ScreenWrapper header={cabecera} contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, gap: espacio.l, paddingBottom: espacio.xxxl * 2 }}>
        <View style={{ flexDirection: 'row' }}>
          <Badge texto={estado.texto} tipo={estado.tipo} />
        </View>

        {compra.total != null ? (
          <View style={{ flexDirection: 'row', gap: espacio.s }}>
            {([
              ['Total', compra.total],
              ...(compra.condicion_pago === 'credito' ? [['Pagado', compra.monto_pagado], ['Debe', compra.saldo_pendiente]] : []),
            ] as [string, number][]).map(([k, v]) => (
              <Tarjeta key={k} estilo={{ flex: 1 }}>
                <Text style={[tipografia.micro, { color: paleta.texto3 }]}>{k}</Text>
                <Text style={[tipografia.h3, tabular, { color: paleta.texto }]} numberOfLines={1} adjustsFontSizeToFit>{pesos(v)}</Text>
              </Tarjeta>
            ))}
          </View>
        ) : null}

        <Tarjeta>
          <Seccion titulo={pendiente ? 'Llegada' : 'Factura'}>
            <View style={{ gap: espacio.s }}>
              {compra.numero_factura || compra.fecha_factura
                ? dato('Factura', [compra.numero_factura, compra.fecha_factura ? fechaCorta(compra.fecha_factura) : null].filter(Boolean).join(' · '))
                : dato('Registrada', fechaCorta(fechaDelNegocio(compra.created_at)))}
              {compra.condicion_pago ? dato('Pago', compra.condicion_pago === 'credito' ? 'Crédito' : 'Contado') : null}
              {compra.fecha_vencimiento ? dato('Vence', fechaCorta(compra.fecha_vencimiento)) : null}
              {grupos.length ? dato('Mercancía', `${grupos.length} referencia${grupos.length === 1 ? '' : 's'} · ${compra.pares} pares`) : null}
              {compra.notas ? dato('Notas', compra.notas) : null}
            </View>
          </Seccion>
          {pendiente && conCostos ? (
            <View style={{ marginTop: espacio.l }}>
              <Boton titulo="Completar costos y pago" onPress={() => router.push(`/recibir-mercancia/completar/${compra.id}`)} />
            </View>
          ) : null}
        </Tarjeta>

        <Seccion titulo="Mercancía">
          {grupos.length === 0 ? (
            <Text style={[tipografia.cuerpo, { color: paleta.texto3 }]}>
              {conCostos ? 'Esta compra no tiene mercancía.' : 'El detalle de la mercancía lo ve quien tiene el permiso de costos.'}
            </Text>
          ) : null}
          {grupos.map((g) => (
            <Tarjeta key={g.clave}>
              <View style={{ flexDirection: 'row', gap: espacio.m }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[tipografia.cuerpoLg, { color: paleta.texto, flexShrink: 1 }]} numberOfLines={1}>{g.referencia ?? g.descripcion}</Text>
                    {g.color ? <PuntoColor color={g.color} tamano={12} /> : null}
                    {g.color ? <Text style={[tipografia.caption, { color: paleta.texto2 }]}>{g.color}</Text> : null}
                  </View>
                  {g.referencia ? <Text style={[tipografia.caption, { color: paleta.texto3 }]} numberOfLines={1}>{g.descripcion}</Text> : null}
                  <Text style={[tipografia.caption, tabular, { color: paleta.texto2 }]}>{textoTallas(g.tallas)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[tipografia.etiqueta, tabular, { color: paleta.texto }]}>{g.pares} pares</Text>
                  {g.subtotal != null ? <Text style={[tipografia.caption, tabular, { color: paleta.texto2 }]}>{pesos(g.subtotal)}</Text> : null}
                </View>
              </View>
            </Tarjeta>
          ))}
        </Seccion>

        {conDeudas && compra.condicion_pago === 'credito' && pagos ? (
          <Seccion
            titulo="Pagos"
            accion={deuda ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Registrar pago" hitSlop={8} onPress={() => setPagando(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Wallet size={16} color={paleta.primario} />
                <Text style={[tipografia.etiqueta, { color: paleta.primario }]}>Registrar pago</Text>
              </Pressable>
            ) : null}
          >
            <Tarjeta>
              {pagos.length === 0 ? (
                <Text style={[tipografia.cuerpo, { color: paleta.texto3 }]}>Todavía no hay pagos.</Text>
              ) : pagos.map((p, i) => (
                <View key={p.id}>
                  {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde, marginVertical: espacio.s }} /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[tipografia.cuerpo, { color: paleta.texto }]}>{fechaCorta(p.fecha)}</Text>
                      {p.notas ? <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{p.notas}</Text> : null}
                    </View>
                    <Text style={[tipografia.cuerpoLg, tabular, { color: paleta.texto }]}>{pesos(p.monto)}</Text>
                  </View>
                </View>
              ))}
            </Tarjeta>
          </Seccion>
        ) : null}

        {conDocumentos && documentos ? (
          <Seccion
            titulo="Factura del proveedor"
            accion={conCostos ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Adjuntar factura" hitSlop={8} disabled={subiendo}
                onPress={() => Alert.alert('Adjuntar factura', undefined, [
                  { text: 'Cámara', onPress: () => adjuntar('camara') },
                  { text: 'Galería', onPress: () => adjuntar('galeria') },
                  { text: 'PDF', onPress: () => adjuntar('pdf') },
                  { text: 'Cancelar', style: 'cancel' },
                ])}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {subiendo ? <ActivityIndicator size="small" color={paleta.primario} /> : <Paperclip size={16} color={paleta.primario} />}
                <Text style={[tipografia.etiqueta, { color: paleta.primario }]}>Adjuntar</Text>
              </Pressable>
            ) : null}
          >
            <Tarjeta>
              {documentos.length === 0 ? (
                <Text style={[tipografia.cuerpo, { color: paleta.texto3 }]}>Sin foto ni PDF de la factura.</Text>
              ) : documentos.map((d, i) => (
                <View key={d.id}>
                  {i > 0 ? <View style={{ height: 1, backgroundColor: paleta.borde, marginVertical: espacio.s }} /> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${d.nombre_archivo ?? 'factura'}`} onPress={() => abrir(d)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: 4 }}>
                    {d.tipo === 'pdf' ? <FileText size={20} color={paleta.texto2} /> : <IconoImagen size={20} color={paleta.texto2} />}
                    <Text style={[tipografia.cuerpo, { color: paleta.texto, flex: 1 }]} numberOfLines={1}>
                      {d.nombre_archivo ?? (d.tipo === 'pdf' ? 'Factura.pdf' : 'Foto de la factura')}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </Tarjeta>
          </Seccion>
        ) : null}
      </ScreenWrapper>

      {pagando ? (
        <HojaPago
          saldo={compra.saldo_pendiente}
          hoy={hoy}
          onCerrar={() => setPagando(false)}
          onPagar={async (monto, fecha, notas) => {
            await registrarPago(compra.id, monto, fecha, notas)
            setPagando(false)
            mostrar('Pago registrado.')
            cargar()
          }}
        />
      ) : null}
    </>
  )
}

function HojaPago({ saldo, hoy, onPagar, onCerrar }: {
  saldo: number
  hoy: string
  onPagar: (monto: number, fecha: string, notas: string) => Promise<void>
  onCerrar: () => void
}) {
  const { paleta } = useTema()
  const [monto, setMonto] = useState(miles(saldo))
  const [fecha, setFecha] = useState(hoy)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const valor = leerPesos(monto)

  async function pagar() {
    if (Number.isNaN(valor) || valor <= 0) return setError('Escribe el monto del pago.')
    if (valor > saldo) return setError(`No puede pasar del saldo (${pesos(saldo)}).`)
    setGuardando(true)
    setError(null)
    try {
      await onPagar(valor, fecha, notas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el pago.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: paleta.overlay, justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} accessibilityLabel="Cerrar" onPress={onCerrar} />
      <View style={{
        backgroundColor: paleta.fondo, borderTopLeftRadius: radio.xl, borderTopRightRadius: radio.xl,
        padding: espacio.xl, paddingBottom: espacio.xxxl, gap: espacio.l,
      }}>
        <Text style={[tipografia.h2, { color: paleta.texto }]}>Registrar pago</Text>
        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Saldo de esta compra: {pesos(saldo)}</Text>
        <CampoTexto etiqueta="Monto" keyboardType="number-pad" value={monto}
          onChangeText={(t) => setMonto(t.replace(/\D/g, '') ? miles(Number(t.replace(/\D/g, ''))) : '')} testID="input-monto-pago" />
        <CampoFecha etiqueta="Fecha del pago" valor={fecha} maximo={hoy} onCambio={setFecha} />
        <CampoTexto etiqueta="Notas" placeholder="Ej. Transferencia Bancolombia" value={notas} onChangeText={setNotas} />
        {error ? <Text style={[tipografia.caption, { color: paleta.peligroTexto }]}>{error}</Text> : null}
        <View style={{ flexDirection: 'row', gap: espacio.s }}>
          <View style={{ flex: 1 }}><Boton titulo="Cancelar" variante="contorno" onPress={onCerrar} /></View>
          <View style={{ flex: 1.3 }}><Boton titulo="Registrar pago" onPress={pagar} cargando={guardando} /></View>
        </View>
      </View>
    </KeyboardAvoidingView>
    </Modal>
  )
}
