package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/vetdata/api/internal/domain"
)

func TestAttachmentsInheritScope(t *testing.T) {
	f, own, other, pid, oid := setupSharing(t)
	ctx := context.Background()
	today := time.Now().In(domain.Santiago).Format("2006-01-02")

	_, consult := createRecord(t, f, own, pid, "consultation", map[string]any{"date": today, "doctor": "Vet", "reason": "Control", "diagnosis": "Sano", "treatment": "Ninguno"}, nil)
	cid := consult["id"].(string)
	_, vaccine := createRecord(t, f, own, pid, "vaccine", map[string]any{"name": "Antirrábica", "date": today}, nil)
	vid := vaccine["id"].(string)

	register := func(cookies []*http.Cookie, patient, record string, body map[string]any) (int, map[string]any) {
		t.Helper()
		w := f.request("POST", "/api/v1/patients/"+patient+"/records/"+record+"/attachments", body, cookies...)
		var out map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return w.Code, out
	}
	list := func(cookies []*http.Cookie, patient, record string) (int, []map[string]any) {
		t.Helper()
		w := f.request("GET", "/api/v1/patients/"+patient+"/records/"+record+"/attachments", nil, cookies...)
		var out []map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return w.Code, out
	}
	pdf := map[string]any{"storageKey": "clinica-a/adjuntos/examen.pdf", "mimeType": "application/pdf", "sizeBytes": 1024}

	code, att := register(own, pid, cid, pdf)
	if code != 201 {
		t.Fatal(code, att)
	}
	aid := att["id"].(string)
	if att["status"] != "quarantine" || att["actorId"] != f.user {
		t.Fatal("register", att)
	}
	if code, items := list(own, pid, cid); code != 200 || len(items) != 1 {
		t.Fatal("own list", code, items)
	}
	if code, _ := list(other, pid, cid); code != 404 {
		t.Fatal("no access list", code)
	}
	// Clínica con acceso no ve cuarentena; tras moderar sí.
	approveGrant(t, f, own, other, pid, "Ficha completa")
	if code, items := list(other, pid, cid); code != 200 || len(items) != 0 {
		t.Fatal("quarantine shared", code, items)
	}
	w := f.request("PATCH", "/api/v1/attachments/"+aid, map[string]string{"status": "clean"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if code, items := list(other, pid, cid); code != 200 || len(items) != 1 {
		t.Fatal("clean shared", code, items)
	}
	if code, _ := register(own, pid, vid, map[string]any{"storageKey": "clinica-a/adjuntos/carnet.pdf", "mimeType": "application/pdf", "sizeBytes": 256}); code != 201 {
		t.Fatal(code)
	}
	if code, items := list(own, pid, vid); code != 200 || len(items) != 1 {
		t.Fatal("own vaccine list", code, items)
	}
	// Resumen solo alcanza adjuntos de vacunas.
	w = f.request("POST", "/api/v1/patients", patientInput{OwnerID: oid, Name: "Second", Species: "Gato", Sex: "Hembra", BirthDate: "2021-05-05"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var second map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &second)
	pid2 := second["id"].(string)
	_, consult2 := createRecord(t, f, own, pid2, "consultation", map[string]any{"date": today, "doctor": "Vet", "reason": "X", "diagnosis": "Y", "treatment": "Z"}, nil)
	_, vaccine2 := createRecord(t, f, own, pid2, "vaccine", map[string]any{"name": "Triple", "date": today}, nil)
	if code, _ := register(own, pid2, consult2["id"].(string), map[string]any{"storageKey": "clinica-a/adjuntos/segundo.pdf", "mimeType": "application/pdf", "sizeBytes": 100}); code != 201 {
		t.Fatal(code)
	}
	code, vaccAtt := register(own, pid2, vaccine2["id"].(string), map[string]any{"storageKey": "clinica-a/adjuntos/carnet2.jpg", "mimeType": "image/jpeg", "sizeBytes": 512})
	if code != 201 {
		t.Fatal(code, vaccAtt)
	}
	if w := f.request("PATCH", "/api/v1/attachments/"+vaccAtt["id"].(string), map[string]string{"status": "clean"}, own...); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	approveGrant(t, f, own, other, pid2, "Resumen clínico")
	if code, items := list(other, pid2, consult2["id"].(string)); code != 200 || len(items) != 0 {
		t.Fatal("summary consultation", code, items)
	}
	if code, items := list(other, pid2, vaccine2["id"].(string)); code != 200 || len(items) != 1 {
		t.Fatal("summary vaccine", code, items)
	}
	code, _ = register(other, pid2, vaccine2["id"].(string), pdf)
	if code != 403 {
		t.Fatal("summary register", code)
	}
	// Moderación terminal y validaciones.
	w = f.request("PATCH", "/api/v1/attachments/"+aid, map[string]string{"status": "rejected"}, own...)
	if w.Code != 409 {
		t.Fatal("remoderate", w.Code)
	}
	w = f.request("PATCH", "/api/v1/attachments/"+aid, map[string]string{"status": "lost"}, own...)
	if w.Code != 400 {
		t.Fatal("status validation", w.Code)
	}
	w = f.request("PATCH", "/api/v1/attachments/"+aid, map[string]string{"status": "clean"}, other...)
	if w.Code != 404 {
		t.Fatal("tenant moderate", w.Code)
	}
	for _, bad := range []map[string]any{
		{"storageKey": "x", "mimeType": "text/plain", "sizeBytes": 10},
		{"storageKey": "x", "mimeType": "application/pdf", "sizeBytes": 0},
		{"storageKey": "", "mimeType": "application/pdf", "sizeBytes": 10},
	} {
		if code, _ := register(own, pid, cid, bad); code != 400 {
			t.Fatal("attachment validation", bad, code)
		}
	}
	if code, _ := register(own, pid, domain.UUID(), pdf); code != 404 {
		t.Fatal("unknown record", code)
	}
	if code, _ := register(own, pid2, cid, pdf); code != 404 {
		t.Fatal("foreign record", code)
	}
	var audits int
	if e := f.pool.QueryRow(ctx, "SELECT count(*) FROM audit_events WHERE action IN ('attachment.registered','attachment.moderated')").Scan(&audits); e != nil || audits < 4 {
		t.Fatal("audit", audits, e)
	}
}
