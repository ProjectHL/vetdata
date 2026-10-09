-- T3-7: opt-out de recordatorios por clínica.
ALTER TABLE clinic_owners ADD COLUMN reminder_opt_out BOOLEAN NOT NULL DEFAULT FALSE;
