package handler

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/model"
	"github.com/vetdata/api/internal/notifications"
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"net/mail"
	"strings"
	"time"
)

func (s *Server) settingsRoutes(m *http.ServeMux) {
	s.route(m, "GET /api/v1/settings/clinic-profile", s.getProfile)
	s.route(m, "PUT /api/v1/settings/clinic-profile", s.putProfile)
	s.route(m, "GET /api/v1/users", s.listUsers)
	s.route(m, "POST /api/v1/users/invitations", s.inviteUser)
	s.route(m, "POST /api/v1/auth/accept-invitation", s.acceptInvitation)
	s.route(m, "PATCH /api/v1/users/{id}", s.updateUser)
	s.route(m, "GET /api/v1/settings/role-permissions", s.getPermissions)
	s.route(m, "PUT /api/v1/settings/role-permissions/{role}", s.setPermission)
	s.route(m, "GET /api/v1/network/clinics", s.listClinics)
	s.route(m, "GET /api/v1/me/clinic", s.currentClinic)
	s.route(m, "GET /api/v1/doctors", s.listDoctors)
}
func validRole(role string) bool {
	for _, r := range model.AllRoles {
		if string(r) == role {
			return true
		}
	}
	return false
}
func validPermission(p string) bool {
	for _, v := range model.AllPermissions {
		if string(v) == p {
			return true
		}
	}
	return false
}
func (s *Server) listUsers(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	if err = s.permitted(r.Context(), a, "usuarios.administrar"); err != nil {
		return err
	}
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	var raw []byte
	err = s.pool.QueryRow(r.Context(), `SELECT coalesce(jsonb_agg(v),'[]') FROM (
 SELECT u.id,u.name,u.email,m.role,m.status,u.last_access AS "lastAccess",d.id AS "doctorId",d.specialty
 FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN doctors d ON d.user_id=u.id AND d.clinic_id=m.clinic_id
 WHERE m.clinic_id=$1 AND ($4='' OR m.status=$4) AND ($5='' OR m.role=$5)
 AND ($6='' OR strpos(lower(u.name||' '||u.email),lower($6))>0)
 ORDER BY u.id LIMIT $2 OFFSET $3) v`, a.ClinicID, limit, offset, r.URL.Query().Get("status"), r.URL.Query().Get("role"), r.URL.Query().Get("q")).Scan(&raw)
	if err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}
func (s *Server) getPermissions(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	raw, err := permissions(r.Context(), s.pool, a.ClinicID)
	if err != nil {
		return err
	}
	writeJSON(w, 200, raw)
	return nil
}

type queryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func permissions(ctx context.Context, q queryer, clinic string) (map[string][]string, error) {
	out := map[string][]string{}
	for _, role := range model.AllRoles {
		out[string(role)] = []string{}
	}
	rows, err := q.Query(ctx, "SELECT role,permission FROM role_permissions WHERE clinic_id=$1 ORDER BY role,permission", clinic)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var role, p string
		if err = rows.Scan(&role, &p); err != nil {
			return nil, err
		}
		out[role] = append(out[role], p)
	}
	return out, rows.Err()
}
func ensureAdmin(ctx context.Context, tx pgx.Tx, clinic string) error {
	var ok bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id
 JOIN role_permissions p ON p.clinic_id=m.clinic_id AND p.role=m.role AND p.permission='usuarios.administrar'
 WHERE m.clinic_id=$1 AND m.status='Activo' AND u.status='Activo')`, clinic).Scan(&ok)
	if err != nil {
		return err
	}
	if !ok {
		return fail(409, "last_administrator", "La clínica debe conservar un administrador activo")
	}
	return nil
}
func (s *Server) setPermission(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	role := r.PathValue("role")
	var in struct {
		Permission string `json:"permission"`
		Granted    bool   `json:"granted"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if !validRole(role) || !validPermission(in.Permission) || (in.Permission == "red.suspender" && role != "Admin") {
		return fail(400, "invalid_permission", "Rol o permiso inválido")
	}
	return s.mutate(w, r, a, "usuarios.administrar", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var err error
		if in.Granted {
			_, err = tx.Exec(r.Context(), "INSERT INTO role_permissions(clinic_id,role,permission) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", a.ClinicID, role, in.Permission)
		} else {
			_, err = tx.Exec(r.Context(), "DELETE FROM role_permissions WHERE clinic_id=$1 AND role=$2 AND permission=$3", a.ClinicID, role, in.Permission)
		}
		if err != nil {
			return nil, err
		}
		if err = ensureAdmin(r.Context(), tx, a.ClinicID); err != nil {
			return nil, err
		}
		if err = audit(r.Context(), tx, a, "permissions.changed", role, in); err != nil {
			return nil, err
		}
		return permissions(r.Context(), tx, a.ClinicID)
	})
}
func (s *Server) inviteUser(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in struct {
		Name      string `json:"name"`
		Email     string `json:"email"`
		Role      string `json:"role"`
		Specialty string `json:"specialty"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	addr, e := mail.ParseAddress(in.Email)
	if e != nil || addr.Address != in.Email || !validRole(in.Role) || strings.TrimSpace(in.Name) == "" || len(in.Name) > 120 {
		return fail(400, "invalid_invitation", "Datos de invitación inválidos")
	}
	if !s.opt.Mail.Enabled() {
		return fail(503, "mail_unavailable", "Correo no configurado")
	}
	return s.mutate(w, r, a, "usuarios.administrar", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		var uid string
		err := tx.QueryRow(r.Context(), `INSERT INTO users(name,email,status) VALUES($1,$2,'Invitado')
 ON CONFLICT(lower(email)) DO UPDATE SET email=users.email RETURNING id`, in.Name, in.Email).Scan(&uid)
		if err != nil {
			return nil, err
		}
		if _, err = tx.Exec(r.Context(), "INSERT INTO memberships(user_id,clinic_id,role,status) VALUES($1,$2,$3,'Invitado')", uid, a.ClinicID, in.Role); err != nil {
			return nil, err
		}
		if in.Role == "Veterinario" {
			if _, err = tx.Exec(r.Context(), "INSERT INTO doctors(clinic_id,user_id,name,specialty,initials) VALUES($1,$2,$3,$4,'')", a.ClinicID, uid, in.Name, in.Specialty); err != nil {
				return nil, err
			}
		}
		raw := token()
		if _, err = tx.Exec(r.Context(), "INSERT INTO auth_action_tokens(token_hash,user_id,clinic_id,purpose,expires_at) VALUES($1,$2,$3,'invitation',now()+interval '72 hours')", digest(raw), uid, a.ClinicID); err != nil {
			return nil, err
		}
		if err = s.opt.Mail.Enqueue(r.Context(), tx, "invite:"+digest(raw), notifications.Message{To: in.Email, Subject: "Invitacion a VetData", Body: s.opt.Origin + "/accept-invitation#token=" + raw}); err != nil {
			return nil, err
		}
		if err = audit(r.Context(), tx, a, "user.invited", uid, map[string]string{"role": in.Role}); err != nil {
			return nil, err
		}
		return map[string]any{"id": uid, "name": in.Name, "email": in.Email, "role": in.Role, "status": "Invitado"}, nil
	})
}
func (s *Server) acceptInvitation(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := decode(w, r, &in); err != nil {
		return err
	}
	if !validPassword(in.Password) {
		return fail(400, "password_length", "Contraseña de 12 a 72 bytes requerida")
	}
	if err := s.limited(r, "accept-invitation", "", 10, 15*time.Minute); err != nil {
		return err
	}
	// Existing accounts prove their password; accepting an invitation never resets it.
	var uid, clinic, status string
	var oldHash *string
	err := s.pool.QueryRow(r.Context(), `SELECT u.id,t.clinic_id,u.status,u.password_hash FROM auth_action_tokens t JOIN users u ON u.id=t.user_id
 WHERE t.token_hash=$1 AND t.purpose='invitation' AND t.used_at IS NULL AND t.expires_at>now()`, digest(in.Token)).Scan(&uid, &clinic, &status, &oldHash)
	if err == pgx.ErrNoRows {
		return fail(400, "invalid_token", "Invitación inválida o expirada")
	}
	if err != nil {
		return err
	}
	if status == "Inactivo" {
		return fail(403, "inactive", "Cuenta inactiva")
	}
	hash := ""
	if oldHash != nil {
		if bcrypt.CompareHashAndPassword([]byte(*oldHash), []byte(in.Password)) != nil {
			return fail(401, "invalid_credentials", "Verifica tu contraseña actual")
		}
		hash = *oldHash
	} else {
		b, e := bcrypt.GenerateFromPassword([]byte(in.Password), 12)
		if e != nil {
			return e
		}
		hash = string(b)
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	if _, err = tx.Exec(r.Context(), "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", clinic); err != nil {
		return err
	}
	var verified bool
	if err = tx.QueryRow(r.Context(), "SELECT (password_hash IS NOT DISTINCT FROM $2::text) AND status<>'Inactivo' FROM users WHERE id=$1 FOR UPDATE", uid, oldHash).Scan(&verified); err != nil {
		return err
	}
	if !verified {
		return fail(409, "account_changed", "La cuenta cambió; solicita un nuevo enlace")
	}
	tag, err := tx.Exec(r.Context(), "UPDATE auth_action_tokens SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now()", digest(in.Token))
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return fail(409, "token_used", "Invitación ya utilizada")
	}
	tag, err = tx.Exec(r.Context(), "UPDATE memberships SET status='Activo',updated_at=now() WHERE user_id=$1 AND clinic_id=$2 AND status='Invitado'", uid, clinic)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return fail(409, "invitation_cancelled", "Invitación cancelada")
	}
	if _, err = tx.Exec(r.Context(), "UPDATE users SET status='Activo',password_hash=$2,updated_at=now() WHERE id=$1", uid, hash); err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	w.WriteHeader(204)
	return nil
}
func (s *Server) updateUser(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	var in struct {
		Role   *string `json:"role"`
		Status *string `json:"status"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if in.Role != nil && !validRole(*in.Role) {
		return fail(400, "invalid_role", "Rol inválido")
	}
	if in.Status != nil && *in.Status != "Activo" && *in.Status != "Inactivo" {
		return fail(400, "invalid_status", "Estado inválido")
	}
	if id == a.UserID {
		return fail(409, "self_change", "No puedes cambiar tu propio rol o estado")
	}
	return s.mutate(w, r, a, "usuarios.administrar", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var currentStatus string
		if err := tx.QueryRow(r.Context(), "SELECT status FROM memberships WHERE user_id=$1 AND clinic_id=$2 FOR UPDATE", id, a.ClinicID).Scan(&currentStatus); err != nil {
			return nil, err
		}
		if currentStatus == "Invitado" && in.Status != nil && *in.Status == "Activo" {
			return nil, fail(409, "invitation_required", "El usuario debe aceptar su invitación")
		}
		if (in.Status != nil && *in.Status == "Inactivo") || (in.Role != nil && *in.Role != "Veterinario") {
			var pending []byte
			if err := tx.QueryRow(r.Context(), `SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'patientId',a.patient_id,'startsAt',a.starts_at,'status',a.status) ORDER BY a.starts_at,a.id),'[]') FROM appointments a JOIN doctors d ON d.id=a.doctor_id
 WHERE d.user_id=$1 AND d.clinic_id=$2 AND a.clinic_id=$2 AND (a.starts_at>=now() OR a.room_id IS NOT NULL OR EXISTS(SELECT 1 FROM waiting_entries WHERE appointment_id=a.id)) AND a.status IN ('Agendada','Confirmada')`, id, a.ClinicID).Scan(&pending); err != nil {
				return nil, err
			}
			if string(pending) != "[]" {
				return nil, &apiError{Status: 409, Code: "future_appointments", Message: "Reasigna o cancela las citas futuras y finaliza las atenciones en curso antes de desactivar", Details: map[string]any{"appointments": json.RawMessage(pending)}}
			}
		}
		var name, email, role, status string
		if _, err := tx.Exec(r.Context(), "UPDATE memberships SET role=coalesce($3,role),status=coalesce($4,status),updated_at=now() WHERE user_id=$1 AND clinic_id=$2", id, a.ClinicID, in.Role, in.Status); err != nil {
			return nil, err
		}
		if err := ensureAdmin(r.Context(), tx, a.ClinicID); err != nil {
			return nil, err
		}
		if err := tx.QueryRow(r.Context(), "SELECT u.name,u.email,m.role,m.status FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.id=$1 AND m.clinic_id=$2", id, a.ClinicID).Scan(&name, &email, &role, &status); err != nil {
			return nil, err
		}
		if role == "Veterinario" {
			if _, err := tx.Exec(r.Context(), "INSERT INTO doctors(clinic_id,user_id,name,specialty,initials) VALUES($1,$2,$3,'','') ON CONFLICT(clinic_id,user_id) WHERE user_id IS NOT NULL DO NOTHING", a.ClinicID, id, name); err != nil {
				return nil, err
			}
		}
		if _, err := tx.Exec(r.Context(), "UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND clinic_id=$2", id, a.ClinicID); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "membership.changed", id, in); err != nil {
			return nil, err
		}
		return map[string]string{"id": id, "name": name, "email": email, "role": role, "status": status}, nil
	})
}
func (s *Server) listClinics(w http.ResponseWriter, r *http.Request) error {
	if _, err := s.actor(r); err != nil {
		return err
	}
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	var raw []byte
	err = s.pool.QueryRow(r.Context(), `SELECT coalesce(jsonb_agg(v),'[]') FROM (
 SELECT id,name,sector,address,phone,email,specialties,status,joined_at AS "joinedAt",last_sync AS "lastSync",patients_ref AS patients
 FROM clinics ORDER BY id LIMIT $1 OFFSET $2) v`, limit, offset).Scan(&raw)
	if err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}
func (s *Server) currentClinic(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var name string
	if err = s.pool.QueryRow(r.Context(), "SELECT name FROM clinics WHERE id=$1", a.ClinicID).Scan(&name); err != nil {
		return err
	}
	writeJSON(w, 200, name)
	return nil
}
func (s *Server) listDoctors(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var raw []byte
	err = s.pool.QueryRow(r.Context(), `SELECT coalesce(jsonb_agg(v),'[]') FROM (
 SELECT d.id,d.name,d.specialty,d.initials,d.user_id AS "userId" FROM doctors d
 LEFT JOIN memberships m ON m.user_id=d.user_id AND m.clinic_id=d.clinic_id
 LEFT JOIN users u ON u.id=d.user_id
 WHERE d.clinic_id=$1 AND (d.user_id IS NULL OR (m.status='Activo' AND m.role='Veterinario' AND u.status='Activo')) ORDER BY d.id) v`, a.ClinicID).Scan(&raw)
	if err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}
