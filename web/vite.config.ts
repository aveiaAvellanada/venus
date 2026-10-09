/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// shared/ (tipos de la base, permisos, formato) vive fuera de web/: se importa
// como @shared y el servidor de desarrollo puede leer la carpeta padre.
const shared = fileURLToPath(new URL('../shared', import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@shared': shared } },
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  build: {
    rollupOptions: {
      output: {
        // Librerías aparte: cambian poco y el navegador las guarda entre versiones del panel.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          supabase: ['@supabase/supabase-js'],
          consultas: ['@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
