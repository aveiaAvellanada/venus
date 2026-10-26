import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Crosshair, ZoomIn } from 'lucide-react'
import { AJUSTE_CENTRADO, desplazar, recorteCuadrado, ZOOM_MAXIMO, type AjusteRecorte } from '../lib/imagen'
import { Boton, Dialogo } from './ui'

const LADO_VISTA = 288

// Encuadrar la foto del zapato en un cuadrado: se arrastra para moverla y el
// zoom la acerca. Lo que se ve en el cuadrado es lo que se guarda.
export function RecortarFoto({ archivo, nombre, alUsar, alCancelar }: {
  archivo: File
  // Cómo se va a llamar el archivo (referencia-color), para mostrarlo.
  nombre: string
  alUsar: (ajuste: AjusteRecorte) => void
  alCancelar: () => void
}) {
  const [url, setUrl] = useState('')
  const [medida, setMedida] = useState<{ ancho: number; alto: number } | null>(null)
  const [ajuste, setAjuste] = useState<AjusteRecorte>(AJUSTE_CENTRADO)
  const arrastre = useRef<{ x: number; y: number; ajuste: AjusteRecorte } | null>(null)

  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') return
    const u = URL.createObjectURL(archivo)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [archivo])

  const r = medida ? recorteCuadrado(medida.ancho, medida.alto, ajuste) : null
  const escala = r ? LADO_VISTA / r.lado : 0

  function empezar(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    arrastre.current = { x: e.clientX, y: e.clientY, ajuste }
  }
  function mover(e: PointerEvent<HTMLDivElement>) {
    const a = arrastre.current
    if (!a || !medida) return
    const lado = recorteCuadrado(medida.ancho, medida.alto, a.ajuste).lado
    setAjuste({
      ...a.ajuste,
      x: desplazar(a.ajuste.x, e.clientX - a.x, LADO_VISTA / lado, medida.ancho - lado),
      y: desplazar(a.ajuste.y, e.clientY - a.y, LADO_VISTA / lado, medida.alto - lado),
    })
  }

  return (
    <Dialogo
      titulo="Encuadrar foto"
      alCerrar={alCancelar}
      ancho="max-w-md"
      pie={
        <>
          <Boton variante="fantasma" onClick={alCancelar}>Cancelar</Boton>
          <Boton onClick={() => alUsar(ajuste)}>Usar foto</Boton>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="relative cursor-grab touch-none overflow-hidden rounded-xl bg-superficie2 active:cursor-grabbing"
          style={{ width: LADO_VISTA, height: LADO_VISTA }}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={() => { arrastre.current = null }}
          onPointerCancel={() => { arrastre.current = null }}
          aria-label="Vista previa: arrastra para mover la foto"
        >
          {url ? (
            <img
              src={url}
              alt=""
              draggable={false}
              onLoad={(e) => setMedida({ ancho: e.currentTarget.naturalWidth, alto: e.currentTarget.naturalHeight })}
              className={r ? 'absolute max-w-none select-none' : 'size-full object-cover'}
              style={r && medida ? { width: medida.ancho * escala, height: medida.alto * escala, left: -r.x * escala, top: -r.y * escala } : undefined}
            />
          ) : null}
        </div>
        <label className="flex w-full items-center gap-3 text-sm text-texto2">
          <ZoomIn aria-hidden className="size-4 shrink-0" />
          <input
            type="range"
            min={1}
            max={ZOOM_MAXIMO}
            step={0.01}
            value={ajuste.zoom}
            onChange={(e) => setAjuste({ ...ajuste, zoom: Number(e.target.value) })}
            aria-label="Zoom"
            className="w-full accent-primario"
          />
        </label>
        <div className="flex w-full items-center justify-between gap-2 text-xs text-texto3">
          <span className="truncate">Se guarda como <strong className="text-texto2">{nombre}</strong></span>
          <button type="button" onClick={() => setAjuste(AJUSTE_CENTRADO)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-superficie2 hover:text-texto">
            <Crosshair aria-hidden className="size-3.5" />
            Centrar
          </button>
        </div>
      </div>
    </Dialogo>
  )
}
