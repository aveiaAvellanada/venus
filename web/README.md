# Panel web (solo el dueño)

El back-office del negocio en el navegador: mercancía, precios, inventario,
proveedores, análisis y administración. La venta y la caja siguen en la app
del celular. Plan completo y fases: [`docs/panel-web.md`](../docs/panel-web.md).

Usa el mismo Supabase que la app, con el mismo login (usuario + PIN) y las
mismas reglas de la base; solo deja entrar a la cuenta del dueño.

## Desarrollo

```sh
cd web
npm ci
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run build      # TypeScript + compilación a dist/
```

`.env.development` y `.env.production` traen la URL y la publishable key de
Venus. Son públicas por diseño (quedan dentro de la página); la protección es
la RLS. Nunca pongas aquí la `service_role` / secret key.

Código compartido con la app del celular: `../shared` (tipos de la base,
permisos, formato de usuario y PIN, fechas del negocio), importado como
`@shared/...`.

## Publicar en Cloudflare Pages (gratis)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → el repositorio `aveiaAvellanada/venus`.
2. Configuración del build:
   - Production branch: `main`
   - Root directory: `web`
   - Build command: `npm ci && npm run build`
   - Build output directory: `dist`
   - Variable de entorno: `NODE_VERSION` = `22`
3. **Save and Deploy**. Queda en `https://<nombre>.pages.dev`; cada push a
   `main` publica una versión nueva y cada PR tiene su propia vista previa.

`public/_redirects` hace que cualquier ruta abra la app (React Router) y
`public/_headers` agrega cabeceras de seguridad.

## Otro negocio

El mismo código sirve para otra tienda con su propio proyecto de Supabase:
en el hosting se definen `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_NEGOCIO_NOMBRE` y, si cambia, `VITE_NEGOCIO_ZONA_HORARIA` (las
variables del hosting pesan más que los archivos `.env.*`).
