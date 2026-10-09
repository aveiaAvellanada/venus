import { createClient } from '@supabase/supabase-js'
import type { Database } from '@shared/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !clave) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY (ver web/README.md).')
}

export const supabase = createClient<Database>(url, clave, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // Separada de cualquier otra app del mismo dominio.
    storageKey: 'panel-sesion',
  },
})
