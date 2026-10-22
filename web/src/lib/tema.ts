import { useEffect, useState } from 'react'

// Tema del panel, como en la app (lib/tema.tsx): claro, oscuro o el del
// sistema. Se guarda en este navegador; index.html lo aplica antes de pintar
// para que no parpadee.
export type ModoTema = 'claro' | 'oscuro' | 'sistema'

export const CLAVE_TEMA = 'panel-tema'

export const MODOS: { valor: ModoTema; titulo: string }[] = [
  { valor: 'claro', titulo: 'Claro' },
  { valor: 'oscuro', titulo: 'Oscuro' },
  { valor: 'sistema', titulo: 'Sistema' },
]

export function leerTema(): ModoTema {
  try {
    const v = localStorage.getItem(CLAVE_TEMA)
    if (v === 'claro' || v === 'oscuro') return v
  } catch {
    // sin almacenamiento: el del sistema
  }
  return 'sistema'
}

export function aplicarTema(modo: ModoTema): void {
  const raiz = document.documentElement
  if (modo === 'sistema') delete raiz.dataset.tema
  else raiz.dataset.tema = modo
  try {
    if (modo === 'sistema') localStorage.removeItem(CLAVE_TEMA)
    else localStorage.setItem(CLAVE_TEMA, modo)
  } catch {
    // sin almacenamiento: vale para esta visita
  }
}

export function useTema(): [ModoTema, (m: ModoTema) => void] {
  const [modo, setModo] = useState<ModoTema>(leerTema)
  useEffect(() => aplicarTema(modo), [modo])
  return [modo, setModo]
}
