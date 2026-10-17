import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Plus, Trash2 } from 'lucide-react-native'
import {
  borradorDesdeTramo, borradorVacio, guardarTramos, listarTramos, tramoDesdeBorrador, validarTramos,
  type TramoBorrador,
} from '../lib/tramos'
import { useTema } from '../lib/tema'
import { espacio, radio, tipografia } from '../lib/theme'
import { Boton, CampoTexto, Presionable, Tarjeta, useToast } from './ui'

const soloNumero = (t: string) => t.replace(/[^0-9.,]/g, '')

// Precios mínimo/máximo por rango de tallas de una referencia. Igual para todos
// los colores; las tallas sin tramo conservan su precio. Se guarda aparte del
// formulario del producto (aplica a todas las variantes de la referencia).
export function PreciosPorTalla({ referencia }: { referencia: string }) {
  const { paleta } = useTema()
  const { mostrar } = useToast()
  const [tramos, setTramos] = useState<TramoBorrador[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    listarTramos(referencia)
      .then((t) => { if (vigente) setTramos(t.map(borradorDesdeTramo)) })
      .catch(() => { if (vigente) mostrar('No se pudieron cargar los precios por talla.', 'error') })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referencia])

  const cambiar = (i: number, campo: keyof TramoBorrador, valor: string) =>
    setTramos((prev) => prev.map((t, k) => (k === i ? { ...t, [campo]: soloNumero(valor) } : t)))

  const guardar = async () => {
    const error = validarTramos(tramos)
    if (error) {
      mostrar(error, 'error')
      return
    }
    try {
      setGuardando(true)
      const r = await guardarTramos(
        referencia,
        tramos.map((t) => tramoDesdeBorrador(t)!),
      )
      mostrar(
        r.tramos === 0
          ? 'Se quitaron los precios por talla.'
          : `Precios por talla guardados: ${r.actualizados} ${r.actualizados === 1 ? 'variante actualizada' : 'variantes actualizadas'}.`,
      )
    } catch (e) {
      mostrar(e instanceof Error ? e.message : 'No se pudieron guardar los precios por talla.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Tarjeta>
      <Text style={[tipografia.h3, { color: paleta.texto }]}>Precios por talla</Text>
      <Text style={[tipografia.caption, { color: paleta.texto3, marginTop: 4 }]}>
        Para precios distintos según la talla. Aplica igual a todos los colores de la referencia;
        las tallas sin tramo conservan su precio. El máximo es opcional.
      </Text>

      {cargando ? (
        <Text style={[tipografia.caption, { color: paleta.texto3, marginTop: espacio.m }]}>Cargando…</Text>
      ) : (
        <View style={{ gap: espacio.m, marginTop: espacio.m }}>
          {tramos.map((t, i) => (
            <View
              key={i}
              style={{
                borderWidth: 1, borderColor: paleta.borde, borderRadius: radio.md,
                padding: espacio.m, gap: espacio.s,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>{`Tramo ${i + 1}`}</Text>
                <Presionable
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar tramo ${i + 1}`}
                  hitSlop={10}
                  onPress={() => setTramos((prev) => prev.filter((_, k) => k !== i))}
                >
                  <Trash2 size={18} color={paleta.texto3} />
                </Presionable>
              </View>
              <View style={{ flexDirection: 'row', gap: espacio.m }}>
                <View style={{ flex: 1 }}>
                  <CampoTexto
                    etiqueta="Talla desde *"
                    value={t.desde}
                    onChangeText={(v) => cambiar(i, 'desde', v)}
                    placeholder="30"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <CampoTexto
                    etiqueta="Talla hasta *"
                    value={t.hasta}
                    onChangeText={(v) => cambiar(i, 'hasta', v)}
                    placeholder="38"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: espacio.m }}>
                <View style={{ flex: 1 }}>
                  <CampoTexto
                    etiqueta="Precio mínimo *"
                    value={t.minimo}
                    onChangeText={(v) => cambiar(i, 'minimo', v)}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <CampoTexto
                    etiqueta="Precio máximo"
                    value={t.maximo}
                    onChangeText={(v) => cambiar(i, 'maximo', v)}
                    placeholder="Opcional"
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            </View>
          ))}

          <Boton
            titulo="Agregar tramo"
            variante="secundario"
            icono={<Plus size={18} color={paleta.primario} />}
            onPress={() => setTramos((prev) => [...prev, borradorVacio()])}
          />
          <Boton
            titulo={tramos.length === 0 ? 'Guardar (sin tramos)' : 'Guardar precios por talla'}
            onPress={guardar}
            cargando={guardando}
            deshabilitado={guardando}
          />
        </View>
      )}
    </Tarjeta>
  )
}
