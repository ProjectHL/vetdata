-- VetData backoffice lives in a dedicated tenant that no clinic session can
-- reach. STAFF_CLINIC_ID is stable and documented in docs/backend/dominios/soporte.md.
CREATE TABLE IF NOT EXISTS staff_clinic (
 clinic_id UUID PRIMARY KEY REFERENCES clinics(id)
);
-- Stable backoffice tenant: group + clinic + marker. Sessions bound here are
-- Staff; clinic sessions can never switch into it (see switchClinic guard).
INSERT INTO groups(id,name) VALUES('00000000-0000-0000-0000-000000000001','VetData Staff') ON CONFLICT DO NOTHING;
INSERT INTO clinics(id,group_id,name,sector,address,phone,email,status,joined_at)
 VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','VetData Staff','Santiago','Interno','+56000000000','staff@vetdata.cl','Conectada',current_date)
 ON CONFLICT(id) DO NOTHING;
INSERT INTO staff_clinic(clinic_id) VALUES('00000000-0000-0000-0000-000000000002') ON CONFLICT DO NOTHING;

CREATE TABLE support_tickets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id),
 number BIGINT NOT NULL, title TEXT NOT NULL CHECK(length(title)>0 AND length(title)<=200),
 category TEXT NOT NULL CHECK(category IN ('Incidencia','Mejora','Consulta','Integración / datos','Facturación del servicio')),
 priority TEXT NOT NULL CHECK(priority IN ('Crítica','Alta','Media','Baja')),
 module TEXT NOT NULL CHECK(length(module)>0 AND length(module)<=200),
 status TEXT NOT NULL DEFAULT 'Nuevo' CHECK(status IN ('Nuevo','En revisión','En progreso','Esperando cliente','Resuelto','Cerrado')),
 created_by UUID NOT NULL REFERENCES users(id),
 context_route TEXT NOT NULL DEFAULT '', context_role TEXT NOT NULL DEFAULT '',
 first_response_at TIMESTAMPTZ, idea_id UUID, rating INT CHECK(rating IS NULL OR (rating>=1 AND rating<=5)),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(id,clinic_id)
);
-- Ticket numbers are global to VetData (count across clinics in code).
CREATE INDEX support_tickets_clinic_status ON support_tickets(clinic_id,status,created_at,id);
CREATE TABLE support_messages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id UUID NOT NULL, clinic_id UUID NOT NULL,
 side TEXT NOT NULL CHECK(side IN ('Clínica','VetData')),
 author_id UUID NOT NULL REFERENCES users(id), body TEXT NOT NULL CHECK(length(body)>0 AND length(body)<=5000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(ticket_id,clinic_id) REFERENCES support_tickets(id,clinic_id)
);
CREATE INDEX support_messages_ticket ON support_messages(ticket_id,created_at,id);
CREATE TABLE support_ideas (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 title TEXT NOT NULL CHECK(length(title)>0 AND length(title)<=200),
 description TEXT NOT NULL CHECK(length(description)>0 AND length(description)<=2000),
 module TEXT NOT NULL CHECK(length(module)>0 AND length(module)<=200),
 status TEXT NOT NULL DEFAULT 'En evaluación' CHECK(status IN ('En evaluación','Planificada','En desarrollo','Lanzada')),
 proposed_by UUID NOT NULL REFERENCES clinics(id),
 release_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE support_votes (
 idea_id UUID NOT NULL REFERENCES support_ideas(id),
 clinic_id UUID NOT NULL REFERENCES clinics(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(idea_id,clinic_id)
);
CREATE TABLE support_releases (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), version TEXT NOT NULL UNIQUE CHECK(length(version)>0 AND length(version)<=50),
 released_on DATE NOT NULL, items JSONB NOT NULL DEFAULT '[]',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE support_ideas ADD CONSTRAINT support_ideas_release_fk FOREIGN KEY(release_id) REFERENCES support_releases(id);
