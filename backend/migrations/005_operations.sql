CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE doctors ADD CONSTRAINT doctors_id_clinic UNIQUE(id,clinic_id);
CREATE TABLE rooms (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id),
 name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'box' CHECK(kind IN ('box','quirofano','imagen','laboratorio','hospitalizacion','comun')),
 status TEXT NOT NULL DEFAULT 'disponible' CHECK(status IN ('disponible','ocupado','limpieza')),
 doctor_id UUID, patient_id UUID REFERENCES patients(id), since TIMESTAMPTZ,
 FOREIGN KEY(doctor_id,clinic_id) REFERENCES doctors(id,clinic_id), UNIQUE(id,clinic_id),
 CHECK((status='ocupado' AND doctor_id IS NOT NULL AND patient_id IS NOT NULL AND kind<>'comun') OR (status<>'ocupado' AND doctor_id IS NULL AND patient_id IS NULL))
);
CREATE UNIQUE INDEX occupied_doctor ON rooms(doctor_id) WHERE status='ocupado';
CREATE UNIQUE INDEX occupied_patient ON rooms(clinic_id,patient_id) WHERE status='ocupado';
CREATE TABLE appointments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id), patient_id UUID NOT NULL REFERENCES patients(id),
 doctor_id UUID NOT NULL, room_id UUID, starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
 reason TEXT NOT NULL CHECK(length(reason)>0),
 status TEXT NOT NULL DEFAULT 'Agendada' CHECK(status IN ('Agendada','Confirmada','Realizada','Cancelada','No asistió')),
 emergency BOOLEAN NOT NULL DEFAULT FALSE, created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(doctor_id,clinic_id) REFERENCES doctors(id,clinic_id), FOREIGN KEY(room_id,clinic_id) REFERENCES rooms(id,clinic_id),
 CHECK(ends_at>starts_at), UNIQUE(id,clinic_id),
 EXCLUDE USING gist (doctor_id WITH =,tstzrange(starts_at,ends_at,'[)') WITH &&) WHERE (status IN ('Agendada','Confirmada'))
);
CREATE INDEX appointments_clinic_time ON appointments(clinic_id,starts_at,id);
CREATE UNIQUE INDEX appointment_active_room ON appointments(room_id) WHERE room_id IS NOT NULL AND status IN ('Agendada','Confirmada');
CREATE TABLE waiting_entries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id),
 appointment_id UUID NOT NULL UNIQUE, arrived_at TIMESTAMPTZ NOT NULL DEFAULT now(), called_at TIMESTAMPTZ,
 FOREIGN KEY(appointment_id,clinic_id) REFERENCES appointments(id,clinic_id)
);
CREATE INDEX waiting_clinic ON waiting_entries(clinic_id,arrived_at);
CREATE TABLE access_entries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id),
 appointment_id UUID NOT NULL UNIQUE, actor_id UUID NOT NULL REFERENCES users(id), arrived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(appointment_id,clinic_id) REFERENCES appointments(id,clinic_id)
);
CREATE TABLE room_history (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id), room_id UUID NOT NULL,
 status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), FOREIGN KEY(room_id,clinic_id) REFERENCES rooms(id,clinic_id)
);
CREATE INDEX room_history_clinic_time ON room_history(clinic_id,created_at);
CREATE TABLE suppliers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id),
 kind TEXT NOT NULL CHECK(kind IN ('pharmacy','retail')), name TEXT NOT NULL, rut TEXT NOT NULL,
 email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', UNIQUE(id,clinic_id), UNIQUE(clinic_id,kind,rut)
);
CREATE TABLE catalog_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id),
 kind TEXT NOT NULL CHECK(kind IN ('medication','product','service')), name TEXT NOT NULL CHECK(length(name)>0),
 price_net BIGINT NOT NULL CHECK(price_net>=0 AND price_net<=1000000000), unit_cost BIGINT NOT NULL DEFAULT 0 CHECK(unit_cost>=0),
 supplier_id UUID, category TEXT NOT NULL DEFAULT '', details JSONB NOT NULL DEFAULT '{}',
 min_stock INT NOT NULL DEFAULT 0 CHECK(min_stock>=0), active BOOLEAN NOT NULL DEFAULT TRUE,
 FOREIGN KEY(supplier_id,clinic_id) REFERENCES suppliers(id,clinic_id), UNIQUE(id,clinic_id)
);
CREATE INDEX catalog_clinic_kind ON catalog_items(clinic_id,kind,id);
CREATE TABLE stock_lots (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id), item_id UUID NOT NULL,
 location TEXT NOT NULL CHECK(location IN ('pharmacy','central','sala')), lot TEXT NOT NULL, expiry DATE,
 qty INT NOT NULL DEFAULT 0 CHECK(qty>=0), unit_cost BIGINT NOT NULL CHECK(unit_cost>=0),
 FOREIGN KEY(item_id,clinic_id) REFERENCES catalog_items(id,clinic_id), UNIQUE(item_id,location,lot), UNIQUE(id,clinic_id)
);
CREATE INDEX stock_item_location_expiry ON stock_lots(item_id,location,expiry,id);
CREATE TABLE inventory_movements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id), item_id UUID NOT NULL,
 lot_id UUID NOT NULL, qty INT NOT NULL CHECK(qty<>0), reason TEXT NOT NULL, reference_id UUID,
 actor_id UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(item_id,clinic_id) REFERENCES catalog_items(id,clinic_id), FOREIGN KEY(lot_id,clinic_id) REFERENCES stock_lots(id,clinic_id)
);
CREATE INDEX movements_clinic_time ON inventory_movements(clinic_id,created_at,id);
CREATE TRIGGER movement_immutable BEFORE UPDATE OR DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();
CREATE TABLE purchase_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id),
 kind TEXT NOT NULL CHECK(kind IN ('pharmacy','retail')), supplier_id UUID NOT NULL, number BIGINT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Borrador' CHECK(status IN ('Borrador','Enviada','Parcialmente recibida','Recibida')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), FOREIGN KEY(supplier_id,clinic_id) REFERENCES suppliers(id,clinic_id),
 UNIQUE(id,clinic_id), UNIQUE(clinic_id,kind,number)
);
CREATE TABLE purchase_order_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL, clinic_id UUID NOT NULL, item_id UUID NOT NULL,
 qty INT NOT NULL CHECK(qty>0), received INT NOT NULL DEFAULT 0 CHECK(received>=0 AND received<=qty),
 unit_cost BIGINT NOT NULL CHECK(unit_cost>=0),
 FOREIGN KEY(order_id,clinic_id) REFERENCES purchase_orders(id,clinic_id),
 FOREIGN KEY(item_id,clinic_id) REFERENCES catalog_items(id,clinic_id), UNIQUE(order_id,item_id)
);
CREATE TABLE invoices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id), owner_id UUID NOT NULL,
 patient_id UUID REFERENCES patients(id), number BIGINT NOT NULL,
 net BIGINT NOT NULL CHECK(net>=0), vat BIGINT NOT NULL CHECK(vat>=0), total BIGINT NOT NULL CHECK(total=net+vat),
 paid BIGINT NOT NULL DEFAULT 0 CHECK(paid>=0 AND paid<=total), items JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), actor_id UUID NOT NULL REFERENCES users(id),
 FOREIGN KEY(clinic_id,owner_id) REFERENCES clinic_owners(clinic_id,owner_id), UNIQUE(clinic_id,number), UNIQUE(id,clinic_id)
);
CREATE INDEX invoices_clinic_time ON invoices(clinic_id,created_at,id);
CREATE TABLE payments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL, invoice_id UUID NOT NULL,
 amount BIGINT NOT NULL CHECK(amount>0), method TEXT NOT NULL CHECK(method IN ('Efectivo','Débito','Crédito','Transferencia')),
 actor_id UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(invoice_id,clinic_id) REFERENCES invoices(id,clinic_id)
);
CREATE INDEX payments_clinic_invoice ON payments(clinic_id,invoice_id);
CREATE TRIGGER payment_immutable BEFORE UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();
CREATE TABLE referrals (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id),
 patient_id UUID NOT NULL REFERENCES patients(id), prescription_id UUID NOT NULL REFERENCES clinical_records(id),
 items JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'Enviada' CHECK(status IN ('Enviada','Dispensada')),
 expires_on DATE NOT NULL, actor_id UUID NOT NULL REFERENCES users(id), dispensed_at TIMESTAMPTZ, invoiced_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(id,clinic_id)
);
CREATE INDEX referrals_clinic ON referrals(clinic_id,created_at,id);
CREATE TABLE attachments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL REFERENCES patients(id),
 record_id UUID NOT NULL REFERENCES clinical_records(id), clinic_id UUID NOT NULL REFERENCES clinics(id),
 storage_key TEXT NOT NULL UNIQUE, mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png')),
 size_bytes INT NOT NULL CHECK(size_bytes>0 AND size_bytes<=10485760),
 status TEXT NOT NULL DEFAULT 'quarantine' CHECK(status IN ('quarantine','clean','rejected')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
