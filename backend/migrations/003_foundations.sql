-- Incremental foundations: existing 001/002 installations are preserved.
CREATE UNIQUE INDEX users_email_ci ON users (lower(email));
CREATE UNIQUE INDEX doctors_clinic_user ON doctors(clinic_id,user_id) WHERE user_id IS NOT NULL;

CREATE TABLE auth_sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id),
 clinic_id UUID NOT NULL REFERENCES clinics(id),
 access_hash TEXT NOT NULL UNIQUE,
 access_expires_at TIMESTAMPTZ NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY (user_id,clinic_id) REFERENCES memberships(user_id,clinic_id)
);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX auth_sessions_clinic ON auth_sessions(clinic_id);
CREATE TABLE auth_refresh_tokens (
 token_hash TEXT PRIMARY KEY,
 session_id UUID NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
 used_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_refresh_session ON auth_refresh_tokens(session_id);
CREATE TABLE auth_action_tokens (
 token_hash TEXT PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES users(id),
 purpose TEXT NOT NULL CHECK (purpose IN ('recovery','invitation')),
 clinic_id UUID REFERENCES clinics(id),
 expires_at TIMESTAMPTZ NOT NULL,
 used_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_action_user ON auth_action_tokens(user_id);
CREATE TABLE rate_limits (
 key TEXT PRIMARY KEY,
 hits INT NOT NULL CHECK(hits>0),
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE notification_outbox (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 dedup_key TEXT NOT NULL UNIQUE,
 encrypted_message BYTEA,
 attempts INT NOT NULL DEFAULT 0,
 available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 locked_until TIMESTAMPTZ,
 sent_at TIMESTAMPTZ,
 last_error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notification_pending ON notification_outbox(available_at) WHERE sent_at IS NULL;
CREATE TABLE audit_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id UUID REFERENCES clinics(id),
 actor_id UUID REFERENCES users(id),
 action TEXT NOT NULL,
 resource_id TEXT,
 details JSONB NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_clinic_time ON audit_events(clinic_id,created_at DESC,id);
CREATE FUNCTION forbid_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit records are append-only'; END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();

CREATE TABLE clinic_owners (
 clinic_id UUID NOT NULL REFERENCES clinics(id),
 owner_id UUID NOT NULL REFERENCES owners(id),
 balance BIGINT NOT NULL DEFAULT 0,
 notes TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(clinic_id,owner_id)
);
CREATE INDEX clinic_owners_owner ON clinic_owners(owner_id);
CREATE TABLE idempotency_keys (
 clinic_id UUID NOT NULL REFERENCES clinics(id),
 actor_id UUID NOT NULL REFERENCES users(id),
 key TEXT NOT NULL,
 operation TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 response JSONB NOT NULL,
 status INT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(clinic_id,actor_id,operation,key)
);
CREATE TABLE counters (
 clinic_id UUID NOT NULL REFERENCES clinics(id),
 kind TEXT NOT NULL,
 value BIGINT NOT NULL CHECK(value>0),
 PRIMARY KEY(clinic_id,kind)
);
CREATE TABLE clinic_hours (
 clinic_id UUID NOT NULL REFERENCES clinics(id),
 weekday INT NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 starts_at TIME NOT NULL,
 ends_at TIME NOT NULL,
 slot_minutes INT NOT NULL DEFAULT 30 CHECK(slot_minutes BETWEEN 5 AND 240),
 PRIMARY KEY(clinic_id,weekday,starts_at),
 CHECK(starts_at<ends_at)
);
CREATE TABLE doctor_hours (
 doctor_id UUID NOT NULL REFERENCES doctors(id),
 weekday INT NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 starts_at TIME NOT NULL,
 ends_at TIME NOT NULL,
 PRIMARY KEY(doctor_id,weekday,starts_at),
 CHECK(starts_at<ends_at)
);
CREATE TABLE clinic_holidays (
 clinic_id UUID NOT NULL REFERENCES clinics(id),
 day DATE NOT NULL,
 name TEXT NOT NULL,
 PRIMARY KEY(clinic_id,day)
);

-- Product decision p-10. No legacy clinic may authorize owner consent.
DELETE FROM role_permissions WHERE permission IN ('red.aprobar','red.revocar');
INSERT INTO role_permissions(clinic_id,role,permission)
SELECT id,'Admin','red.suspender' FROM clinics ON CONFLICT DO NOTHING;
ALTER TABLE role_permissions ADD CONSTRAINT no_legacy_sharing_permissions
CHECK(permission NOT IN ('red.aprobar','red.revocar'));
ALTER TABLE role_permissions ADD CONSTRAINT suspension_admin_only
CHECK(permission<>'red.suspender' OR role='Admin');
