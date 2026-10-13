package privacy

import (
	"context"
	"github.com/vetdata/api/internal/testutil"
	"github.com/vetdata/api/migrations"
	"github.com/vetdata/api/seeds"
	"reflect"
	"testing"
	"time"
)

func TestRetentionCutoffAndNoWrites(t *testing.T) {
	p := testutil.Database(t)
	ctx := context.Background()
	if e := migrations.Apply(ctx, p); e != nil {
		t.Fatal(e)
	}
	at := time.Date(2026, 10, 11, 0, 0, 0, 0, time.UTC)
	cut := at.AddDate(-5, 0, 0)
	for _, ts := range []time.Time{cut.Add(-time.Second), cut, cut.Add(time.Second)} {
		if _, e := p.Exec(ctx, "INSERT INTO audit_events(action,created_at) VALUES('fixture',$1)", ts); e != nil {
			t.Fatal(e)
		}
	}
	a, e := Retention(ctx, p, at)
	if e != nil {
		t.Fatal(e)
	}
	b, e := Retention(ctx, p, at)
	if e != nil {
		t.Fatal(e)
	}
	if a.Categories[0].Total != 3 || a.Categories[0].Candidates != 1 || b.Categories[0].Total != 3 {
		t.Fatal(a, b)
	}
	for _, c := range a.Categories[1:] {
		if c.Candidates != 0 {
			t.Fatal("unapproved deletion candidate", c)
		}
	}
	if _, e = p.Exec(ctx, "DELETE FROM audit_events"); e == nil {
		t.Fatal("audit no longer immutable")
	}
}

func TestAnonymizationNoWritesAndScope(t *testing.T) {
	p := testutil.Database(t)
	ctx := context.Background()
	if e := migrations.Apply(ctx, p); e != nil {
		t.Fatal(e)
	}
	if e := seeds.Apply(ctx, p); e != nil {
		t.Fatal(e)
	}
	var clinic, owner, before, after string
	if e := p.QueryRow(ctx, "SELECT clinic_id,owner_id FROM clinic_owners LIMIT 1").Scan(&clinic, &owner); e != nil {
		t.Fatal(e)
	}
	if e := p.QueryRow(ctx, "SELECT row_to_json(o)::text FROM owners o WHERE id=$1", owner).Scan(&before); e != nil {
		t.Fatal(e)
	}
	at := time.Date(2026, 10, 11, 0, 0, 0, 0, time.UTC)
	a, e := Anonymization(ctx, p, clinic, owner, at)
	if e != nil {
		t.Fatal(e)
	}
	b, e := Anonymization(ctx, p, clinic, owner, at)
	if e != nil || !reflect.DeepEqual(a, b) {
		t.Fatal(a, b, e)
	}
	if e := p.QueryRow(ctx, "SELECT row_to_json(o)::text FROM owners o WHERE id=$1", owner).Scan(&after); e != nil || before != after {
		t.Fatal("owner modified", e)
	}
	if _, e = Anonymization(ctx, p, "00000000-0000-0000-0000-000000000001", owner, at); e == nil {
		t.Fatal("unlinked owner")
	}
}
