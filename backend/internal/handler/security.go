package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
)

func (s *Server) securityRoutes(m *http.ServeMux) {
	s.route(m, "GET /api/v1/security/events", s.listSecurityEvents)
	s.route(m, "POST /api/v1/security/events", s.createSecurityEvent)
	s.route(m, "GET /api/v1/security/events/{id}", s.getSecurityEvent)
	s.route(m, "PATCH /api/v1/security/events/{id}", s.updateSecurityEvent)
	s.route(m, "POST /api/v1/security/events/{id}/notes", s.addSecurityEventNote)
	s.route(m, "GET /api/v1/security/settings", s.getSecuritySettings)
	s.route(m, "PATCH /api/v1/security/settings", s.updateSecuritySettings)
}

const securityEventSelect = `SELECT e.id,e.zone,e.camera_ref AS "cameraRef",e.type,e.severity,e.status,
 e.assignee_id AS "assigneeId",e.linked_event_id AS "linkedEventId",e.resolved_at AS "resolvedAt",
 e.actor_id AS "actorId",e.created_at AS "createdAt",
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',n.id,'text',n.text,'actorId',n.actor_id,'createdAt',n.created_at) ORDER BY n.created_at,n.id),'[]') FROM security_event_notes n WHERE n.event_id=e.id) AS notes FROM security_events e`

func securityEventJSON(ctx context.Context, tx pgx.Tx, clinic, id string) (json.RawMessage, error) {
	var raw []byte
	err := tx.QueryRow(ctx, "SELECT to_jsonb(v) FROM ("+securityEventSelect+" WHERE e.id=$1 AND e.clinic_id=$2) v", id, clinic).Scan(&raw)
	return raw, err
}

var securityZones = map[string]bool{"hall": true, "espera": true, "boxes": true, "tienda": true, "bodega": true, "farmacia": true}
var securityTypes = map[string]bool{"Movimiento fuera de horario": true, "Puerta forzada": true, "Puerta abierta": true, "Acceso no autorizado": true, "Aforo excedido": true, "Cámara sin señal": true, "Caja abierta sin venta": true, "Botón de pánico": true, "Marcado manual": true}
var securitySeverities = map[string]bool{"Crítica": true, "Alta": true, "Media": true, "Baja": true}

type securityEventInput struct {
	Zone          string  `json:"zone"`
	CameraRef     string  `json:"cameraRef"`
	Type          string  `json:"type"`
	Severity      string  `json:"severity"`
	Note          string  `json:"note"`
	LinkedEventID *string `json:"linkedEventId"`
}

func (s *Server) listSecurityEvents(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	if err = s.permitted(r.Context(), a, "seguridad.ver"); err != nil {
		return err
	}
	q := securityEventSelect + ` WHERE e.clinic_id=$1`
	args := []any{a.ClinicID}
	if v := r.URL.Query().Get("status"); v != "" {
		switch v {
		case "Nuevo", "En revisión", "Resuelto", "Falsa alarma":
		default:
			return fail(400, "invalid_status", "Estado inválido")
		}
		args = append(args, v)
		q += " AND e.status=$2"
	}
	if v := r.URL.Query().Get("severity"); v != "" {
		if !securitySeverities[v] {
			return fail(400, "invalid_severity", "Severidad inválida")
		}
		args = append(args, v)
		q += " AND e.severity=$" + itoa(len(args))
	}
	if v := r.URL.Query().Get("zone"); v != "" {
		if !securityZones[v] {
			return fail(400, "invalid_zone", "Zona inválida")
		}
		args = append(args, v)
		q += " AND e.zone=$" + itoa(len(args))
	}
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	var raw []byte
	err = s.pool.QueryRow(r.Context(), "SELECT coalesce(jsonb_agg(v),'[]') FROM ("+q+" ORDER BY e.created_at DESC,e.id LIMIT $"+itoa(len(args)+1)+" OFFSET $"+itoa(len(args)+2)+") v", append(args, limit, offset)...).Scan(&raw)
	if err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}

func (s *Server) getSecurityEvent(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if !domain.ValidID(id) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	if err = s.permitted(r.Context(), a, "seguridad.ver"); err != nil {
		return err
	}
	var raw []byte
	if err = s.pool.QueryRow(r.Context(), "SELECT to_jsonb(v) FROM ("+securityEventSelect+" WHERE e.id=$1 AND e.clinic_id=$2) v", id, a.ClinicID).Scan(&raw); err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}

func (s *Server) createSecurityEvent(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in securityEventInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if !securityZones[in.Zone] {
		return fail(400, "invalid_zone", "Zona inválida")
	}
	if !securityTypes[in.Type] {
		return fail(400, "invalid_type", "Tipo inválido")
	}
	if !securitySeverities[in.Severity] {
		return fail(400, "invalid_severity", "Severidad inválida")
	}
	if len(in.CameraRef) > 120 {
		return fail(400, "invalid_camera", "Referencia de cámara inválida")
	}
	if len(in.Note) > 2000 {
		return fail(400, "invalid_note", "Nota demasiado larga")
	}
	return s.mutate(w, r, a, "seguridad.ver", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		if in.LinkedEventID != nil {
			if !domain.ValidID(*in.LinkedEventID) {
				return nil, fail(400, "invalid_link", "Evento vinculado inválido")
			}
			var exists bool
			if err := tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM security_events WHERE id=$1 AND clinic_id=$2)", *in.LinkedEventID, a.ClinicID).Scan(&exists); err != nil {
				return nil, err
			}
			if !exists {
				return nil, fail(404, "unknown_event", "Evento vinculado inexistente")
			}
		}
		id := domain.UUID()
		if _, err := tx.Exec(r.Context(), "INSERT INTO security_events(id,clinic_id,zone,camera_ref,type,severity,linked_event_id,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", id, a.ClinicID, in.Zone, in.CameraRef, in.Type, in.Severity, in.LinkedEventID, a.UserID); err != nil {
			return nil, err
		}
		if strings.TrimSpace(in.Note) != "" {
			nid := domain.UUID()
			if _, err := tx.Exec(r.Context(), "INSERT INTO security_event_notes(id,event_id,clinic_id,text,actor_id) VALUES($1,$2,$3,$4,$5)", nid, id, a.ClinicID, strings.TrimSpace(in.Note), a.UserID); err != nil {
				return nil, err
			}
		}
		if err := audit(r.Context(), tx, a, "security.created", id, map[string]any{"type": in.Type, "severity": in.Severity}); err != nil {
			return nil, err
		}
		return securityEventJSON(r.Context(), tx, a.ClinicID, id)
	})
}

type securityEventUpdate struct {
	Status   *string `json:"status"`
	Assignee *string `json:"assignee"`
}

func (s *Server) updateSecurityEvent(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if !domain.ValidID(id) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	var in securityEventUpdate
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if in.Status == nil && in.Assignee == nil {
		return fail(400, "invalid_update", "Nada que actualizar")
	}
	if in.Status != nil {
		switch *in.Status {
		case "En revisión", "Resuelto", "Falsa alarma":
		default:
			return fail(400, "invalid_status", "Estado inválido")
		}
	}
	// Closing is privileged; annotate/assign is ver-level.
	needsAdmin := in.Status != nil && *in.Status != "En revisión"
	perm := "seguridad.ver"
	if needsAdmin {
		perm = "seguridad.administrar"
	}
	return s.mutate(w, r, a, perm, in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var status string
		var assignee *string
		if err := tx.QueryRow(r.Context(), "SELECT status,assignee_id FROM security_events WHERE id=$1 AND clinic_id=$2 FOR UPDATE", id, a.ClinicID).Scan(&status, &assignee); err != nil {
			return nil, err
		}
		if status == "Resuelto" || status == "Falsa alarma" {
			return nil, fail(409, "event_closed", "El evento cerrado no se edita ni se reabre")
		}
		action := "security.updated"
		if in.Assignee != nil {
			if *in.Assignee == "self" {
				assignee = &a.UserID
			} else if *in.Assignee == "" {
				assignee = nil
			} else {
				if !domain.ValidID(*in.Assignee) {
					return nil, fail(400, "invalid_assignee", "Responsable inválido")
				}
				var member bool
				if err := tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id=$1 AND clinic_id=$2 AND status='Activo')", *in.Assignee, a.ClinicID).Scan(&member); err != nil {
					return nil, err
				}
				if !member {
					return nil, fail(404, "unknown_assignee", "Responsable inexistente en la clínica")
				}
				assignee = in.Assignee
			}
			// Assigning a Nuevo event moves it to En revisión.
			if status == "Nuevo" && (in.Status == nil || *in.Status == "En revisión") {
				if _, err := tx.Exec(r.Context(), "UPDATE security_events SET assignee_id=$2,status='En revisión' WHERE id=$1", id, assignee); err != nil {
					return nil, err
				}
				status = "En revisión"
				action = "security.assigned"
			} else if _, err := tx.Exec(r.Context(), "UPDATE security_events SET assignee_id=$2 WHERE id=$1", id, assignee); err != nil {
				return nil, err
			} else {
				action = "security.assigned"
			}
		}
		if in.Status != nil && *in.Status != status {
			switch *in.Status {
			case "En revisión":
				if status != "Nuevo" {
					return nil, fail(409, "invalid_transition", "Transición inválida")
				}
				if _, err := tx.Exec(r.Context(), "UPDATE security_events SET status='En revisión' WHERE id=$1", id); err != nil {
					return nil, err
				}
			case "Resuelto", "Falsa alarma":
				if status != "Nuevo" && status != "En revisión" {
					return nil, fail(409, "invalid_transition", "Transición inválida")
				}
				if _, err := tx.Exec(r.Context(), "UPDATE security_events SET status=$2,resolved_at=now() WHERE id=$1", id, *in.Status); err != nil {
					return nil, err
				}
				action = "security.closed"
			}
		}
		if err := audit(r.Context(), tx, a, action, id, in); err != nil {
			return nil, err
		}
		return securityEventJSON(r.Context(), tx, a.ClinicID, id)
	})
}

func (s *Server) addSecurityEventNote(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if !domain.ValidID(id) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	var in struct {
		Text string `json:"text"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	in.Text = strings.TrimSpace(in.Text)
	if in.Text == "" || len(in.Text) > 2000 {
		return fail(400, "invalid_note", "Nota inválida")
	}
	return s.mutate(w, r, a, "seguridad.ver", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		var status string
		if err := tx.QueryRow(r.Context(), "SELECT status FROM security_events WHERE id=$1 AND clinic_id=$2 FOR UPDATE", id, a.ClinicID).Scan(&status); err != nil {
			return nil, err
		}
		if status == "Resuelto" || status == "Falsa alarma" {
			return nil, fail(409, "event_closed", "El evento cerrado no admite notas")
		}
		nid := domain.UUID()
		if _, err := tx.Exec(r.Context(), "INSERT INTO security_event_notes(id,event_id,clinic_id,text,actor_id) VALUES($1,$2,$3,$4,$5)", nid, id, a.ClinicID, in.Text, a.UserID); err != nil {
			return nil, err
		}
		if status == "Nuevo" {
			if _, err := tx.Exec(r.Context(), "UPDATE security_events SET status='En revisión' WHERE id=$1", id); err != nil {
				return nil, err
			}
		}
		if err := audit(r.Context(), tx, a, "security.noted", nid, map[string]any{"event": id}); err != nil {
			return nil, err
		}
		return map[string]any{"id": nid, "eventId": id, "text": in.Text}, nil
	})
}

func (s *Server) getSecuritySettings(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	if err = s.permitted(r.Context(), a, "seguridad.ver"); err != nil {
		return err
	}
	// Lazy row with compiled defaults.
	if _, err = s.pool.Exec(r.Context(), "INSERT INTO security_settings(clinic_id) VALUES($1) ON CONFLICT DO NOTHING", a.ClinicID); err != nil {
		return err
	}
	var retention int
	var privacy, autoArm bool
	var from, to string
	var updated time.Time
	if err = s.pool.QueryRow(r.Context(), "SELECT retention_days,privacy_in_boxes,after_hours_from,after_hours_to,auto_arm,updated_at FROM security_settings WHERE clinic_id=$1", a.ClinicID).Scan(&retention, &privacy, &from, &to, &autoArm, &updated); err != nil {
		return err
	}
	writeJSON(w, 200, map[string]any{"retentionDays": retention, "privacyInBoxes": privacy, "afterHoursFrom": from, "afterHoursTo": to, "autoArm": autoArm, "updatedAt": updated})
	return nil
}

type securitySettingsInput struct {
	RetentionDays  *int    `json:"retentionDays"`
	PrivacyInBoxes *bool   `json:"privacyInBoxes"`
	AfterHoursFrom *string `json:"afterHoursFrom"`
	AfterHoursTo   *string `json:"afterHoursTo"`
	AutoArm        *bool   `json:"autoArm"`
	AlarmArmed     *bool   `json:"alarmArmed"`
}

func validHHMM(v string) bool {
	if len(v) != 5 || v[2] != ':' {
		return false
	}
	h, m := v[:2], v[3:]
	if h < "00" || h > "23" || m < "00" || m > "59" {
		return false
	}
	return true
}

func (s *Server) updateSecuritySettings(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in securitySettingsInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if in.AlarmArmed != nil {
		return fail(400, "alarm_separate", "La alarma se opera por su propio control, no por PATCH")
	}
	if in.RetentionDays != nil {
		switch *in.RetentionDays {
		case 15, 30, 60, 90:
		default:
			return fail(400, "invalid_retention", "Retención no permitida")
		}
	}
	if in.AfterHoursFrom != nil && !validHHMM(*in.AfterHoursFrom) {
		return fail(400, "invalid_hours", "Horario inválido")
	}
	if in.AfterHoursTo != nil && !validHHMM(*in.AfterHoursTo) {
		return fail(400, "invalid_hours", "Horario inválido")
	}
	if in.RetentionDays == nil && in.PrivacyInBoxes == nil && in.AfterHoursFrom == nil && in.AfterHoursTo == nil && in.AutoArm == nil {
		return fail(400, "invalid_update", "Nada que actualizar")
	}
	return s.mutate(w, r, a, "seguridad.administrar", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		if _, err := tx.Exec(r.Context(), "INSERT INTO security_settings(clinic_id) VALUES($1) ON CONFLICT DO NOTHING", a.ClinicID); err != nil {
			return nil, err
		}
		if in.RetentionDays != nil {
			if _, err := tx.Exec(r.Context(), "UPDATE security_settings SET retention_days=$2,updated_at=now() WHERE clinic_id=$1", a.ClinicID, *in.RetentionDays); err != nil {
				return nil, err
			}
		}
		if in.PrivacyInBoxes != nil {
			if _, err := tx.Exec(r.Context(), "UPDATE security_settings SET privacy_in_boxes=$2,updated_at=now() WHERE clinic_id=$1", a.ClinicID, *in.PrivacyInBoxes); err != nil {
				return nil, err
			}
		}
		if in.AfterHoursFrom != nil {
			if _, err := tx.Exec(r.Context(), "UPDATE security_settings SET after_hours_from=$2,updated_at=now() WHERE clinic_id=$1", a.ClinicID, *in.AfterHoursFrom); err != nil {
				return nil, err
			}
		}
		if in.AfterHoursTo != nil {
			if _, err := tx.Exec(r.Context(), "UPDATE security_settings SET after_hours_to=$2,updated_at=now() WHERE clinic_id=$1", a.ClinicID, *in.AfterHoursTo); err != nil {
				return nil, err
			}
		}
		if in.AutoArm != nil {
			if _, err := tx.Exec(r.Context(), "UPDATE security_settings SET auto_arm=$2,updated_at=now() WHERE clinic_id=$1", a.ClinicID, *in.AutoArm); err != nil {
				return nil, err
			}
		}
		if err := audit(r.Context(), tx, a, "security.settings", a.ClinicID, in); err != nil {
			return nil, err
		}
		var retention int
		var privacy, autoArm bool
		var from, to string
		var updated time.Time
		if err := tx.QueryRow(r.Context(), "SELECT retention_days,privacy_in_boxes,after_hours_from,after_hours_to,auto_arm,updated_at FROM security_settings WHERE clinic_id=$1", a.ClinicID).Scan(&retention, &privacy, &from, &to, &autoArm, &updated); err != nil {
			return nil, err
		}
		return map[string]any{"retentionDays": retention, "privacyInBoxes": privacy, "afterHoursFrom": from, "afterHoursTo": to, "autoArm": autoArm, "updatedAt": updated}, nil
	})
}
