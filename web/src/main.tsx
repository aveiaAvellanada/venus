import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import { App } from './app/App'
import { NEGOCIO } from './lib/negocio'

document.title = `${NEGOCIO.nombre} · Panel`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
