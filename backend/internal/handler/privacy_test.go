package handler

import (
	"context"
	"strings"
	"testing"
)

func TestOwnerExportTenantAndAudit(t *testing.T) {
	f, own, other, pid, oid := setupSharing(t)
	ctx := context.Background()
	if _, e := f.pool.Exec(ctx, `INSERT INTO clinical_records(patient_id,clinic_id,actor_id,kind,payload) VALUES($1,$2,$3,'consultation','{"diagnosis":"FOREIGN-PRIVATE"}')`, pid, f.other, f.user); e != nil {
		t.Fatal(e)
	}
	w := f.request("GET", "/api/v1/owners/12345678-5/export", nil, own...)
	if w.Code != 200 || strings.Contains(w.Body.String(), "FOREIGN-PRIVATE") || !strings.Contains(w.Body.String(), "secret diagnosis") || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/owners/12345678-5/export", nil, other...)
	if w.Code != 404 {
		t.Fatal(w.Code, w.Body.String())
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO clinic_owners(clinic_id,owner_id) VALUES($1,$2)", f.other, oid); e != nil {
		t.Fatal(e)
	}
	w = f.request("GET", "/api/v1/owners/12345678-5/export", nil, other...)
	if w.Code != 200 || strings.Contains(w.Body.String(), "secret diagnosis") || !strings.Contains(w.Body.String(), "FOREIGN-PRIVATE") {
		t.Fatal(w.Code, w.Body.String())
	}
	if _, e := f.pool.Exec(ctx, "UPDATE memberships SET role='Recepción' WHERE user_id=$1", f.user); e != nil {
		t.Fatal(e)
	}
	w = f.request("GET", "/api/v1/owners/12345678-5/export", nil, own...)
	if w.Code != 403 {
		t.Fatal(w.Code)
	}
	var n int
	if e := f.pool.QueryRow(ctx, "SELECT count(*) FROM audit_events WHERE action LIKE 'privacy.export.%'").Scan(&n); e != nil || n != 4 {
		t.Fatal(n, e)
	}
}
