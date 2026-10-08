-- 001_init: base schema placeholder.
-- Real tables land in Fase 1 (T1-1..T1-3): groups, clinics, memberships, users.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
