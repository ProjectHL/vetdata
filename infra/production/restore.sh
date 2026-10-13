#!/bin/sh
set -eu
# Explicit existing EMPTY destination. Never drops or cleans an existing database.
: "${PGHOST:?}" "${PGDATABASE:?}" "${PGUSER:?}" "${BACKUP_DIR:?}"
test -f "$BACKUP_DIR/COMPLETE"
(cd "$BACKUP_DIR" && sha256sum -c SHA256SUMS)
pg_restore --list "$BACKUP_DIR/database.dump" >/dev/null
tables=$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S')")
test "$tables" = 0 || { echo 'restore_refused_nonempty_database' >&2; exit 1; }
pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname="$PGDATABASE" "$BACKUP_DIR/database.dump"
echo restore_complete
