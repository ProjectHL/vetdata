package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/vetdata/api/internal/domain"
)

func approveGrant(t *testing.T, f *fixture, own, other []*http.Cookie, pid, scope string) {
	t.Helper()
	w := f.request("POST", "/api/v1/sharing/requests", sharingInput{PatientIDs: []string{pid}, Scope: "Ficha completa", Reason: "Continuidad clínica"}, other...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var qs []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &qs)
	if _, err := f.mail.DeliverOne(context.Background()); err != nil {
		t.Fatal(err)
	}
	token := lastToken(t, f, context.Background())
	decision := map[string]any{"token": token, "rut": "12345678-5", "approve": true, "scope": scope}
	w = f.request("POST", "/api/v1/owner/sharing/requests/"+qs[0]["id"].(string)+"/decision", decision)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
}

func createRecord(t *testing.T, f *fixture, cookies []*http.Cookie, pid, kind string, payload map[string]any, corrects *string) (int, map[string]any) {
	t.Helper()
	body := map[string]any{"kind": kind, "payload": payload}
	if corrects != nil {
		body["correctsId"] = *corrects
	}
	w := f.request("POST", "/api/v1/patients/"+pid+"/records", body, cookies...)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func TestClinicalRecordsAppendOnly(t *testing.T) {
	f, own, other, pid, oid := setupSharing(t)
	ctx := context.Background()
	today := time.Now().In(domain.Santiago).Format("2006-01-02")
	tomorrow := time.Now().In(domain.Santiago).AddDate(0, 0, 1).Format("2006-01-02")

	consult := map[string]any{"date": today, "doctor": "Vet Test", "reason": "Picazón intensa", "diagnosis": "Dermatitis por pulgas", "treatment": "Antipulgas"}
	code, created := createRecord(t, f, own, pid, "consultation", consult, nil)
	if code != 201 {
		t.Fatal(code, created)
	}
	cid := created["id"].(string)
	if created["payload"].(map[string]any)["category"] != "Dermatológico" {
		t.Fatal("category", created)
	}
	if created["clinicId"] != f.clinic || created["actorId"] != f.user {
		t.Fatal("attribution", created)
	}
	code, _ = createRecord(t, f, own, pid, "vaccine", map[string]any{"name": "Antirrábica", "date": today, "nextDose": tomorrow}, nil)
	if code != 201 {
		t.Fatal("vaccine", code)
	}
	code, _ = createRecord(t, f, own, pid, "prescription", map[string]any{"date": today, "drug": "Amoxicilina", "dose": "250mg", "duration": "7 días", "doctor": "Vet Test"}, nil)
	if code != 201 {
		t.Fatal("prescription", code)
	}
	code, _ = createRecord(t, f, own, pid, "exam", map[string]any{"date": today, "name": "Hemograma", "result": "Normal"}, nil)
	if code != 201 {
		t.Fatal("exam", code)
	}
	// Validaciones.
	code, _ = createRecord(t, f, own, pid, "surgery", map[string]any{}, nil)
	if code != 400 {
		t.Fatal("kind", code)
	}
	code, _ = createRecord(t, f, own, pid, "vaccine", map[string]any{"date": today}, nil)
	if code != 400 {
		t.Fatal("vaccine name", code)
	}
	code, _ = createRecord(t, f, own, pid, "consultation", map[string]any{"date": tomorrow, "doctor": "Vet", "reason": "X", "diagnosis": "Y", "treatment": ""}, nil)
	if code != 400 {
		t.Fatal("future date", code)
	}
	// Sin acceso: 404.
	code, _ = createRecord(t, f, other, pid, "consultation", consult, nil)
	if code != 404 {
		t.Fatal("no access", code)
	}
	// Clínica con Ficha completa escribe; con Resumen clínico no.
	approveGrant(t, f, own, other, pid, "Ficha completa")
	code, shared := createRecord(t, f, other, pid, "consultation", consult, nil)
	if code != 201 {
		t.Fatal("shared write", code, shared)
	}
	if shared["clinicId"] != f.other {
		t.Fatal("shared attribution", shared)
	}
	w := f.request("POST", "/api/v1/patients", patientInput{OwnerID: oid, Name: "Second", Species: "Gato", Sex: "Hembra", BirthDate: "2021-05-05"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var second map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &second)
	pid2 := second["id"].(string)
	approveGrant(t, f, own, other, pid2, "Resumen clínico")
	code, _ = createRecord(t, f, other, pid2, "consultation", consult, nil)
	if code != 403 {
		t.Fatal("summary write", code)
	}
	// Corrección propia conserva el original y queda vinculada.
	code, correction := createRecord(t, f, own, pid, "correction", map[string]any{"note": "Dosis corregida"}, &cid)
	if code != 201 {
		t.Fatal("correction", code, correction)
	}
	if correction["correctsId"] != cid {
		t.Fatal("link", correction)
	}
	var original string
	if e := f.pool.QueryRow(ctx, "SELECT payload->>'diagnosis' FROM clinical_records WHERE id=$1", cid).Scan(&original); e != nil || original != "Dermatitis por pulgas" {
		t.Fatal("original mutated", original, e)
	}
	// La clínica con acceso no corrige registros ajenos.
	code, _ = createRecord(t, f, other, pid, "correction", map[string]any{"note": "Ajena"}, &cid)
	if code != 403 {
		t.Fatal("foreign correction", code)
	}
	// Corrección sin objetivo, sobre corrección y evento nuevo con correctsId.
	code, _ = createRecord(t, f, own, pid, "correction", map[string]any{}, nil)
	if code != 400 {
		t.Fatal("missing corrects", code)
	}
	corrID := correction["id"].(string)
	code, _ = createRecord(t, f, own, pid, "annulment", map[string]any{}, &corrID)
	if code != 409 {
		t.Fatal("correct a correction", code)
	}
	code, _ = createRecord(t, f, own, pid, "vaccine", map[string]any{"name": "X", "date": today}, &cid)
	if code != 400 {
		t.Fatal("unexpected corrects", code)
	}
	code, _ = createRecord(t, f, own, pid, "annulment", map[string]any{"note": "Duplicada"}, &cid)
	if code != 201 {
		t.Fatal("annulment", code)
	}
	// Inmutabilidad a nivel de base: UPDATE directo falla por trigger.
	if _, e := f.pool.Exec(ctx, "UPDATE clinical_records SET payload='{}' WHERE id=$1", cid); e == nil {
		t.Fatal("record updated despite trigger")
	}
	// La ficha expone los eventos con su categoría y la corrección vinculada.
	w = f.request("GET", "/api/v1/patients/"+pid, nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, "Dermatológico") || !strings.Contains(body, cid) {
		t.Fatal("projection", body)
	}
	var audits int
	if e := f.pool.QueryRow(ctx, "SELECT count(*) FROM audit_events WHERE action='record.created'").Scan(&audits); e != nil || audits < 6 {
		t.Fatal("audit", audits, e)
	}
}

func TestPatientStatusFromDefaultRules(t *testing.T) {
	f, own, _, pid, _ := setupSharing(t)
	today := time.Now().In(domain.Santiago).Format("2006-01-02")
	yesterday := time.Now().In(domain.Santiago).AddDate(0, 0, -1).Format("2006-01-02")
	tomorrow := time.Now().In(domain.Santiago).AddDate(0, 0, 1).Format("2006-01-02")

	getStatus := func() (string, bool) {
		t.Helper()
		w := f.request("GET", "/api/v1/patients/"+pid, nil, own...)
		if w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
		var p map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &p)
		status, _ := p["status"].(string)
		pending, _ := p["statusPending"].(bool)
		return status, pending
	}
	if status, pending := getStatus(); status != "Al día" || pending {
		t.Fatal("default", status, pending)
	}
	code, _ := createRecord(t, f, own, pid, "vaccine", map[string]any{"name": "Antirrábica", "date": today, "nextDose": tomorrow}, nil)
	if code != 201 {
		t.Fatal(code)
	}
	if status, _ := getStatus(); status != "Al día" {
		t.Fatal("future dose", status)
	}
	code, _ = createRecord(t, f, own, pid, "vaccine", map[string]any{"name": "KC", "date": today, "nextDose": yesterday}, nil)
	if code != 201 {
		t.Fatal(code)
	}
	if status, pending := getStatus(); status != "Control" || pending {
		t.Fatal("overdue dose", status, pending)
	}
}
