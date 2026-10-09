package handler

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
	"github.com/vetdata/api/internal/notifications"
	"net"
	"net/http"
	"strings"
	"time"
)

func (s *Server) sharingRoutes(m *http.ServeMux) {
	s.route(m, "POST /api/v1/sharing/requests", s.sendRequests)
	s.route(m, "GET /api/v1/sharing/requests", s.listRequests)
	s.route(m, "GET /api/v1/sharing/grants", s.listGrants)
	s.route(m, "POST /api/v1/sharing/requests/{id}/cancel", s.cancelRequest)
	s.route(m, "POST /api/v1/sharing/requests/{id}/resend", s.resendRequest)
	s.route(m, "POST /api/v1/owner/sharing/requests/{id}/decision", s.ownerDecision)
	s.route(m, "POST /api/v1/sharing/grants/{id}/suspend", s.suspendGrant)
	s.route(m, "POST /api/v1/sharing/grants/{id}/restore", s.suspendGrant)
	s.route(m, "POST /api/v1/owner/auth/request", s.ownerLoginRequest)
	s.route(m, "POST /api/v1/owner/auth/verify", s.ownerLoginVerify)
	s.route(m, "POST /api/v1/owner/auth/logout", s.ownerLogout)
	s.route(m, "GET /api/v1/owner/sharing/grants", s.ownerGrants)
	s.route(m, "POST /api/v1/owner/sharing/grants/{id}/revoke", s.ownerRevoke)
	s.route(m, "GET /api/v1/sharing/audit", s.sharingAudit)
	s.route(m, "GET /api/v1/owner/sharing/audit", s.ownerAudit)
}
func validScope(s string) bool  { return s == "Ficha completa" || s == "Resumen clínico" }
func validDuration(d *int) bool { return d == nil || *d == 30 || *d == 90 }
func grantJSON(ctx context.Context, tx pgx.Tx, id string) (json.RawMessage, error) {
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT jsonb_build_object('id',g.id,'requestId',g.request_id,'patientId',g.patient_id,
 'ownerClinic',c.name,'ownerClinicId',g.origin_clinic_id,'grantedTo',b.name,'grantedToId',g.granted_to,
 'scope',g.scope,'since',g.since,'until',g.until,'revoked',g.revoked_at IS NOT NULL,
 'suspended',g.suspended_at IS NOT NULL,'suspensionReason',g.suspension_reason,
 'status',CASE WHEN revoked_at IS NOT NULL THEN 'Revocado' WHEN until<$2::date THEN 'Vencido'
 WHEN suspended_at IS NOT NULL THEN 'Suspendido' ELSE 'Vigente' END)
 FROM sharing_grants g JOIN clinics c ON c.id=g.origin_clinic_id JOIN clinics b ON b.id=g.granted_to WHERE g.id=$1`, id, domain.LocalDate(domain.Now(ctx))).Scan(&raw)
	return raw, err
}

type sharingInput struct {
	PatientIDs []string `json:"patientIds"`
	Scope      string   `json:"scope"`
	Duration   *int     `json:"duration"`
	Reason     string   `json:"reason"`
	// Renewal of a terminal request (linked, no succession rules: the new
	// grant starts at approval date, the previous one keeps its terms).
	PreviousRequestID *string `json:"previousRequestId"`
}

func (s *Server) sendRequests(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in sharingInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if !validScope(in.Scope) || !validDuration(in.Duration) || len(in.PatientIDs) == 0 || len(in.PatientIDs) > 20 || strings.TrimSpace(in.Reason) == "" || len(in.Reason) > 2000 {
		return fail(400, "invalid_request", "Solicitud inválida")
	}
	if in.PreviousRequestID != nil && (len(in.PatientIDs) != 1 || !domain.ValidID(*in.PreviousRequestID)) {
		return fail(400, "invalid_renewal", "La renovación es de a una ficha con enlace previo válido")
	}
	for _, id := range in.PatientIDs {
		if !domain.ValidID(id) {
			return fail(400, "invalid_id", "Paciente inválido")
		}
	}
	if !s.opt.Mail.Enabled() {
		return fail(503, "mail_unavailable", "Correo no configurado")
	}
	return s.mutate(w, r, a, "red.solicitar", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		out := []map[string]any{}
		for _, pid := range in.PatientIDs {
			var origin, email, name, requester string
			err := tx.QueryRow(r.Context(), `SELECT p.origin_clinic_id,o.email,p.name,c.name FROM patients p
 JOIN owners o ON o.id=p.owner_id JOIN clinics c ON c.id=$2 WHERE p.id=$1 FOR UPDATE OF p`, pid, a.ClinicID).Scan(&origin, &email, &name, &requester)
			if err != nil {
				return nil, err
			}
			if origin == a.ClinicID {
				return nil, fail(409, "own_patient", "La mascota pertenece a tu clínica")
			}
			if _, err = tx.Exec(r.Context(), "UPDATE sharing_requests SET status='Expirada' WHERE patient_id=$1 AND requesting_clinic_id=$2 AND status='Esperando dueño' AND expires_at<=now()", pid, a.ClinicID); err != nil {
				return nil, err
			}
			var pending bool
			err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM sharing_requests WHERE patient_id=$1 AND requesting_clinic_id=$2 AND status='Esperando dueño' AND expires_at>now())`, pid, a.ClinicID).Scan(&pending)
			if err != nil {
				return nil, err
			}
			if pending {
				return nil, fail(409, "pending_request", "Ya existe una solicitud pendiente para esta mascota")
			}
			var prevID any
			renewal := false
			if in.PreviousRequestID != nil {
				var prevPatient, prevRequester, prevStatus string
				err := tx.QueryRow(r.Context(), "SELECT patient_id,requesting_clinic_id,status FROM sharing_requests WHERE id=$1", *in.PreviousRequestID).Scan(&prevPatient, &prevRequester, &prevStatus)
				if err == pgx.ErrNoRows || prevPatient != pid || prevRequester != a.ClinicID {
					return nil, fail(400, "invalid_renewal", "El enlace previo no corresponde a esta ficha y clínica")
				}
				if err != nil {
					return nil, err
				}
				if prevStatus == "Esperando dueño" {
					return nil, fail(409, "pending_request", "Cancela la solicitud pendiente antes de renovar")
				}
				prevID = *in.PreviousRequestID
				renewal = true
			}
			var blocked bool
			err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM sharing_grants WHERE patient_id=$1 AND granted_to=$2 AND revoked_at IS NULL
 AND (suspended_at IS NOT NULL OR until IS NULL OR until>=$3::date))`, pid, a.ClinicID, domain.LocalDate(domain.Now(r.Context()))).Scan(&blocked)
			if err != nil {
				return nil, err
			}
			if blocked && !renewal {
				return nil, fail(409, "existing_access", "Ya existe acceso vigente o suspendido")
			}
			id, raw := domain.UUID(), token()
			if _, err = tx.Exec(r.Context(), `INSERT INTO sharing_requests(id,patient_id,requesting_clinic_id,origin_clinic_id,requested_by,reason,scope,duration,token_hash,previous_request_id)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, id, pid, a.ClinicID, origin, a.UserID, in.Reason, in.Scope, in.Duration, digest(raw), prevID); err != nil {
				return nil, err
			}
			message := notifications.Message{To: email, Subject: "Solicitud de acceso a ficha veterinaria", Body: requester + " solicita acceso a la ficha de " + name + ". Alcance: " + in.Scope + ". Vigencia: " + durationText(in.Duration) + ". El enlace expira en 72 horas."}
			if prevID != nil {
				message.Body += " Renovación de la solicitud " + *in.PreviousRequestID + "."
			}
			message.Body += "\n" + s.opt.Origin + "/owner/consent#request=" + id + "&token=" + raw
			if err = s.opt.Mail.Enqueue(r.Context(), tx, "sharing:"+id, message); err != nil {
				return nil, err
			}
			if err = audit(r.Context(), tx, a, "sharing.requested", id, map[string]string{"patientId": pid}); err != nil {
				return nil, err
			}
			out = append(out, map[string]any{"id": id, "patientId": pid, "scope": in.Scope, "duration": in.Duration, "status": "Esperando dueño"})
		}
		return out, nil
	})
}
func durationText(v *int) string {
	if v == nil {
		return "permanente"
	}
	if *v == 30 {
		return "30 días"
	}
	return "90 días"
}
func (s *Server) listRequests(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	var raw []byte
	err = s.pool.QueryRow(r.Context(), `SELECT coalesce(jsonb_agg(v),'[]') FROM (SELECT q.id,q.patient_id AS "patientId",
 b.name AS "from",b.id AS "fromId",c.name AS "to",c.id AS "toId",u.name AS "requestedBy",q.created_at AS date,
 q.reason,q.scope,q.duration,CASE WHEN q.status='Esperando dueño' AND q.expires_at<=now() THEN 'Expirada' ELSE q.status END AS status,
 q.expires_at AS "expiresAt",q.responded_at AS "respondedAt"
 FROM sharing_requests q JOIN clinics b ON b.id=q.requesting_clinic_id JOIN clinics c ON c.id=q.origin_clinic_id JOIN users u ON u.id=q.requested_by
 WHERE (q.requesting_clinic_id=$1 OR q.origin_clinic_id=$1) ORDER BY q.created_at DESC,q.id LIMIT $2 OFFSET $3) v`, a.ClinicID, limit, offset).Scan(&raw)
	if err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}
func (s *Server) listGrants(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	return s.grantsFor(w, r, "origin_clinic_id=$1 OR granted_to=$1", a.ClinicID)
}
func (s *Server) grantsFor(w http.ResponseWriter, r *http.Request, where, id string) error {
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	rows, err := tx.Query(r.Context(), "SELECT id FROM sharing_grants WHERE ("+where+") ORDER BY consent_at DESC,id LIMIT $2 OFFSET $3", id, limit, offset)
	if err != nil {
		return err
	}
	ids := []string{}
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	out := []json.RawMessage{}
	for _, gid := range ids {
		v, e := grantJSON(r.Context(), tx, gid)
		if e != nil {
			return e
		}
		out = append(out, v)
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	writeJSON(w, 200, out)
	return nil
}
func (s *Server) cancelRequest(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	return s.mutate(w, r, a, "red.solicitar", struct{}{}, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var status string
		err := tx.QueryRow(r.Context(), "SELECT status FROM sharing_requests WHERE id=$1 AND requesting_clinic_id=$2 FOR UPDATE", id, a.ClinicID).Scan(&status)
		if err != nil {
			return nil, err
		}
		tag, err := tx.Exec(r.Context(), "UPDATE sharing_requests SET status='Cancelada',responded_at=now() WHERE id=$1 AND status='Esperando dueño' AND expires_at>now()", id)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() != 1 {
			return nil, fail(409, "terminal_request", "La solicitud no admite cancelación")
		}
		return map[string]string{"id": id, "status": "Cancelada"}, audit(r.Context(), tx, a, "sharing.cancelled", id, map[string]string{})
	})
}
func (s *Server) resendRequest(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	if err = s.limited(r, "resend", id, 3, time.Hour); err != nil {
		return err
	}
	if !s.opt.Mail.Enabled() {
		return fail(503, "mail_unavailable", "Correo no configurado")
	}
	return s.mutate(w, r, a, "red.solicitar", struct{}{}, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var email, scope, name string
		var duration *int
		err := tx.QueryRow(r.Context(), `SELECT o.email,q.scope,q.duration,p.name FROM sharing_requests q JOIN patients p ON p.id=q.patient_id JOIN owners o ON o.id=p.owner_id
 WHERE q.id=$1 AND q.requesting_clinic_id=$2 AND q.status='Esperando dueño' AND q.expires_at>now() FOR UPDATE OF q`, id, a.ClinicID).Scan(&email, &scope, &duration, &name)
		if err != nil {
			return nil, err
		}
		raw := token()
		if _, err = tx.Exec(r.Context(), "UPDATE sharing_requests SET token_hash=$2 WHERE id=$1", id, digest(raw)); err != nil {
			return nil, err
		}
		if err = s.opt.Mail.Enqueue(r.Context(), tx, "resend:"+digest(raw), notifications.Message{To: email, Subject: "Solicitud de acceso a ficha veterinaria", Body: name + " — " + scope + " — " + durationText(duration) + ". Este enlace reemplaza al anterior y conserva su vencimiento.\n" + s.opt.Origin + "/owner/consent#request=" + id + "&token=" + raw}); err != nil {
			return nil, err
		}
		return map[string]string{"id": id, "status": "Esperando dueño"}, nil
	})
}
func (s *Server) ownerDecision(w http.ResponseWriter, r *http.Request) error {
	id, err := pathID(r)
	if err != nil {
		return err
	}
	var in struct {
		Token   string `json:"token"`
		RUT     string `json:"rut"`
		Approve bool   `json:"approve"`
		Scope   string `json:"scope"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if err = s.limited(r, "owner-decision", "", 20, 15*time.Minute); err != nil {
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
	var pid, origin, target, owner, scope, status string
	var duration *int
	var expires time.Time
	var previous *string
	err = tx.QueryRow(r.Context(), `SELECT q.patient_id,q.origin_clinic_id,q.requesting_clinic_id,p.owner_id,q.scope,q.duration,q.status,q.expires_at,q.previous_request_id
 FROM sharing_requests q JOIN patients p ON p.id=q.patient_id JOIN owners o ON o.id=p.owner_id
 WHERE q.id=$1 AND q.token_hash=$2 AND o.rut=$3 FOR UPDATE OF q`, id, digest(in.Token), rut).Scan(&pid, &origin, &target, &owner, &scope, &duration, &status, &expires, &previous)
	if err == pgx.ErrNoRows {
		return fail(400, "invalid_token", "Enlace o verificación inválidos")
	}
	if err != nil {
		return err
	}
	if status != "Esperando dueño" || !domain.Now(r.Context()).Before(expires) {
		return fail(409, "terminal_request", "Solicitud respondida, cancelada o expirada")
	}
	next := "Denegada"
	out := map[string]any{"request": map[string]string{"id": id, "status": next}}
	if in.Approve {
		if !validScope(in.Scope) || (scope == "Resumen clínico" && in.Scope != "Resumen clínico") {
			return fail(400, "scope_escalation", "El alcance no puede superar el solicitado")
		}
		var blocked bool
		if err = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM sharing_grants WHERE patient_id=$1 AND granted_to=$2 AND revoked_at IS NULL AND (suspended_at IS NOT NULL OR until IS NULL OR until>=$3::date))`, pid, target, domain.LocalDate(domain.Now(r.Context()))).Scan(&blocked); err != nil {
			return err
		}
		if blocked && previous == nil {
			return fail(409, "existing_access", "Existe acceso vigente o suspendido")
		}
		gid := domain.UUID()
		since := domain.LocalDate(domain.Now(r.Context()))
		var until *string
		if duration != nil {
			d, e := domain.AddDays(since, *duration)
			if e != nil {
				return e
			}
			until = &d
		}
		ip, _, _ := net.SplitHostPort(r.RemoteAddr)
		if net.ParseIP(ip) == nil {
			ip = "0.0.0.0"
		}
		_, err = tx.Exec(r.Context(), `INSERT INTO sharing_grants(id,request_id,patient_id,origin_clinic_id,granted_to,owner_id,scope,since,until,consent_ip)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, gid, id, pid, origin, target, owner, in.Scope, since, until, ip)
		if err != nil {
			return err
		}
		next = "Aprobada"
		raw, e := grantJSON(r.Context(), tx, gid)
		if e != nil {
			return e
		}
		out["grant"] = raw
	}
	if _, err = tx.Exec(r.Context(), "UPDATE sharing_requests SET status=$2,responded_at=now() WHERE id=$1", id, next); err != nil {
		return err
	}
	// The consumed token remains a hash for evidence and cannot decide again.
	out["request"] = map[string]string{"id": id, "status": next}
	if _, err = tx.Exec(r.Context(), "INSERT INTO audit_events(clinic_id,action,resource_id,details) VALUES($1,'owner.decided',$2,jsonb_build_object('status',$3::text))", origin, id, next); err != nil {
		return err
	}
	if s.opt.Mail.Enabled() {
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
			if err = s.opt.Mail.Enqueue(r.Context(), tx, "decision:"+id+":"+email, notifications.Message{To: email, Subject: "Decision del dueno sobre acceso", Body: "La solicitud " + id + " fue " + next + " por el dueño."}); err != nil {
				return err
			}
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	writeJSON(w, 200, out)
	return nil
}
func (s *Server) suspendGrant(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	var in struct {
		Reason string `json:"reason"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if strings.TrimSpace(in.Reason) == "" || len(in.Reason) > 2000 {
		return fail(422, "reason_required", "Indica un motivo")
	}
	restore := strings.HasSuffix(r.URL.Path, "/restore")
	return s.mutate(w, r, a, "red.suspender", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		if a.Role != "Admin" {
			return nil, fail(403, "admin_required", "Solo Admin de origen")
		}
		var revoked, suspended *time.Time
		var until *time.Time
		var ownerEmail, recipientEmail string
		err := tx.QueryRow(r.Context(), `SELECT g.revoked_at,g.suspended_at,g.until,o.email,c.email FROM sharing_grants g
 JOIN owners o ON o.id=g.owner_id JOIN clinics c ON c.id=g.granted_to WHERE g.id=$1 AND g.origin_clinic_id=$2 FOR UPDATE OF g`, id, a.ClinicID).Scan(&revoked, &suspended, &until, &ownerEmail, &recipientEmail)
		if err != nil {
			return nil, err
		}
		if revoked != nil || (until != nil && until.Format("2006-01-02") < domain.LocalDate(domain.Now(r.Context()))) {
			return nil, fail(409, "inactive_grant", "El acceso está revocado o vencido")
		}
		if (restore && suspended == nil) || (!restore && suspended != nil) {
			return nil, fail(409, "invalid_transition", "El acceso ya está en ese estado")
		}
		action := "sharing.suspended"
		if restore {
			_, err = tx.Exec(r.Context(), "UPDATE sharing_grants SET suspended_at=NULL,suspension_reason=NULL,suspended_by=NULL WHERE id=$1", id)
			action = "sharing.restored"
		} else {
			_, err = tx.Exec(r.Context(), "UPDATE sharing_grants SET suspended_at=now(),suspension_reason=$2,suspended_by=$3 WHERE id=$1", id, in.Reason, a.UserID)
		}
		if err != nil {
			return nil, err
		}
		if err = audit(r.Context(), tx, a, action, id, in); err != nil {
			return nil, err
		}
		if !s.opt.Mail.Enabled() {
			return nil, fail(503, "mail_unavailable", "Correo no configurado")
		}
		for _, email := range []string{ownerEmail, recipientEmail} {
			if err = s.opt.Mail.Enqueue(r.Context(), tx, action+":"+id+":"+r.Header.Get("Idempotency-Key")+":"+email, notifications.Message{To: email, Subject: "Cambio de acceso a ficha veterinaria", Body: action + " — " + id + "\nMotivo: " + in.Reason}); err != nil {
				return nil, err
			}
		}
		return grantJSON(r.Context(), tx, id)
	})
}
