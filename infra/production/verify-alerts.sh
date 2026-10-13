#!/bin/sh
set -eu
test "$PGDATABASE" = phase7_fixture
export PGPASSWORD=test-only HEALTH_URL=http://restored-api:4000/healthz
mkdir -p /backups
printf 'synthetic backup\n' >/backups/database.dump
printf 'fixture migration\n' >/backups/migrations.txt
printf 'release=fixture\n' >/backups/manifest.txt
(cd /backups && sha256sum database.dump migrations.txt manifest.txt >SHA256SUMS)
touch /backups/COMPLETE
sh /ops/check.sh
expect_alert() {
  expected="$1"; shift
  if "$@" >/tmp/check-output 2>&1; then echo "FAIL expected $expected"; exit 1; fi
  grep "ALERT $expected" /tmp/check-output
}
expect_alert api_unavailable env HEALTH_URL=http://127.0.0.1:1/healthz sh /ops/check.sh
expect_alert backup_stale env MAX_BACKUP_AGE_MINUTES=0 sh /ops/check.sh
printf 'corruption\n' >>/backups/database.dump
expect_alert backup_integrity sh /ops/check.sh
printf 'synthetic backup\n' >/backups/database.dump
expect_alert backup_disk_capacity env MAX_DISK_PERCENT=0 sh /ops/check.sh
trap "psql -X -v ON_ERROR_STOP=1 -c \"DELETE FROM notification_outbox WHERE dedup_key='phase7-alert-fixture'\" >/dev/null" EXIT
psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO notification_outbox(dedup_key,attempts) VALUES('phase7-alert-fixture',3)" >/dev/null
expect_alert mail_delivery_failures sh /ops/check.sh
echo 'PASS: healthy baseline and five controlled alert conditions'
