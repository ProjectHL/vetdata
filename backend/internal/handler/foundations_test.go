package handler

import (
	"context"
	"encoding/json"
	"github.com/vetdata/api/internal/domain"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestPhaseOneSessionLifecycle(t *testing.T) {
	f := newFixture(t)
	f.handler = NewWithOptions(f.pool, slog.New(slog.NewTextHandler(io.Discard, nil)), Options{Origin: "http://localhost:3000", Mail: f.mail, SecureCookies: true})
	ctx := context.Background()
	cookies := f.login(t)
	for _, c := range cookies {
		if !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteLaxMode || c.MaxAge <= 0 {
			t.Fatal("unsafe cookie", c.Name)
		}
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO memberships(user_id,clinic_id,role,status) VALUES($1,$2,'Farmacia','Activo')", f.user, f.other); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO role_permissions(clinic_id,role,permission) VALUES($1,'Farmacia','farmacia.dispensar')", f.other); e != nil {
		t.Fatal(e)
	}
	w := f.request("POST", "/api/v1/auth/clinic", map[string]string{"clinicId": f.other}, cookies...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	rotated := w.Result().Cookies()
	w = f.request("GET", "/api/v1/me?clinicId="+f.clinic, nil, rotated...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var me struct {
		User        struct{ Role string }
		Clinic      struct{ ID string }
		Permissions []string
	}
	if e := json.Unmarshal(w.Body.Bytes(), &me); e != nil {
		t.Fatal(e)
	}
	if me.Clinic.ID != f.other || me.User.Role != "Farmacia" || len(me.Permissions) != 1 || me.Permissions[0] != "farmacia.dispensar" {
		t.Fatal(w.Body.String())
	}
	if w = f.request("GET", "/api/v1/users", nil, rotated...); w.Code != 403 {
		t.Fatal("role escaped clinic", w.Code)
	}
	if w = f.request("GET", "/api/v1/me", nil, cookies...); w.Code != 401 {
		t.Fatal("old token active", w.Code)
	}
	if w = f.request("POST", "/api/v1/auth/logout", nil, rotated...); w.Code != 204 {
		t.Fatal(w.Code)
	}
	for _, c := range w.Result().Cookies() {
		if c.MaxAge != -1 {
			t.Fatal("cookie not cleared")
		}
	}
	if w = f.request("POST", "/api/v1/auth/refresh", nil, rotated...); w.Code != 401 {
		t.Fatal("logout not revoked", w.Code)
	}
	cookies = f.login(t)
	if _, e := f.pool.Exec(ctx, "UPDATE auth_sessions SET access_expires_at=now()-interval '1 second' WHERE user_id=$1", f.user); e != nil {
		t.Fatal(e)
	}
	if w = f.request("GET", "/api/v1/me", nil, cookies...); w.Code != 401 {
		t.Fatal("expired access accepted", w.Code)
	}
	if w = f.request("POST", "/api/v1/auth/refresh", nil, cookies...); w.Code != 200 {
		t.Fatal("refresh after access expiry", w.Code)
	}
	cookies = w.Result().Cookies()
	if _, e := f.pool.Exec(ctx, "UPDATE auth_sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1", f.user); e != nil {
		t.Fatal(e)
	}
	if w = f.request("POST", "/api/v1/auth/refresh", nil, cookies...); w.Code != 401 {
		t.Fatal("expired session refreshed", w.Code)
	}
	if _, e := f.pool.Exec(ctx, "UPDATE users SET status='Invitado' WHERE id=$1", f.user); e != nil {
		t.Fatal(e)
	}
	if w = f.request("POST", "/api/v1/auth/login", map[string]string{"email": "test@example.test", "password": "Test-password-123"}); w.Code != 401 {
		t.Fatal("invited login", w.Code)
	}
}

func TestRecoveryExpiryEnumerationAndRateLimit(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	known := f.request("POST", "/api/v1/auth/recovery", map[string]string{"email": "test@example.test"})
	unknown := f.request("POST", "/api/v1/auth/recovery", map[string]string{"email": "absent@example.test"})
	if known.Code != 202 || unknown.Code != 202 || known.Body.String() != unknown.Body.String() {
		t.Fatal("account enumeration")
	}
	if _, e := f.mail.DeliverOne(ctx); e != nil {
		t.Fatal(e)
	}
	raw := strings.Split(f.sender.messages[0].Body, "#token=")[1]
	if _, e := f.pool.Exec(ctx, "UPDATE auth_action_tokens SET expires_at=now()-interval '1 second'"); e != nil {
		t.Fatal(e)
	}
	w := f.request("POST", "/api/v1/auth/reset", map[string]string{"token": raw, "password": "Replacement-password"})
	if w.Code != 400 {
		t.Fatal("expired recovery accepted", w.Code)
	}
	for i := 0; i < 3; i++ {
		w = f.request("POST", "/api/v1/auth/recovery", map[string]string{"email": " TEST@example.test "})
	}
	if w.Code != 429 {
		t.Fatal("whitespace bypassed limit", w.Code)
	}
}

func TestFoundationsRUTProfileFilteringAndIdempotency(t *testing.T) {
	f, own, other, _, _ := setupSharing(t)
	in := profileInput{LegalName: "Clinic SpA", RUT: "12.345.678-5", Email: "clinic@example.test"}
	key := domain.UUID()
	responses := make(chan *httptest.ResponseRecorder, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			responses <- f.requestKey("PUT", "/api/v1/settings/clinic-profile", key, in, own...)
		}()
	}
	wg.Wait()
	close(responses)
	for w := range responses {
		if w.Code != 200 || !strings.Contains(w.Body.String(), "12345678-5") {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	var n int
	if e := f.pool.QueryRow(context.Background(), "SELECT count(*) FROM audit_events WHERE action='clinic.profile.changed'").Scan(&n); e != nil || n != 1 {
		t.Fatal("duplicate side effect", n, e)
	}
	w := f.request("GET", "/api/v1/settings/clinic-profile", nil, other...)
	if w.Code != 200 || strings.Contains(w.Body.String(), "Clinic SpA") {
		t.Fatal("profile leaked", w.Code)
	}
	in.RUT = "12.345.678-0"
	if w = f.request("PUT", "/api/v1/settings/clinic-profile", in, own...); w.Code != 400 {
		t.Fatal("invalid rut", w.Code)
	}
	for _, path := range []string{"/api/v1/patients?q=absent", "/api/v1/owners?q=absent", "/api/v1/users?role=Farmacia"} {
		w = f.request("GET", path, nil, own...)
		if w.Code != 200 || strings.TrimSpace(w.Body.String()) != "[]" {
			t.Fatal(path, w.Code, w.Body.String())
		}
	}
	if w = f.request("GET", "/api/v1/patients?limit=201", nil, own...); w.Code != 400 {
		t.Fatal("invalid pagination", w.Code)
	}
	duplicate := ownerInput{RUT: "12.345.678-5", FirstName: "Duplicate", LastName: "Owner", Email: "duplicate@example.test", BirthDate: "1990-01-01", PreferredContact: "Email"}
	if w = f.request("POST", "/api/v1/owners", duplicate, own...); w.Code != 409 {
		t.Fatal("normalized duplicate", w.Code, w.Body.String())
	}
}

func TestCorrelativesConcurrentAndRollback(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	var wg sync.WaitGroup
	values := make(chan int64, 12)
	errs := make(chan error, 12)
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			tx, e := f.pool.Begin(ctx)
			if e != nil {
				errs <- e
				return
			}
			defer tx.Rollback(ctx)
			n, e := nextNumber(ctx, tx, f.clinic, "test")
			if e == nil {
				e = tx.Commit(ctx)
			}
			if e != nil {
				errs <- e
				return
			}
			values <- n
		}()
	}
	wg.Wait()
	close(values)
	close(errs)
	for e := range errs {
		t.Fatal(e)
	}
	seen := map[int64]bool{}
	for n := range values {
		if seen[n] {
			t.Fatal("duplicate", n)
		}
		seen[n] = true
	}
	if len(seen) != 12 {
		t.Fatal(seen)
	}
	tx, e := f.pool.Begin(ctx)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = nextNumber(ctx, tx, f.clinic, "test"); e != nil {
		t.Fatal(e)
	}
	_ = tx.Rollback(ctx)
	tx, e = f.pool.Begin(ctx)
	if e != nil {
		t.Fatal(e)
	}
	defer tx.Rollback(ctx)
	n, e := nextNumber(ctx, tx, f.clinic, "test")
	if e != nil || n != 13 {
		t.Fatal(n, e)
	}
	other, e := nextNumber(ctx, tx, f.other, "test")
	if e != nil || other != 1 {
		t.Fatal(other, e)
	}
}

func TestHealthUnavailableAndBusinessClock(t *testing.T) {
	f := newFixture(t)
	f.pool.Close()
	started := time.Now()
	w := f.request("GET", "/healthz", nil)
	if w.Code != 503 || time.Since(started) > 3*time.Second {
		t.Fatal(w.Code, time.Since(started))
	}
	at := time.Date(2026, 10, 8, 1, 0, 0, 0, time.UTC)
	ctx := domain.WithNow(context.Background(), at)
	if domain.LocalDate(domain.Now(ctx)) != "2026-10-07" {
		t.Fatal("Santiago date boundary")
	}
}
