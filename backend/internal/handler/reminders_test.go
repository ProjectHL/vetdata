package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/vetdata/api/internal/domain"
)

func TestAppointmentRemindersRespectContactAndOptOut(t *testing.T) {
	f, own, other, pid, _ := setupSharing(t)
	ctx := context.Background()
	mkDoctor := func() string {
		t.Helper()
		doctor := domain.UUID()
		if _, e := f.pool.Exec(ctx, "INSERT INTO doctors(id,clinic_id,name,specialty,initials) VALUES($1,$2,'Vet','General','VT')", doctor, f.clinic); e != nil {
			t.Fatal(e)
		}
		return doctor
	}
	mkAppointment := func(patient, doctor string) string {
		t.Helper()
		now := time.Now().In(domain.Santiago)
		w := f.request("POST", "/api/v1/appointments", appointmentInput{PatientID: patient, DoctorID: doctor, Date: now.Format("2006-01-02"), Time: now.Format("15:04"), Reason: "Control", Emergency: true}, own...)
		if w.Code != 201 {
			t.Fatal(w.Code, w.Body.String())
		}
		var ap map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &ap)
		return ap["id"].(string)
	}
	remind := func(aid string, cookies ...*http.Cookie) (int, map[string]any) {
		t.Helper()
		w := f.request("POST", "/api/v1/appointments/"+aid+"/remind", nil, cookies...)
		var out map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return w.Code, out
	}
	pending := func(aid string) bool {
		t.Helper()
		var n int
		if e := f.pool.QueryRow(ctx, "SELECT count(*) FROM notification_outbox WHERE dedup_key=$1 AND sent_at IS NULL", "reminder:"+aid).Scan(&n); e != nil {
			t.Fatal(e)
		}
		return n == 1
	}

	aid := mkAppointment(pid, mkDoctor())
	code, out := remind(aid, own...)
	if code != 200 || out["sent"] != true {
		t.Fatal("remind", code, out)
	}
	if !pending(aid) {
		t.Fatal("outbox")
	}
	code, out = remind(aid, own...)
	if code != 200 || out["reason"] != "already_pending" {
		t.Fatal("retry", code, out)
	}
	if ok, e := f.mail.DeliverOne(ctx); e != nil || !ok {
		t.Fatal("deliver", ok, e)
	}
	last := f.sender.messages[len(f.sender.messages)-1]
	if last.To != "owner@example.test" {
		t.Fatal("recipient", last.To)
	}
	code, out = remind(aid, own...)
	if code != 200 || out["reason"] != "already_sent" {
		t.Fatal("resend", code, out)
	}
	if ok, e := f.mail.DeliverOne(ctx); e != nil || ok {
		t.Fatal("duplicate delivery", ok, e)
	}
	// Opt-out: suprime el pendiente y bloquea nuevos.
	aid2 := mkAppointment(pid, mkDoctor())
	if code, _ = remind(aid2, own...); code != 200 {
		t.Fatal(code)
	}
	w := f.request("POST", "/api/v1/owners/12345678-5/contact", map[string]any{"reminderOptOut": true}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var owner map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &owner)
	if owner["reminderOptOut"] != true {
		t.Fatal("optout flag", owner)
	}
	if pending(aid2) {
		t.Fatal("pending not suppressed")
	}
	code, out = remind(aid2, own...)
	if code != 200 || out["reason"] != "opted_out" {
		t.Fatal("optout remind", code, out)
	}
	// Canal no enviable: se respeta sin encolar.
	w = f.request("POST", "/api/v1/owners", ownerInput{RUT: "11111111-1", FirstName: "Sin", LastName: "Mail", Email: "nomail@example.test", Phone: "123", BirthDate: "1990-01-01", PreferredContact: "Teléfono"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var o2 map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &o2)
	w = f.request("POST", "/api/v1/patients", patientInput{OwnerID: o2["id"].(string), Name: "Fono", Species: "Gato", Sex: "Macho", BirthDate: "2020-01-01"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var p2 map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &p2)
	aid3 := mkAppointment(p2["id"].(string), mkDoctor())
	code, out = remind(aid3, own...)
	if code != 200 || out["reason"] != "channel_unavailable" {
		t.Fatal("channel", code, out)
	}
	if pending(aid3) {
		t.Fatal("channel queued")
	}
	// Cita cancelada: 409 y el pendiente se borra al cancelar.
	aid4 := mkAppointment(p2["id"].(string), mkDoctor())
	if code, _ = remind(aid4, own...); code != 200 {
		t.Fatal(code)
	}
	w = f.request("PATCH", "/api/v1/appointments/"+aid4, map[string]string{"status": "Cancelada"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if pending(aid4) {
		t.Fatal("cancel keeps reminder")
	}
	code, _ = remind(aid4, own...)
	if code != 409 {
		t.Fatal("cancelled remind", code)
	}
	// Aislamiento y validaciones.
	if code, _ = remind(aid, other...); code != 404 {
		t.Fatal("tenant", code)
	}
	w = f.request("POST", "/api/v1/owners/malo/contact", map[string]any{"reminderOptOut": true}, own...)
	if w.Code != 400 {
		t.Fatal("rut", w.Code)
	}
	w = f.request("POST", "/api/v1/owners/12345678-5/contact", map[string]any{"preferredContact": "Humo"}, own...)
	if w.Code != 400 {
		t.Fatal("channel validation", w.Code)
	}
	w = f.request("POST", "/api/v1/owners/22222222-2/contact", map[string]any{"reminderOptOut": true}, own...)
	if w.Code != 404 {
		t.Fatal("unknown owner", w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/owners/12345678-5/contact", map[string]any{}, own...)
	if w.Code != 400 {
		t.Fatal("empty contact", w.Code)
	}
}
