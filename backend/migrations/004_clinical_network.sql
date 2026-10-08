-- Domain identity and sharing. No demo consent is promoted to authorization.
ALTER TABLE memberships ADD COLUMN status TEXT NOT NULL DEFAULT 'Activo'
 CHECK(status IN ('Activo','Invitado','Inactivo'));
UPDATE memberships m SET status=u.status FROM users u WHERE u.id=m.user_id;

CREATE TABLE patients (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id UUID NOT NULL REFERENCES owners(id),
 origin_clinic_id UUID NOT NULL REFERENCES clinics(id),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 species TEXT NOT NULL CHECK(species IN ('Perro','Gato','Ave','Conejo')),
 breed TEXT NOT NULL DEFAULT '',
 sex TEXT NOT NULL CHECK(sex IN ('Macho','Hembra')),
 birth_date DATE NOT NULL,
 color TEXT NOT NULL DEFAULT '',
 sterilized BOOLEAN NOT NULL DEFAULT FALSE,
 weight_kg NUMERIC(8,3) NOT NULL DEFAULT 0 CHECK(weight_kg>=0),
 chip TEXT NOT NULL DEFAULT '',
 allergies TEXT[] NOT NULL DEFAULT '{}',
 conditions TEXT[] NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(id,origin_clinic_id)
);
CREATE INDEX patients_owner ON patients(owner_id);
CREATE INDEX patients_origin ON patients(origin_clinic_id,id);
CREATE TABLE clinical_records (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 patient_id UUID NOT NULL REFERENCES patients(id),
 clinic_id UUID NOT NULL REFERENCES clinics(id),
 actor_id UUID NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('consultation','vaccine','exam','prescription','correction','annulment')),
 payload JSONB NOT NULL,
 corrects_id UUID REFERENCES clinical_records(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX records_patient_time ON clinical_records(patient_id,created_at,id);
CREATE INDEX records_clinic ON clinical_records(clinic_id);
CREATE TRIGGER clinical_records_immutable BEFORE UPDATE OR DELETE ON clinical_records
FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();

CREATE TABLE sharing_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 patient_id UUID NOT NULL REFERENCES patients(id),
 requesting_clinic_id UUID NOT NULL REFERENCES clinics(id),
 origin_clinic_id UUID NOT NULL REFERENCES clinics(id),
 requested_by UUID NOT NULL REFERENCES users(id),
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 1 AND 2000),
 scope TEXT NOT NULL CHECK(scope IN ('Ficha completa','Resumen clínico')),
 duration INT CHECK(duration IN (30,90)),
 status TEXT NOT NULL DEFAULT 'Esperando dueño' CHECK(status IN ('Esperando dueño','Aprobada','Denegada','Expirada','Cancelada')),
 token_hash TEXT NOT NULL UNIQUE,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '72 hours',
 responded_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 previous_request_id UUID REFERENCES sharing_requests(id),
 CHECK(requesting_clinic_id<>origin_clinic_id),
 FOREIGN KEY(patient_id,origin_clinic_id) REFERENCES patients(id,origin_clinic_id)
);
CREATE UNIQUE INDEX sharing_one_pending ON sharing_requests(patient_id,requesting_clinic_id) WHERE status='Esperando dueño';
CREATE INDEX sharing_request_origin ON sharing_requests(origin_clinic_id,created_at);
CREATE INDEX sharing_request_recipient ON sharing_requests(requesting_clinic_id,created_at);
CREATE TABLE sharing_grants (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id UUID NOT NULL UNIQUE REFERENCES sharing_requests(id),
 patient_id UUID NOT NULL REFERENCES patients(id),
 origin_clinic_id UUID NOT NULL REFERENCES clinics(id),
 granted_to UUID NOT NULL REFERENCES clinics(id),
 owner_id UUID NOT NULL REFERENCES owners(id),
 scope TEXT NOT NULL CHECK(scope IN ('Ficha completa','Resumen clínico')),
 since DATE NOT NULL,
 until DATE,
 revoked_at TIMESTAMPTZ,
 suspended_at TIMESTAMPTZ,
 suspension_reason TEXT,
 suspended_by UUID REFERENCES users(id),
 consent_ip INET NOT NULL,
 consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 consent_method TEXT NOT NULL DEFAULT 'email-link' CHECK(consent_method='email-link'),
 CHECK(origin_clinic_id<>granted_to),
 CHECK(until IS NULL OR until>=since),
 FOREIGN KEY(patient_id,origin_clinic_id) REFERENCES patients(id,origin_clinic_id)
);
CREATE INDEX sharing_grants_access ON sharing_grants(patient_id,granted_to) WHERE revoked_at IS NULL;
CREATE INDEX sharing_grants_owner ON sharing_grants(owner_id);
CREATE INDEX sharing_grants_origin ON sharing_grants(origin_clinic_id);
CREATE TABLE owner_sessions (
 token_hash TEXT PRIMARY KEY,
 owner_id UUID NOT NULL REFERENCES owners(id),
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE owner_login_tokens (
 token_hash TEXT PRIMARY KEY,
 owner_id UUID NOT NULL REFERENCES owners(id),
 expires_at TIMESTAMPTZ NOT NULL,
 used_at TIMESTAMPTZ
);
CREATE TABLE shared_read_audit (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 patient_id UUID NOT NULL REFERENCES patients(id),
 grant_id UUID NOT NULL REFERENCES sharing_grants(id),
 owner_id UUID NOT NULL REFERENCES owners(id),
 origin_clinic_id UUID NOT NULL REFERENCES clinics(id),
 reader_clinic_id UUID NOT NULL REFERENCES clinics(id),
 reader_user_id UUID NOT NULL REFERENCES users(id),
 scope TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shared_audit_owner ON shared_read_audit(owner_id,created_at DESC,id);
CREATE INDEX shared_audit_origin ON shared_read_audit(origin_clinic_id,created_at DESC,id);
CREATE TRIGGER shared_audit_immutable BEFORE UPDATE OR DELETE ON shared_read_audit
FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();
CREATE TABLE task_meta (
 clinic_id UUID NOT NULL REFERENCES clinics(id),
 task_id TEXT NOT NULL,
 assignee UUID REFERENCES users(id),
 done BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(clinic_id,task_id)
);
