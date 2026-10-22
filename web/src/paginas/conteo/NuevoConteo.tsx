import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Check, Search, X } from 'lucide-react'
import {
  aplicarCambiados, borradorVacio, contar, enAlcance, erroresConteo, lineas, payloadConteo, quitarRevisar, resumen,
  textoAlcance, valorDiferencias, type BorradorConteo, type Contado,
} from '../../lib/conteo'
import { agrupar, filtrar, type GrupoReferencia } from '../../lib/inventario'
import { registrarConteo } from '../../lib/datos/conteo'
import { costosPorProducto, listarCalzado } from '../../lib/datos/inventario'
import { nuevoId } from '../../lib/id'
import { Boton, Cargando, ConColor, MensajeError } from '../../componentes/ui'
import { CATEGORIAS } from '../compras/FilaReferencia'
import { RevisarConteo } from './RevisarConteo'

const BORRADOR = 'panel-conteo-borrador'
const POR_PAGINA = 60

type Vista = 'todas' | 'sin_contar' | 'con_diferencia'

const VISTAS: { valor: Vista; titulo: string }[] = [
  { valor: 'todas', titulo: 'Todas' },
  { valor: 'sin_contar', titulo: 'Sin contar' },
  { valor: 'con_diferencia', titulo: 'Con diferencia' },
]

export const tituloCategoria = (c: string) => CATEGORIAS.find((x) => x.valor === c)?.titulo ?? c

function leerBorrador(): BorradorConteo {
  try {
    const guardado = localStorage.getItem(BORRADOR)
    if (guardado) return JSON.parse(guardado) as BorradorConteo
  } catch {
    // borrador ilegible: se empieza de cero
  }
  return borradorVacio(nuevoId())
}

// Para que la lista ofrezca "Seguir con el conteo" si hay uno a medias.
export function hayBorrador(): boolean {
  try {
    const b = JSON.parse(localStorage.getItem(BORRADOR) ?? 'null') as BorradorConteo | null
    return !!b && Object.keys(b.contados ?? {}).length > 0
  } catch {
    return false
  }
}

export function NuevoConteo() {
  const navegar = useNavigate()
  const cliente = useQueryClient()
  const [borrador, setBorrador] = useState<BorradorConteo>(leerBorrador)
  const [texto, setTexto] = useState('')
  const [vista, setVista] = useState<Vista>('todas')
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const [revisando, setRevisando] = useState(false)
  const [cambiados, setCambiados] = useState(0)

  // El borrador vive en este navegador: un conteo a medias no se pierde.
  useEffect(() => {
    try { localStorage.setItem(BORRADOR, JSON.stringify(borrador)) } catch { /* sin espacio: se sigue sin borrador */ }
  }, [borrador])

  const inventario = useQuery({ queryKey: ['inventario'], queryFn: listarCalzado })
  // Sin permiso de costos la base responde con error: el conteo sigue sin valores a costo.
  const costos = useQuery({ queryKey: ['costos'], queryFn: costosPorProducto, retry: false })
  const productos = useMemo(() => inventario.data ?? [], [inventario.data])

  const activos = useMemo(() => productos.filter((p) => p.activo), [productos])
  const categorias = useMemo(() => [...new Set(activos.map((p) => p.categoria))].sort(), [activos])
  const marcas = useMemo(
    () => [...new Set(activos.filter((p) => !borrador.categoria || p.categoria === borrador.categoria).map((p) => p.marca).filter((m): m is string => !!m))].sort(),
    [activos, borrador.categoria],
  )
  const enElAlcance = useMemo(
    () => productos.filter((p) => enAlcance(p, borrador.categoria, borrador.marca)),
    [productos, borrador.categoria, borrador.marca],
  )
  const grupos = useMemo(() => agrupar(enElAlcance), [enElAlcance])
  const ls = useMemo(() => lineas(borrador, productos), [borrador, productos])
  const suma = resumen(ls, enElAlcance)
  const errores = erroresConteo(ls)
  const valor = valorDiferencias(ls, costos.data)
  const alcance = textoAlcance(borrador.categoria ? tituloCategoria(borrador.categoria) : '', borrador.marca)
  const empezado = Object.keys(borrador.contados).length > 0

  const filtrados = useMemo(() => {
    const porTexto = filtrar(grupos, { texto, categoria: '', marca: '', estado: 'activos' })
    if (vista === 'todas') return porTexto
    return porTexto.filter((g) => g.tallas.some((t) => {
      const c = borrador.contados[t.id]
      if (vista === 'sin_contar') return !c
      return !!c && (c.revisar || c.contado.trim() !== String(c.sistema))
    }))
  }, [grupos, texto, vista, borrador.contados])
  const enPantalla = filtrados.slice(0, visibles)
  const orden = enPantalla.flatMap((g) => g.tallas.map((t) => t.id))

  const cambiarAlcance = (cambios: Partial<Pick<BorradorConteo, 'categoria' | 'marca'>>) => {
    setBorrador((b) => ({ ...b, ...cambios }))
    setVisibles(POR_PAGINA)
  }

  function teclas(e: KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const i = orden.indexOf(id)
    const destino = orden[e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey) ? i - 1 : i + 1]
    if (destino) {
      const campo = document.getElementById(`conteo-${destino}`) as HTMLInputElement | null
      campo?.focus()
      campo?.select()
    }
  }

  function igualAlSistema(g: GrupoReferencia) {
    setBorrador((b) => g.tallas.reduce((acc, t) => contar(acc, t, String(acc.contados[t.id]?.sistema ?? t.stock_actual)), b))
  }

  function faltantesEnCero() {
    const sinContar = enElAlcance.filter((p) => !borrador.contados[p.id])
    const pares = sinContar.reduce((s, p) => s + p.stock_actual, 0)
    if (!window.confirm(`¿Contar como 0 las ${sinContar.length} tallas sin contar de ${alcance.toLowerCase()}? ${pares ? `Tienen ${pares} pares en el sistema que quedarían como faltantes.` : 'Ninguna tiene stock en el sistema.'}`)) return
    setBorrador((b) => sinContar.reduce((acc, p) => contar(acc, p, '0'), b))
  }

  function descartar() {
    if (!window.confirm('¿Descartar este conteo? Se borra todo lo contado.')) return
    try { localStorage.removeItem(BORRADOR) } catch { /* nada */ }
    setBorrador(borradorVacio(nuevoId()))
    setCambiados(0)
  }

  const guardar = useMutation({
    mutationFn: () => registrarConteo(payloadConteo(borrador, ls, alcance), borrador.clave),
    onSuccess: async (r) => {
      if (!r.aplicado) {
        // El stock se movió mientras se contaba: nada se guardó.
        setBorrador((b) => aplicarCambiados(b, r.cambiados))
        setCambiados(r.cambiados.length)
        setRevisando(false)
        setVista('con_diferencia')
        await cliente.invalidateQueries({ queryKey: ['inventario'] })
        return
      }
      try { localStorage.removeItem(BORRADOR) } catch { /* nada */ }
      await Promise.all([
        cliente.invalidateQueries({ queryKey: ['inventario'] }),
        cliente.invalidateQueries({ queryKey: ['conteos'] }),
      ])
      navegar(`/conteo/${r.conteo_id}`)
    },
  })

  if (inventario.isPending) return <Cargando />
  if (inventario.isError) return <MensajeError error={inventario.error} />

  return (
    <div className="flex flex-col gap-5 pb-28">
      <Link to="/conteo" className="inline-flex items-center gap-1.5 self-start text-sm text-texto2 hover:text-texto">
        <ArrowLeft aria-hidden className="size-4" />
        Conteos
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-titulo">Nuevo conteo</h1>
          <p className="text-texto2">
            Escribe cuántos pares hay de cada talla. Enter pasa a la siguiente. Lo que no cuentes no se toca.
          </p>
        </div>
        <div className="flex gap-2">
          {empezado ? <Boton variante="fantasma" onClick={descartar}>Descartar conteo</Boton> : null}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Categoría a contar"
          value={borrador.categoria}
          disabled={empezado}
          onChange={(e) => cambiarAlcance({ categoria: e.target.value, marca: '' })}
          className="rounded-xl border border-borde bg-fondo px-3 py-2 text-sm text-texto2 disabled:opacity-60"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c} value={c}>{tituloCategoria(c)}</option>)}
        </select>
        <select
          aria-label="Marca a contar"
          value={borrador.marca}
          disabled={empezado}
          onChange={(e) => cambiarAlcance({ marca: e.target.value })}
          className="rounded-xl border border-borde bg-fondo px-3 py-2 text-sm text-texto2 disabled:opacity-60"
        >
          <option value="">Todas las marcas</option>
          {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {empezado ? <span className="text-xs text-texto3">Para contar otra cosa, confirma o descarta este conteo.</span> : null}
      </div>

      {cambiados ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-advertencia-soft px-4 py-3 text-sm text-advertencia-texto">
          <AlertTriangle aria-hidden className="size-4 shrink-0" />
          <p className="flex-1">
            Mientras contabas cambió el stock de {cambiados} talla{cambiados === 1 ? '' : 's'} (una venta o una devolución). No se guardó nada.
            Están marcadas: vuélvelas a contar, o mantén lo contado si ya incluía ese cambio.
          </p>
          <Boton variante="fantasma" className="py-1.5" onClick={() => { setBorrador(quitarRevisar); setCambiados(0) }}>
            Mantener lo contado
          </Boton>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-borde bg-fondo px-3 py-2 focus-within:border-primario">
          <Search aria-hidden className="size-4 text-texto3" />
          <input
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setVisibles(POR_PAGINA) }}
            placeholder="Buscar referencia, descripción, marca o color"
            aria-label="Buscar en el conteo"
            className="w-full bg-transparent text-sm outline-none"
          />
          {texto ? (
            <button aria-label="Borrar búsqueda" onClick={() => setTexto('')} className="text-texto3 hover:text-texto">
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        <div role="radiogroup" aria-label="Mostrar" className="flex rounded-xl border border-borde bg-fondo p-0.5">
          {VISTAS.map((v) => (
            <button
              key={v.valor}
              role="radio"
              aria-checked={vista === v.valor}
              onClick={() => { setVista(v.valor); setVisibles(POR_PAGINA) }}
              className={`rounded-lg px-3 py-1.5 text-sm ${vista === v.valor ? 'bg-primario-soft font-semibold text-primario' : 'text-texto2 hover:text-texto'}`}
            >
              {v.titulo}
            </button>
          ))}
        </div>
        {suma.sinContar ? (
          <Boton variante="fantasma" onClick={faltantesEnCero} className="border border-borde py-2">
            Lo que falta, en 0
          </Boton>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {enPantalla.map((g) => (
          <FilaConteo
            key={g.clave}
            grupo={g}
            contados={borrador.contados}
            alContar={(t, valorTexto) => setBorrador((b) => contar(b, t, valorTexto))}
            alIgualar={() => igualAlSistema(g)}
            alTecla={teclas}
          />
        ))}
        {filtrados.length === 0 ? (
          <p className="rounded-2xl border border-borde bg-fondo px-4 py-10 text-center text-texto3">
            {grupos.length ? 'Ninguna referencia coincide con la búsqueda.' : 'No hay tallas activas para contar con este alcance.'}
          </p>
        ) : null}
        {filtrados.length > visibles ? (
          <Boton variante="fantasma" onClick={() => setVisibles((v) => v + POR_PAGINA)} className="self-center">
            Mostrar más ({filtrados.length - visibles} referencias restantes)
          </Boton>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-fondo/95 px-4 py-3 backdrop-blur lg:left-72">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-texto2">
            <strong className="text-texto">{suma.contadas}</strong> talla{suma.contadas === 1 ? '' : 's'} contada{suma.contadas === 1 ? '' : 's'}
            {suma.sinContar ? <> · {suma.sinContar} sin contar</> : null}
            {' '}· {suma.conDiferencia} con diferencia
            {suma.sobrantes ? <> · <span className="cifras">+{suma.sobrantes}</span> sobrantes</> : null}
            {suma.faltantes ? <> · <span className="cifras font-medium text-peligro-texto">−{suma.faltantes}</span> faltantes</> : null}
          </p>
          <Boton onClick={() => setRevisando(true)} disabled={suma.contadas === 0}>
            Revisar y confirmar
          </Boton>
        </div>
      </div>

      {revisando ? (
        <RevisarConteo
          alcance={alcance}
          borrador={borrador}
          lineas={ls}
          resumen={suma}
          valor={valor}
          errores={errores}
          guardando={guardar.isPending}
          error={guardar.isError ? guardar.error : null}
          alCambiar={setBorrador}
          alConfirmar={() => guardar.mutate()}
          alCerrar={() => setRevisando(false)}
        />
      ) : null}
    </div>
  )
}

function FilaConteo({ grupo: g, contados, alContar, alIgualar, alTecla }: {
  grupo: GrupoReferencia
  contados: Record<string, Contado>
  alContar: (t: GrupoReferencia['tallas'][number], texto: string) => void
  alIgualar: () => void
  alTecla: (e: KeyboardEvent<HTMLInputElement>, id: string) => void
}) {
  const nombre = g.referencia ?? g.descripcion
  return (
    <section aria-label={`${nombre} ${g.color ?? ''}`.trim()} className="flex flex-wrap items-start gap-4 rounded-2xl border border-borde bg-fondo p-4">
      <div className="w-56 shrink-0">
        <p className="font-medium">{g.referencia ?? '—'} · {g.descripcion}</p>
        <p className="text-xs text-texto3">
          {g.marca}{g.marca && g.color ? ' · ' : ''}{g.color ? <ConColor color={g.color} /> : null}
        </p>
        <button onClick={alIgualar} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primario hover:underline">
          <Check aria-hidden className="size-3.5" />
          Todo coincide con el sistema
        </button>
      </div>
      <div className="flex flex-1 flex-wrap gap-2">
        {g.tallas.map((t) => {
          const c = contados[t.id]
          const sistema = c?.sistema ?? t.stock_actual
          const texto = c?.contado ?? ''
          const n = /^\d+$/.test(texto.trim()) ? Number(texto.trim()) : null
          const diferencia = n === null ? null : n - sistema
          const marco = c?.revisar ? 'border-advertencia-texto bg-advertencia-soft'
            : !c ? 'border-borde'
              : diferencia === null ? 'border-peligro-texto'
                : diferencia === 0 ? 'border-exito-texto/40 bg-exito-soft/40'
                  : 'border-advertencia-texto/50'
          return (
            <label key={t.id} className={`flex w-[5.5rem] flex-col gap-1 rounded-xl border p-2 text-xs ${marco}`}>
              <span className="flex items-baseline justify-between">
                <span className="font-semibold">{t.talla ?? 'Única'}</span>
                <span className="cifras text-texto3" title="Stock en el sistema">sist. {sistema}</span>
              </span>
              <input
                id={`conteo-${t.id}`}
                inputMode="numeric"
                autoComplete="off"
                value={texto}
                onChange={(e) => alContar(t, e.target.value)}
                onKeyDown={(e) => alTecla(e, t.id)}
                aria-label={`Contado de ${nombre} ${g.color ?? ''} talla ${t.talla ?? 'única'}`.replace(/\s+/g, ' ')}
                className="cifras w-full rounded-lg border border-borde bg-fondo px-2 py-1 text-sm outline-none focus:border-primario"
              />
              <span className="cifras h-4 text-center font-medium">
                {!c ? '' : c.revisar ? <span className="text-advertencia-texto">Recontar</span>
                  : diferencia === null ? <span className="text-peligro-texto">¿?</span>
                    : diferencia === 0 ? <span className="text-exito-texto">✓</span>
                      : diferencia > 0 ? <span className="text-advertencia-texto">+{diferencia}</span>
                        : <span className="text-peligro-texto">−{-diferencia}</span>}
              </span>
            </label>
          )
        })}
      </div>
    </section>
  )
}
