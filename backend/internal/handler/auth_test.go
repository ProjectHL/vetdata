package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vetdata/api/internal/domain"
	"github.com/vetdata/api/internal/notifications"
	"github.com/vetdata/api/internal/testutil"
	"github.com/vetdata/api/migrations"
	"golang.org/x/crypto/bcrypt"
)

type fixture struct {
	pool                *pgxpool.Pool
	handler             http.Handler
	user, clinic, other string
	mail                *notifications.Outbox
	sender              *captureMail
}
type captureMail struct {
	mu       sync.Mutex
	messages []notifications.Message
}

func (m *captureMail) Send(_ context.Context, v notifications.Message) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.messages = append(m.messages, v)
	return nil
}
func newFixture(t *testing.T) *fixture {
	t.Helper()
	pool := testutil.Database(t)
	ctx := context.Background()
	if err := migrations.Apply(ctx, pool); err != nil {
		t.Fatal(err)
	}
	f := &fixture{pool: pool, user: domain.UUID(), clinic: domain.UUID(), other: domain.UUID(), sender: &captureMail{}}
	for _, cid := range []string{f.clinic, f.other} {
		gid := domain.UUID()
		if _, err := pool.Exec(ctx, "INSERT INTO groups(id,name) VALUES($1,'Test')", gid); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO clinics(id,group_id,name,sector,address,phone,email,status,joined_at)
  VALUES($1,$2,'Test clinic','Test','Test','123','test@example.test','Conectada',current_date)`, cid, gid); err != nil {
			t.Fatal(err)
		}
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte("Test-password-123"), 4)
	if _, err := pool.Exec(ctx, "INSERT INTO users(id,name,email,password_hash,status) VALUES($1,'Test user','test@example.test',$2,'Activo')", f.user, string(hash)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "INSERT INTO memberships(user_id,clinic_id,role) VALUES($1,$2,'Admin')", f.user, f.clinic); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "INSERT INTO role_permissions(clinic_id,role,permission) VALUES($1,'Admin','usuarios.administrar')", f.clinic); err != nil {
		t.Fatal(err)
	}
	// T4-3 support permissions: Admin manages; Recepción creates/reply.
	// (soporte.crear is a new T4-3 perm; it does not affect pre-T4-3 perms.)
	for _, cid := range []string{f.clinic, f.other} {
		for _, role := range []string{"Admin", "Recepción"} {
			for _, p := range []string{"soporte.crear"} {
				if _, e := pool.Exec(ctx, "INSERT INTO role_permissions(clinic_id,role,permission) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", cid, role, p); e != nil {
					t.Fatal(e)
				}
			}
		}
	}
	for _, p := range []string{"soporte.crear", "soporte.administrar"} {
		if _, e := pool.Exec(ctx, "INSERT INTO role_permissions(clinic_id,role,permission) VALUES($1,'Admin',$2) ON CONFLICT DO NOTHING", f.clinic, p); e != nil {
			t.Fatal(e)
		}
	}
	var err error
	f.mail, err = notifications.New(pool, base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{42}, 32)), f.sender)
	if err != nil {
		t.Fatal(err)
	}
	f.handler = NewWithOptions(pool, slog.New(slog.NewTextHandler(io.Discard, nil)), Options{Origin: "http://localhost:3000", Mail: f.mail})
	return f
}
func (f *fixture) request(method, path string, body any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	return f.requestKey(method, path, domain.UUID(), body, cookies...)
}
func (f *fixture) requestKey(method, path, key string, body any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	var data []byte
	if body != nil {
		data, _ = json.Marshal(body)
	}
	r := httptest.NewRequest(method, path, bytes.NewReader(data))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Origin", "http://localhost:3000")
	r.Header.Set("Idempotency-Key", key)
	for _, c := range cookies {
		r.AddCookie(c)
	}
	w := httptest.NewRecorder()
	f.handler.ServeHTTP(w, r)
	return w
}
func (f *fixture) login(t *testing.T) []*http.Cookie {
	t.Helper()
	w := f.request("POST", "/api/v1/auth/login", map[string]string{"email": "test@example.test", "password": "Test-password-123", "clinicId": f.clinic})
	if w.Code != 200 {
		t.Fatalf("login %d %s", w.Code, w.Body.String())
	}
	return w.Result().Cookies()
}
func (f *fixture) loginAs(t *testing.T, role string) []*http.Cookie {
	t.Helper()
	ctx := context.Background()
	hash, _ := bcrypt.GenerateFromPassword([]byte("Test-password-123"), 4)
	uid := domain.UUID()
	email := "role-" + role + "@example.test"
	if _, e := f.pool.Exec(ctx, "INSERT INTO users(id,name,email,password_hash,status) VALUES($1,'Role Test',$2,$3,'Activo')", uid, email, string(hash)); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO memberships(user_id,clinic_id,role) VALUES($1,$2,$3)", uid, f.clinic, role); e != nil {
		t.Fatal(e)
	}
	w := f.request("POST", "/api/v1/auth/login", map[string]string{"email": email, "password": "Test-password-123", "clinicId": f.clinic})
	if w.Code != 200 {
		t.Fatalf("loginAs %s: %d %s", role, w.Code, w.Body.String())
	}
	return w.Result().Cookies()
}
func TestAuthRotationReplayAndTenant(t *testing.T) {
	f := newFixture(t)
	cookies := f.login(t)
	w := f.request("GET", "/api/v1/me", nil, cookies...)
	if w.Code != 200 || !strings.Contains(w.Body.String(), f.clinic) {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/auth/clinic", map[string]string{"clinicId": f.other}, cookies...)
	if w.Code != 403 {
		t.Fatal("cross tenant", w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/auth/refresh", nil, cookies...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	rotated := w.Result().Cookies()
	w = f.request("GET", "/api/v1/me", nil, cookies...)
	if w.Code != 401 {
		t.Fatal("old access accepted", w.Code)
	}
	w = f.request("GET", "/api/v1/me", nil, rotated...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/auth/refresh", nil, cookies...)
	if w.Code != 401 {
		t.Fatal("replay", w.Code)
	}
	w = f.request("GET", "/api/v1/me", nil, rotated...)
	if w.Code != 401 {
		t.Fatal("family survived replay", w.Code)
	}
}
func TestRecoveryEncryptedSingleUseAndRevocation(t *testing.T) {
	f := newFixture(t)
	cookies := f.login(t)
	w := f.request("POST", "/api/v1/auth/recovery", map[string]string{"email": "test@example.test"})
	if w.Code != 202 {
		t.Fatal(w.Code, w.Body.String())
	}
	var ciphertext []byte
	if err := f.pool.QueryRow(context.Background(), "SELECT encrypted_message FROM notification_outbox").Scan(&ciphertext); err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("token=")) {
		t.Fatal("plaintext token")
	}
	delivered, err := f.mail.DeliverOne(context.Background())
	if err != nil || !delivered {
		t.Fatal(delivered, err)
	}
	if len(f.sender.messages) != 1 {
		t.Fatal("mail not delivered")
	}
	raw := strings.Split(f.sender.messages[0].Body, "#token=")[1]
	w = f.request("POST", "/api/v1/auth/reset", map[string]string{"token": raw, "password": "Changed-password-123"})
	if w.Code != 204 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/auth/reset", map[string]string{"token": raw, "password": "Changed-again-123"})
	if w.Code != 400 {
		t.Fatal("reused token", w.Code)
	}
	w = f.request("GET", "/api/v1/me", nil, cookies...)
	if w.Code != 401 {
		t.Fatal("session survived reset")
	}
	w = f.request("POST", "/api/v1/auth/login", map[string]string{"email": "test@example.test", "password": "Changed-password-123"})
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
}
func TestOriginStatusAndStrictInput(t *testing.T) {
	f := newFixture(t)
	r := httptest.NewRequest("POST", "/api/v1/auth/login", strings.NewReader("{}"))
	r.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	f.handler.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("origin")
	}
	w = f.request("POST", "/api/v1/auth/login", map[string]any{"email": "test@example.test", "password": "Test-password-123", "role": "Admin"})
	if w.Code != 400 {
		t.Fatal("unknown field")
	}
	if _, err := f.pool.Exec(context.Background(), "UPDATE users SET status='Inactivo' WHERE id=$1", f.user); err != nil {
		t.Fatal(err)
	}
	w = f.request("POST", "/api/v1/auth/login", map[string]string{"email": "test@example.test", "password": "Test-password-123"})
	if w.Code != 401 {
		t.Fatal("inactive login", w.Code)
	}
}

func TestAdminMFAEnrollChallengeAndVerify(t *testing.T) {
	f := newFixture(t)
	admin := f.login(t)
	w := f.request("POST", "/api/v1/auth/mfa/enroll", map[string]any{}, admin...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var enrolled map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &enrolled)
	codes, ok := enrolled["recoveryCodes"].([]any)
	if !ok || len(codes) == 0 {
		t.Fatal("recovery codes missing", enrolled)
	}
	code := codes[0].(string)

	// Password login for an enrolled Admin returns a challenge and no session cookies.
	w = f.request("POST", "/api/v1/auth/login", map[string]string{"email": "test@example.test", "password": "Test-password-123", "clinicId": f.clinic})
	if w.Code != 202 {
		t.Fatal(w.Code, w.Body.String())
	}
	if len(w.Result().Cookies()) != 0 {
		t.Fatal("challenge issued cookies")
	}
	var challenged map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &challenged)
	challenge, _ := challenged["challengeToken"].(string)
	if challenge == "" || challenged["twoFactorRequired"] != true {
		t.Fatal("challenge missing", challenged)
	}
	w = f.request("POST", "/api/v1/auth/mfa/verify", map[string]string{"challengeToken": challenge, "code": code})
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	cookies := w.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("verify did not issue cookies")
	}
	w = f.request("GET", "/api/v1/me", nil, cookies...)
	if w.Code != 200 {
		t.Fatal("verified session", w.Code, w.Body.String())
	}
	// Code is single-use and challenge is consumed.
	w = f.request("POST", "/api/v1/auth/mfa/verify", map[string]string{"challengeToken": challenge, "code": code})
	if w.Code != 401 {
		t.Fatal("reused mfa", w.Code, w.Body.String())
	}
}

func TestAdminMFAResetDoesNotBypassSecondFactor(t *testing.T) {
	f := newFixture(t)
	admin := f.login(t)
	w := f.request("POST", "/api/v1/auth/mfa/enroll", map[string]any{}, admin...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/auth/recovery", map[string]string{"email": "test@example.test"})
	if w.Code != 202 {
		t.Fatal(w.Code, w.Body.String())
	}
	delivered, err := f.mail.DeliverOne(context.Background())
	if err != nil || !delivered {
		t.Fatal(delivered, err)
	}
	raw := strings.Split(f.sender.messages[len(f.sender.messages)-1].Body, "#token=")[1]
	w = f.request("POST", "/api/v1/auth/reset", map[string]string{"token": raw, "password": "Changed-password-123"})
	if w.Code != 204 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/auth/login", map[string]string{"email": "test@example.test", "password": "Changed-password-123", "clinicId": f.clinic})
	if w.Code != 202 {
		t.Fatal("reset bypassed mfa", w.Code, w.Body.String())
	}
}

func TestMFAEnrollRequiresAdmin(t *testing.T) {
	f := newFixture(t)
	vet := f.loginAs(t, "Veterinario")
	w := f.request("POST", "/api/v1/auth/mfa/enroll", map[string]any{}, vet...)
	if w.Code != 403 {
		t.Fatal(w.Code, w.Body.String())
	}
}
