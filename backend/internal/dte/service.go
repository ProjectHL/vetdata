// Package dte is provider-neutral preparation. Production does not register a
// provider or expose issuance routes until D-05 certification is complete.
package dte

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
)

var ErrConflict = errors.New("DTE conflict")
var ErrDisabled = errors.New("DTE provider disabled")

type Request struct {
	Key, ClinicID, InvoiceID string
	Type                     int
	Net, VAT, Total          int64
	Items                    json.RawMessage
}
type Result struct {
	State, Reference, Folio, Document string
	Revision                          int64
}
type Event struct {
	ID, Key string
	Result  Result
}
type Provider interface {
	// Name is the stable provider/account namespace, configured by the operator.
	// Event identities and references must be unique within that namespace.
	Name() string
	Issue(context.Context, Request) (Result, error)
	Lookup(context.Context, string) (Result, error)
	// VerifyEvent must validate signature, age and replay identity before parsing.
	VerifyEvent(context.Context, http.Header, []byte) (Event, error)
}
type Service struct {
	DB       *pgxpool.Pool
	Provider Provider
}

func (s Service) Prepare(ctx context.Context, clinic, invoice, key string, kind int) (string, error) {
	if s.Provider == nil {
		return "", ErrDisabled
	}
	tx, e := s.DB.Begin(ctx)
	if e != nil {
		return "", e
	}
	defer tx.Rollback(context.Background())
	var id string
	e = tx.QueryRow(ctx, `INSERT INTO dte_documents(clinic_id,invoice_id,idempotency_key,document_type,provider)
 VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id`, clinic, invoice, key, kind, s.Provider.Name()).Scan(&id)
	if e == pgx.ErrNoRows {
		e = tx.QueryRow(ctx, "SELECT id FROM dte_documents WHERE clinic_id=$1 AND invoice_id=$2 AND idempotency_key=$3 AND document_type=$4 AND provider=$5", clinic, invoice, key, kind, s.Provider.Name()).Scan(&id)
		if e == pgx.ErrNoRows {
			return "", ErrConflict
		}
	}
	if e != nil {
		return "", e
	}
	return id, tx.Commit(ctx)
}

// Sending is committed before network I/O. Crash/timeout requires Lookup and
// never retries Issue, even if the provider cannot yet find the document.
func (s Service) Issue(ctx context.Context, clinic, id string) error {
	return s.perform(ctx, clinic, id, false)
}
func (s Service) Reconcile(ctx context.Context, clinic, id string) error {
	return s.perform(ctx, clinic, id, true)
}
func (s Service) perform(ctx context.Context, clinic, id string, reconcile bool) error {
	if s.Provider == nil {
		return ErrDisabled
	}
	tx, e := s.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	var req Request
	var state string
	e = tx.QueryRow(ctx, `SELECT d.id,d.clinic_id,d.invoice_id,d.document_type,i.net,i.vat,i.total,i.items,d.state FROM dte_documents d JOIN invoices i ON i.id=d.invoice_id AND i.clinic_id=d.clinic_id WHERE d.id=$1 AND d.clinic_id=$2 AND d.provider=$3 FOR UPDATE OF d`, id, clinic, s.Provider.Name()).Scan(&req.Key, &req.ClinicID, &req.InvoiceID, &req.Type, &req.Net, &req.VAT, &req.Total, &req.Items, &state)
	if e != nil {
		return e
	}
	if state == "issued" || state == "rejected" {
		return tx.Commit(ctx)
	}
	if !reconcile && state != "pending" {
		return ErrConflict
	}
	if reconcile && state == "pending" {
		return ErrConflict
	}
	op := "issue"
	if reconcile {
		op = "reconcile"
	}
	var attempt string
	if e = tx.QueryRow(ctx, "INSERT INTO dte_attempts(document_id,operation) VALUES($1,$2) RETURNING id", id, op).Scan(&attempt); e != nil {
		return e
	}
	if !reconcile {
		if _, e = tx.Exec(ctx, "UPDATE dte_documents SET state='sending',updated_at=now() WHERE id=$1", id); e != nil {
			return e
		}
	}
	if e = tx.Commit(ctx); e != nil {
		return e
	}
	var result Result
	if reconcile {
		result, e = s.Provider.Lookup(ctx, id)
	} else {
		result, e = s.Provider.Issue(ctx, req)
	}
	if e != nil {
		// Best-effort completion; an expired context leaves sending for later lookup.
		finishErr := s.finish(ctx, id, attempt, "uncertain", nil)
		if finishErr != nil {
			return finishErr
		}
		return errors.New("DTE result uncertain; reconciliation required")
	}
	if e = valid(result); e != nil {
		_ = s.finish(ctx, id, attempt, "uncertain", nil)
		return e
	}
	return s.finish(ctx, id, attempt, "received", &result)
}
func valid(r Result) error {
	if r.Revision < 1 || r.Reference == "" {
		return ErrConflict
	}
	if r.State != "accepted" && r.State != "issued" && r.State != "rejected" {
		return ErrConflict
	}
	if r.State == "issued" && (r.Folio == "" || r.Document == "") {
		return ErrConflict
	}
	return nil
}
func (s Service) finish(ctx context.Context, id, attempt, outcome string, r *Result) error {
	tx, e := s.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	if r != nil {
		if e = apply(ctx, tx, id, *r); e != nil {
			return e
		}
	} else {
		if _, e = tx.Exec(ctx, "UPDATE dte_documents SET state='uncertain',updated_at=now() WHERE id=$1 AND state='sending'", id); e != nil {
			return e
		}
	}
	if _, e = tx.Exec(ctx, "UPDATE dte_attempts SET result=$2,finished_at=now() WHERE id=$1", attempt, outcome); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func apply(ctx context.Context, tx pgx.Tx, id string, r Result) error {
	if e := valid(r); e != nil {
		return e
	}
	var state, ref string
	var revision int64
	if e := tx.QueryRow(ctx, "SELECT state,coalesce(provider_ref,''),revision FROM dte_documents WHERE id=$1 FOR UPDATE", id).Scan(&state, &ref, &revision); e != nil {
		return e
	}
	if ref != "" && ref != r.Reference {
		return ErrConflict
	}
	if r.Revision <= revision {
		return nil
	}
	if state == "issued" || state == "rejected" {
		return nil
	}
	if state == "pending" {
		return ErrConflict
	}
	_, e := tx.Exec(ctx, "UPDATE dte_documents SET state=$2,provider_ref=$3,folio=$4,document_ref=$5,revision=$6,updated_at=now() WHERE id=$1", id, r.State, r.Reference, r.Folio, r.Document, r.Revision)
	return e
}
func (s Service) Callback(ctx context.Context, headers http.Header, body []byte) error {
	if s.Provider == nil {
		return ErrDisabled
	}
	if len(body) > 1<<20 {
		return ErrConflict
	}
	event, e := s.Provider.VerifyEvent(ctx, headers, body)
	if e != nil {
		return e
	}
	if event.ID == "" {
		return ErrConflict
	}
	hash := sha256.Sum256(body)
	digest := hex.EncodeToString(hash[:])
	tx, e := s.DB.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	var id string
	if e = tx.QueryRow(ctx, "SELECT id FROM dte_documents WHERE id=$1 AND provider=$2 FOR UPDATE", event.Key, s.Provider.Name()).Scan(&id); e != nil {
		return e
	}
	tag, e := tx.Exec(ctx, "INSERT INTO dte_events(provider,event_id,document_id,payload_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", s.Provider.Name(), event.ID, id, digest)
	if e != nil {
		return e
	}
	if tag.RowsAffected() == 0 {
		var same bool
		e = tx.QueryRow(ctx, "SELECT document_id=$3 AND payload_hash=$4 FROM dte_events WHERE provider=$1 AND event_id=$2", s.Provider.Name(), event.ID, id, digest).Scan(&same)
		if e != nil {
			return e
		}
		if !same {
			return ErrConflict
		}
		return tx.Commit(ctx)
	}
	if e = apply(ctx, tx, id, event.Result); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
