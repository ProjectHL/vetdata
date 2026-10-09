package handler

import (
	"context"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
)

func (s *Server) tasksRoutes(m *http.ServeMux) {
	s.route(m, "GET /api/v1/tasks", s.listTasks)
	s.route(m, "PATCH /api/v1/tasks/{id}", s.updateTask)
}

type taskItem struct {
	ID         string  `json:"id"`
	Channel    string  `json:"channel"`
	Title      string  `json:"title"`
	Detail     string  `json:"detail"`
	Priority   string  `json:"priority"`
	Since      string  `json:"since"`
	Href       string  `json:"href"`
	Permission string  `json:"permission"`
	Assignee   *string `json:"assignee,omitempty"`
	Done       bool    `json:"done"`
}

// taskPermission maps a task source to the permission that gates it.
func taskPermission(source string) (string, bool) {
	switch source {
	case "solicitud":
		return "red.solicitar", true
	case "llegada":
		return "agenda.gestionar", true
	}
	return "", false
}

func taskPriorityRank(p string) int {
	switch p {
	case "Alta":
		return 0
	case "Media":
		return 1
	}
	return 2
}

func (s *Server) listTasks(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	view := r.URL.Query().Get("view")
	if view == "" {
		view = "open"
	}
	if view != "all" && view != "open" && view != "mine" && view != "done" {
		return fail(400, "invalid_view", "Vista inválida")
	}
	allowed, err := permissions(r.Context(), s.pool, a.ClinicID)
	if err != nil {
		return err
	}
	has := map[string]bool{}
	for _, p := range allowed[a.Role] {
		has[p] = true
	}
	today := domain.LocalDate(domain.Now(r.Context()))
	out := []taskItem{}
	rows, err := s.pool.Query(r.Context(), `SELECT q.id,to_char(q.created_at,'YYYY-MM-DD'),
 CASE WHEN q.expires_at<=now()+interval '24 hours' THEN 'Alta' ELSE 'Media' END,q.scope,p.name FROM sharing_requests q
 JOIN patients p ON p.id=q.patient_id WHERE q.requesting_clinic_id=$1 AND q.status='Esperando dueño' AND q.expires_at>now() ORDER BY q.created_at`, a.ClinicID)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id, since, priority, scope, name string
		if err = rows.Scan(&id, &since, &priority, &scope, &name); err != nil {
			rows.Close()
			return err
		}
		out = append(out, taskItem{ID: "solicitud:" + id, Channel: "Red", Title: "Seguimiento de solicitud", Detail: name + " · " + scope, Priority: priority, Since: since, Href: "/clinicas/solicitudes", Permission: "red.solicitar"})
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	rows, err = s.pool.Query(r.Context(), `SELECT a.id,to_char(a.starts_at AT TIME ZONE 'America/Santiago','HH24:MI'),a.reason,a.emergency,p.name FROM appointments a
 JOIN patients p ON p.id=a.patient_id WHERE a.clinic_id=$1 AND a.status IN ('Agendada','Confirmada') AND (a.starts_at AT TIME ZONE 'America/Santiago')::date=$2::date ORDER BY a.starts_at`, a.ClinicID, today)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id, at, reason, name string
		var emergency bool
		if err = rows.Scan(&id, &at, &reason, &emergency, &name); err != nil {
			rows.Close()
			return err
		}
		priority := "Media"
		if emergency {
			priority = "Alta"
		}
		out = append(out, taskItem{ID: "llegada:" + id, Channel: "Clínica", Title: "Llegada de " + name + " a las " + at, Detail: reason, Priority: priority, Since: today, Href: "/inicio/agenda", Permission: "agenda.gestionar"})
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	metaRows, err := s.pool.Query(r.Context(), "SELECT task_id,assignee,done FROM task_meta WHERE clinic_id=$1", a.ClinicID)
	if err != nil {
		return err
	}
	type meta struct {
		assignee *string
		done     bool
	}
	metas := map[string]meta{}
	for metaRows.Next() {
		var tid string
		var m meta
		if err = metaRows.Scan(&tid, &m.assignee, &m.done); err != nil {
			metaRows.Close()
			return err
		}
		metas[tid] = m
	}
	metaRows.Close()
	if err = metaRows.Err(); err != nil {
		return err
	}
	filtered := []taskItem{}
	for _, t := range out {
		if !has[t.Permission] {
			continue
		}
		if m, ok := metas[t.ID]; ok {
			t.Assignee = m.assignee
			t.Done = m.done
		}
		switch view {
		case "open":
			if t.Done {
				continue
			}
		case "mine":
			if t.Done || (t.Assignee != nil && *t.Assignee != a.UserID) {
				continue
			}
		case "done":
			if !t.Done {
				continue
			}
		}
		filtered = append(filtered, t)
	}
	for i := 0; i < len(filtered); i++ {
		for j := i + 1; j < len(filtered); j++ {
			ri, rj := taskPriorityRank(filtered[i].Priority), taskPriorityRank(filtered[j].Priority)
			if rj < ri || (rj == ri && filtered[j].Since < filtered[i].Since) {
				filtered[i], filtered[j] = filtered[j], filtered[i]
			}
		}
	}
	writeJSON(w, 200, filtered)
	return nil
}

func (s *Server) updateTask(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	parts := strings.SplitN(id, ":", 2)
	perm, ok := taskPermission(parts[0])
	if len(parts) != 2 || !ok || !domain.ValidID(parts[1]) {
		return fail(400, "invalid_task", "Tarea inválida")
	}
	if err = s.permitted(r.Context(), a, perm); err != nil {
		return err
	}
	var in struct {
		Assignee **string `json:"assignee"`
		Done     *bool    `json:"done"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	var assignee *string
	var done bool
	err = tx.QueryRow(r.Context(), "SELECT assignee,done FROM task_meta WHERE clinic_id=$1 AND task_id=$2", a.ClinicID, id).Scan(&assignee, &done)
	if err != nil && err != pgx.ErrNoRows {
		return err
	}
	if in.Assignee != nil {
		assignee = *in.Assignee
		if assignee != nil {
			var ok bool
			if err = tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM memberships WHERE user_id=$1 AND clinic_id=$2)", *assignee, a.ClinicID).Scan(&ok); err != nil {
				return err
			}
			if !ok {
				return fail(400, "invalid_assignee", "Responsable fuera de la clínica")
			}
		}
	}
	if in.Done != nil {
		done = *in.Done
	}
	if _, err = tx.Exec(r.Context(), `INSERT INTO task_meta(clinic_id,task_id,assignee,done) VALUES($1,$2,$3,$4)
 ON CONFLICT(clinic_id,task_id) DO UPDATE SET assignee=excluded.assignee,done=excluded.done`, a.ClinicID, id, assignee, done); err != nil {
		return err
	}
	if err = audit(r.Context(), tx, a, "task.updated", id, map[string]any{"assignee": assignee, "done": done}); err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	writeJSON(w, 200, map[string]any{"id": id, "assignee": assignee, "done": done})
	return nil
}
