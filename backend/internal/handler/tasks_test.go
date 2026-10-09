package handler

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/vetdata/api/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

func TestTasksComputedFilteredAndMeta(t *testing.T) {
	f, own, other, pid, _ := setupSharing(t)
	ctx := context.Background()
	doctor := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO doctors(id,clinic_id,name,specialty,initials) VALUES($1,$2,'Vet','General','VT')", doctor, f.clinic); e != nil {
		t.Fatal(e)
	}
	aidToday, aidTomorrow := domain.UUID(), domain.UUID()
	noon := "(date_trunc('day', now() AT TIME ZONE 'America/Santiago') + interval '12 hours') AT TIME ZONE 'America/Santiago'"
	if _, e := f.pool.Exec(ctx, "INSERT INTO appointments(id,clinic_id,patient_id,doctor_id,starts_at,ends_at,reason,created_by) VALUES($1,$2,$3,$4,"+noon+","+noon+" + interval '30 minutes','Control',$5)", aidToday, f.clinic, pid, doctor, f.user); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO appointments(id,clinic_id,patient_id,doctor_id,starts_at,ends_at,reason,created_by) VALUES($1,$2,$3,$4,"+noon+" + interval '1 day',"+noon+" + interval '1 day 30 minutes','Control',$5)", aidTomorrow, f.clinic, pid, doctor, f.user); e != nil {
		t.Fatal(e)
	}
	w := f.request("POST", "/api/v1/sharing/requests", sharingInput{PatientIDs: []string{pid}, Scope: "Ficha completa", Reason: "Continuidad clínica"}, other...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var qs []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &qs)
	qid := qs[0]["id"].(string)
	w = f.request("GET", "/api/v1/tasks", nil, other...)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "solicitud:"+qid) || strings.Contains(w.Body.String(), "llegada:") {
		t.Fatal("other tasks", w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/tasks", nil, own...)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "llegada:"+aidToday) || strings.Contains(w.Body.String(), aidTomorrow) || strings.Contains(w.Body.String(), "solicitud:") {
		t.Fatal("own tasks", w.Code, w.Body.String())
	}
	if _, e := f.pool.Exec(ctx, "UPDATE sharing_requests SET expires_at=now()+interval '1 hour' WHERE id=$1", qid); e != nil {
		t.Fatal(e)
	}
	w = f.request("GET", "/api/v1/tasks", nil, other...)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"priority":"Alta"`) {
		t.Fatal("urgent task", w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/tasks/llegada%3A"+aidToday, map[string]any{"done": true}, own...)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"done":true`) {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/tasks", nil, own...)
	if strings.Contains(w.Body.String(), "llegada:"+aidToday) {
		t.Fatal("done hidden", w.Body.String())
	}
	w = f.request("GET", "/api/v1/tasks?view=done", nil, own...)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "llegada:"+aidToday) {
		t.Fatal("done view", w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/tasks/llegada%3A"+aidToday, map[string]any{"done": false, "assignee": f.user}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/tasks?view=mine", nil, own...)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "llegada:"+aidToday) {
		t.Fatal("mine view", w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/tasks/llegada%3A"+aidToday, map[string]any{"assignee": domain.UUID()}, own...)
	if w.Code != 400 || !strings.Contains(w.Body.String(), "invalid_assignee") {
		t.Fatal("outsider assignee", w.Code, w.Body.String())
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte("Test-password-123"), 4)
	uid := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO users(id,name,email,password_hash,status) VALUES($1,'Vet','vet2@example.test',$2,'Activo')", uid, string(hash)); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO memberships(user_id,clinic_id,role) VALUES($1,$2,'Veterinario')", uid, f.clinic); e != nil {
		t.Fatal(e)
	}
	w = f.request("POST", "/api/v1/auth/login", map[string]string{"email": "vet2@example.test", "password": "Test-password-123", "clinicId": f.clinic})
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/tasks", nil, w.Result().Cookies()...)
	if w.Code != 200 || strings.TrimSpace(w.Body.String()) != "[]" {
		t.Fatal("permission filter", w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/tasks/basura", map[string]any{"done": true}, own...)
	if w.Code != 400 {
		t.Fatal("bad task id", w.Code)
	}
	w = f.request("GET", "/api/v1/tasks?view=x", nil, own...)
	if w.Code != 400 {
		t.Fatal("bad view", w.Code)
	}
}
