CREATE TABLE auth_mfa (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 enabled BOOLEAN NOT NULL DEFAULT false,
 recovery_hashes TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE auth_mfa_challenges (
 token_hash TEXT PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 clinic_id UUID NOT NULL REFERENCES clinics(id),
 expires_at TIMESTAMPTZ NOT NULL,
 used_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,clinic_id) REFERENCES memberships(user_id,clinic_id)
);
CREATE INDEX auth_mfa_challenges_user ON auth_mfa_challenges(user_id,clinic_id);
