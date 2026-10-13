package bootstrap

import (
	"context"
	"github.com/vetdata/api/internal/domain"
	"github.com/vetdata/api/internal/testutil"
	"github.com/vetdata/api/migrations"
	"testing"
)

func TestFreshProductionBootstrap(t *testing.T) {
	p := testutil.Database(t)
	ctx := context.Background()
	if e := migrations.Apply(ctx, p); e != nil {
		t.Fatal(e)
	}
	// Migration 011 installs the reserved VetData Staff tenant, not demo data.
	var baseClinics, baseGroups int
	if e := p.QueryRow(ctx, "SELECT (SELECT count(*) FROM clinics),(SELECT count(*) FROM groups)").Scan(&baseClinics, &baseGroups); e != nil {
		t.Fatal(e)
	}
	in := Input{ClinicID: domain.UUID(), Name: "Admin", Email: "admin@example.test", Password: "Test-password-123", Tenant: &Tenant{GroupID: domain.UUID(), GroupName: "Group", ClinicName: "Clinic", Sector: "Sector", Address: "Address", LegalName: "Clinic", RUT: "12345678-5"}}
	first, e := Apply(ctx, p, in)
	if e != nil {
		t.Fatal(e)
	}
	in.Password = "Do-not-replace-123"
	second, e := Apply(ctx, p, in)
	if e != nil || first != second {
		t.Fatal(second, e)
	}
	var n int
	if e = p.QueryRow(ctx, "SELECT count(*) FROM clinics").Scan(&n); e != nil || n != baseClinics+1 {
		t.Fatal(n, e)
	}
	if e = p.QueryRow(ctx, "SELECT count(*) FROM owners").Scan(&n); e != nil || n != 0 {
		t.Fatal("demo owners", n, e)
	}
	bad := in
	bad.ClinicID = domain.UUID()
	bad.Tenant = &Tenant{GroupID: domain.UUID(), GroupName: "Other", ClinicName: "Other", Sector: "Sector", Address: "Address", LegalName: "Other", RUT: "12345678-5"}
	if _, e = Apply(ctx, p, bad); e == nil {
		t.Fatal("existing account elevated")
	}
	if e = p.QueryRow(ctx, "SELECT count(*) FROM groups").Scan(&n); e != nil || n != baseGroups+1 {
		t.Fatal("bootstrap not atomic", n, e)
	}
}
