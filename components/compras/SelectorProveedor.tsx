import React, { useState } from 'react'
import { FlatList, Modal, Pressable, Text, View } from 'react-native'
import { Building2, Check, ChevronRight, CirclePlus, Search, X } from 'lucide-react-native'
import { crearProveedor, type Proveedor } from '../../lib/proveedores'
import { useTema } from '../../lib/tema'
import { espacio, radio, tipografia } from '../../lib/theme'
import { Boton, CampoTexto, ScreenWrapper, useToast } from '../ui'

const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Campo "Proveedor" de la compra: muestra el elegido y abre una lista con
// buscador; con permiso de proveedores, también se crea uno nuevo ahí mismo.
export function SelectorProveedor({ proveedores, valor, onElegir, puedeCrear, onCreado }: {
  proveedores: Proveedor[]
  valor: string
  onElegir: (id: string) => void
  puedeCrear: boolean
  onCreado: (p: Proveedor) => void
}) {
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const [abierto, setAbierto] = useState(false)
  const [creando, setCreando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [nuevo, setNuevo] = useState({ nombre: '', nit: '', telefono: '', ciudad: '' })
  const [guardando, setGuardando] = useState(false)

  const elegido = proveedores.find((p) => p.id === valor)
  const visibles = proveedores.filter((p) => p.activo !== false && plano(p.nombre).includes(plano(busqueda)))

  function cerrar() {
    setAbierto(false)
    setCreando(false)
    setBusqueda('')
  }

  async function guardarNuevo() {
    if (!nuevo.nombre.trim()) {
      mostrar('Escribe el nombre del proveedor.', 'error')
      return
    }
    setGuardando(true)
    try {
      const p = await crearProveedor({
        nombre: nuevo.nombre.trim(),
        nit_cedula: nuevo.nit.trim() || null,
        telefono: nuevo.telefono.trim() || null,
        ciudad: nuevo.ciudad.trim() || null,
        activo: true,
      })
      onCreado(p)
      onElegir(p.id)
      setNuevo({ nombre: '', nit: '', telefono: '', ciudad: '' })
      mostrar(`Proveedor "${p.nombre}" creado.`)
      cerrar()
    } catch (e) {
      mostrar(e instanceof Error ? e.message : 'No se pudo crear el proveedor.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const cabecera = (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: espacio.m,
      paddingHorizontal: espacio.xl, paddingTop: 56, paddingBottom: espacio.m,
    }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={12}
        onPress={creando ? () => setCreando(false) : cerrar}>
        <X size={24} color={paleta.texto} />
      </Pressable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]}>{creando ? 'Nuevo proveedor' : 'Proveedor'}</Text>
    </View>
  )

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Elegir proveedor"
        testID="elegir-proveedor"
        onPress={() => setAbierto(true)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: espacio.m,
          minHeight: 56, paddingHorizontal: espacio.m, borderRadius: radio.md,
          borderWidth: 1, borderColor: valor ? paleta.borde : paleta.bordeFuerte,
          backgroundColor: pressed ? paleta.superficie2 : paleta.superficie,
        })}
      >
        <Building2 size={20} color={paleta.texto3} />
        <View style={{ flex: 1 }}>
          <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Proveedor</Text>
          <Text style={[tipografia.cuerpoLg, { color: elegido ? paleta.texto : paleta.textoDeshabilitado }]} numberOfLines={1}>
            {elegido?.nombre ?? 'Elegir proveedor'}
          </Text>
        </View>
        <ChevronRight size={20} color={paleta.texto3} />
      </Pressable>

      <Modal visible={abierto} animationType="slide" onRequestClose={creando ? () => setCreando(false) : cerrar}>
        {creando ? (
          <ScreenWrapper
            header={cabecera}
            contentContainerStyle={{ paddingHorizontal: espacio.xl, paddingBottom: espacio.xxl, gap: espacio.m }}
            footer={
              <View style={{ padding: espacio.l, borderTopWidth: 1, borderTopColor: paleta.borde }}>
                <Boton titulo="Crear y elegir" onPress={guardarNuevo} cargando={guardando} />
              </View>
            }
          >
            <CampoTexto etiqueta="Nombre *" placeholder="Distribuidora del Norte" value={nuevo.nombre}
              onChangeText={(nombre) => setNuevo((x) => ({ ...x, nombre }))} testID="input-prov-nombre" />
            <CampoTexto etiqueta="NIT o cédula" value={nuevo.nit} onChangeText={(nit) => setNuevo((x) => ({ ...x, nit }))} />
            <CampoTexto etiqueta="Teléfono (WhatsApp)" keyboardType="phone-pad" value={nuevo.telefono}
              onChangeText={(telefono) => setNuevo((x) => ({ ...x, telefono }))} />
            <CampoTexto etiqueta="Ciudad" value={nuevo.ciudad} onChangeText={(ciudad) => setNuevo((x) => ({ ...x, ciudad }))} />
          </ScreenWrapper>
        ) : (
          <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
            {cabecera}
            <View style={{ paddingHorizontal: espacio.xl, gap: espacio.m }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
                <Search size={18} color={paleta.texto3} />
                <View style={{ flex: 1 }}>
                  <CampoTexto placeholder="Buscar proveedor" value={busqueda} onChangeText={setBusqueda} autoCorrect={false} />
                </View>
              </View>
              {puedeCrear ? (
                <Pressable accessibilityRole="button" onPress={() => { setNuevo((x) => ({ ...x, nombre: busqueda })); setCreando(true) }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingVertical: espacio.s }}>
                  <CirclePlus size={20} color={paleta.primario} />
                  <Text style={[tipografia.cuerpoLg, { color: paleta.primario }]}>
                    {busqueda.trim() ? `Crear "${busqueda.trim()}"` : 'Crear proveedor nuevo'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <FlatList
              data={visibles}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: espacio.xl, paddingBottom: espacio.xxxl }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: paleta.borde }} />}
              ListEmptyComponent={
                <Text style={[tipografia.cuerpo, { color: paleta.texto3, paddingVertical: espacio.l }]}>
                  Ningún proveedor coincide.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.nombre}
                  onPress={() => { onElegir(item.id); cerrar() }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.l,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>{item.nombre}</Text>
                    {item.ciudad || item.telefono ? (
                      <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                        {[item.ciudad, item.telefono].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  {item.id === valor ? <Check size={20} color={paleta.primario} /> : null}
                </Pressable>
              )}
            />
          </View>
        )}
      </Modal>
    </>
  )
}
