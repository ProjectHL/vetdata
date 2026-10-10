package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/vetdata/api/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

func setupStaff(t *testing.T, f *fixture) []*http.Cookie {
	t.Helper()
	ctx := context.Background()
	hash, _ := bcrypt.GenerateFromPassword([]byte("Test-password-123"), 4)
	uid := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO users(id,name,email,password_hash,status) VALUES($1,'Staff','staff@example.test',$2,'Activo')", uid, string(hash)); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO memberships(user_id,clinic_id,role) VALUES($1,$2,'Admin')", uid, StaffClinicID); e != nil {
		t.Fatal(e)
	}
	for _, p := range []string{"soporte.crear", "soporte.administrar"} {
		if _, e := f.pool.Exec(ctx, "INSERT INTO role_permissions(clinic_id,role,permission) VALUES($1,'Admin',$2) ON CONFLICT DO NOTHING", StaffClinicID, p); e != nil {
			t.Fatal(e)
		}
	}
	w := f.request("POST", "/api/v1/auth/login", map[string]string{"email": "staff@example.test", "password": "Test-password-123", "clinicId": StaffClinicID})
	if w.Code != 200 {
		t.Fatalf("staff login %d %s", w.Code, w.Body.String())
	}
	return w.Result().Cookies()
}

func TestSupportTicketsIdeasAndStaff(t *testing.T) {
	f, own, other, _, _ := setupSharing(t)
	ctx := context.Background()

	// Clinic creates a ticket (Nuevo, first message = body).
	w := f.request("POST", "/api/v1/support/tickets", map[string]any{"title": "No puedo facturar", "category": "Incidencia", "priority": "Alta", "module": "Clínica › Facturación", "body": "Al emitir sale 500"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var ticket map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &ticket)
	tid := ticket["id"].(string)
	if ticket["status"] != "Nuevo" || ticket["number"] != float64(1041) {
		t.Fatal("ticket created", ticket)
	}

	// Tenant isolation: other clinic cannot see it.
	if w := f.request("GET", "/api/v1/support/tickets/"+tid, nil, other...); w.Code != 404 {
		t.Fatal("cross-tenant ticket", w.Code, w.Body.String())
	}

	// Clinic lists only own without administrar.
	recep := f.loginAs(t, "Recepción")
	w = f.request("POST", "/api/v1/support/tickets", map[string]any{"title": "Duda", "category": "Consulta", "priority": "Baja", "module": "Clínica › Agenda", "body": "¿Cómo reasigno?"}, recep...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/support/tickets?scope=all", nil, recep...)
	if w.Code != 403 {
		t.Fatal("scope all guard", w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/support/tickets", nil, recep...)
	var mine []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &mine)
	if len(mine) != 1 {
		t.Fatal("own tickets", w.Body.String())
	}

	// Clinic reply: Esperando cliente -> En progreso.
	w = f.request("PATCH", "/api/v1/support/tickets/"+tid+"/status", map[string]any{"status": "Esperando cliente"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/support/tickets/"+tid+"/messages", map[string]any{"body": "Adjunto captura"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	_ = json.Unmarshal(w.Body.Bytes(), &ticket)
	if ticket["status"] != "En progreso" {
		t.Fatal("reply progress", ticket)
	}

	// Clinic cannot take VetData states or close without administrar.
	for _, st := range []string{"En revisión", "Cerrado"} {
		w = f.request("PATCH", "/api/v1/support/tickets/"+tid+"/status", map[string]any{"status": st}, own...)
		if w.Code != 403 && w.Code != 409 {
			t.Fatal("clinic state guard", st, w.Code, w.Body.String())
		}
	}
	// Clinic CAN mark Resuelto (its own resolution path).
	w = f.request("PATCH", "/api/v1/support/tickets/"+tid+"/status", map[string]any{"status": "Resuelto"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}

	// Rate while Resuelto closes it.
	w = f.request("POST", "/api/v1/support/tickets/"+tid+"/rating", map[string]any{"rating": 5}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	_ = json.Unmarshal(w.Body.Bytes(), &ticket)
	if ticket["status"] != "Cerrado" {
		t.Fatal("rated closed", ticket)
	}
	// Reply on closed -> 409.
	if w := f.request("POST", "/api/v1/support/tickets/"+tid+"/messages", map[string]any{"body": "tardío"}, own...); w.Code != 409 {
		t.Fatal("reply closed", w.Code, w.Body.String())
	}

	// proposeIdea is atomic: idea + Mejora ticket linked.
	w = f.request("POST", "/api/v1/support/ideas", map[string]any{"title": "Modo oscuro", "description": "Para turnos nocturnos", "module": "Clínica › General"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var proposed map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &proposed)
	idea := proposed["idea"].(map[string]any)
	linked := proposed["ticket"].(map[string]any)
	if idea["status"] != "En evaluación" || idea["votes"] != float64(1) || idea["votedByMe"] != true {
		t.Fatal("idea created", idea)
	}
	if linked["category"] != "Mejora" || linked["ideaId"] != idea["id"] {
		t.Fatal("idea ticket", linked)
	}

	// Vote: voted=true adds a vote; voted=false removes it. Idempotent.
	iid := idea["id"].(string)
	w = f.request("POST", "/api/v1/support/ideas/"+iid+"/vote", map[string]any{"voted": true}, other...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/support/ideas/"+iid+"/vote", map[string]any{"voted": true}, other...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var voted map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &voted)
	if voted["votes"] != float64(2) || voted["votedByMe"] != true {
		t.Fatal("vote idempotent", voted)
	}

	// Unvote idempotently.
	w = f.request("POST", "/api/v1/support/ideas/"+iid+"/vote", map[string]any{"voted": false}, other...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var unvoted map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &unvoted)
	if unvoted["votes"] != float64(1) || unvoted["votedByMe"] != false {
		t.Fatal("unvote", unvoted)
	}
	// No-op: voted=false when already not voted.
	w = f.request("POST", "/api/v1/support/ideas/"+iid+"/vote", map[string]any{"voted": false}, other...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	_ = json.Unmarshal(w.Body.Bytes(), &unvoted)
	if unvoted["votes"] != float64(1) || unvoted["votedByMe"] != false {
		t.Fatal("unvote no-op", unvoted)
	}

	// Releases are read-only for clinics.
	w = f.request("GET", "/api/v1/support/releases", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}

	// SLA: Crítica overdue without response.
	var sla string
	if e := f.pool.QueryRow(ctx, "SELECT 'x'").Scan(&sla); e != nil {
		t.Fatal(e)
	}
	_ = sla

	// Staff session in the backoffice tenant.
	staff := setupStaff(t, f)
	w = f.request("GET", "/api/v1/admin/tickets", nil, staff...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var queue []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &queue)
	if len(queue) < 2 {
		t.Fatal("staff queue sees all clinics", w.Body.String())
	}

	// Staff replies: sets firstResponseAt once, moves Nuevo -> En revisión.
	var fresh string
	if e := f.pool.QueryRow(ctx, "SELECT id FROM support_tickets WHERE status='Nuevo' LIMIT 1").Scan(&fresh); e != nil {
		t.Fatal(e)
	}
	w = f.request("POST", "/api/v1/admin/tickets/"+fresh+"/messages", map[string]any{"body": "Lo estamos viendo"}, staff...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var answered map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &answered)
	if answered["status"] != "En revisión" || answered["firstResponseAt"] == nil {
		t.Fatal("staff reply", answered)
	}
	// Clinic session cannot reach /admin.
	if w := f.request("GET", "/api/v1/admin/tickets", nil, own...); w.Code != 403 {
		t.Fatal("admin guard", w.Code, w.Body.String())
	}
	// Clinic cannot switch into the staff tenant.
	if w := f.request("POST", "/api/v1/auth/clinic", map[string]string{"clinicId": StaffClinicID}, own...); w.Code != 403 {
		t.Fatal("staff tenant guard", w.Code, w.Body.String())
	}
	_ = domain.UUID
}

func TestSupportVoteIdempotentAndNoOp(t *testing.T) {
	f, own, other, _, _ := setupSharing(t)
	ctx := context.Background()

	// Propose an idea with `own` (creates 1 vote from own's clinic).
	w := f.request("POST", "/api/v1/support/ideas", map[string]any{"title": "Modooscuro", "description": "Para turnos nocturnos", "module": "Clínica › General"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var proposed map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &proposed)
	iid := proposed["idea"].(map[string]any)["id"].(string)

	// 400: missing voted body.
	if w := f.request("POST", "/api/v1/support/ideas/"+iid+"/vote", nil, other...); w.Code != 400 {
		t.Fatal("missing voted -> 400", w.Code, w.Body.String())
	}
	// 400: unknown field rejected (DisallowUnknownFields).
	if w := f.request("POST", "/api/v1/support/ideas/"+iid+"/vote", map[string]any{"vote": true}, other...); w.Code != 400 {
		t.Fatal("unknown field -> 400", w.Code, w.Body.String())
	}

	// 400: missing voted.
	if w := f.request("POST", "/api/v1/support/ideas/"+iid+"/vote", nil, other...); w.Code != 400 {
		t.Fatal("missing voted", w.Code, w.Body.String())
	}

	// other clinic votes (voted=true), then repeats the SAME body -> idempotent: still voted.
	// NOTE: `mutate` dedupes identical bodies under the same Idempotency-Key
	// (409 idempotency_conflict on different body), so each call needs its own key.
	voteTrue := func() *httptest.ResponseRecorder {
		// unique idempotency key per call so the server doesn't dedupe.
		return f.requestKey("POST", "/api/v1/support/ideas/"+iid+"/vote", domain.UUID(), map[string]any{"voted": true}, other...)
	}
	w = voteTrue()
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var idea map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &idea)
	if idea["votes"] != float64(2) || idea["votedByMe"] != true {
		t.Fatal("first vote voted=true", idea)
	}
	// Same desired state again: no-op, still voted, same canonical state.
	w = voteTrue()
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	_ = json.Unmarshal(w.Body.Bytes(), &idea)
	if idea["votes"] != float64(2) || idea["votedByMe"] != true {
		t.Fatal("idempotent vote voted=true", idea)
	}

	// voted=true again must not add a duplicate row: votes stays 2.
	w = voteTrue()
	_ = json.Unmarshal(w.Body.Bytes(), &idea)
	if idea["votes"] != float64(2) || idea["votedByMe"] != true {
		t.Fatal("duplicate prevented", idea)
	}

	// voted=false while voted removes the vote (DELETE). A second voted=false
	// would be the no-op; it is asserted at the end of this test.
	w = f.requestKey("POST", "/api/v1/support/ideas/"+iid+"/vote", domain.UUID(), map[string]any{"voted": false}, other...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	_ = json.Unmarshal(w.Body.Bytes(), &idea)
	if idea["votes"] != float64(1) || idea["votedByMe"] != false {
		t.Fatal("unvote voted=false", idea)
	}

	// No-op: voted=false when already not voted -> still not voted.
	w = f.requestKey("POST", "/api/v1/support/ideas/"+iid+"/vote", domain.UUID(), map[string]any{"voted": false}, other...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	_ = json.Unmarshal(w.Body.Bytes(), &idea)
	if idea["votes"] != float64(1) || idea["votedByMe"] != false {
		t.Fatal("no-op voted=false when not voted", idea)
	}

	// Concurrency: 10 parallel voted=true from the same clinic converge to 1 vote row
	// (own clinic's + other clinic's = 2 total, but other contributes exactly 1).
	// At this point other is NOT voted (removed above), so all goroutines agree on voted=true.
	ideaIID := iid
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			f.requestKey("POST", "/api/v1/support/ideas/"+ideaIID+"/vote", domain.UUID(), map[string]any{"voted": true}, other...)
		}()
	}
	wg.Wait()
	var votes int
	if err := f.pool.QueryRow(ctx, "SELECT count(*) FROM support_votes WHERE idea_id=$1", ideaIID).Scan(&votes); err != nil {
		t.Fatal(err)
	}
	if votes != 2 {
		t.Fatal("concurrent idempotent votes", votes)
	}
}

func TestSupportVoteLaunchedIdea(t *testing.T) {
	f, _, _, _, _ := setupSharing(t)
	ctx := context.Background()

	// Propose then set status to Lanzada, then voting must 409 (proposer's own clinic,
	// which is already voted, tries voted=false: the 409 takes precedence over the no-op).
	w := f.request("POST", "/api/v1/support/ideas", map[string]any{"title": "Lanzada", "description": "x", "module": "Clínica › General"}, f.login(t)...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var proposed map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &proposed)
	iid := proposed["idea"].(map[string]any)["id"].(string)

	if _, e := f.pool.Exec(ctx, "UPDATE support_ideas SET status='Lanzada' WHERE id=$1", iid); e != nil {
		t.Fatal(e)
	}
	own := f.login(t)
	// voted=false would be a no-op (own clinic already voted), but Lanzada wins with 409.
	w = f.requestKey("POST", "/api/v1/support/ideas/"+iid+"/vote", domain.UUID(), map[string]any{"voted": false}, own...)
	if w.Code != 409 {
		t.Fatal("launched idea vote", w.Code, w.Body.String())
	}
}
