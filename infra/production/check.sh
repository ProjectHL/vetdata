#!/bin/sh
set -eu
# Run inside the private maintenance network with PostgreSQL client and wget.
: "${BACKUP_ROOT:=/backups}" "${MAX_BACKUP_AGE_MINUTES:=1500}" "${MAX_DISK_PERCENT:=85}"
failed=0
wget -q --spider "${HEALTH_URL:-http://api:4000/healthz}" || { echo 'ALERT api_unavailable'; failed=1; }
recent=$(find "$BACKUP_ROOT" -name COMPLETE -mmin "-$MAX_BACKUP_AGE_MINUTES" | head -n 1)
test -n "$recent" || { echo 'ALERT backup_stale'; failed=1; }
if test -n "$recent"; then
  backup_dir=$(dirname "$recent")
  if ! (cd "$backup_dir" && test -s database.dump && test -f migrations.txt && test -f manifest.txt && test -s SHA256SUMS && sha256sum -c SHA256SUMS >/dev/null 2>&1); then
    echo 'ALERT backup_integrity'
    failed=1
  fi
fi
used=$(df -P "$BACKUP_ROOT" | awk 'NR==2 {gsub(/%/,"",$5);print $5}')
test "$used" -lt "$MAX_DISK_PERCENT" || { echo 'ALERT backup_disk_capacity'; failed=1; }
errors=$(psql -X -At -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM notification_outbox WHERE sent_at IS NULL AND attempts >= 3')
test "$errors" = 0 || { echo 'ALERT mail_delivery_failures'; failed=1; }
exit "$failed"
