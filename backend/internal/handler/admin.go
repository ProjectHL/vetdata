package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
	"github.com/vetdata/api/internal/model"
)

// Backoffice endpoints for VetData Staff. Every route requires a session bound
// to the staff tenant; clinic sessions get 403 and can never switch into it.
func (s *Server) adminRoutes(m *http.ServeMux) {
	s.route(m, "GET /api/v1/admin/tickets", s.adminListTickets)
	s.route(m, "GET /api/v1/admin/tickets/{id}", s.adminGetTicket)
	s.route(m, "POST /api/v1/admin/tickets/{id}/messages", s.adminReplyTicket)
	s.route(m, "PATCH /api/v1/admin/tickets/{id}/status", s.adminTicketStatus)
	s.route(m, "GET /api/v1/admin/ideas", s.adminListIdeas)
	s.route(m, "PATCH /api/v1/admin/ideas/{id}/status", s.adminIdeaStatus)
	s.route(m, "GET /api/v1/admin/releases", s.listReleases)
	s.route(m, "POST /api/v1/admin/releases", s.adminCreateRelease)
	s.route(m, "POST /api/v1/admin/clinics", s.adminCreateClinic)
}

func (s *Server) adminActor(w http.ResponseWriter, r *http.Request) (Actor, error) {
	a, err := s.actor(r)
	if err != nil {
		return a, err
	}
	if !s.isStaffTenant(a) {
		return a, fail(403, "staff_only", "Acceso restringido a VetData Staff")
	}
	return a, nil
}

// isStaffTenant reports whether the actor's session belongs to the backoffice
// Staff clinic (StaffClinicID).
func (s *Server) isStaffTenant(a Actor) bool {
	return a.ClinicID == StaffClinicID
}

func (s *Server) adminListTickets(w http.ResponseWriter, r *http.Request) error {
	a, err := s.adminActor(w, r)
	if err != nil {
		return err
	}
	q := ticketSelect + ` WHERE 1=1`
	args := []any{}
	if v := r.URL.Query().Get("status"); v != "" {
		switch v {
		case "Nuevo", "En revisión", "En progreso", "Esperando cliente", "Resuelto", "Cerrado":
		default:
			return fail(400, "invalid_status", "Estado inválido")
		}
		args = append(args, v)
		q += " AND t.status=$" + itoa(len(args))
	}
	if v := r.URL.Query().Get("clinicId"); v != "" {
		if !domain.ValidID(v) {
			return fail(400, "invalid_clinic", "Clínica inválida")
		}
		args = append(args, v)
		q += " AND t.clinic_id=$" + itoa(len(args))
	}
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	rows, err := s.pool.Query(r.Context(), "SELECT to_jsonb(v) FROM ("+q+" ORDER BY t.created_at DESC,t.id LIMIT $"+itoa(len(args)+1)+" OFFSET $"+itoa(len(args)+2)+") v", append(args, limit, offset)...)
	if err != nil {
		return err
	}
	defer rows.Close()
	now := domain.Now(r.Context())
	out := []any{}
	for rows.Next() {
		var raw []byte
		if err = rows.Scan(&raw); err != nil {
			return err
		}
		v, err := ticketWithSLA(raw, now)
		if err != nil {
			return err
		}
		out = append(out, v)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	_ = a
	writeJSON(w, 200, out)
	return nil
}

func (s *Server) adminGetTicket(w http.ResponseWriter, r *http.Request) error {
	if _, err := s.adminActor(w, r); err != nil {
		return err
	}
	id := r.PathValue("id")
	if !domain.ValidID(id) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	var raw []byte
	if err := s.pool.QueryRow(r.Context(), "SELECT to_jsonb(v) FROM ("+ticketSelect+" WHERE t.id=$1) v", id).Scan(&raw); err != nil {
		return err
	}
	out, err := ticketWithSLA(raw, domain.Now(r.Context()))
	if err != nil {
		return err
	}
	writeJSON(w, 200, out)
	return nil
}

func (s *Server) adminReplyTicket(w http.ResponseWriter, r *http.Request) error {
	a, err := s.adminActor(w, r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if !domain.ValidID(id) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	var in struct {
		Body string `json:"body"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	in.Body = strings.TrimSpace(in.Body)
	if in.Body == "" || len(in.Body) > 5000 {
		return fail(400, "invalid_message", "Mensaje inválido")
	}
	return s.mutate(w, r, a, "", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var ticketClinic string
		var status string
		var first any
		if err := tx.QueryRow(r.Context(), "SELECT clinic_id,status,first_response_at FROM support_tickets WHERE id=$1 FOR UPDATE", id).Scan(&ticketClinic, &status, &first); err != nil {
			return nil, err
		}
		if ticketClinic != a.ClinicID && !s.isStaffTenant(a) {
			return nil, pgx.ErrNoRows
		}
		if status == "Cerrado" {
			return nil, fail(409, "ticket_closed", "El ticket cerrado no admite mensajes")
		}
		mid := domain.UUID()
		if _, err := tx.Exec(r.Context(), "INSERT INTO support_messages(id,ticket_id,clinic_id,side,author_id,body) VALUES($1,$2,$3,'VetData',$4,$5)", mid, id, ticketClinic, a.UserID, in.Body); err != nil {
			return nil, err
		}
		if first == nil {
			if _, err := tx.Exec(r.Context(), "UPDATE support_tickets SET first_response_at=now() WHERE id=$1", id); err != nil {
				return nil, err
			}
		}
		if status == "Nuevo" {
			if _, err := tx.Exec(r.Context(), "UPDATE support_tickets SET status='En revisión' WHERE id=$1", id); err != nil {
				return nil, err
			}
		}
		if err := audit(r.Context(), tx, a, "support.staff_replied", mid, map[string]any{"ticket": id}); err != nil {
			return nil, err
		}
		raw, err := ticketJSON(r.Context(), tx, id)
		if err != nil {
			return nil, err
		}
		return ticketWithSLA(raw, domain.Now(r.Context()))
	})
}

func (s *Server) adminTicketStatus(w http.ResponseWriter, r *http.Request) error {
	a, err := s.adminActor(w, r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if !domain.ValidID(id) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	var in struct {
		Status string `json:"status"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	switch in.Status {
	case "Nuevo", "En revisión", "En progreso", "Esperando cliente", "Resuelto", "Cerrado":
	default:
		return fail(400, "invalid_status", "Estado inválido")
	}
	return s.mutate(w, r, a, "", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var status string
		if err := tx.QueryRow(r.Context(), "SELECT status FROM support_tickets WHERE id=$1 FOR UPDATE", id).Scan(&status); err != nil {
			return nil, err
		}
		allowed := false
		for _, next := range staffTicketFlow[status] {
			if next == in.Status {
				allowed = true
			}
		}
		if !allowed {
			return nil, fail(409, "invalid_transition", "Transición inválida")
		}
		if _, err := tx.Exec(r.Context(), "UPDATE support_tickets SET status=$2 WHERE id=$1", id, in.Status); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "support.staff_status", id, in); err != nil {
			return nil, err
		}
		raw, err := ticketJSON(r.Context(), tx, id)
		if err != nil {
			return nil, err
		}
		return ticketWithSLA(raw, domain.Now(r.Context()))
	})
}

func (s *Server) adminListIdeas(w http.ResponseWriter, r *http.Request) error {
	if _, err := s.adminActor(w, r); err != nil {
		return err
	}
	return s.listIdeas(w, r)
}

func (s *Server) adminIdeaStatus(w http.ResponseWriter, r *http.Request) error {
	a, err := s.adminActor(w, r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if !domain.ValidID(id) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	var in struct {
		Status    string  `json:"status"`
		ReleaseID *string `json:"releaseId"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	switch in.Status {
	case "En evaluación", "Planificada", "En desarrollo", "Lanzada":
	default:
		return fail(400, "invalid_status", "Estado inválido")
	}
	return s.mutate(w, r, a, "", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		if in.ReleaseID != nil {
			if !domain.ValidID(*in.ReleaseID) {
				return nil, fail(400, "invalid_release", "Release inválida")
			}
			var exists bool
			if err := tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM support_releases WHERE id=$1)", *in.ReleaseID).Scan(&exists); err != nil {
				return nil, err
			}
			if !exists {
				return nil, fail(404, "unknown_release", "Release inexistente")
			}
		}
		if _, err := tx.Exec(r.Context(), "UPDATE support_ideas SET status=$2,release_id=$3 WHERE id=$1", id, in.Status, in.ReleaseID); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "support.idea_status", id, in); err != nil {
			return nil, err
		}
		return ideaJSON(r.Context(), tx, a.ClinicID, id)
	})
}

func (s *Server) adminCreateRelease(w http.ResponseWriter, r *http.Request) error {
	a, err := s.adminActor(w, r)
	if err != nil {
		return err
	}
	var in struct {
		Version    string           `json:"version"`
		ReleasedOn string           `json:"releasedOn"`
		Items      []map[string]any `json:"items"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	in.Version = strings.TrimSpace(in.Version)
	if in.Version == "" || len(in.Version) > 50 {
		return fail(400, "invalid_release", "Release inválida")
	}
	if _, err = domain.CivilDate(in.ReleasedOn); err != nil {
		return fail(400, "invalid_date", "Fecha inválida")
	}
	if len(in.Items) > 200 {
		return fail(400, "invalid_items", "Demasiados ítems")
	}
	return s.mutate(w, r, a, "", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		id := domain.UUID()
		itemsRaw, err := json.Marshal(in.Items)
		if err != nil {
			return nil, err
		}
		if _, err = tx.Exec(r.Context(), "INSERT INTO support_releases(id,version,released_on,items) VALUES($1,$2,$3::date,$4)", id, in.Version, in.ReleasedOn, itemsRaw); err != nil {
			return nil, err
		}
		if err = audit(r.Context(), tx, a, "support.release", id, map[string]any{"version": in.Version}); err != nil {
			return nil, err
		}
		var raw []byte
		if err = tx.QueryRow(r.Context(), "SELECT to_jsonb(v) FROM (SELECT id,version,to_char(released_on,'YYYY-MM-DD') AS \"releasedOn\",items FROM support_releases WHERE id=$1) v", id).Scan(&raw); err != nil {
			return nil, err
		}
		return json.RawMessage(raw), nil
	})
}

func (s *Server) adminCreateClinic(w http.ResponseWriter, r *http.Request) error {
	a, err := s.adminActor(w, r)
	if err != nil {
		return err
	}
	var in struct {
		Name    string `json:"name"`
		Sector  string `json:"sector"`
		Address string `json:"address"`
		Phone   string `json:"phone"`
		Email   string `json:"email"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" || len(in.Name) > 200 || len(in.Sector) > 200 || len(in.Address) > 500 || len(in.Phone) > 50 || len(in.Email) > 200 {
		return fail(400, "invalid_clinic", "Clínica inválida")
	}
	return s.mutate(w, r, a, "", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		gid := domain.UUID()
		if _, err := tx.Exec(r.Context(), "INSERT INTO groups(id,name) VALUES($1,$2)", gid, in.Name); err != nil {
			return nil, err
		}
		cid := domain.UUID()
		if _, err := tx.Exec(r.Context(), "INSERT INTO clinics(id,group_id,name,sector,address,phone,email,status,joined_at) VALUES($1,$2,$3,$4,$5,$6,$7,'Invitación pendiente',current_date)", cid, gid, in.Name, in.Sector, in.Address, in.Phone, in.Email); err != nil {
			return nil, err
		}
		for role, perms := range model.DefaultRolePermissions() {
			for _, p := range perms {
				if _, err := tx.Exec(r.Context(), "INSERT INTO role_permissions(clinic_id,role,permission) VALUES($1,$2,$3)", cid, role, p); err != nil {
					return nil, err
				}
			}
		}
		if err := audit(r.Context(), tx, a, "support.clinic_created", cid, map[string]any{"name": in.Name}); err != nil {
			return nil, err
		}
		return map[string]any{"id": cid, "name": in.Name, "status": "Invitación pendiente"}, nil
	})
}
