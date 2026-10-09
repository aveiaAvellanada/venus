#!/usr/bin/env bash
# Aplica TODAS las migraciones de supabase/migrations/ sobre un Postgres local
# efímero (con stub_supabase.sql) y corre los tests SQL que se pasen como
# argumentos. Un test pasa si termina con un error "*_OK_ROLLBACK".
#
# Uso:  supabase/tests/local/run.sh supabase/tests/seguridad_rls_test.sql
#
# Requiere los binarios de Postgres (initdb/pg_ctl/psql, 16+). Si se corre como
# root, el servidor se levanta con el usuario del sistema "postgres".
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../../.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")}"
TMP="$(mktemp -d)"
PUERTO="${PUERTO:-54329}"

# Migraciones que dependen de servicios que el stub no emula.
OMITIR=(
  20260618171400_caja_scheduler_cron.sql   # pg_cron + pg_net (solo agenda un job)
)

como_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

limpiar() {
  como_pg "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap limpiar EXIT

[ "$(id -u)" = "0" ] && chown postgres "$TMP"
como_pg "$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust >/dev/null
como_pg "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PUERTO -k $TMP -c listen_addresses=''" -l "$TMP/pg.log" -w start >/dev/null

PSQL=(psql -h "$TMP" -p "$PUERTO" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -f "$RAIZ/supabase/tests/local/stub_supabase.sql" >/dev/null

for f in "$RAIZ"/supabase/migrations/*.sql; do
  nombre="$(basename "$f")"
  if printf '%s\n' "${OMITIR[@]}" | grep -qx "$nombre"; then
    echo "omitida   $nombre"
    continue
  fi
  if ! salida="$("${PSQL[@]}" -f "$f" 2>&1)"; then
    echo "FALLO     $nombre"
    echo "$salida"
    exit 1
  fi
  echo "aplicada  $nombre"
done

estado=0
for t in "$@"; do
  salida="$("${PSQL[@]}" -f "$t" 2>&1 || true)"
  if grep -q "_OK_ROLLBACK" <<<"$salida"; then
    echo "OK        $(basename "$t")"
  else
    echo "FALLO     $(basename "$t")"
    echo "$salida"
    estado=1
  fi
done
exit $estado
