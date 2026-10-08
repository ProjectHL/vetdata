#!/usr/bin/env bash
# Seed application helper for Fase 1.
# Applies 002_fase1_core.sql migrations (if not applied) then loads seeds.
#
# Usage:
#   DATABASE_URL=postgresql://vetdata:vetdata@localhost:5435/vetdata \
#     bash backend/scripts/apply_seeds.sh
#
# Requires: psql in PATH.
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-}"
if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
SEEDS_DIR="$BACKEND_DIR/seeds"

echo ">> Applying Fase 1 seeds from $SEEDS_DIR"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SEEDS_DIR/002_fase1_seeds.sql"

echo ">> Seeds applied OK"
