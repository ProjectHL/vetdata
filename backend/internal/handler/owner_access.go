package handler

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
	"github.com/vetdata/api/internal/notifications"
	"net/http"
	"strings"
	"time"
)

func (s *Server) ownerLoginRequest(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		RUT   string `json:"rut"`
		Email string `json:"email"`
	}
	if err := decode(w, r, &in); err != nil {
		return err
	}
	if err := s.limited(r, "owner-login", "", 5, 15*time.Minute); err != nil {
		return err
	}
	rut, err := domain.NormalizeRUT(in.RUT)
	if err != nil {
		return fail(400, "invalid_rut", err.Error())
	}
	if !s.opt.Mail.Enabled() {
		return fail(503, "mail_unavailable", "Correo no configurado")
	}
	var oid, email string
	err = s.pool.QueryRow(r.Context(), "SELECT id,email FROM owners WHERE rut=$1 AND lower(email)=lower($2)", rut, strings.TrimSpace(in.Email)).Scan(&oid, &email)
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
		if _, e = tx.Exec(r.Context(), "INSERT INTO owner_login_tokens(token_hash,owner_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')", digest(raw), oid); e != nil {
			return e
		}
		if e = s.opt.Mail.Enqueue(r.Context(), tx, "owner-login:"+digest(raw), notifications.Message{To: email, Subject: "Acceso del dueno a VetData", Body: s.opt.Origin + "/owner/access#token=" + raw}); e != nil {
			return e
		}
		if e = tx.Commit(r.Context()); e != nil {
			return e
		}
	}
	writeJSON(w, 202, map[string]string{"message": "Si los datos coinciden, recibirás un enlace"})
	return nil
}
func (s *Server) ownerLoginVerify(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		RUT   string `json:"rut"`
		Token string `json:"token"`
	}
	if err := decode(w, r, &in); err != nil {
		return err
	}
	if err := s.limited(r, "owner-verify", "", 10, 15*time.Minute); err != nil {
		return err
	}
	rut, err := domain.NormalizeRUT(in.RUT)
	if err != nil {
		return fail(400, "invalid_rut", err.Error())
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	var oid string
	err = tx.QueryRow(r.Context(), `UPDATE owner_login_tokens t SET used_at=now() FROM owners o
 WHERE o.id=t.owner_id AND o.rut=$2 AND t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>now() RETURNING t.owner_id`, digest(in.Token), rut).Scan(&oid)
	if err == pgx.ErrNoRows {
		return fail(400, "invalid_token", "Enlace inválido o expirado")
	}
	if err != nil {
		return err
	}
	raw := token()
	if _, err = tx.Exec(r.Context(), "INSERT INTO owner_sessions(token_hash,owner_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')", digest(raw), oid); err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{Name: "vetdata_owner", Value: raw, Path: "/api/v1/owner", HttpOnly: true, Secure: s.opt.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: 900})
	writeJSON(w, 200, map[string]bool{"authenticated": true})
	return nil
}
func (s *Server) ownerActor(r *http.Request) (string, error) {
	c, err := r.Cookie("vetdata_owner")
	if err != nil {
		return "", fail(401, "owner_unauthenticated", "Verifica tu identidad mediante un enlace")
	}
	var oid string
	err = s.pool.QueryRow(r.Context(), "SELECT owner_id FROM owner_sessions WHERE token_hash=$1 AND expires_at>now()", digest(c.Value)).Scan(&oid)
	if err == pgx.ErrNoRows {
		return "", fail(401, "owner_unauthenticated", "Sesión expirada")
	}
	return oid, err
}
func (s *Server) ownerLogout(w http.ResponseWriter, r *http.Request) error {
	if c, err := r.Cookie("vetdata_owner"); err == nil {
		if _, err = s.pool.Exec(r.Context(), "DELETE FROM owner_sessions WHERE token_hash=$1", digest(c.Value)); err != nil {
			return err
		}
	}
	http.SetCookie(w, &http.Cookie{Name: "vetdata_owner", Value: "", Path: "/api/v1/owner", HttpOnly: true, Secure: s.opt.SecureCookies, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	w.WriteHeader(204)
	return nil
}
func (s *Server) ownerGrants(w http.ResponseWriter, r *http.Request) error {
	oid, err := s.ownerActor(r)
	if err != nil {
		return err
	}
	return s.grantsFor(w, r, "owner_id=$1", oid)
}
func (s *Server) ownerRevoke(w http.ResponseWriter, r *http.Request) error {
	oid, err := s.ownerActor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	var origin, target string
	var revoked *time.Time
	err = tx.QueryRow(r.Context(), "SELECT origin_clinic_id,granted_to,revoked_at FROM sharing_grants WHERE id=$1 AND owner_id=$2 FOR UPDATE", id, oid).Scan(&origin, &target, &revoked)
	if err != nil {
		return err
	}
	if revoked == nil {
		if _, err = tx.Exec(r.Context(), "UPDATE sharing_grants SET revoked_at=now() WHERE id=$1", id); err != nil {
			return err
		}
		if _, err = tx.Exec(r.Context(), "INSERT INTO audit_events(clinic_id,action,resource_id,details) VALUES($1,'owner.revoked',$2,jsonb_build_object('ownerId',$3::text))", origin, id, oid); err != nil {
			return err
		}
		if !s.opt.Mail.Enabled() {
			return fail(503, "mail_unavailable", "Correo no configurado")
		}
		rows, e := tx.Query(r.Context(), "SELECT email FROM clinics WHERE id=$1 OR id=$2", origin, target)
		if e != nil {
			return e
		}
		emails := []string{}
		for rows.Next() {
			var email string
			if e = rows.Scan(&email); e != nil {
				rows.Close()
				return e
			}
			emails = append(emails, email)
		}
		rows.Close()
		if e = rows.Err(); e != nil {
			return e
		}
		for _, email := range emails {
			if err = s.opt.Mail.Enqueue(r.Context(), tx, "revoke:"+id+":"+email, notifications.Message{To: email, Subject: "Acceso revocado por el dueno", Body: "El dueño revocó el acceso " + id + "."}); err != nil {
				return err
			}
		}
	}
	raw, err := grantJSON(r.Context(), tx, id)
	if err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	writeJSON(w, 200, raw)
	return nil
}
func (s *Server) sharingAudit(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	if a.Role != "Admin" {
		return fail(403, "forbidden", "Solo Admin de origen puede consultar la auditoría")
	}
	return s.readAudit(w, r, "origin_clinic_id", a.ClinicID)
}
func (s *Server) ownerAudit(w http.ResponseWriter, r *http.Request) error {
	oid, err := s.ownerActor(r)
	if err != nil {
		return err
	}
	return s.readAudit(w, r, "owner_id", oid)
}
func (s *Server) readAudit(w http.ResponseWriter, r *http.Request, column, id string) error {
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	var raw []byte
	err = s.pool.QueryRow(r.Context(), `SELECT coalesce(jsonb_agg(v),'[]') FROM (
 SELECT a.id,a.patient_id AS "patientId",a.grant_id AS "grantId",a.reader_clinic_id AS "clinicId",
 a.reader_user_id AS "userId",a.scope,a.created_at AS at FROM shared_read_audit a WHERE `+column+`=$1
 ORDER BY a.created_at DESC,a.id LIMIT $2 OFFSET $3) v`, id, limit, offset).Scan(&raw)
	if err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}
