package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
	"github.com/vetdata/api/internal/notifications"
	"golang.org/x/crypto/bcrypt"
)

var dummyHash = func() []byte {
	h, e := bcrypt.GenerateFromPassword([]byte("invalid-login-placeholder"), 12)
	if e != nil {
		panic(e)
	}
	return h
}()

func (s *Server) authRoutes(m *http.ServeMux) {
	s.route(m, "POST /api/v1/auth/login", s.login)
	s.route(m, "POST /api/v1/auth/refresh", s.refresh)
	s.route(m, "POST /api/v1/auth/logout", s.logout)
	s.route(m, "POST /api/v1/auth/recovery", s.recoverPassword)
	s.route(m, "POST /api/v1/auth/reset", s.resetPassword)
	s.route(m, "POST /api/v1/auth/clinic", s.switchClinic)
	s.route(m, "GET /api/v1/me", s.me)
}
func (s *Server) cookies(w http.ResponseWriter, access, refresh string) {
	http.SetCookie(w, &http.Cookie{Name: "vetdata_access", Value: access, Path: "/", HttpOnly: true, Secure: s.opt.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: 900})
	http.SetCookie(w, &http.Cookie{Name: "vetdata_refresh", Value: refresh, Path: "/api/v1/auth", HttpOnly: true, Secure: s.opt.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: 30 * 86400})
}
func (s *Server) clearCookies(w http.ResponseWriter) {
	for _, c := range []struct{ name, path string }{{"vetdata_access", "/"}, {"vetdata_refresh", "/api/v1/auth"}} {
		http.SetCookie(w, &http.Cookie{Name: c.name, Value: "", Path: c.path, HttpOnly: true, Secure: s.opt.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	}
}
func validPassword(s string) bool { return len(s) >= 12 && len(s) <= 72 }
func (s *Server) login(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		ClinicID string `json:"clinicId"`
	}
	if err := decode(w, r, &in); err != nil {
		return err
	}
	if err := s.limited(r, "login-ip", "", 40, 15*time.Minute); err != nil {
		return err
	}
	if err := s.limited(r, "login", in.Email, 10, 15*time.Minute); err != nil {
		return err
	}
	var uid, status string
	var hash *string
	err := s.pool.QueryRow(r.Context(), "SELECT id,status,password_hash FROM users WHERE lower(email)=lower($1)", strings.TrimSpace(in.Email)).Scan(&uid, &status, &hash)
	if err != nil && err != pgx.ErrNoRows {
		return err
	}
	candidate := dummyHash
	if hash != nil {
		candidate = []byte(*hash)
	}
	passwordErr := bcrypt.CompareHashAndPassword(candidate, []byte(in.Password))
	if err == pgx.ErrNoRows || hash == nil || passwordErr != nil || status != "Activo" {
		return fail(401, "invalid_credentials", "Correo o contraseña incorrectos")
	}
	if in.ClinicID != "" && !domain.ValidID(in.ClinicID) {
		return fail(400, "invalid_clinic", "Clínica inválida")
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	// Lock account so password reset/inactivation cannot race session issuance.
	if err = tx.QueryRow(r.Context(), "SELECT status FROM users WHERE id=$1 AND password_hash=$2 FOR UPDATE", uid, *hash).Scan(&status); err != nil {
		return fail(401, "invalid_credentials", "Correo o contraseña incorrectos")
	}
	if status != "Activo" {
		return fail(401, "invalid_credentials", "Correo o contraseña incorrectos")
	}
	clinic := in.ClinicID
	if clinic == "" {
		err = tx.QueryRow(r.Context(), "SELECT clinic_id FROM memberships WHERE user_id=$1 AND status='Activo' ORDER BY clinic_id LIMIT 1", uid).Scan(&clinic)
	} else {
		err = tx.QueryRow(r.Context(), "SELECT clinic_id FROM memberships WHERE user_id=$1 AND clinic_id=$2 AND status='Activo'", uid, clinic).Scan(&clinic)
	}
	if err == pgx.ErrNoRows {
		return fail(403, "no_membership", "No tienes acceso a esta clínica")
	}
	if err != nil {
		return err
	}
	access, refresh := token(), token()
	var sid string
	err = tx.QueryRow(r.Context(), `INSERT INTO auth_sessions(user_id,clinic_id,access_hash,access_expires_at,expires_at)
 VALUES($1,$2,$3,now()+interval '15 minutes',now()+interval '30 days') RETURNING id`, uid, clinic, digest(access)).Scan(&sid)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(r.Context(), "INSERT INTO auth_refresh_tokens(token_hash,session_id) VALUES($1,$2)", digest(refresh), sid); err != nil {
		return err
	}
	if _, err = tx.Exec(r.Context(), "UPDATE users SET last_access=now() WHERE id=$1", uid); err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	s.cookies(w, access, refresh)
	writeJSON(w, 200, map[string]bool{"authenticated": true})
	return nil
}
func (s *Server) refresh(w http.ResponseWriter, r *http.Request) error {
	c, err := r.Cookie("vetdata_refresh")
	if err != nil {
		return fail(401, "unauthenticated", "Inicia sesión")
	}
	if err = s.limited(r, "refresh", "", 100, time.Minute); err != nil {
		return err
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	var sid, uid, status string
	var used, revoked *time.Time
	var expires time.Time
	err = tx.QueryRow(r.Context(), `SELECT s.id,s.user_id,u.status,t.used_at,s.revoked_at,s.expires_at
 FROM auth_refresh_tokens t JOIN auth_sessions s ON s.id=t.session_id JOIN users u ON u.id=s.user_id
 JOIN memberships m ON m.user_id=s.user_id AND m.clinic_id=s.clinic_id
 WHERE t.token_hash=$1 AND m.status='Activo' FOR UPDATE OF s,t`, digest(c.Value)).Scan(&sid, &uid, &status, &used, &revoked, &expires)
	if err == pgx.ErrNoRows {
		s.clearCookies(w)
		return fail(401, "unauthenticated", "Sesión inválida")
	}
	if err != nil {
		return err
	}
	if used != nil {
		if _, err = tx.Exec(r.Context(), "UPDATE auth_sessions SET revoked_at=now() WHERE id=$1", sid); err != nil {
			return err
		}
		if err = tx.Commit(r.Context()); err != nil {
			return err
		}
		s.clearCookies(w)
		return fail(401, "refresh_reused", "Sesión revocada por reutilización de token")
	}
	if revoked != nil || time.Now().After(expires) || status != "Activo" {
		s.clearCookies(w)
		return fail(401, "unauthenticated", "Sesión expirada")
	}
	access, refresh := token(), token()
	if _, err = tx.Exec(r.Context(), "UPDATE auth_refresh_tokens SET used_at=now() WHERE token_hash=$1", digest(c.Value)); err != nil {
		return err
	}
	if _, err = tx.Exec(r.Context(), "INSERT INTO auth_refresh_tokens(token_hash,session_id) VALUES($1,$2)", digest(refresh), sid); err != nil {
		return err
	}
	if _, err = tx.Exec(r.Context(), "UPDATE auth_sessions SET access_hash=$2,access_expires_at=least(now()+interval '15 minutes',expires_at) WHERE id=$1", sid, digest(access)); err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	s.cookies(w, access, refresh)
	writeJSON(w, 200, map[string]bool{"authenticated": true})
	return nil
}
func (s *Server) logout(w http.ResponseWriter, r *http.Request) error {
	access, refresh := "", ""
	if c, e := r.Cookie("vetdata_access"); e == nil {
		access = c.Value
	}
	if c, e := r.Cookie("vetdata_refresh"); e == nil {
		refresh = c.Value
	}
	_, err := s.pool.Exec(r.Context(), `UPDATE auth_sessions SET revoked_at=now() WHERE access_hash=$1
 OR id IN(SELECT session_id FROM auth_refresh_tokens WHERE token_hash=$2)`, digest(access), digest(refresh))
	if err != nil {
		return err
	}
	s.clearCookies(w)
	w.WriteHeader(204)
	return nil
}
func (s *Server) me(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var raw []byte
	err = s.pool.QueryRow(r.Context(), `SELECT jsonb_build_object(
 'user',jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'status',u.status,'role',$3::text,'lastAccess',u.last_access),
 'clinic',jsonb_build_object('id',c.id,'name',c.name,'groupId',c.group_id),
 'permissions',coalesce((SELECT jsonb_agg(permission ORDER BY permission) FROM role_permissions WHERE clinic_id=c.id AND role=$3),'[]'::jsonb),
 'memberships',(SELECT coalesce(jsonb_agg(jsonb_build_object('clinicId',m.clinic_id,'name',mc.name,'role',m.role)),'[]'::jsonb)
 FROM memberships m JOIN clinics mc ON mc.id=m.clinic_id WHERE m.user_id=u.id AND m.status='Activo'))
 FROM users u CROSS JOIN clinics c WHERE u.id=$1 AND c.id=$2`, a.UserID, a.ClinicID, a.Role).Scan(&raw)
	if err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}
func (s *Server) switchClinic(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in struct {
		ClinicID string `json:"clinicId"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if !domain.ValidID(in.ClinicID) {
		return fail(400, "invalid_clinic", "Clínica inválida")
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	var exists bool
	if err = tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id=$1 AND clinic_id=$2 AND status='Activo')", a.UserID, in.ClinicID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return fail(403, "no_membership", "No tienes acceso a esta clínica")
	}
	access, refresh := token(), token()
	tag, err := tx.Exec(r.Context(), "UPDATE auth_sessions SET clinic_id=$2,access_hash=$3,access_expires_at=least(now()+interval '15 minutes',expires_at) WHERE id=$1 AND revoked_at IS NULL AND expires_at>now()", a.SessionID, in.ClinicID, digest(access))
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return fail(401, "unauthenticated", "Sesión expirada")
	}
	if _, err = tx.Exec(r.Context(), "UPDATE auth_refresh_tokens SET used_at=coalesce(used_at,now()) WHERE session_id=$1", a.SessionID); err != nil {
		return err
	}
	if _, err = tx.Exec(r.Context(), "INSERT INTO auth_refresh_tokens(token_hash,session_id) VALUES($1,$2)", digest(refresh), a.SessionID); err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	s.cookies(w, access, refresh)
	writeJSON(w, 200, map[string]string{"clinicId": in.ClinicID})
	return nil
}
func (s *Server) recoverPassword(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Email string `json:"email"`
	}
	if err := decode(w, r, &in); err != nil {
		return err
	}
	if err := s.limited(r, "recovery-ip", "", 15, 15*time.Minute); err != nil {
		return err
	}
	if err := s.limited(r, "recovery", in.Email, 3, 15*time.Minute); err != nil {
		return err
	}
	if !s.opt.Mail.Enabled() {
		return fail(503, "mail_unavailable", "El correo transaccional no está configurado")
	}
	var uid, email string
	err := s.pool.QueryRow(r.Context(), "SELECT id,email FROM users WHERE lower(email)=lower($1) AND status='Activo'", strings.TrimSpace(in.Email)).Scan(&uid, &email)
	if err != nil && err != pgx.ErrNoRows {
		return err
	}
	if err == nil {
		tx, e := s.pool.Begin(r.Context())
		if e != nil {
			return e
		}
		defer tx.Rollback(context.Background())
		raw := token()
		if _, e = tx.Exec(r.Context(), "INSERT INTO auth_action_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'recovery',now()+interval '30 minutes')", digest(raw), uid); e != nil {
			return e
		}
		message := notifications.Message{To: email, Subject: "Recuperar acceso a VetData", Body: "Abre este enlace para cambiar tu contraseña. Expira en 30 minutos:\n" + s.opt.Origin + "/reset-password#token=" + raw}
		if e = s.opt.Mail.Enqueue(r.Context(), tx, "recovery:"+digest(raw), message); e != nil {
			return e
		}
		if e = tx.Commit(r.Context()); e != nil {
			return e
		}
	}
	writeJSON(w, 202, map[string]string{"message": "Si la cuenta está activa, recibirás un correo"})
	return nil
}
func (s *Server) resetPassword(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := decode(w, r, &in); err != nil {
		return err
	}
	if err := s.limited(r, "reset", "", 10, 15*time.Minute); err != nil {
		return err
	}
	if !validPassword(in.Password) {
		return fail(400, "password_length", "La contraseña debe tener entre 12 y 72 bytes")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), 12)
	if err != nil {
		return err
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	var uid string
	err = tx.QueryRow(r.Context(), `SELECT t.user_id FROM auth_action_tokens t JOIN users u ON u.id=t.user_id
 WHERE t.token_hash=$1 AND t.purpose='recovery' AND t.used_at IS NULL AND t.expires_at>now() AND u.status='Activo'
 FOR UPDATE OF u,t`, digest(in.Token)).Scan(&uid)
	if err == pgx.ErrNoRows {
		return fail(400, "invalid_token", "Enlace inválido o expirado")
	}
	if err != nil {
		return err
	}
	if _, err = tx.Exec(r.Context(), "UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1", uid, string(hash)); err != nil {
		return err
	}
	if _, err = tx.Exec(r.Context(), "UPDATE auth_action_tokens SET used_at=now() WHERE user_id=$1 AND purpose='recovery' AND used_at IS NULL", uid); err != nil {
		return err
	}
	if _, err = tx.Exec(r.Context(), "UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", uid); err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	s.clearCookies(w)
	w.WriteHeader(204)
	return nil
}
