#!/bin/sh
set -eu
umask 077
export PGPASSWORD="$(cat "${PGPASSWORD_FILE:-/run/secrets/db_password}")"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="/backups/$stamp"
mkdir "$target"
trap 'rm -f "$target/database.dump.partial"' EXIT
pg_dump --format=custom --no-owner --no-acl --file="$target/database.dump.partial"
pg_restore --list "$target/database.dump.partial" >/dev/null
mv "$target/database.dump.partial" "$target/database.dump"
psql -X -At -v ON_ERROR_STOP=1 -c 'SELECT version FROM schema_migrations ORDER BY version' >"$target/migrations.txt"
printf 'release=%s\ncreated_utc=%s\npostgres_major=17\n' "${RELEASE:?}" "$stamp" >"$target/manifest.txt"
(cd "$target" && sha256sum database.dump migrations.txt manifest.txt >SHA256SUMS)
touch "$target/COMPLETE"
printf 'backup_complete=%s\n' "$stamp"
