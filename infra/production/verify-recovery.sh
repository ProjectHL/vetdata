#!/bin/sh
set -eu
# Synthetic databases only, inside vetdata-phase7-verify. No host DB ports.
test "$PGDATABASE" = phase7_fixture
export PGPASSWORD=test-only
printf 'test-only\n' >/tmp/fixture-password
export PGPASSWORD_FILE=/tmp/fixture-password RELEASE=phase7-fixture
psql -X -v ON_ERROR_STOP=1 -f /ops/recovery-fixtures.sql
fingerprint() {
  psql -X -At -v ON_ERROR_STOP=1 -c "SELECT '$1',count(*),md5(coalesce(string_agg(row_to_json(t)::text,E'\n' ORDER BY row_to_json(t)::text),'')) FROM $1 t"
}
tables='schema_migrations users memberships role_permissions owners clinic_owners patients sharing_grants stock_lots invoices payments'
for table in $tables; do fingerprint "$table"; done >/tmp/before
for table in sharing_grants stock_lots invoices payments; do
  test "$(psql -X -At -c "SELECT count(*) FROM $table")" -gt 0
done
sh /ops/backup.sh
export BACKUP_DIR
BACKUP_DIR=$(find /backups -name COMPLETE | head -n 1 | sed 's,/COMPLETE$,,')
test -n "$BACKUP_DIR"
createdb phase7_restored
export PGDATABASE=phase7_restored
sh /ops/restore.sh
for table in $tables; do fingerprint "$table"; done >/tmp/after
diff -u /tmp/before /tmp/after
if sh /ops/restore.sh; then echo 'FAIL: nonempty destination accepted'; exit 1; fi
createdb phase7_corrupt
export PGDATABASE=phase7_corrupt
printf 'corruption' >>"$BACKUP_DIR/database.dump"
if sh /ops/restore.sh; then echo 'FAIL: corrupted dump accepted'; exit 1; fi
echo 'PASS: restore fingerprint, nonempty refusal, corrupt refusal'
