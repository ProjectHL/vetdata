package handler

import (
	"context"
	"encoding/json"
	"github.com/vetdata/api/internal/domain"
	"github.com/vetdata/api/internal/model"
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"strings"
	"testing"
)

func setupSharing(t *testing.T) (*fixture, []*http.Cookie, []*http.Cookie, string, string) {
	t.Helper()
	f := newFixture(t)
	ctx := context.Background()
	for _, cid := range []string{f.clinic, f.other} {
		for _, p := range model.AllPermissions {
			if _, e := f.pool.Exec(ctx, "INSERT INTO role_permissions(clinic_id,role,permission) VALUES($1,'Admin',$2) ON CONFLICT DO NOTHING", cid, string(p)); e != nil {
				t.Fatal(e)
			}
		}
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte("Test-password-123"), 4)
	uid := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO users(id,name,email,password_hash,status) VALUES($1,'Other','other@example.test',$2,'Activo')", uid, string(hash)); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO memberships(user_id,clinic_id,role) VALUES($1,$2,'Admin')", uid, f.other); e != nil {
		t.Fatal(e)
	}
	own := f.login(t)
	w := f.request("POST", "/api/v1/auth/login", map[string]string{"email": "other@example.test", "password": "Test-password-123", "clinicId": f.other})
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	other := w.Result().Cookies()
	w = f.request("POST", "/api/v1/owners", ownerInput{RUT: "12345678-5", FirstName: "Owner", LastName: "Test", Email: "owner@example.test", Phone: "private-phone", BirthDate: "1990-01-01", PreferredContact: "Email"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var o map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &o)
	oid := o["id"].(string)
	w = f.request("POST", "/api/v1/patients", patientInput{OwnerID: oid, Name: "Test patient", Species: "Perro", Sex: "Macho", BirthDate: "2020-01-01", Chip: "secret-chip", Allergies: []string{"test allergy"}}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var p map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &p)
	pid := p["id"].(string)
	if _, e := f.pool.Exec(ctx, "INSERT INTO clinical_records(patient_id,clinic_id,actor_id,kind,payload) VALUES($1,$2,$3,'consultation',$4)", pid, f.clinic, f.user, []byte(`{"diagnosis":"secret diagnosis"}`)); e != nil {
		t.Fatal(e)
	}
	return f, own, other, pid, oid
}
func TestOwnerConsentProjectionSuspensionAndRevocation(t *testing.T) {
	f, own, other, pid, oid := setupSharing(t)
	w := f.request("GET", "/api/v1/patients/"+pid, nil, other...)
	if w.Code != 404 {
		t.Fatal("unshared", w.Code)
	}
	w = f.request("GET", "/api/v1/network/search?rut=12345678-5", nil, other...)
	if w.Code != 200 || strings.Contains(w.Body.String(), "private-phone") || strings.Contains(w.Body.String(), "secret diagnosis") {
		t.Fatal("search leak", w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/sharing/requests", sharingInput{PatientIDs: []string{pid}, Scope: "Ficha completa", Reason: "Continuidad clínica"}, other...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var qs []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &qs)
	qid := qs[0]["id"].(string)
	if _, err := f.mail.DeliverOne(context.Background()); err != nil {
		t.Fatal(err)
	}
	raw := strings.Split(f.sender.messages[0].Body, "&token=")[1]
	decision := map[string]any{"token": raw, "rut": "12345678-5", "approve": true, "scope": "Resumen clínico"}
	w = f.request("POST", "/api/v1/owner/sharing/requests/"+qid+"/decision", decision)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var response struct {
		Grant struct {
			ID string `json:"id"`
		} `json:"grant"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &response)
	gid := response.Grant.ID
	w = f.request("POST", "/api/v1/owner/sharing/requests/"+qid+"/decision", decision)
	if w.Code != 409 {
		t.Fatal("reused decision", w.Code)
	}
	w = f.request("GET", "/api/v1/patients/"+pid, nil, other...)
	if w.Code != 200 || strings.Contains(w.Body.String(), "consultations") || strings.Contains(w.Body.String(), "secret") || strings.Contains(w.Body.String(), "ownerRut") {
		t.Fatal("projection", w.Code, w.Body.String())
	}
	var count int
	if err := f.pool.QueryRow(context.Background(), "SELECT count(*) FROM shared_read_audit WHERE patient_id=$1", pid).Scan(&count); err != nil || count != 1 {
		t.Fatal(count, err)
	}
	w = f.request("POST", "/api/v1/sharing/grants/"+gid+"/suspend", map[string]string{"reason": "Error de identidad"}, other...)
	if w.Code != 404 {
		t.Fatal("recipient suspension", w.Code)
	}
	w = f.request("POST", "/api/v1/sharing/grants/"+gid+"/suspend", map[string]string{"reason": "Error de identidad"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/patients/"+pid, nil, other...)
	if w.Code != 404 {
		t.Fatal("suspended access", w.Code)
	}
	w = f.request("POST", "/api/v1/sharing/grants/"+gid+"/restore", map[string]string{"reason": "Verificado"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	// A distinct, verified owner session is required to revoke after deciding.
	ownerToken := token()
	if _, err := f.pool.Exec(context.Background(), "INSERT INTO owner_sessions(token_hash,owner_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')", digest(ownerToken), oid); err != nil {
		t.Fatal(err)
	}
	w = f.request("POST", "/api/v1/owner/sharing/grants/"+gid+"/revoke", nil, &http.Cookie{Name: "vetdata_owner", Value: ownerToken})
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/patients/"+pid, nil, other...)
	if w.Code != 404 {
		t.Fatal("revoked access")
	}
	w = f.request("POST", "/api/v1/sharing/grants/"+gid+"/restore", map[string]string{"reason": "must not restore"}, own...)
	if w.Code != 409 {
		t.Fatal("revived revoked grant", w.Code)
	}
}
func TestLastAdminAndCrossClinicMembership(t *testing.T) {
	f, own, _, _, _ := setupSharing(t)
	w := f.request("PUT", "/api/v1/settings/role-permissions/Admin", map[string]any{"permission": "usuarios.administrar", "granted": false}, own...)
	if w.Code != 409 {
		t.Fatal("last admin", w.Code, w.Body.String())
	}
	w = f.request("PUT", "/api/v1/settings/role-permissions/Veterinario", map[string]any{"permission": "red.suspender", "granted": true}, own...)
	if w.Code != 400 {
		t.Fatal("delegated suspension", w.Code)
	}
	w = f.request("GET", "/api/v1/owners/12345678-5", nil)
	if w.Code != 401 {
		t.Fatal(w.Code)
	}
}
func TestExpiredGrantDeniesRead(t *testing.T) {
	f, _, other, pid, _ := setupSharing(t)
	ctx := context.Background()
	w := f.request("POST", "/api/v1/sharing/requests", sharingInput{PatientIDs: []string{pid}, Scope: "Ficha completa", Reason: "Continuidad clínica"}, other...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var qs []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &qs)
	qid := qs[0]["id"].(string)
	if _, err := f.mail.DeliverOne(ctx); err != nil {
		t.Fatal(err)
	}
	raw := strings.Split(f.sender.messages[len(f.sender.messages)-1].Body, "&token=")[1]
	w = f.request("POST", "/api/v1/owner/sharing/requests/"+qid+"/decision", map[string]any{"token": raw, "rut": "12345678-5", "approve": true, "scope": "Ficha completa"})
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/patients/"+pid, nil, other...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if _, err := f.pool.Exec(ctx, "UPDATE sharing_grants SET since=(CURRENT_DATE-10),until=(CURRENT_DATE-1) WHERE patient_id=$1 AND granted_to=$2 AND revoked_at IS NULL", pid, f.other); err != nil {
		t.Fatal(err)
	}
	w = f.request("GET", "/api/v1/patients/"+pid, nil, other...)
	if w.Code != 404 {
		t.Fatal("expired grant", w.Code)
	}
	w = f.request("GET", "/api/v1/patients", nil, other...)
	if w.Code != 200 || strings.Contains(w.Body.String(), pid) {
		t.Fatal("expired listed", w.Code)
	}
}
func TestNetworkSearchMinimalRateLimitAndAudit(t *testing.T) {
	f, _, other, _, _ := setupSharing(t)
	ctx := context.Background()
	w := f.request("GET", "/api/v1/network/search?rut=12345678-5", nil, other...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, "Test patient") {
		t.Fatal("minimal card", body)
	}
	for _, leak := range []string{"private-phone", "secret", "chip", "ownerRut", "consultations", "12345678-5"} {
		if strings.Contains(body, leak) {
			t.Fatal("search leak", leak)
		}
	}
	var audits int
	if err := f.pool.QueryRow(ctx, "SELECT count(*) FROM audit_events WHERE clinic_id=$1 AND action='network.searched'", f.other).Scan(&audits); err != nil || audits < 1 {
		t.Fatal("search audit", audits, err)
	}
	for i := 0; i < 25; i++ {
		w = f.request("GET", "/api/v1/network/search?rut=12345678-5", nil, other...)
	}
	if w.Code != 429 {
		t.Fatal("rate limit", w.Code)
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte("Test-password-123"), 4)
	uid := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO users(id,name,email,password_hash,status) VALUES($1,'NoRed','nored@example.test',$2,'Activo')", uid, string(hash)); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO memberships(user_id,clinic_id,role) VALUES($1,$2,'Recepción')", uid, f.other); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "DELETE FROM role_permissions WHERE clinic_id=$1 AND role='Recepción' AND permission='red.solicitar'", f.other); e != nil {
		t.Fatal(e)
	}
	w = f.request("POST", "/api/v1/auth/login", map[string]string{"email": "nored@example.test", "password": "Test-password-123", "clinicId": f.other})
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/network/search?rut=12345678-5", nil, w.Result().Cookies()...)
	if w.Code != 403 {
		t.Fatal("forbidden search", w.Code)
	}
}
func TestInviteAcceptSingleUseAndExpiry(t *testing.T) {
	f, own, _, _, _ := setupSharing(t)
	ctx := context.Background()
	w := f.request("POST", "/api/v1/users/invitations", map[string]string{"name": "Nueva Recepción", "email": "invite@example.test", "role": "Recepción"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	if _, err := f.mail.DeliverOne(ctx); err != nil {
		t.Fatal(err)
	}
	raw := strings.Split(f.sender.messages[len(f.sender.messages)-1].Body, "#token=")[1]
	w = f.request("POST", "/api/v1/auth/accept-invitation", map[string]string{"token": raw, "password": "Test-password-123"}, own...)
	if w.Code != 204 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/auth/accept-invitation", map[string]string{"token": raw, "password": "Test-password-123"}, own...)
	if w.Code != 400 && w.Code != 409 {
		t.Fatal("reused invitation", w.Code)
	}
	w = f.request("POST", "/api/v1/auth/login", map[string]string{"email": "invite@example.test", "password": "Test-password-123", "clinicId": f.clinic})
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/users/invitations", map[string]string{"name": "Expirada", "email": "expired@example.test", "role": "Recepción"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	if _, err := f.mail.DeliverOne(ctx); err != nil {
		t.Fatal(err)
	}
	expired := strings.Split(f.sender.messages[len(f.sender.messages)-1].Body, "#token=")[1]
	if _, err := f.pool.Exec(ctx, "UPDATE auth_action_tokens SET expires_at=now()-interval '1 minute' WHERE purpose='invitation' AND used_at IS NULL AND user_id=(SELECT id FROM users WHERE lower(email)='expired@example.test')"); err != nil {
		t.Fatal(err)
	}
	w = f.request("POST", "/api/v1/auth/accept-invitation", map[string]string{"token": expired, "password": "Test-password-123"}, own...)
	if w.Code != 400 {
		t.Fatal("expired invitation", w.Code)
	}
}
