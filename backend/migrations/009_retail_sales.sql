CREATE TABLE retail_sales (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id),
 number BIGINT NOT NULL, owner_id UUID, payment TEXT NOT NULL CHECK(payment IN ('Efectivo','Débito','Crédito','Transferencia')),
 delivery_fee_net BIGINT NOT NULL DEFAULT 0 CHECK(delivery_fee_net>=0),
 net BIGINT NOT NULL CHECK(net>=0), vat BIGINT NOT NULL CHECK(vat>=0), total BIGINT NOT NULL CHECK(total=net+vat),
 channel TEXT NOT NULL DEFAULT 'Mesón' CHECK(channel IN ('Mesón','Web')),
 actor_id UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(clinic_id,owner_id) REFERENCES clinic_owners(clinic_id,owner_id),
 UNIQUE(id,clinic_id), UNIQUE(clinic_id,number)
);
CREATE INDEX retail_sales_clinic_time ON retail_sales(clinic_id,created_at,id);
CREATE TABLE retail_sale_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sale_id UUID NOT NULL, clinic_id UUID NOT NULL, item_id UUID NOT NULL,
 qty INT NOT NULL CHECK(qty>0), unit_price_net BIGINT NOT NULL CHECK(unit_price_net>=0),
 FOREIGN KEY(sale_id,clinic_id) REFERENCES retail_sales(id,clinic_id),
 FOREIGN KEY(item_id,clinic_id) REFERENCES catalog_items(id,clinic_id), UNIQUE(sale_id,item_id)
);
CREATE TABLE shipments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id UUID NOT NULL REFERENCES clinics(id),
 sale_id UUID NOT NULL, owner_id UUID NOT NULL, address TEXT NOT NULL DEFAULT '', sector TEXT NOT NULL DEFAULT '',
 courier TEXT NOT NULL CHECK(courier IN ('Reparto propio','Pedidos Ya Envíos','Chilexpress')),
 scheduled_for DATE NOT NULL, delivered_at TIMESTAMPTZ,
 status TEXT NOT NULL DEFAULT 'Por preparar' CHECK(status IN ('Por preparar','Preparado','En ruta','Entregado')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(id,clinic_id),
 FOREIGN KEY(sale_id,clinic_id) REFERENCES retail_sales(id,clinic_id),
 FOREIGN KEY(clinic_id,owner_id) REFERENCES clinic_owners(clinic_id,owner_id)
);
CREATE INDEX shipments_clinic_status ON shipments(clinic_id,status,scheduled_for,id);
