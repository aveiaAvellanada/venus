import React from 'react'
import { Switch, Text, View } from 'react-native'
import { PERMISOS, PLANTILLAS, TITULO_GRUPO, type GrupoPermiso, type Permiso } from '../lib/permisos'
import { useTema } from '../lib/tema'
import { espacio, tipografia } from '../lib/theme'
import { Chip } from './ui'

interface Props {
  valor: Permiso[]
  onCambio: (permisos: Permiso[]) => void
  deshabilitado?: boolean
}

const GRUPOS: GrupoPermiso[] = ['operacion', 'administracion', 'finanzas']

const mismos = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((p) => b.includes(p))

// Plantillas para arrancar rápido + un interruptor por permiso del cuadro del PRD.
export function SelectorPermisos({ valor, onCambio, deshabilitado = false }: Props) {
  const { paleta } = useTema()

  const alternar = (p: Permiso, activo: boolean) =>
    onCambio(activo ? [...valor.filter((x) => x !== p), p] : valor.filter((x) => x !== p))

  return (
    <View style={{ gap: espacio.l }}>
      <View style={{ gap: espacio.s }}>
        <Text style={[tipografia.etiqueta, { color: paleta.texto2 }]}>Empezar con una plantilla</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
          {Object.values(PLANTILLAS).map((pl) => (
            <Chip
              key={pl.titulo}
              etiqueta={pl.titulo}
              activo={mismos(valor, pl.permisos)}
              onPress={() => !deshabilitado && onCambio([...pl.permisos])}
            />
          ))}
          <Chip etiqueta="Ninguno" activo={valor.length === 0} onPress={() => !deshabilitado && onCambio([])} />
        </View>
      </View>

      {GRUPOS.map((grupo) => (
        <View key={grupo} style={{ gap: espacio.s }}>
          <Text style={[tipografia.micro, { color: paleta.texto3 }]}>{TITULO_GRUPO[grupo]}</Text>
          {grupo === 'finanzas' ? (
            <Text style={[tipografia.caption, { color: paleta.advertenciaTexto }]}>
              Muestran el dinero del negocio. Entrégalos solo a personas de confianza.
            </Text>
          ) : null}
          {PERMISOS.filter((p) => p.grupo === grupo).map((p) => (
            <View
              key={p.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.xs }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[tipografia.cuerpoLg, { color: paleta.texto }]}>{p.titulo}</Text>
                <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{p.descripcion}</Text>
              </View>
              <Switch
                accessibilityLabel={p.titulo}
                value={valor.includes(p.id)}
                disabled={deshabilitado}
                onValueChange={(v) => alternar(p.id, v)}
                trackColor={{ false: paleta.borde, true: paleta.primarioSoft }}
                thumbColor={valor.includes(p.id) ? paleta.primario : paleta.superficie}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
