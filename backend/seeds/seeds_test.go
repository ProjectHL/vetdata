package seeds_test

import (
	"context"
	"github.com/vetdata/api/internal/domain"
	"github.com/vetdata/api/internal/testutil"
	"github.com/vetdata/api/migrations"
	"github.com/vetdata/api/seeds"
	"testing"
)

func TestCompleteSeedsReapply(t *testing.T) {
	p := testutil.Database(t)
	ctx := context.Background()
	if e := migrations.Apply(ctx, p); e != nil {
		t.Fatal(e)
	}
	for n := 0; n < 2; n++ {
		if e := seeds.Apply(ctx, p); e != nil {
			t.Fatal(e)
		}
		for table, want := range map[string]int{"owners": 12, "patients": 19, "groups": 8, "clinic_owners": 19} {
			var got int
			if e := p.QueryRow(ctx, "SELECT count(*) FROM "+table).Scan(&got); e != nil {
				t.Fatal(e)
			}
			if table != "clinic_owners" && got != want {
				t.Fatalf("%s: %d != %d", table, got, want)
			}
		}
	}
	rows, e := p.Query(ctx, "SELECT rut FROM owners UNION ALL SELECT rut FROM clinic_profiles")
	if e != nil {
		t.Fatal(e)
	}
	defer rows.Close()
	for rows.Next() {
		var rut string
		if e = rows.Scan(&rut); e != nil {
			t.Fatal(e)
		}
		if normalized, e := domain.NormalizeRUT(rut); e != nil || normalized != rut {
			t.Fatal(rut, e)
		}
	}
	if e = rows.Err(); e != nil {
		t.Fatal(e)
	}
	var links, distinctLinks int
	if e = p.QueryRow(ctx, "SELECT count(*),count(DISTINCT (clinic_id,owner_id)) FROM clinic_owners").Scan(&links, &distinctLinks); e != nil || links != distinctLinks || links < 12 {
		t.Fatal(links, distinctLinks, e)
	}
	var grants int
	if e = p.QueryRow(ctx, "SELECT count(*) FROM sharing_grants").Scan(&grants); e != nil || grants != 0 {
		t.Fatal("demo consent promoted", grants, e)
	}
}
