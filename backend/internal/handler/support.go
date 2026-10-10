package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
)

// StaffClinicID is the stable backoffice tenant created by migration 011.
// Clinic sessions can never switch into it; only Staff memberships live there.
const StaffClinicID = "00000000-0000-0000-0000-000000000002"

func (s *Server) supportRoutes(m *http.ServeMux) {
	s.route(m, "GET /api/v1/support/tickets", s.listTickets)
	s.route(m, "POST /api/v1/support/tickets", s.createTicket)
	s.route(m, "GET /api/v1/support/tickets/{id}", s.getTicket)
	s.route(m, "POST /api/v1/support/tickets/{id}/messages", s.replyTicket)
	s.route(m, "PATCH /api/v1/support/tickets/{id}/status", s.changeTicketStatus)
	s.route(m, "POST /api/v1/support/tickets/{id}/rating", s.rateTicket)
	s.route(m, "GET /api/v1/support/ideas", s.listIdeas)
	s.route(m, "POST /api/v1/support/ideas", s.proposeIdea)
	s.route(m, "POST /api/v1/support/ideas/{id}/vote", s.voteIdea)
	s.route(m, "GET /api/v1/support/releases", s.listReleases)
}

// SLA response limits in hours, per priority (p-18, horas corridas).
var slaHours = map[string]float64{"Crítica": 4, "Alta": 24, "Media": 72, "Baja": 168}

func slaState(priority string, created, first *time.Time, now time.Time) string {
	limit := slaHours[priority]
	deadline := created.Add(time.Duration(limit * float64(time.Hour)))
	if first != nil {
		if !first.After(deadline) {
			return "Cumplido"
		}
		return "Incumplido"
	}
	if now.After(deadline) {
		return "Vencido"
	}
	if now.After(deadline.Add(-time.Duration(limit * 0.25 * float64(time.Hour)))) {
		return "En riesgo"
	}
	return "En plazo"
}

const ticketSelect = `SELECT t.id,t.number,t.clinic_id AS "clinicId",t.title,t.category,t.priority,t.module,t.status,
 t.created_by AS "createdBy",t.context_route AS "contextRoute",t.context_role AS "contextRole",
 t.first_response_at AS "firstResponseAt",t.idea_id AS "ideaId",t.rating,t.created_at AS "createdAt",
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'side',m.side,'authorId',m.author_id,'body',m.body,'createdAt',m.created_at) ORDER BY m.created_at,m.id),'[]') FROM support_messages m WHERE m.ticket_id=t.id) AS messages FROM support_tickets t`

func ticketJSON(ctx context.Context, tx pgx.Tx, id string) (json.RawMessage, error) {
	var raw []byte
	err := tx.QueryRow(ctx, "SELECT to_jsonb(v) FROM ("+ticketSelect+" WHERE t.id=$1) v", id).Scan(&raw)
	return raw, err
}

func ticketWithSLA(raw json.RawMessage, now time.Time) (map[string]any, error) {
	var v map[string]any
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, err
	}
	created, _ := time.Parse(time.RFC3339, v["createdAt"].(string))
	var first *time.Time
	if s, ok := v["firstResponseAt"].(string); ok {
		if p, err := time.Parse(time.RFC3339, s); err == nil {
			first = &p
		}
	}
	v["slaState"] = slaState(v["priority"].(string), &created, first, now)
	return v, nil
}

func (s *Server) staffOnly(r *http.Request, a Actor) error {
	var staff bool
	if err := s.pool.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM staff_clinic WHERE clinic_id=$1)", a.ClinicID).Scan(&staff); err != nil {
		return err
	}
	if !staff {
		return fail(403, "staff_only", "Solo VetData Staff")
	}
	return nil
}

func ticketAccess(r *http.Request, tx pgx.Tx, a Actor, id string, admin bool) error {
	var clinic, creator string
	if err := tx.QueryRow(r.Context(), "SELECT clinic_id,created_by FROM support_tickets WHERE id=$1", id).Scan(&clinic, &creator); err != nil {
		return err
	}
	if clinic != a.ClinicID {
		return pgx.ErrNoRows
	}
	if !admin && creator != a.UserID {
		return fail(403, "forbidden", "No tienes permiso para esta operación")
	}
	return nil
}

func (s *Server) listTickets(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	if err = s.permitted(r.Context(), a, "soporte.crear"); err != nil {
		return err
	}
	scope := r.URL.Query().Get("scope")
	admin := false
	if scope == "all" {
		if err = s.permitted(r.Context(), a, "soporte.administrar"); err != nil {
			return err
		}
		admin = true
	} else if scope != "" && scope != "mine" {
		return fail(400, "invalid_scope", "Alcance inválido")
	}
	q := `SELECT t.id,t.number,t.clinic_id,t.title,t.category,t.priority,t.module,t.status,
 t.created_by,t.context_route,t.context_role,t.first_response_at,t.idea_id,t.rating,t.created_at FROM support_tickets t WHERE t.clinic_id=$1`
	args := []any{a.ClinicID}
	if !admin {
		args = append(args, a.UserID)
		q += " AND t.created_by=$2"
	}
	if v := r.URL.Query().Get("status"); v != "" {
		switch v {
		case "Nuevo", "En revisión", "En progreso", "Esperando cliente", "Resuelto", "Cerrado":
		default:
			return fail(400, "invalid_status", "Estado inválido")
		}
		args = append(args, v)
		q += " AND t.status=$" + itoa(len(args))
	}
	if v := r.URL.Query().Get("category"); v != "" {
		switch v {
		case "Incidencia", "Mejora", "Consulta", "Integración / datos", "Facturación del servicio":
		default:
			return fail(400, "invalid_category", "Categoría inválida")
		}
		args = append(args, v)
		q += " AND t.category=$" + itoa(len(args))
	}
	if v := r.URL.Query().Get("priority"); v != "" {
		if _, ok := slaHours[v]; !ok {
			return fail(400, "invalid_priority", "Prioridad inválida")
		}
		args = append(args, v)
		q += " AND t.priority=$" + itoa(len(args))
	}
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	rows, err := s.pool.Query(r.Context(), q+" ORDER BY t.created_at DESC,t.id LIMIT $"+itoa(len(args)+1)+" OFFSET $"+itoa(len(args)+2), append(args, limit, offset)...)
	if err != nil {
		return err
	}
	defer rows.Close()
	now := domain.Now(r.Context())
	out := []any{}
	for rows.Next() {
		var t supportTicketRow
		if err = rows.Scan(&t.id, &t.number, &t.clinicID, &t.title, &t.category, &t.priority, &t.module, &t.status, &t.createdBy, &t.contextRoute, &t.contextRole, &t.firstResponseAt, &t.ideaID, &t.rating, &t.createdAt); err != nil {
			return err
		}
		v := map[string]any{
			"id": t.id, "number": t.number, "clinicId": t.clinicID, "title": t.title,
			"category": t.category, "priority": t.priority, "module": t.module, "status": t.status,
			"createdBy": t.createdBy, "contextRoute": t.contextRoute, "contextRole": t.contextRole,
			"ideaId": nilIfInvalid(t.ideaID), "rating": nilIntValid(t.rating),
			"createdAt": t.createdAt, "messages": []any{}, "slaState": slaState(t.priority, &t.createdAt, nullTime(t.firstResponseAt), now),
		}
		out = append(out, v)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	writeJSON(w, 200, out)
	return nil
}

type supportTicketRow struct {
	id                        string
	number                    int64
	clinicID                  string
	title                     string
	category                  string
	priority                  string
	module                    string
	status                    string
	createdBy                 string
	contextRoute, contextRole string
	firstResponseAt           sql.NullTime
	ideaID                    sql.NullString
	rating                    sql.NullInt64
	createdAt                 time.Time
}

func nilIfInvalid(s sql.NullString) any {
	if s.Valid {
		return s.String
	}
	return nil
}
func nilIntValid(i sql.NullInt64) any {
	if i.Valid {
		return i.Int64
	}
	return nil
}

func nullTime(nt sql.NullTime) *time.Time {
	if nt.Valid {
		return &nt.Time
	}
	return nil
}

type ticketInput struct {
	Title    string `json:"title"`
	Category string `json:"category"`
	Priority string `json:"priority"`
	Module   string `json:"module"`
	Body     string `json:"body"`
	Route    string `json:"route"`
}

var ticketCategories = map[string]bool{"Incidencia": true, "Mejora": true, "Consulta": true, "Integración / datos": true, "Facturación del servicio": true}

func (s *Server) createTicket(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in ticketInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	in.Title = strings.TrimSpace(in.Title)
	in.Body = strings.TrimSpace(in.Body)
	in.Module = strings.TrimSpace(in.Module)
	if in.Title == "" || len(in.Title) > 200 || !ticketCategories[in.Category] {
		return fail(400, "invalid_ticket", "Ticket inválido")
	}
	if _, ok := slaHours[in.Priority]; !ok {
		return fail(400, "invalid_ticket", "Prioridad inválida")
	}
	if in.Module == "" || len(in.Module) > 200 || in.Body == "" || len(in.Body) > 5000 || len(in.Route) > 300 {
		return fail(400, "invalid_ticket", "Ticket inválido")
	}
	return s.mutate(w, r, a, "soporte.crear", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		if err := s.staffClinicGuard(r.Context(), tx, a); err != nil {
			return nil, err
		}
		id := domain.UUID()
		var number int64
		if err := tx.QueryRow(r.Context(), "SELECT coalesce(max(number),1040)+1 FROM support_tickets").Scan(&number); err != nil {
			return nil, err
		}
		mid := domain.UUID()
		if _, err := tx.Exec(r.Context(), "INSERT INTO support_tickets(id,clinic_id,number,title,category,priority,module,created_by,context_route,context_role) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", id, a.ClinicID, number, in.Title, in.Category, in.Priority, in.Module, a.UserID, in.Route, a.Role); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(r.Context(), "INSERT INTO support_messages(id,ticket_id,clinic_id,side,author_id,body) VALUES($1,$2,$3,'Clínica',$4,$5)", mid, id, a.ClinicID, a.UserID, in.Body); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "support.created", id, map[string]any{"number": number}); err != nil {
			return nil, err
		}
		raw, err := ticketJSON(r.Context(), tx, id)
		if err != nil {
			return nil, err
		}
		return ticketWithSLA(raw, domain.Now(r.Context()))
	})
}

func (s *Server) staffClinicGuard(ctx context.Context, tx pgx.Tx, a Actor) error {
	var staff bool
	if err := tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM staff_clinic WHERE clinic_id=$1)", a.ClinicID).Scan(&staff); err != nil {
		return err
	}
	if staff {
		return fail(403, "staff_readonly", "El tenant Staff no emite tickets de clínica")
	}
	return nil
}

func (s *Server) getTicket(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if !domain.ValidID(id) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	if err = s.permitted(r.Context(), a, "soporte.crear"); err != nil {
		return err
	}
	var clinic, creator string
	if err = s.pool.QueryRow(r.Context(), "SELECT clinic_id,created_by FROM support_tickets WHERE id=$1", id).Scan(&clinic, &creator); err != nil {
		return err
	}
	if clinic != a.ClinicID {
		return fail(404, "not_found", "Recurso no encontrado")
	}
	var admin bool
	if err = s.pool.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM role_permissions WHERE clinic_id=$1 AND role=$2 AND permission='soporte.administrar')", a.ClinicID, a.Role).Scan(&admin); err != nil {
		return err
	}
	if !admin && creator != a.UserID {
		return fail(403, "forbidden", "No tienes permiso para esta operación")
	}
	var raw []byte
	if err = s.pool.QueryRow(r.Context(), "SELECT to_jsonb(v) FROM ("+ticketSelect+" WHERE t.id=$1) v", id).Scan(&raw); err != nil {
		return err
	}
	out, err := ticketWithSLA(raw, domain.Now(r.Context()))
	if err != nil {
		return err
	}
	writeJSON(w, 200, out)
	return nil
}

func (s *Server) replyTicket(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
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
	return s.mutate(w, r, a, "soporte.crear", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var admin bool
		if err := tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM role_permissions WHERE clinic_id=$1 AND role=$2 AND permission='soporte.administrar')", a.ClinicID, a.Role).Scan(&admin); err != nil {
			return nil, err
		}
		if err := ticketAccess(r, tx, a, id, admin); err != nil {
			return nil, err
		}
		var status string
		if err := tx.QueryRow(r.Context(), "SELECT status FROM support_tickets WHERE id=$1 FOR UPDATE", id).Scan(&status); err != nil {
			return nil, err
		}
		if status == "Cerrado" {
			return nil, fail(409, "ticket_closed", "El ticket cerrado no admite mensajes")
		}
		mid := domain.UUID()
		if _, err := tx.Exec(r.Context(), "INSERT INTO support_messages(id,ticket_id,clinic_id,side,author_id,body) VALUES($1,$2,$3,'Clínica',$4,$5)", mid, id, a.ClinicID, a.UserID, in.Body); err != nil {
			return nil, err
		}
		if status == "Esperando cliente" {
			if _, err := tx.Exec(r.Context(), "UPDATE support_tickets SET status='En progreso' WHERE id=$1", id); err != nil {
				return nil, err
			}
		}
		if err := audit(r.Context(), tx, a, "support.replied", mid, map[string]any{"ticket": id}); err != nil {
			return nil, err
		}
		raw, err := ticketJSON(r.Context(), tx, id)
		if err != nil {
			return nil, err
		}
		return ticketWithSLA(raw, domain.Now(r.Context()))
	})
}

// Ticket transitions allowed to the clinic side (p-18). VetData-side states
// (En revisión, En progreso, Esperando cliente) belong to /admin.
var clinicTicketFlow = map[string][]string{
	"Nuevo":             {"Esperando cliente", "Resuelto"},
	"En revisión":       {"Esperando cliente", "Resuelto"},
	"En progreso":       {"Esperando cliente", "Resuelto"},
	"Esperando cliente": {"En progreso", "Resuelto"},
	"Resuelto":          {},
	"Cerrado":           {},
}

var staffTicketFlow = map[string][]string{
	"Nuevo":             {"En revisión", "En progreso", "Esperando cliente", "Resuelto"},
	"En revisión":       {"En progreso", "Esperando cliente", "Resuelto"},
	"En progreso":       {"Esperando cliente", "Resuelto"},
	"Esperando cliente": {"En progreso", "Resuelto", "Nuevo"},
	"Resuelto":          {"Cerrado", "En progreso"},
	"Cerrado":           {},
}

func (s *Server) changeTicketStatus(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
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
	return s.mutate(w, r, a, "soporte.crear", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var admin bool
		if err := tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM role_permissions WHERE clinic_id=$1 AND role=$2 AND permission='soporte.administrar')", a.ClinicID, a.Role).Scan(&admin); err != nil {
			return nil, err
		}
		if err := ticketAccess(r, tx, a, id, admin); err != nil {
			return nil, err
		}
		if in.Status == "Cerrado" && !admin {
			return nil, fail(403, "forbidden", "Solo soporte.administrar cierra tickets")
		}
		var status string
		if err := tx.QueryRow(r.Context(), "SELECT status FROM support_tickets WHERE id=$1 FOR UPDATE", id).Scan(&status); err != nil {
			return nil, err
		}
		allowed := false
		for _, next := range clinicTicketFlow[status] {
			if next == in.Status {
				allowed = true
			}
		}
		if in.Status == "En revisión" || in.Status == "En progreso" || in.Status == "Esperando cliente" || in.Status == "Nuevo" {
			if !admin {
				return nil, fail(403, "staff_state", "Ese estado lo gestiona VetData")
			}
		}
		if !allowed {
			return nil, fail(409, "invalid_transition", "Transición inválida")
		}
		if _, err := tx.Exec(r.Context(), "UPDATE support_tickets SET status=$2 WHERE id=$1", id, in.Status); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "support.status", id, in); err != nil {
			return nil, err
		}
		raw, err := ticketJSON(r.Context(), tx, id)
		if err != nil {
			return nil, err
		}
		return ticketWithSLA(raw, domain.Now(r.Context()))
	})
}

func (s *Server) rateTicket(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if !domain.ValidID(id) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	var in struct {
		Rating int `json:"rating"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if in.Rating < 1 || in.Rating > 5 {
		return fail(400, "invalid_rating", "Calificación inválida")
	}
	return s.mutate(w, r, a, "soporte.crear", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var admin bool
		if err := tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM role_permissions WHERE clinic_id=$1 AND role=$2 AND permission='soporte.administrar')", a.ClinicID, a.Role).Scan(&admin); err != nil {
			return nil, err
		}
		if err := ticketAccess(r, tx, a, id, admin); err != nil {
			return nil, err
		}
		var status string
		var rated *int
		if err := tx.QueryRow(r.Context(), "SELECT status,rating FROM support_tickets WHERE id=$1 FOR UPDATE", id).Scan(&status, &rated); err != nil {
			return nil, err
		}
		if status != "Resuelto" {
			return nil, fail(409, "not_resolved", "Solo se califica un ticket Resuelto")
		}
		if rated != nil {
			return nil, fail(409, "already_rated", "El ticket ya fue calificado")
		}
		if _, err := tx.Exec(r.Context(), "UPDATE support_tickets SET rating=$2,status='Cerrado' WHERE id=$1", id, in.Rating); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "support.rated", id, in); err != nil {
			return nil, err
		}
		raw, err := ticketJSON(r.Context(), tx, id)
		if err != nil {
			return nil, err
		}
		return ticketWithSLA(raw, domain.Now(r.Context()))
	})
}

func ideaJSON(ctx context.Context, tx pgx.Tx, clinic, id string) (map[string]any, error) {
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT to_jsonb(v) FROM (SELECT i.id,i.title,i.description,i.module,i.status,
 i.proposed_by AS "proposedBy",i.release_id AS "releaseId",i.created_at AS "createdAt",
 (SELECT count(*) FROM support_votes v WHERE v.idea_id=i.id) AS votes,
 EXISTS(SELECT 1 FROM support_votes v WHERE v.idea_id=i.id AND v.clinic_id=$2) AS "votedByMe" FROM support_ideas i WHERE i.id=$1) v`, id, clinic).Scan(&raw)
	if err != nil {
		return nil, err
	}
	var v map[string]any
	if err = json.Unmarshal(raw, &v); err != nil {
		return nil, err
	}
	return v, nil
}

func (s *Server) listIdeas(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	q := `SELECT to_jsonb(v) FROM (SELECT i.id,i.title,i.description,i.module,i.status,
 i.proposed_by AS "proposedBy",i.release_id AS "releaseId",i.created_at AS "createdAt",
 (SELECT count(*) FROM support_votes v WHERE v.idea_id=i.id) AS votes,
 EXISTS(SELECT 1 FROM support_votes v WHERE v.idea_id=i.id AND v.clinic_id=$1) AS "votedByMe" FROM support_ideas i`
	args := []any{a.ClinicID}
	if v := r.URL.Query().Get("status"); v != "" {
		switch v {
		case "En evaluación", "Planificada", "En desarrollo", "Lanzada":
		default:
			return fail(400, "invalid_status", "Estado inválido")
		}
		args = append(args, v)
		q += " WHERE i.status=$2"
	}
	if v := r.URL.Query().Get("module"); v != "" {
		args = append(args, v)
		if len(args) == 2 {
			q += " WHERE i.module=$2"
		} else {
			q += " AND i.module=$3"
		}
	}
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	rows, err := s.pool.Query(r.Context(), "SELECT * FROM ("+q+" ORDER BY i.created_at DESC,i.id LIMIT $"+itoa(len(args)+1)+" OFFSET $"+itoa(len(args)+2)+") v", append(args, limit, offset)...)
	if err != nil {
		return err
	}
	defer rows.Close()
	out := []any{}
	for rows.Next() {
		var raw []byte
		if err = rows.Scan(&raw); err != nil {
			return err
		}
		var v map[string]any
		if err = json.Unmarshal(raw, &v); err != nil {
			return err
		}
		out = append(out, v)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	writeJSON(w, 200, out)
	return nil
}

func (s *Server) proposeIdea(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Module      string `json:"module"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	in.Title = strings.TrimSpace(in.Title)
	in.Description = strings.TrimSpace(in.Description)
	in.Module = strings.TrimSpace(in.Module)
	if in.Title == "" || len(in.Title) > 200 || in.Description == "" || len(in.Description) > 2000 || in.Module == "" || len(in.Module) > 200 {
		return fail(400, "invalid_idea", "Idea inválida")
	}
	return s.mutate(w, r, a, "soporte.crear", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		if err := s.staffClinicGuard(r.Context(), tx, a); err != nil {
			return nil, err
		}
		iid := domain.UUID()
		if _, err := tx.Exec(r.Context(), "INSERT INTO support_ideas(id,title,description,module,proposed_by) VALUES($1,$2,$3,$4,$5)", iid, in.Title, in.Description, in.Module, a.ClinicID); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(r.Context(), "INSERT INTO support_votes(idea_id,clinic_id) VALUES($1,$2)", iid, a.ClinicID); err != nil {
			return nil, err
		}
		tid := domain.UUID()
		var number int64
		if err := tx.QueryRow(r.Context(), "SELECT coalesce(max(number),1040)+1 FROM support_tickets").Scan(&number); err != nil {
			return nil, err
		}
		mid := domain.UUID()
		if _, err := tx.Exec(r.Context(), "INSERT INTO support_tickets(id,clinic_id,number,title,category,priority,module,created_by,context_route,context_role,idea_id) VALUES($1,$2,$3,$4,'Mejora','Baja',$5,$6,'/soporte/mejoras',$7,$8)", tid, a.ClinicID, number, in.Title, in.Module, a.UserID, a.Role, iid); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(r.Context(), "INSERT INTO support_messages(id,ticket_id,clinic_id,side,author_id,body) VALUES($1,$2,$3,'Clínica',$4,$5)", mid, tid, a.ClinicID, a.UserID, in.Description); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "support.idea", iid, map[string]any{"ticket": tid}); err != nil {
			return nil, err
		}
		idea, err := ideaJSON(r.Context(), tx, a.ClinicID, iid)
		if err != nil {
			return nil, err
		}
		raw, err := ticketJSON(r.Context(), tx, tid)
		if err != nil {
			return nil, err
		}
		ticket, err := ticketWithSLA(raw, domain.Now(r.Context()))
		if err != nil {
			return nil, err
		}
		return map[string]any{"idea": idea, "ticket": ticket}, nil
	})
}

func (s *Server) voteIdea(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if !domain.ValidID(id) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	var in struct {
		Voted bool `json:"voted"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	return s.mutate(w, r, a, "soporte.crear", map[string]any{"id": id, "voted": in.Voted}, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var status string
		var voted bool
		if err := tx.QueryRow(r.Context(), "SELECT status,EXISTS(SELECT 1 FROM support_votes WHERE idea_id=$1 AND clinic_id=$2) AS voted FROM support_ideas WHERE id=$1 FOR UPDATE", id, a.ClinicID).Scan(&status, &voted); err != nil {
			return nil, err
		}
		if status == "Lanzada" {
			return nil, fail(409, "idea_launched", "La idea lanzada no se vota")
		}
		if voted == in.Voted {
			return ideaJSON(r.Context(), tx, a.ClinicID, id)
		}
		if in.Voted {
			if _, err := tx.Exec(r.Context(), "INSERT INTO support_votes(idea_id,clinic_id) VALUES($1,$2) ON CONFLICT DO NOTHING", id, a.ClinicID); err != nil {
				return nil, err
			}
		} else {
			if _, err := tx.Exec(r.Context(), "DELETE FROM support_votes WHERE idea_id=$1 AND clinic_id=$2", id, a.ClinicID); err != nil {
				return nil, err
			}
		}
		if err := audit(r.Context(), tx, a, "support.voted", id, map[string]any{"voted": in.Voted}); err != nil {
			return nil, err
		}
		return ideaJSON(r.Context(), tx, a.ClinicID, id)
	})
}

func (s *Server) listReleases(w http.ResponseWriter, r *http.Request) error {
	if _, err := s.actor(r); err != nil {
		return err
	}
	rows, err := s.pool.Query(r.Context(), "SELECT id,version,released_on,items FROM support_releases ORDER BY released_on DESC,version")
	if err != nil {
		return err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id string
		var version, items []byte
		var released time.Time
		if err = rows.Scan(&id, &version, &released, &items); err != nil {
			return err
		}
		out = append(out, map[string]any{"id": id, "version": string(version), "releasedOn": released.Format("2006-01-02"), "items": json.RawMessage(items)})
	}
	if err = rows.Err(); err != nil {
		return err
	}
	writeJSON(w, 200, out)
	return nil
}
