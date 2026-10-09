# Despliegue de Venus

Pasos para llevar a producción lo que está en la rama: migraciones de Supabase,
Edge Function del reporte y el APK para los teléfonos de la tienda. Todo es
copiar y pegar; lo que dice **Comprobar** es lo que debe verse para seguir.

Proyecto Supabase: `xqspsaghukeynlizbjvc` · Paquete Android: `com.venusdelcaqueta.app`

> **Hazlo con la tienda cerrada.** Al aplicar las migraciones, las cuentas pasan
> a entrar con *usuario* + PIN (el correo de Auth cambia a `usuario@venus.invalid`),
> así que la app vieja deja de poder iniciar sesión. Instala el APK nuevo en
> todos los teléfonos antes de abrir.

## 0. Lo que necesitas

- Node 22 y este repositorio con `npm ci` hecho.
- Acceso al proyecto en el Dashboard de Supabase.
- Una cuenta de Expo (gratis) para compilar el APK con EAS.
- Opcional: `psql` (si no, todo lo SQL se puede pegar en Dashboard → SQL Editor).

## 1. Respaldo

Dashboard → Database → Backups: confirma que hay un respaldo de hoy. En el plan
gratis no hay respaldos automáticos; saca uno (requiere Docker):

```sh
npx supabase login
npx supabase link --project-ref xqspsaghukeynlizbjvc
npx supabase db dump --linked -f respaldo-esquema.sql
npx supabase db dump --linked --data-only -f respaldo-datos.sql
```

## 2. Migraciones

Hay que aplicar, en orden, los 10 archivos `supabase/migrations/20261009*.sql`
(seguridad, dinero, caja con base, permisos por usuario, gestión de empleados).
El historial remoto coincide con los archivos del repo (comprobado el
2026-10-09: las 33 anteriores, mismas versiones), así que la CLI aplica justo
esas 10:

```sh
npx supabase migration list      # deben faltar en Remote solo las 20261009…
npx supabase db push --dry-run   # muestra qué aplicaría, sin aplicar nada
npx supabase db push
```

Si `migration list` mostrara pendiente alguna anterior, **no hagas push**:
revisa primero por qué no coincide.

Cada migración corre en su propia transacción: si una falla, no deja nada a
medias (las anteriores sí quedan). Copia el error y no sigas.

> El conector de Supabase en Claude (`apply_migration`) pide confirmar las
> operaciones destructivas (`drop policy`, `revoke`…). Si la confirmación no
> aparece donde corre la sesión, la llamada se cancela a los 60 s sin aplicar
> nada. Sin CLI, la alternativa que se usó el 2026-10-09: un solo script con
> los archivos en orden dentro de `begin; … commit;`, cada uno seguido de
> `insert into supabase_migrations.schema_migrations (version, name) values (…)`,
> pegado en Dashboard → SQL Editor. Es todo o nada y queda en el historial.

## 3. Verificar la base

Solo lectura; no toca datos. Pega `supabase/tests/remoto/verificar_despliegue.sql`
en el SQL Editor, o con la cadena de conexión (Dashboard → Connect → *Session pooler*):

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/remoto/verificar_despliegue.sql
```

**Comprobar:** termina con `ERROR: DESPLIEGUE_OK_ROLLBACK` (ese "error" es el
éxito). Antes lista cada persona con su usuario, por ejemplo
`Sandra Cardona → usuario "sandra", crea PIN de 6 al entrar`. **Anota esos
usuarios:** es lo que cada uno escribe para entrar. Si sale otro error, dice
exactamente qué falló; no sigas.

Los tests `supabase/tests/*_test.sql` **no** se corren contra producción:
aunque terminan en rollback, gastan números de venta y quedarían huecos. Ya
corren en el CI de cada PR (sección 8).

## 4. Tipos de TypeScript

```sh
npx supabase gen types typescript --project-id xqspsaghukeynlizbjvc > lib/database.types.ts
npx tsc --noEmit
```

Si `git diff lib/database.types.ts` muestra cambios, súbelos en un commit aparte.

## 5. Reporte diario por correo

```sh
npx supabase functions deploy enviar-reporte-diario
```

- **Rota la clave de Resend:** la actual se pegó en un chat. En Resend crea una
  nueva, guárdala y revoca la vieja:
  `npx supabase secrets set RESEND_API_KEY=re_xxx`
- Remitente: sin configurar, sale de `onboarding@resend.dev`, que **solo entrega
  al correo dueño de la cuenta de Resend** (hoy funciona porque son el mismo).
  Para mandar a otro correo, verifica un dominio en Resend y:
  `npx supabase secrets set RESEND_FROM='Venus <reportes@tu-dominio.com>'`
- `caja-scheduler` no cambió; no hay que redesplegarla.

## 6. APK

Una sola vez:

```sh
npm install -g eas-cli
eas login
eas init        # crea el proyecto en Expo y agrega extra.eas.projectId a app.json: haz commit
```

Variables de la app (la publishable key está en Dashboard → Project Settings →
API Keys, empieza por `sb_publishable_`). Es pública por diseño: la protección
son las políticas RLS, no la clave. Nunca uses aquí la `service_role` / secret key.

```sh
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xqspsaghukeynlizbjvc.supabase.co --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_xxx --environment preview --visibility plaintext
# Repetir ambos con --environment production cuando se vaya a la Play Store.
```

Compilar e instalar:

```sh
eas build -p android --profile preview
```

Al terminar, EAS da un enlace y un QR al APK. En cada teléfono: abrir el
enlace, descargar e instalar (Android pide permitir "instalar apps de esta
fuente"). Si el teléfono tiene una versión vieja de Venus con otro nombre de
paquete, desinstálala para que no queden dos.

- `preview` = APK para instalar directo (lo de la tienda). `production` = AAB
  para la Play Store; no hace falta por ahora.
- El número de versión de Android (`versionCode`) lo lleva EAS y sube solo en
  cada build.

## 7. Primer día con la app nueva

Cada persona entra con su **usuario** (paso 3) y su **PIN de siempre**; la
app le pide crear un PIN nuevo de 6 dígitos. No acepta PIN fáciles de adivinar
(`000000`, `123456`, `121212`…).

Andrés, primero:

1. Entra como `andres` y crea su PIN de 6.
2. **Perfil → Caja:** pone la *base predeterminada* (el sencillo con que
   abre el cajón). La apertura automática la toma de ahí.
3. **Empleados**: revisa los permisos de cada persona. Sandra quedó con la
   plantilla *Administrativo* y los demás con *Operativo*. Ajusta lo que haga
   falta. Si alguien no tiene cuenta (Nikol), créala ahí con usuario y PIN.
4. Prueba de punta a punta con el día real:

| # | Quién | Qué hacer | Debe pasar |
|---|-------|-----------|------------|
| 1 | Operativo | Abrir caja | Propone la base guardada; queda abierta |
| 2 | Operativo | Una venta en efectivo | Se confirma una sola vez aunque se toque dos veces |
| 3 | Operativo | Registrar un gasto con "Se pagó con plata del cajón" | Aparece en Caja como gasto del cajón |
| 4 | Operativo | Recorrer la app | No ve Balance, costos, deudas ni Empleados |
| 5 | Andrés | Cerrar caja contando el efectivo | Esperado = base + efectivo de ventas − gastos del cajón |
| 6 | Andrés | Crear una cuenta `prueba`, entrar con ella en otro teléfono, desactivarla | La sesión de `prueba` se corta y ya no puede entrar |
| 7 | Cualquiera | Perfil → Cambiar mi PIN | Pide el actual; el nuevo funciona al volver a entrar |

Si alguien olvida su PIN: Andrés → Empleados → la persona → *PIN de acceso* → Guardar PIN nuevo.

**Intentos de PIN:** Supabase limita los inicios de sesión por IP. Como todos
los teléfonos de la tienda salen a internet por la misma IP, muchos intentos
fallidos seguidos pueden bloquear el login unos minutos para todos. Es la
protección contra quien intente adivinar PINs; si pasa, esperar 5 minutos.

## 8. CI (GitHub Actions)

`.github/workflows/ci.yml` corre en cada PR y en `main`:

- **App:** `npm ci`, `tsc`, `jest`, `expo install --check`.
- **Base de datos:** aplica todas las migraciones desde cero en un Postgres
  local y corre los `*_test.sql`, la conversión de cuentas existentes y esta
  misma verificación de despliegue.

Recomendado: en GitHub → Settings → Branches, exigir esos dos checks para
fusionar a `main`.

## Si algo sale mal

- **Una migración falla:** la que falló no deja nada aplicado; las anteriores
  sí quedan. Copia el error, no reintentes a ciegas.
- **Nadie puede entrar después de migrar:** corre la verificación (paso 3);
  dice qué cuenta y por qué. Lo típico es escribir el correo viejo en vez del
  usuario.
- **Volver atrás:** las migraciones no tienen reversa automática (cambian los
  correos de Auth y los permisos). Se corrige hacia adelante con una migración
  nueva o, en el peor caso, se restaura el respaldo del paso 1.
