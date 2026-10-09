package handler

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/vetdata/api/internal/domain"
)

func TestVetLifecycleGeneratesDoctorIdAndBlocksDeactivation(t *testing.T) {
	f, own, _, pid, _ := setupSharing(t)
	ctx := context.Background()
	w := f.request("POST", "/api/v1/users/invitations", map[string]string{"name": "Nueva Vet", "email": "newvet@example.test", "role": "Veterinario", "specialty": "General"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	raw := lastMarker(t, f, ctx, "#token=")
	w = f.request("POST", "/api/v1/auth/accept-invitation", map[string]string{"token": raw, "password": "Test-password-123"}, own...)
	if w.Code != 204 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/users", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var users []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &users)
	var vetID, doctorID string
	for _, u := range users {
		if u["email"] == "newvet@example.test" {
			vetID, _ = u["id"].(string)
			doctorID, _ = u["doctorId"].(string)
		}
	}
	if vetID == "" || doctorID == "" {
		t.Fatal("vet doctorId", vetID, doctorID)
	}
	aid := domain.UUID()
	aligned := "(date_trunc('hour', now() AT TIME ZONE 'America/Santiago') + interval '2 hours') AT TIME ZONE 'America/Santiago'"
	if _, e := f.pool.Exec(ctx, "INSERT INTO appointments(id,clinic_id,patient_id,doctor_id,starts_at,ends_at,reason,created_by) VALUES($1,$2,$3,$4,"+aligned+","+aligned+" + interval '30 minutes','Control',$5)", aid, f.clinic, pid, doctorID, f.user); e != nil {
		t.Fatal(e)
	}
	w = f.request("PATCH", "/api/v1/users/"+vetID, map[string]string{"status": "Inactivo"}, own...)
	if w.Code != 409 || !strings.Contains(w.Body.String(), aid) {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/users/"+vetID, map[string]string{"role": "Recepción"}, own...)
	if w.Code != 409 {
		t.Fatal("role change", w.Code, w.Body.String())
	}
	doc2 := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO doctors(id,clinic_id,name,specialty,initials) VALUES($1,$2,'Vet Dos','General','VD')", doc2, f.clinic); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO clinic_hours(clinic_id,weekday,starts_at,ends_at,slot_minutes) SELECT $1,g,'00:00','23:59',30 FROM generate_series(0,6) g", f.clinic); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO doctor_hours(doctor_id,weekday,starts_at,ends_at) SELECT $1,g,'00:00','23:59' FROM generate_series(0,6) g", doc2); e != nil {
		t.Fatal(e)
	}
	w = f.request("PATCH", "/api/v1/appointments/"+aid, map[string]string{"doctorId": doc2}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/users/"+vetID, map[string]string{"status": "Inactivo"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
}
func TestDeactivateVetReturnsAppointments(t *testing.T) {
	f, own, _, pid, _ := setupSharing(t)
	ctx := context.Background()
	uid, doctor := domain.UUID(), domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO users(id,name,email,password_hash,status) VALUES($1,'Vet','vet@example.test','','Activo')", uid); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO memberships(user_id,clinic_id,role,status) VALUES($1,$2,'Veterinario','Activo')", uid, f.clinic); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO doctors(id,clinic_id,user_id,name,specialty,initials) VALUES($1,$2,$3,'Vet','General','VT')", doctor, f.clinic, uid); e != nil {
		t.Fatal(e)
	}
	aid := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO appointments(id,clinic_id,patient_id,doctor_id,starts_at,ends_at,reason,created_by) VALUES($1,$2,$3,$4,now()+interval '1 day',now()+interval '1 day 30 minutes','Control',$5)", aid, f.clinic, pid, doctor, f.user); e != nil {
		t.Fatal(e)
	}
	w := f.request("PATCH", "/api/v1/users/"+uid, map[string]string{"status": "Inactivo"}, own...)
	if w.Code != 409 || !strings.Contains(w.Body.String(), aid) || !strings.Contains(w.Body.String(), "appointments") {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/appointments/"+aid, map[string]string{"status": "Cancelada"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/users/"+uid, map[string]string{"status": "Inactivo"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestSchedulesConcurrentBookingAndTenant(t *testing.T) {
	f, own, other, pid, _ := setupSharing(t)
	doctor := domain.UUID()
	if _, e := f.pool.Exec(context.Background(), "INSERT INTO doctors(id,clinic_id,name,specialty,initials) VALUES($1,$2,'Vet','General','VT')", doctor, f.clinic); e != nil {
		t.Fatal(e)
	}
	date := time.Now().In(domain.Santiago).AddDate(0, 0, 2)
	schedule := scheduleInput{Hours: []hoursInput{{Weekday: int(date.Weekday()), Start: "09:00", End: "11:00", SlotMinutes: 30}}, Holidays: []holidayInput{}}
	w := f.request("PUT", "/api/v1/settings/schedule", schedule, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("PUT", "/api/v1/doctors/"+doctor+"/schedule", map[string]any{"hours": []hoursInput{{Weekday: int(date.Weekday()), Start: "09:30", End: "10:30"}}}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	path := "/api/v1/appointments/availability?date=" + date.Format("2006-01-02") + "&doctorId=" + doctor
	var result struct {
		Slots []map[string]string `json:"slots"`
	}
	w = f.request("GET", path, nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if e := json.Unmarshal(w.Body.Bytes(), &result); e != nil {
		t.Fatal(e)
	}
	if len(result.Slots) != 2 {
		t.Fatal(w.Body.String())
	}
	w = f.request("GET", "/api/v1/doctors/"+doctor+"/schedule", nil, other...)
	if w.Code != 404 {
		t.Fatal("foreign doctor", w.Code)
	}
	input := appointmentInput{PatientID: pid, DoctorID: doctor, Date: date.Format("2006-01-02"), Time: "09:30", Reason: "Control"}
	responses := make(chan *httptest.ResponseRecorder, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); responses <- f.request("POST", "/api/v1/appointments", input, own...) }()
	}
	wg.Wait()
	close(responses)
	counts := map[int]int{}
	var id string
	for response := range responses {
		counts[response.Code]++
		if response.Code == 201 {
			var obj map[string]any
			_ = json.Unmarshal(response.Body.Bytes(), &obj)
			id = obj["id"].(string)
		} else if response.Code != 409 {
			t.Fatal(response.Code, response.Body.String())
		}
	}
	if counts[201] != 1 || counts[409] != 1 {
		t.Fatal(counts)
	}
	w = f.request("GET", path, nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	_ = json.Unmarshal(w.Body.Bytes(), &result)
	if len(result.Slots) != 1 {
		t.Fatal(w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/appointments/"+id, map[string]any{"status": "Cancelada", "date": input.Date, "time": "10:00"}, own...)
	if w.Code != 400 {
		t.Fatal("ambiguous mutation", w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/appointments/"+id, map[string]any{"status": "Cancelada"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	schedule.Holidays = []holidayInput{{Date: input.Date, Name: "Cerrado"}}
	w = f.request("PUT", "/api/v1/settings/schedule", schedule, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/appointments", input, own...)
	if w.Code != 409 {
		t.Fatal("holiday", w.Code, w.Body.String())
	}
	w = f.request("GET", path, nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	_ = json.Unmarshal(w.Body.Bytes(), &result)
	if len(result.Slots) != 0 {
		t.Fatal(w.Body.String())
	}
	schedule.Hours = append(schedule.Hours, hoursInput{Weekday: int(date.Weekday()), Start: "10:00", End: "12:00", SlotMinutes: 30})
	w = f.request("PUT", "/api/v1/settings/schedule", schedule, own...)
	if w.Code != 400 {
		t.Fatal("overlap accepted", w.Code)
	}
}

func TestWaitingRoomLifecycle(t *testing.T) {
	f, own, other, pid, _ := setupSharing(t)
	ctx := context.Background()
	doctor := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO doctors(id,clinic_id,name,specialty,initials) VALUES($1,$2,'Vet','General','VT')", doctor, f.clinic); e != nil {
		t.Fatal(e)
	}
	now := time.Now().In(domain.Santiago)
	w := f.request("POST", "/api/v1/appointments", appointmentInput{PatientID: pid, DoctorID: doctor, Date: now.Format("2006-01-02"), Time: now.Format("15:04"), Reason: "Urgencia", Emergency: true}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var ap map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &ap)
	aid := ap["id"].(string)
	w = f.request("POST", "/api/v1/security/waiting", map[string]string{"appointmentId": aid}, other...)
	if w.Code != 404 {
		t.Fatal("cross tenant arrival", w.Code)
	}
	w = f.request("POST", "/api/v1/security/waiting", map[string]string{"appointmentId": aid}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var arrival struct{ Waiting struct{ ID string } }
	_ = json.Unmarshal(w.Body.Bytes(), &arrival)
	w = f.request("POST", "/api/v1/security/waiting", map[string]string{"appointmentId": aid}, own...)
	if w.Code != 409 {
		t.Fatal("duplicate arrival", w.Code)
	}
	w = f.request("POST", "/api/v1/rooms", map[string]string{"name": "Box 1", "kind": "box"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var room map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &room)
	rid := room["id"].(string)
	w = f.request("POST", "/api/v1/security/waiting/"+arrival.Waiting.ID+"/call", map[string]string{"roomId": rid}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/security/waiting/"+arrival.Waiting.ID+"/call", map[string]string{"roomId": rid}, own...)
	if w.Code != 409 {
		t.Fatal("double call", w.Code)
	}
	w = f.request("POST", "/api/v1/rooms/"+rid+"/finish", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/rooms/"+rid+"/finish", nil, own...)
	if w.Code != 409 {
		t.Fatal("double finish", w.Code)
	}
	w = f.request("PATCH", "/api/v1/rooms/"+rid, map[string]string{"status": "disponible"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var status string
	if e := f.pool.QueryRow(ctx, "SELECT status FROM appointments WHERE id=$1", aid).Scan(&status); e != nil || status != "Realizada" {
		t.Fatal(status, e)
	}
	var count int
	if e := f.pool.QueryRow(ctx, "SELECT count(*) FROM access_entries WHERE appointment_id=$1", aid).Scan(&count); e != nil || count != 1 {
		t.Fatal(count, e)
	}
}
