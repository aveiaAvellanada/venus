import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { MENSAJE_PIN_DEBIL, cambiarMiPin, pinDebil, pinValido } from '../lib/usuarios'
import { useTema } from '../lib/tema'
import { espacio, tipografia } from '../lib/theme'
import { Boton, TecladoPin } from './ui'

type Paso = 'actual' | 'nuevo' | 'confirmar'

const TITULO: Record<Paso, string> = {
  actual: 'Escribe tu PIN actual',
  nuevo: 'Crea tu PIN nuevo de 6 dígitos',
  confirmar: 'Repite el PIN nuevo',
}

interface Props {
  // Obligatorio: cuenta con PIN viejo de 4 dígitos; no se puede saltar.
  obligatorio?: boolean
  onListo: () => void
  onCancelar?: () => void
}

export function FormularioCambiarPin({ obligatorio = false, onListo, onCancelar }: Props) {
  const { paleta } = useTema()
  const [paso, setPaso] = useState<Paso>('actual')
  const [actual, setActual] = useState('')
  const [nuevo, setNuevo] = useState('')
  const [valor, setValor] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function avanzar(pin: string) {
    setError(null)
    if (paso === 'actual') {
      setActual(pin)
      setPaso('nuevo')
    } else if (paso === 'nuevo') {
      if (!pinValido(pin)) {
        setError('El PIN debe tener 6 números.')
      } else if (pinDebil(pin)) {
        setError(MENSAJE_PIN_DEBIL)
      } else if (pin === actual) {
        setError('El PIN nuevo debe ser distinto al actual.')
      } else {
        setNuevo(pin)
        setPaso('confirmar')
      }
    } else if (pin !== nuevo) {
      setError('Los PIN no coinciden. Créalo de nuevo.')
      setNuevo('')
      setPaso('nuevo')
    } else {
      guardar(pin)
    }
    setValor('')
  }

  async function guardar(pinNuevo: string) {
    setGuardando(true)
    try {
      await cambiarMiPin(actual, pinNuevo)
      onListo()
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'No se pudo cambiar el PIN.'
      setError(mensaje)
      // Con el actual equivocado hay que empezar de nuevo.
      setActual('')
      setNuevo('')
      setPaso('actual')
    } finally {
      setGuardando(false)
    }
  }

  // 6 dígitos avanzan solos; el PIN actual puede ser el viejo de 4 (botón Continuar).
  useEffect(() => {
    if (valor.length === 6) avanzar(valor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo, padding: espacio.xxl, paddingTop: 56, gap: espacio.l }}>
      {onCancelar && !obligatorio ? (
        <Boton titulo="Cancelar" variante="fantasma" onPress={onCancelar} />
      ) : null}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacio.l }}>
        {obligatorio ? (
          <Text style={[tipografia.cuerpo, { color: paleta.texto2, textAlign: 'center' }]}>
            Ahora los PIN son de 6 dígitos. Crea el tuyo para seguir.
          </Text>
        ) : null}
        <Text style={[tipografia.h2, { color: paleta.texto, textAlign: 'center' }]}>{TITULO[paso]}</Text>

        <TecladoPin
          valor={valor}
          longitud={6}
          error={!!error}
          deshabilitado={guardando}
          onDigito={(d) => {
            if (valor.length < 6 && !guardando) setValor(valor + d)
          }}
          onBorrar={() => setValor(valor.slice(0, -1))}
        />

        <View style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', gap: espacio.s }}>
          {guardando ? (
            <ActivityIndicator color={paleta.primario} />
          ) : error ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[tipografia.caption, { color: paleta.peligroTexto, textAlign: 'center' }]}
            >
              {error}
            </Text>
          ) : null}
          {paso === 'actual' && valor.length === 4 && !guardando ? (
            <Boton titulo="Continuar" variante="fantasma" onPress={() => avanzar(valor)} />
          ) : null}
        </View>
      </View>
    </View>
  )
}
