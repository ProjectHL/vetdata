-- T3-5: flag de receta para medicamentos controlados.
ALTER TABLE catalog_items ADD COLUMN prescription_required BOOLEAN NOT NULL DEFAULT FALSE;
