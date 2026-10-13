-- Provider-neutral persistence only; no production adapter or emission enabled.
CREATE TABLE dte_documents (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id UUID NOT NULL REFERENCES clinics(id),
 invoice_id UUID NOT NULL,
 document_type INT NOT NULL CHECK(document_type IN (33,39)),
 provider TEXT NOT NULL CHECK(length(provider)>0),
 idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 128),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','uncertain','accepted','issued','rejected')),
 provider_ref TEXT,
 folio TEXT,
 document_ref TEXT,
 revision BIGINT NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(invoice_id,clinic_id) REFERENCES invoices(id,clinic_id),
 UNIQUE(clinic_id,idempotency_key),
 UNIQUE(clinic_id,invoice_id),
 UNIQUE(provider,provider_ref),
 CHECK(state NOT IN ('accepted','issued','rejected') OR provider_ref IS NOT NULL),
 CHECK(state <> 'issued' OR (length(folio)>0 AND length(document_ref)>0 AND folio IS NOT NULL AND document_ref IS NOT NULL))
);
CREATE INDEX dte_reconcile ON dte_documents(updated_at,id) WHERE state IN ('sending','uncertain','accepted');
CREATE TABLE dte_attempts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id UUID NOT NULL REFERENCES dte_documents(id),
 operation TEXT NOT NULL CHECK(operation IN ('issue','reconcile')),
 result TEXT NOT NULL DEFAULT 'started',
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 finished_at TIMESTAMPTZ
);
CREATE INDEX dte_attempt_document ON dte_attempts(document_id,started_at);
CREATE TABLE dte_events (
 provider TEXT NOT NULL,
 event_id TEXT NOT NULL,
 document_id UUID NOT NULL REFERENCES dte_documents(id),
 payload_hash TEXT NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(provider,event_id)
);
CREATE INDEX dte_event_document ON dte_events(document_id,received_at);
CREATE TRIGGER dte_event_immutable BEFORE UPDATE OR DELETE ON dte_events FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();
