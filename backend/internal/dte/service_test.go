package dte

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/vetdata/api/internal/testutil"
	"github.com/vetdata/api/migrations"
	"github.com/vetdata/api/seeds"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
)

type fakeProvider struct {
	calls   atomic.Int32
	timeout bool
	result  Result
}

func (*fakeProvider) Name() string { return "test-only" }
func (f *fakeProvider) Issue(_ context.Context, _ Request) (Result, error) {
	f.calls.Add(1)
	if f.timeout {
		return Result{}, errors.New("timeout")
	}
	return f.result, nil
}
func (f *fakeProvider) Lookup(_ context.Context, _ string) (Result, error) { return f.result, nil }
func (*fakeProvider) VerifyEvent(_ context.Context, h http.Header, b []byte) (Event, error) {
	if h.Get("Test-Signature") != "valid" {
		return Event{}, errors.New("bad signature")
	}
	var e Event
	err := json.Unmarshal(b, &e)
	return e, err
}

func fixture(t *testing.T) (Service, string, string) {
	t.Helper()
	p := testutil.Database(t)
	ctx := context.Background()
	if e := migrations.Apply(ctx, p); e != nil {
		t.Fatal(e)
	}
	if e := seeds.Apply(ctx, p); e != nil {
		t.Fatal(e)
	}
	var clinic, invoice string
	e := p.QueryRow(ctx, `INSERT INTO invoices(clinic_id,owner_id,number,net,vat,total,items,actor_id)
 SELECT co.clinic_id,co.owner_id,9999,1000,190,1190,'[]',m.user_id FROM clinic_owners co JOIN memberships m ON m.clinic_id=co.clinic_id LIMIT 1 RETURNING clinic_id,id`).Scan(&clinic, &invoice)
	if e != nil {
		t.Fatal(e)
	}
	return Service{DB: p, Provider: &fakeProvider{result: Result{State: "accepted", Reference: "provider-1", Revision: 1}}}, clinic, invoice
}
func TestUncertainEmissionReconcilesWithoutReissue(t *testing.T) {
	s, clinic, invoice := fixture(t)
	ctx := context.Background()
	p := s.Provider.(*fakeProvider)
	p.timeout = true
	id, e := s.Prepare(ctx, clinic, invoice, "test-key-0001", 39)
	if e != nil {
		t.Fatal(e)
	}
	again, e := s.Prepare(ctx, clinic, invoice, "test-key-0001", 39)
	if e != nil || again != id {
		t.Fatal(again, e)
	}
	if _, e = s.Prepare(ctx, clinic, invoice, "test-key-0002", 33); e == nil {
		t.Fatal("duplicate invoice")
	}
	var wg sync.WaitGroup
	for range 5 {
		wg.Add(1)
		go func() { defer wg.Done(); _ = s.Issue(ctx, clinic, id) }()
	}
	wg.Wait()
	if p.calls.Load() != 1 {
		t.Fatal("duplicate network issuance", p.calls.Load())
	}
	var state string
	if e = s.DB.QueryRow(ctx, "SELECT state FROM dte_documents WHERE id=$1", id).Scan(&state); e != nil || state != "uncertain" {
		t.Fatal(state, e)
	}
	p.result = Result{State: "issued", Reference: "provider-1", Folio: "123", Document: "provider-doc", Revision: 3}
	if e = s.Reconcile(ctx, clinic, id); e != nil {
		t.Fatal(e)
	}
	if e = s.Issue(ctx, clinic, id); e != nil || p.calls.Load() != 1 {
		t.Fatal(e, p.calls.Load())
	}
	signed := http.Header{"Test-Signature": []string{"valid"}}
	event := Event{ID: "event-1", Key: id, Result: Result{State: "accepted", Reference: "provider-1", Revision: 2}}
	raw, _ := json.Marshal(event)
	if e = s.Callback(ctx, http.Header{}, raw); e == nil {
		t.Fatal("unsigned callback")
	}
	for range 2 {
		if e = s.Callback(ctx, signed, raw); e != nil {
			t.Fatal(e)
		}
	}
	event.Result.Revision = 4
	changed, _ := json.Marshal(event)
	if e = s.Callback(ctx, signed, changed); e == nil {
		t.Fatal("event identity reused")
	}
	if e = s.DB.QueryRow(ctx, "SELECT state FROM dte_documents WHERE id=$1", id).Scan(&state); e != nil || state != "issued" {
		t.Fatal(state, e)
	}
	var n int
	if e = s.DB.QueryRow(ctx, "SELECT count(*) FROM dte_events").Scan(&n); e != nil || n != 1 {
		t.Fatal(n, e)
	}
}
func TestRejectedAndWrongTenant(t *testing.T) {
	s, clinic, invoice := fixture(t)
	ctx := context.Background()
	s.Provider.(*fakeProvider).result = Result{State: "rejected", Reference: "rejected-1", Revision: 1}
	id, e := s.Prepare(ctx, clinic, invoice, "test-key-0003", 33)
	if e != nil {
		t.Fatal(e)
	}
	if e = s.Issue(ctx, "00000000-0000-0000-0000-000000000001", id); e == nil {
		t.Fatal("tenant leak")
	}
	if e = s.Issue(ctx, clinic, id); e != nil {
		t.Fatal(e)
	}
	var state string
	if e = s.DB.QueryRow(ctx, "SELECT state FROM dte_documents WHERE id=$1", id).Scan(&state); e != nil || state != "rejected" {
		t.Fatal(state, e)
	}
	if e = (Service{DB: s.DB}).Issue(ctx, clinic, id); !errors.Is(e, ErrDisabled) {
		t.Fatal(e)
	}
}
