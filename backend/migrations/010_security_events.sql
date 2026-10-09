CREATE TABLE security_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id),
 zone TEXT NOT NULL CHECK(zone IN ('hall','espera','boxes','tienda','bodega','farmacia')),
 camera_ref TEXT NOT NULL DEFAULT '' CHECK(length(camera_ref)<=120),
 type TEXT NOT NULL CHECK(type IN ('Movimiento fuera de horario','Puerta forzada','Puerta abierta','Acceso no autorizado','Aforo excedido','Cámara sin señal','Caja abierta sin venta','Botón de pánico','Marcado manual')),
 severity TEXT NOT NULL CHECK(severity IN ('Crítica','Alta','Media','Baja')),
 status TEXT NOT NULL DEFAULT 'Nuevo' CHECK(status IN ('Nuevo','En revisión','Resuelto','Falsa alarma')),
 assignee_id UUID REFERENCES users(id),
 linked_event_id UUID REFERENCES security_events(id),
 resolved_at TIMESTAMPTZ,
 actor_id UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(id,clinic_id),
 CHECK((status IN ('Resuelto','Falsa alarma') AND resolved_at IS NOT NULL) OR (status IN ('Nuevo','En revisión') AND resolved_at IS NULL))
);
CREATE INDEX security_events_clinic_status ON security_events(clinic_id,status,created_at,id);
CREATE TABLE security_event_notes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_id UUID NOT NULL, clinic_id UUID NOT NULL,
 text TEXT NOT NULL CHECK(length(text)>0 AND length(text)<=2000),
 actor_id UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(event_id,clinic_id) REFERENCES security_events(id,clinic_id)
);
CREATE INDEX security_event_notes_event ON security_event_notes(event_id,created_at,id);
CREATE TABLE security_settings (
 clinic_id UUID PRIMARY KEY REFERENCES clinics(id),
 retention_days INT NOT NULL DEFAULT 30 CHECK(retention_days IN (15,30,60,90)),
 privacy_in_boxes BOOLEAN NOT NULL DEFAULT TRUE,
 after_hours_from TEXT NOT NULL DEFAULT '20:00',
 after_hours_to TEXT NOT NULL DEFAULT '08:00',
 auto_arm BOOLEAN NOT NULL DEFAULT FALSE,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
