import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import {
  ArrowLeft,
  Ban,
  Calendar,
  CircleAlert,
  CircleCheckBig,
  Info,
  KeyRound,
  Receipt,
  ShieldCheck,
  Save,
  User,
  Wallet,
} from 'lucide-react-native'
import { useRequireModulo } from '../../../lib/auth'
import { usePaddingInferior } from '../../../hooks/usePaddingInferior'
import {
  listarEmpleados,
  diasTrabajadosMes,
  historialPagos,
  guardarConfigEmpleado,
  actualizarEmpleado,
  restablecerPinEmpleado,
  setActivoEmpleado,
  registrarPagoEmpleado,
  diasEsperadosMes,
  montoSugeridoPago,
  type Empleado,
  type PagoEmpleado,
} from '../../../lib/empleados'
import { useTema } from '../../../lib/tema'
import type { Paleta } from '../../../lib/theme'
import { espacio, radio, tabular, tipografia } from '../../../lib/theme'
import { Badge, Boton, CampoTexto, CirculoIcono, EstadoVacio, Presionable, Tarjeta, useToast } from '../../../components/ui'
import { SelectorPermisos } from '../../../components/SelectorPermisos'
import { resumenPermisos, type Permiso } from '../../../lib/permisos'
import { pinValido } from '../../../lib/usuarios'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

function hoyISO(): string {
  const d = new Date()
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

// Encabezado a nivel de módulo: no se remonta en cada render (Regla 2).
function Encabezado({ paleta, onVolver }: { paleta: Paleta; onVolver: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        paddingHorizontal: espacio.xl,
        paddingTop: 56,
        paddingBottom: espacio.m,
      }}
    >
      <Presionable accessibilityRole="button" accessibilityLabel="Volver" onPress={onVolver} hitSlop={12}>
        <ArrowLeft size={24} color={paleta.texto} />
      </Presionable>
      <Text style={[tipografia.h2, { color: paleta.texto, flex: 1 }]} numberOfLines={1}>
        Empleado
      </Text>
    </View>
  )
}

export default function EmpleadoDetalleScreen() {
  const requireModulo = useRequireModulo('gestion-empleado')
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { paleta } = useTema()
  const toast = useToast()
  const paddingInferior = usePaddingInferior(espacio.xxxl)

  // ─── Estado de carga ───────────────────────────────────────────────────────
  const [empleado, setEmpleado] = useState<Empleado | null>(null)
  const [diasEsteMes, setDiasEsteMes] = useState<number>(0)
  const [pagos, setPagos] = useState<PagoEmpleado[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  // ─── Campos de edición ──────────────────────────────────────────────────────
  const [nombre, setNombre] = useState('')
  const [sueldoTexto, setSueldoTexto] = useState('')
  const [diasSemanaTexto, setDiasSemanaTexto] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [guardando, setGuardando] = useState(false)

  // ─── Estado — activar/desactivar ───────────────────────────────────────────
  const [cambiandoActivo, setCambiandoActivo] = useState(false)

  // Permisos y PIN (solo el dueño llega aquí)
  const [permisos, setPermisos] = useState<Permiso[]>([])
  const [guardandoPermisos, setGuardandoPermisos] = useState(false)
  const [pinNuevo, setPinNuevo] = useState('')
  const [guardandoPin, setGuardandoPin] = useState(false)

  // ─── Campos de pago ────────────────────────────────────────────────────────
  const [montoTexto, setMontoTexto] = useState('')
  const [registrandoPago, setRegistrandoPago] = useState(false)

  // ─── Carga de datos ────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    if (!id) return
    setCargando(true)
    setErrorCarga(null)
    try {
      const ahora = new Date()
      const anio = ahora.getFullYear()
      const mes = ahora.getMonth() + 1 // 1-12

      const lista = await listarEmpleados()
      const emp = lista.find((e) => e.id === id) ?? null

      if (!emp) {
        setErrorCarga('Empleado no encontrado.')
        setCargando(false)
        return
      }

      const [dias, pagosData] = await Promise.all([
        diasTrabajadosMes(id, anio, mes),
        historialPagos(id),
      ])

      setEmpleado(emp)
      setDiasEsteMes(dias)
      setPagos(pagosData)

      // Inicializar campos de edición con los datos actuales
      setNombre(emp.nombre)
      setPermisos(emp.permisos)
      setSueldoTexto(emp.config?.sueldo_mensual != null ? String(emp.config.sueldo_mensual) : '')
      setDiasSemanaTexto(
        emp.config?.dias_trabajo_semana != null ? String(emp.config.dias_trabajo_semana) : ''
      )
      setFechaInicio(emp.config?.fecha_inicio ?? '')

      // Calcular monto sugerido de pago
      const diasSemana = emp.config?.dias_trabajo_semana ?? null
      const sueldo = emp.config?.sueldo_mensual ?? 0
      const diasEsp = diasEsperadosMes(diasSemana, anio, mes)
      const montoSug = montoSugeridoPago(sueldo, dias, diasEsp)
      setMontoTexto(String(montoSug))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setErrorCarga(msg)
    } finally {
      setCargando(false)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      // No disparar peticiones si el rol no tiene acceso (el guard redirige abajo).
      if (!requireModulo) cargarDatos()
    }, [cargarDatos, requireModulo])
  )

  // ─── Guard de módulo ───────────────────────────────────────────────────────
  if (requireModulo) return requireModulo

  // ─── Guardar datos del empleado ────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!empleado) return
    const nombreTrimmed = nombre.trim()
    if (!nombreTrimmed) {
      toast.mostrar('El nombre no puede estar vacío.', 'error')
      return
    }
    const sueldo = parseInt(sueldoTexto.replace(/[^0-9]/g, ''), 10)
    if (isNaN(sueldo) || sueldo < 0) {
      toast.mostrar('El sueldo mensual debe ser un número válido.', 'error')
      return
    }
    const diasSemana =
      diasSemanaTexto.trim() !== ''
        ? parseInt(diasSemanaTexto.replace(/[^0-9]/g, ''), 10)
        : null
    if (diasSemana !== null && (isNaN(diasSemana) || diasSemana < 1 || diasSemana > 7)) {
      toast.mostrar('Los días de trabajo por semana deben estar entre 1 y 7.', 'error')
      return
    }
    const fechaInicioParsed = fechaInicio.trim() || null
    if (fechaInicioParsed) {
      const regexFecha = /^\d{4}-\d{2}-\d{2}$/
      if (!regexFecha.test(fechaInicioParsed)) {
        toast.mostrar('La fecha de inicio debe tener el formato AAAA-MM-DD.', 'error')
        return
      }
      const d = new Date(fechaInicioParsed + 'T00:00:00')
      if (isNaN(d.getTime())) {
        toast.mostrar('La fecha de inicio no es una fecha válida.', 'error')
        return
      }
    }

    try {
      setGuardando(true)
      await actualizarEmpleado(empleado.id, { nombre: nombreTrimmed })
      await guardarConfigEmpleado(empleado.id, {
        sueldo_mensual: sueldo,
        fecha_inicio: fechaInicioParsed,
        dias_trabajo_semana: diasSemana,
      })
      toast.mostrar('Los datos del empleado se guardaron correctamente.', 'exito')
      await cargarDatos()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      toast.mostrar(msg, 'error')
    } finally {
      setGuardando(false)
    }
  }

  // ─── Permisos ──────────────────────────────────────────────────────────────
  const handleGuardarPermisos = async () => {
    if (!empleado) return
    try {
      setGuardandoPermisos(true)
      await actualizarEmpleado(empleado.id, { permisos })
      toast.mostrar('Permisos actualizados. Se aplican de inmediato.', 'exito')
      await cargarDatos()
    } catch (err: unknown) {
      toast.mostrar(err instanceof Error ? err.message : 'No se pudieron guardar los permisos', 'error')
    } finally {
      setGuardandoPermisos(false)
    }
  }

  // ─── PIN ───────────────────────────────────────────────────────────────────
  const handleRestablecerPin = async () => {
    if (!empleado) return
    if (!pinValido(pinNuevo)) {
      toast.mostrar('El PIN debe tener exactamente 6 números.', 'error')
      return
    }
    try {
      setGuardandoPin(true)
      await restablecerPinEmpleado(empleado.id, pinNuevo)
      setPinNuevo('')
      toast.mostrar(`PIN nuevo listo. Dáselo a ${empleado.nombre.split(' ')[0]}.`, 'exito')
    } catch (err: unknown) {
      toast.mostrar(err instanceof Error ? err.message : 'No se pudo cambiar el PIN', 'error')
    } finally {
      setGuardandoPin(false)
    }
  }

  // ─── Activar / Desactivar ──────────────────────────────────────────────────
  const handleToggleActivo = () => {
    if (!empleado) return
    const nuevoActivo = !empleado.activo
    const titulo = nuevoActivo ? 'Activar empleado' : 'Desactivar empleado'
    const mensaje = nuevoActivo
      ? `¿Activar a ${empleado.nombre}? Podrá iniciar sesión nuevamente.`
      : `¿Desactivar a ${empleado.nombre}? No podrá entrar y se cerrará la sesión que tenga abierta.`

    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: nuevoActivo ? 'Activar' : 'Desactivar',
        style: nuevoActivo ? 'default' : 'destructive',
        onPress: async () => {
          try {
            setCambiandoActivo(true)
            await setActivoEmpleado(empleado.id, nuevoActivo)
            await cargarDatos()
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error al cambiar estado'
            toast.mostrar(msg, 'error')
          } finally {
            setCambiandoActivo(false)
          }
        },
      },
    ])
  }

  // ─── Registrar pago ────────────────────────────────────────────────────────
  const handleRegistrarPago = async () => {
    if (!empleado) return
    const monto = parseInt(montoTexto.replace(/[^0-9]/g, ''), 10)
    if (isNaN(monto) || monto <= 0) {
      toast.mostrar('El monto del pago debe ser mayor a cero.', 'error')
      return
    }

    Alert.alert(
      'Confirmar pago',
      `Registrar pago de ${pesos(monto)} para ${empleado.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Registrar',
          onPress: async () => {
            try {
              setRegistrandoPago(true)
              const ahora = new Date()
              const anio = ahora.getFullYear()
              const mes = ahora.getMonth() + 1
              // periodo: primer y último día del mes actual
              const periodoInicio = `${anio}-${String(mes).padStart(2, '0')}-01`
              const ultimoDia = new Date(anio, mes, 0).getDate()
              const periodoFin = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

              await registrarPagoEmpleado({
                empleado_id: empleado.id,
                monto,
                fecha_pago: hoyISO(),
                periodo_inicio: periodoInicio,
                periodo_fin: periodoFin,
                dias_trabajados: diasEsteMes,
              })
              toast.mostrar('El pago se registró correctamente.', 'exito')
              const pagosActualizados = await historialPagos(empleado.id)
              setPagos(pagosActualizados)
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Error al registrar pago'
              toast.mostrar(msg, 'error')
            } finally {
              setRegistrandoPago(false)
            }
          },
        },
      ]
    )
  }

  // ─── Pantalla de carga ─────────────────────────────────────────────────────
  if (cargando) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado paleta={paleta} onVolver={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: espacio.m }}>
          <ActivityIndicator size="large" color={paleta.primario} />
          <Text style={[tipografia.cuerpo, { color: paleta.texto2 }]}>Cargando empleado...</Text>
        </View>
      </View>
    )
  }

  if (errorCarga || !empleado) {
    return (
      <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
        <Encabezado paleta={paleta} onVolver={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: espacio.xl, gap: espacio.l }}>
          <EstadoVacio icono={<CircleAlert />} titulo={errorCarga ?? 'Empleado no encontrado.'} />
          <Boton titulo="Reintentar" variante="secundario" tamano="md" onPress={() => cargarDatos()} />
        </View>
      </View>
    )
  }

  const permisosCambiados =
    permisos.length !== empleado.permisos.length || permisos.some((p) => !empleado.permisos.includes(p))
  const ahora = new Date()
  const anioActual = ahora.getFullYear()
  const mesActual = ahora.getMonth() + 1
  const diasSemanaNum = empleado.config?.dias_trabajo_semana ?? null
  const sueldoNum = empleado.config?.sueldo_mensual ?? 0
  const diasEsp = diasEsperadosMes(diasSemanaNum, anioActual, mesActual)
  const montoSug = montoSugeridoPago(sueldoNum, diasEsteMes, diasEsp)

  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo }}>
      <Encabezado paleta={paleta} onVolver={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: espacio.xl, paddingTop: 0, paddingBottom: paddingInferior, gap: espacio.l }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Cabecera del empleado ── */}
          <Tarjeta>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m }}>
              <CirculoIcono tono="primario" tamano={52}>
                <User />
              </CirculoIcono>
              <View style={{ flex: 1 }}>
                <Text style={[tipografia.h3, { color: paleta.texto }]}>{empleado.nombre}</Text>
                <Text style={[tipografia.caption, { color: paleta.texto2 }]}>{resumenPermisos(empleado)}</Text>
                <Text style={[tipografia.caption, { color: paleta.texto3 }]} numberOfLines={1}>
                  Usuario: {empleado.usuario}
                </Text>
              </View>
              <Badge texto={empleado.activo ? 'Activo' : 'Inactivo'} tipo={empleado.activo ? 'exito' : 'peligro'} punto={empleado.activo} />
            </View>
          </Tarjeta>

          {/* ── Sección 1: Datos ── */}
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.l }]}>Datos del empleado</Text>

            <View style={{ gap: espacio.m }}>
              <CampoTexto
                etiqueta="Nombre *"
                value={nombre}
                onChangeText={setNombre}
                placeholder="Nombre completo"
                testID="input-nombre"
              />

              <CampoTexto
                etiqueta="Sueldo mensual (COP) *"
                value={sueldoTexto}
                onChangeText={(t) => setSueldoTexto(t.replace(/[^0-9]/g, ''))}
                placeholder="Ej. 1300000"
                keyboardType="number-pad"
                testID="input-sueldo"
              />

              <CampoTexto
                etiqueta="Días de trabajo por semana (opcional)"
                value={diasSemanaTexto}
                onChangeText={(t) => setDiasSemanaTexto(t.replace(/[^0-9]/g, ''))}
                placeholder="Ej. 6  (predeterminado: 6)"
                keyboardType="number-pad"
                maxLength={1}
                testID="input-dias-semana"
              />

              <CampoTexto
                etiqueta="Fecha de inicio (AAAA-MM-DD, opcional)"
                value={fechaInicio}
                onChangeText={setFechaInicio}
                placeholder="Ej. 2025-01-15"
                maxLength={10}
                testID="input-fecha-inicio"
              />
            </View>

            {/* Boton no acepta testID; se usa un Presionable con los mismos tokens (testID requerido por la suite) */}
            <Presionable
              accessibilityRole="button"
              accessibilityLabel="Guardar"
              accessibilityState={{ disabled: guardando, busy: guardando }}
              disabled={guardando}
              onPress={guardando ? undefined : handleGuardar}
              testID="btn-guardar"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: espacio.s,
                height: 56,
                borderRadius: radio.md,
                backgroundColor: paleta.primario,
                opacity: guardando ? 0.45 : 1,
                marginTop: espacio.l,
              }}
            >
              {guardando ? (
                <ActivityIndicator color={paleta.sobrePrimario} />
              ) : (
                <Save size={20} color={paleta.sobrePrimario} />
              )}
              <Text style={[tipografia.cuerpoLg, { color: paleta.sobrePrimario }]}>Guardar</Text>
            </Presionable>
          </Tarjeta>

          {/* ── Permisos ── */}
          <Tarjeta>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginBottom: espacio.l }}>
              <ShieldCheck size={20} color={paleta.primario} />
              <Text style={[tipografia.h3, { color: paleta.texto }]}>Permisos</Text>
            </View>
            <SelectorPermisos valor={permisos} onCambio={setPermisos} deshabilitado={guardandoPermisos} />
            <View style={{ marginTop: espacio.l }}>
              <Boton
                titulo="Guardar permisos"
                onPress={handleGuardarPermisos}
                cargando={guardandoPermisos}
                deshabilitado={guardandoPermisos || !permisosCambiados}
              />
            </View>
          </Tarjeta>

          {/* ── PIN de acceso ── */}
          <Tarjeta>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginBottom: espacio.m }}>
              <KeyRound size={20} color={paleta.primario} />
              <Text style={[tipografia.h3, { color: paleta.texto }]}>PIN de acceso</Text>
            </View>
            <Text style={[tipografia.cuerpo, { color: paleta.texto2, marginBottom: espacio.l }]}>
              Si olvidó su PIN, ponle uno nuevo de 6 dígitos. Luego puede cambiarlo desde su Perfil.
            </Text>
            <CampoTexto
              etiqueta="PIN nuevo"
              placeholder="••••••"
              value={pinNuevo}
              onChangeText={(t) => setPinNuevo(t.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            <View style={{ marginTop: espacio.m }}>
              <Boton
                titulo="Guardar PIN nuevo"
                variante="secundario"
                onPress={handleRestablecerPin}
                cargando={guardandoPin}
                deshabilitado={guardandoPin || pinNuevo.length !== 6}
              />
            </View>
          </Tarjeta>

          {/* ── Sección 2: Estado (Activar / Desactivar) ── */}
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.m }]}>Estado del empleado</Text>
            <Text style={[tipografia.cuerpo, { color: paleta.texto2, marginBottom: espacio.l }]}>
              {empleado.activo
                ? 'El empleado puede iniciar sesión en la app.'
                : 'El empleado no puede iniciar sesión. Actívalo para restablecer el acceso.'}
            </Text>
            {/* Boton no acepta testID; se usa un Presionable con los mismos tokens (testID requerido por la suite) */}
            <Presionable
              accessibilityRole="button"
              accessibilityLabel={empleado.activo ? 'Desactivar empleado' : 'Activar empleado'}
              accessibilityState={{ disabled: cambiandoActivo, busy: cambiandoActivo }}
              disabled={cambiandoActivo}
              onPress={cambiandoActivo ? undefined : handleToggleActivo}
              testID="btn-toggle-activo"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: espacio.s,
                height: 56,
                borderRadius: radio.md,
                backgroundColor: empleado.activo ? paleta.peligro : paleta.exito,
                opacity: cambiandoActivo ? 0.45 : 1,
              }}
            >
              {cambiandoActivo ? (
                <ActivityIndicator color={paleta.sobrePrimario} />
              ) : empleado.activo ? (
                <Ban size={20} color={paleta.sobrePrimario} />
              ) : (
                <CircleCheckBig size={20} color={paleta.sobrePrimario} />
              )}
              <Text style={[tipografia.cuerpoLg, { color: paleta.sobrePrimario }]}>
                {empleado.activo ? 'Desactivar empleado' : 'Activar empleado'}
              </Text>
            </Presionable>
          </Tarjeta>

          {/* ── Sección 3: Días este mes ── */}
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.l }]}>Días trabajados este mes</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.l }}>
              <CirculoIcono tono="primario" tamano={48}>
                <Calendar />
              </CirculoIcono>
              <View style={{ flex: 1 }}>
                <Text style={[tipografia.display, tabular, { color: paleta.texto }]}>{diasEsteMes}</Text>
                <Text style={[tipografia.caption, { color: paleta.texto3 }]}>días registrados</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[tipografia.micro, { color: paleta.texto3 }]}>Esperados</Text>
                <Text style={[tipografia.h2, tabular, { color: paleta.texto2 }]}>{diasEsp}</Text>
              </View>
            </View>
          </Tarjeta>

          {/* ── Sección 4: Registrar pago ── */}
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.l }]}>Registrar pago</Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: espacio.s,
                backgroundColor: paleta.primarioSoft,
                borderRadius: radio.sm,
                padding: espacio.m,
                marginBottom: espacio.l,
              }}
            >
              <Info size={16} color={paleta.primario} />
              <Text style={[tipografia.cuerpo, tabular, { color: paleta.primario, flex: 1 }]}>
                Monto proporcional sugerido: {pesos(montoSug)} ({diasEsteMes}/{diasEsp} días)
              </Text>
            </View>

            <CampoTexto
              etiqueta="Monto a pagar (COP) *"
              value={montoTexto}
              onChangeText={(t) => setMontoTexto(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Ej. 650000"
              testID="input-monto-pago"
            />

            {/* Boton no acepta testID; se usa un Presionable con los mismos tokens (testID requerido por la suite) */}
            <Presionable
              accessibilityRole="button"
              accessibilityLabel="Registrar pago"
              accessibilityState={{ disabled: registrandoPago, busy: registrandoPago }}
              disabled={registrandoPago}
              onPress={registrandoPago ? undefined : handleRegistrarPago}
              testID="btn-registrar-pago"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: espacio.s,
                height: 56,
                borderRadius: radio.md,
                backgroundColor: paleta.primario,
                opacity: registrandoPago ? 0.45 : 1,
                marginTop: espacio.l,
              }}
            >
              {registrandoPago ? (
                <ActivityIndicator color={paleta.sobrePrimario} />
              ) : (
                <Wallet size={20} color={paleta.sobrePrimario} />
              )}
              <Text style={[tipografia.cuerpoLg, { color: paleta.sobrePrimario }]}>Registrar pago</Text>
            </Presionable>
          </Tarjeta>

          {/* ── Sección 5: Historial de pagos ── */}
          <Tarjeta>
            <Text style={[tipografia.h3, { color: paleta.texto, marginBottom: espacio.m }]}>Historial de pagos</Text>

            {pagos.length === 0 ? (
              <EstadoVacio icono={<Receipt />} titulo="Sin pagos registrados." />
            ) : (
              pagos.map((pago, idx) => (
                <View key={pago.id}>
                  <View style={{ flexDirection: 'row', gap: espacio.m, paddingVertical: espacio.m }}>
                    <CirculoIcono tono="exito" tamano={36}>
                      <CircleCheckBig />
                    </CirculoIcono>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[tipografia.h3, tabular, { color: paleta.texto }]}>{pesos(pago.monto)}</Text>
                      <Text style={[tipografia.caption, { color: paleta.texto2 }]}>
                        {new Date(pago.fecha_pago + 'T12:00:00').toLocaleDateString('es-CO', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </Text>
                      {pago.dias_trabajados != null && (
                        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>Días: {pago.dias_trabajados}</Text>
                      )}
                      {pago.periodo_inicio && pago.periodo_fin && (
                        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>
                          Período: {pago.periodo_inicio} → {pago.periodo_fin}
                        </Text>
                      )}
                      {pago.nota ? (
                        <Text style={[tipografia.caption, { color: paleta.texto3, fontStyle: 'italic' }]}>{pago.nota}</Text>
                      ) : null}
                    </View>
                  </View>
                  {idx < pagos.length - 1 ? (
                    <View style={{ height: 1, backgroundColor: paleta.borde }} />
                  ) : null}
                </View>
              ))
            )}
          </Tarjeta>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
