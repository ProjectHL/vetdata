package handler

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
	"github.com/vetdata/api/internal/notifications"
	"net/http"
	"net/mail"
	"strings"
	"time"
)

func (s *Server) operationsRoutes(m *http.ServeMux) {
	s.scheduleRoutes(m)
	s.inventoryRoutes(m)
	s.billingRoutes(m)
	s.referralRoutes(m)
	s.route(m, "GET /api/v1/appointments", s.listAppointments)
	s.route(m, "POST /api/v1/appointments", s.createAppointment)
	s.route(m, "PATCH /api/v1/appointments/{id}", s.updateAppointment)
	s.route(m, "POST /api/v1/appointments/{id}/remind", s.remindAppointment)
	s.route(m, "GET /api/v1/rooms", s.listRooms)
	s.route(m, "POST /api/v1/rooms", s.createRoom)
	s.route(m, "PATCH /api/v1/rooms/{id}", s.updateRoom)
	s.route(m, "POST /api/v1/rooms/{id}/finish", s.finishRoom)
	s.route(m, "GET /api/v1/security/waiting", s.listWaiting)
	s.route(m, "GET /api/v1/security/access", s.listAccess)
	s.route(m, "POST /api/v1/security/waiting", s.checkIn)
	s.route(m, "POST /api/v1/security/waiting/{id}/call", s.callWaiting)
}
func (s *Server) scopedList(w http.ResponseWriter, r *http.Request, perm, query string) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	if perm != "" {
		if err = s.permitted(r.Context(), a, perm); err != nil {
			return err
		}
	}
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	var raw []byte
	err = s.pool.QueryRow(r.Context(), "SELECT coalesce(jsonb_agg(v),'[]') FROM ("+query+" LIMIT $2 OFFSET $3) v", a.ClinicID, limit, offset).Scan(&raw)
	if err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}

const appointmentSelect = `SELECT id,patient_id AS "patientId",doctor_id AS "doctorId",room_id AS "roomId",
 to_char(starts_at AT TIME ZONE 'America/Santiago','YYYY-MM-DD') AS date,
 to_char(starts_at AT TIME ZONE 'America/Santiago','HH24:MI') AS time,
 starts_at AS "startsAt",ends_at AS "endsAt",reason,status,emergency FROM appointments`

func appointmentJSON(ctx context.Context, tx pgx.Tx, id, clinic string) (json.RawMessage, error) {
	var raw []byte
	err := tx.QueryRow(ctx, "SELECT to_jsonb(v) FROM ("+appointmentSelect+" WHERE id=$1 AND clinic_id=$2) v", id, clinic).Scan(&raw)
	return raw, err
}
func (s *Server) listAppointments(w http.ResponseWriter, r *http.Request) error {
	return s.scopedList(w, r, "agenda.gestionar", appointmentSelect+" WHERE clinic_id=$1 ORDER BY starts_at,id")
}

type appointmentInput struct {
	PatientID string `json:"patientId"`
	DoctorID  string `json:"doctorId"`
	Date      string `json:"date"`
	Time      string `json:"time"`
	Reason    string `json:"reason"`
	Emergency bool   `json:"emergency"`
}

func appointmentTime(ctx context.Context, tx pgx.Tx, a Actor, in appointmentInput) (time.Time, time.Time, error) {
	if !domain.ValidID(in.PatientID) || !domain.ValidID(in.DoctorID) || strings.TrimSpace(in.Reason) == "" || len(in.Reason) > 2000 {
		return time.Time{}, time.Time{}, fail(400, "invalid_appointment", "Datos de cita inválidos")
	}
	starts, err := time.ParseInLocation("2006-01-02 15:04", in.Date+" "+in.Time, domain.Santiago)
	if err != nil || starts.Format("2006-01-02 15:04") != in.Date+" "+in.Time {
		return starts, starts, fail(400, "invalid_time", "Fecha u hora inválida")
	}
	if !in.Emergency && starts.Before(domain.Now(ctx)) {
		return starts, starts, fail(409, "past_appointment", "La cita debe ser futura")
	}
	if in.Emergency && in.Date != domain.LocalDate(domain.Now(ctx)) {
		return starts, starts, fail(400, "emergency_date", "La urgencia debe ser de hoy")
	}
	if _, err = patientAccess(ctx, tx, a, in.PatientID); err != nil {
		return starts, starts, err
	}
	var active bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM doctors d LEFT JOIN memberships m ON m.user_id=d.user_id AND m.clinic_id=d.clinic_id
 LEFT JOIN users u ON u.id=d.user_id WHERE d.id=$1 AND d.clinic_id=$2
 AND (d.user_id IS NULL OR (m.status='Activo' AND m.role='Veterinario' AND u.status='Activo')))`, in.DoctorID, a.ClinicID).Scan(&active)
	if err != nil {
		return starts, starts, err
	}
	if !active {
		return starts, starts, fail(409, "inactive_doctor", "Profesional no disponible")
	}
	minutes := 30
	if !in.Emergency {
		err = tx.QueryRow(ctx, `SELECT h.slot_minutes FROM clinic_hours h WHERE h.clinic_id=$1 AND h.weekday=$2
 AND $3::time>=h.starts_at AND $3::time+h.slot_minutes*interval '1 minute'<=h.ends_at
 AND mod(extract(epoch FROM ($3::time-h.starts_at))::int,h.slot_minutes*60)=0
 AND NOT EXISTS(SELECT 1 FROM clinic_holidays WHERE clinic_id=$1 AND day=$4::date)
 AND (NOT EXISTS(SELECT 1 FROM doctor_hours WHERE doctor_id=$5)
 OR EXISTS(SELECT 1 FROM doctor_hours dh WHERE dh.doctor_id=$5 AND dh.weekday=$2
 AND $3::time>=dh.starts_at AND $3::time+h.slot_minutes*interval '1 minute'<=dh.ends_at))
 ORDER BY h.starts_at LIMIT 1`, a.ClinicID, int(starts.Weekday()), in.Time, in.Date, in.DoctorID).Scan(&minutes)
		if err == pgx.ErrNoRows {
			return starts, starts, fail(409, "outside_hours", "Hora fuera de disponibilidad")
		}
		if err != nil {
			return starts, starts, err
		}
	}
	return starts, starts.Add(time.Duration(minutes) * time.Minute), nil
}
func (s *Server) createAppointment(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in appointmentInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	return s.mutate(w, r, a, "agenda.gestionar", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		start, end, e := appointmentTime(r.Context(), tx, a, in)
		if e != nil {
			return nil, e
		}
		id := domain.UUID()
		if _, e = tx.Exec(r.Context(), "INSERT INTO appointments(id,clinic_id,patient_id,doctor_id,starts_at,ends_at,reason,emergency,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", id, a.ClinicID, in.PatientID, in.DoctorID, start, end, in.Reason, in.Emergency, a.UserID); e != nil {
			return nil, e
		}
		if e = audit(r.Context(), tx, a, "appointment.created", id, struct{}{}); e != nil {
			return nil, e
		}
		return appointmentJSON(r.Context(), tx, id, a.ClinicID)
	})
}
func (s *Server) updateAppointment(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	var in struct {
		Status   *string `json:"status"`
		Date     *string `json:"date"`
		Time     *string `json:"time"`
		DoctorID *string `json:"doctorId"`
		Reason   *string `json:"reason"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if (in.Date == nil) != (in.Time == nil) {
		return fail(400, "date_time_required", "Fecha y hora se actualizan juntas")
	}
	if in.Status != nil && (in.Date != nil || in.DoctorID != nil) {
		return fail(400, "ambiguous_transition", "Reagenda y cambia el estado en operaciones separadas")
	}
	return s.mutate(w, r, a, "agenda.gestionar", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var current, pid, doctor, reason string
		var start, end time.Time
		var room *string
		err := tx.QueryRow(r.Context(), "SELECT status,patient_id,doctor_id,reason,starts_at,ends_at,room_id FROM appointments WHERE id=$1 AND clinic_id=$2 FOR UPDATE", id, a.ClinicID).Scan(&current, &pid, &doctor, &reason, &start, &end, &room)
		if err != nil {
			return nil, err
		}
		if current != "Agendada" && current != "Confirmada" {
			return nil, fail(409, "terminal_appointment", "La cita está cerrada")
		}
		var arrived bool
		if err = tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM waiting_entries WHERE appointment_id=$1)", id).Scan(&arrived); err != nil {
			return nil, err
		}
		if room != nil || arrived {
			return nil, fail(409, "already_arrived", "La cita ya está en atención; usa el flujo de espera/box")
		}
		status := current
		if in.Status != nil {
			status = *in.Status
		}
		if status != "Agendada" && status != "Confirmada" && status != "Cancelada" && status != "No asistió" {
			return nil, fail(409, "invalid_transition", "Transición no permitida; finaliza desde el box")
		}
		if status == "No asistió" && start.After(domain.Now(r.Context())) {
			return nil, fail(409, "future_appointment", "La cita aún no comienza")
		}
		if in.Reason != nil {
			reason = *in.Reason
		}
		if strings.TrimSpace(reason) == "" || len(reason) > 2000 {
			return nil, fail(400, "reason_required", "Motivo requerido")
		}
		if in.DoctorID != nil {
			doctor = *in.DoctorID
		}
		if in.Date != nil || in.DoctorID != nil {
			date, clock := start.In(domain.Santiago).Format("2006-01-02"), start.In(domain.Santiago).Format("15:04")
			if in.Date != nil {
				date = *in.Date
				clock = *in.Time
			}
			start, end, err = appointmentTime(r.Context(), tx, a, appointmentInput{PatientID: pid, DoctorID: doctor, Date: date, Time: clock, Reason: reason})
			if err != nil {
				return nil, err
			}
			status = "Agendada"
		}
		if _, err = tx.Exec(r.Context(), "UPDATE appointments SET status=$3,doctor_id=$4,starts_at=$5,ends_at=$6,reason=$7 WHERE id=$1 AND clinic_id=$2", id, a.ClinicID, status, doctor, start, end, reason); err != nil {
			return nil, err
		}
		if status == "Cancelada" {
			if _, err = tx.Exec(r.Context(), "DELETE FROM notification_outbox WHERE sent_at IS NULL AND dedup_key=$1", "reminder:"+id); err != nil {
				return nil, err
			}
		}
		return appointmentJSON(r.Context(), tx, id, a.ClinicID)
	})
}

func (s *Server) remindAppointment(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	if s.opt.Mail == nil || !s.opt.Mail.Enabled() {
		return fail(503, "notifications_unavailable", "Avisos no disponibles")
	}
	return s.mutate(w, r, a, "agenda.gestionar", struct{}{}, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var status, patient, doctor, reason, email, channel, firstName, lastName, clinic string
		var start, end time.Time
		var optOut bool
		err := tx.QueryRow(r.Context(), `SELECT a.status,a.starts_at,a.ends_at,p.name,d.name,a.reason,o.email,o.preferred_contact,o.first_name,o.last_name,c.name,co.reminder_opt_out
 FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN doctors d ON d.id=a.doctor_id
 JOIN owners o ON o.id=p.owner_id JOIN clinic_owners co ON co.owner_id=o.id AND co.clinic_id=a.clinic_id
 JOIN clinics c ON c.id=a.clinic_id
 WHERE a.id=$1 AND a.clinic_id=$2 FOR UPDATE OF a`,
			id, a.ClinicID).Scan(&status, &start, &end, &patient, &doctor, &reason, &email, &channel, &firstName, &lastName, &clinic, &optOut)
		if err != nil {
			return nil, err
		}
		if status != "Agendada" && status != "Confirmada" {
			return nil, fail(409, "invalid_status", "Solo citas activas reciben recordatorio")
		}
		skip := func(reason string) (any, error) {
			if e := audit(r.Context(), tx, a, "reminder.skipped", id, map[string]string{"reason": reason}); e != nil {
				return nil, e
			}
			return map[string]any{"sent": false, "reason": reason}, nil
		}
		if optOut {
			return skip("opted_out")
		}
		if channel != "Email" {
			return skip("channel_unavailable")
		}
		if _, err = mail.ParseAddress(email); err != nil || email != strings.TrimSpace(email) {
			return nil, fail(400, "invalid_email", "Correo del dueño inválido")
		}
		key := "reminder:" + id
		var sentAt *time.Time
		if err = tx.QueryRow(r.Context(), "SELECT sent_at FROM notification_outbox WHERE dedup_key=$1", key).Scan(&sentAt); err != nil && err != pgx.ErrNoRows {
			return nil, err
		}
		if err == nil {
			if sentAt != nil {
				return skip("already_sent")
			}
			return skip("already_pending")
		}
		when := start.In(domain.Santiago).Format("02/01/2006 15:04")
		body := "Hola " + firstName + " " + lastName + ":\nTe recordamos tu cita en " + clinic + ".\nMascota: " + patient + "\nFecha: " + when + "\nProfesional: " + doctor + "\nMotivo: " + reason + "\nSi no querés más avisos, pedilo en recepción."
		if err = s.opt.Mail.Enqueue(r.Context(), tx, key, notifications.Message{To: email, Subject: "Recordatorio de cita — " + clinic, Body: body}); err != nil {
			return nil, err
		}
		if err = audit(r.Context(), tx, a, "reminder.queued", id, map[string]string{}); err != nil {
			return nil, err
		}
		return map[string]any{"sent": true}, nil
	})
}

const roomSelect = `SELECT id,name,kind,status,doctor_id AS "doctorId",patient_id AS "patientId",since FROM rooms`

func roomJSON(ctx context.Context, tx pgx.Tx, id, clinic string) (json.RawMessage, error) {
	var raw []byte
	err := tx.QueryRow(ctx, "SELECT to_jsonb(v) FROM ("+roomSelect+" WHERE id=$1 AND clinic_id=$2) v", id, clinic).Scan(&raw)
	return raw, err
}
func (s *Server) listRooms(w http.ResponseWriter, r *http.Request) error {
	return s.scopedList(w, r, "", roomSelect+" WHERE clinic_id=$1 ORDER BY id")
}
func (s *Server) createRoom(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in struct {
		Name string `json:"name"`
		Kind string `json:"kind"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if strings.TrimSpace(in.Name) == "" || len(in.Name) > 120 {
		return fail(400, "invalid_name", "Nombre inválido")
	}
	return s.mutate(w, r, a, "usuarios.administrar", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		id := domain.UUID()
		if _, e := tx.Exec(r.Context(), "INSERT INTO rooms(id,clinic_id,name,kind) VALUES($1,$2,$3,$4)", id, a.ClinicID, in.Name, in.Kind); e != nil {
			return nil, e
		}
		return roomJSON(r.Context(), tx, id, a.ClinicID)
	})
}
func (s *Server) updateRoom(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	var in struct {
		Status string `json:"status"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if in.Status != "disponible" {
		return fail(409, "invalid_transition", "Usa el flujo de atención para ocupar/finalizar")
	}
	return s.mutate(w, r, a, "agenda.gestionar", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var current string
		if e := tx.QueryRow(r.Context(), "SELECT status FROM rooms WHERE id=$1 AND clinic_id=$2 FOR UPDATE", id, a.ClinicID).Scan(&current); e != nil {
			return nil, e
		}
		if current != "limpieza" {
			return nil, fail(409, "invalid_transition", "El box no está en limpieza")
		}
		if _, e := tx.Exec(r.Context(), "UPDATE rooms SET status='disponible',since=now() WHERE id=$1", id); e != nil {
			return nil, e
		}
		if _, e := tx.Exec(r.Context(), "INSERT INTO room_history(clinic_id,room_id,status) VALUES($1,$2,'disponible')", a.ClinicID, id); e != nil {
			return nil, e
		}
		return roomJSON(r.Context(), tx, id, a.ClinicID)
	})
}
func (s *Server) listWaiting(w http.ResponseWriter, r *http.Request) error {
	return s.scopedList(w, r, "agenda.gestionar", `SELECT w.id,w.appointment_id AS "appointmentId",a.patient_id AS "patientId",w.arrived_at AS "arrivedAt" FROM waiting_entries w JOIN appointments a ON a.id=w.appointment_id WHERE w.clinic_id=$1 AND w.called_at IS NULL ORDER BY w.arrived_at,w.id`)
}
func (s *Server) listAccess(w http.ResponseWriter, r *http.Request) error {
	return s.scopedList(w, r, "agenda.gestionar", `SELECT id,appointment_id AS "appointmentId",arrived_at AS at,'Ingreso' AS direction,'Cliente' AS kind FROM access_entries WHERE clinic_id=$1 ORDER BY arrived_at DESC,id`)
}
func (s *Server) checkIn(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in struct {
		AppointmentID string `json:"appointmentId"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if !domain.ValidID(in.AppointmentID) {
		return fail(400, "invalid_id", "Cita inválida")
	}
	return s.mutate(w, r, a, "agenda.gestionar", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		var pid, status string
		var start time.Time
		e := tx.QueryRow(r.Context(), "SELECT patient_id,status,starts_at FROM appointments WHERE id=$1 AND clinic_id=$2 FOR UPDATE", in.AppointmentID, a.ClinicID).Scan(&pid, &status, &start)
		if e != nil {
			return nil, e
		}
		if domain.LocalDate(start) != domain.LocalDate(domain.Now(r.Context())) || (status != "Agendada" && status != "Confirmada") {
			return nil, fail(409, "invalid_checkin", "Solo citas activas de hoy")
		}
		if _, e = patientAccess(r.Context(), tx, a, pid); e != nil {
			return nil, e
		}
		wid, aid := domain.UUID(), domain.UUID()
		if _, e = tx.Exec(r.Context(), "INSERT INTO waiting_entries(id,clinic_id,appointment_id) VALUES($1,$2,$3)", wid, a.ClinicID, in.AppointmentID); e != nil {
			return nil, e
		}
		if _, e = tx.Exec(r.Context(), "INSERT INTO access_entries(id,clinic_id,appointment_id,actor_id) VALUES($1,$2,$3,$4)", aid, a.ClinicID, in.AppointmentID, a.UserID); e != nil {
			return nil, e
		}
		return map[string]any{"waiting": map[string]string{"id": wid, "appointmentId": in.AppointmentID, "patientId": pid}, "access": map[string]string{"id": aid, "appointmentId": in.AppointmentID}}, nil
	})
}
func (s *Server) callWaiting(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	var in struct {
		RoomID string `json:"roomId"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if !domain.ValidID(in.RoomID) {
		return fail(400, "invalid_id", "Box inválido")
	}
	return s.mutate(w, r, a, "agenda.gestionar", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var pid, doctor, appointment, status string
		var called *time.Time
		var starts time.Time
		e := tx.QueryRow(r.Context(), `SELECT a.patient_id,a.doctor_id,a.id,a.status,w.called_at,a.starts_at FROM waiting_entries w JOIN appointments a ON a.id=w.appointment_id WHERE w.id=$1 AND w.clinic_id=$2 FOR UPDATE OF w,a`, id, a.ClinicID).Scan(&pid, &doctor, &appointment, &status, &called, &starts)
		if e != nil {
			return nil, e
		}
		if called != nil || (status != "Agendada" && status != "Confirmada") {
			return nil, fail(409, "already_called", "Paciente ya llamado o cita cerrada")
		}
		if domain.LocalDate(starts) != domain.LocalDate(domain.Now(r.Context())) {
			return nil, fail(409, "invalid_checkin", "Solo citas activas de hoy")
		}
		if e = activeDoctor(r.Context(), tx, a.ClinicID, doctor); e != nil {
			return nil, e
		}
		if _, e = patientAccess(r.Context(), tx, a, pid); e != nil {
			return nil, e
		}
		var roomStatus, kind string
		if e = tx.QueryRow(r.Context(), "SELECT status,kind FROM rooms WHERE id=$1 AND clinic_id=$2 FOR UPDATE", in.RoomID, a.ClinicID).Scan(&roomStatus, &kind); e != nil {
			return nil, e
		}
		if roomStatus != "disponible" || kind == "comun" {
			return nil, fail(409, "room_unavailable", "Box no disponible")
		}
		if _, e = tx.Exec(r.Context(), "UPDATE rooms SET status='ocupado',doctor_id=$2,patient_id=$3,since=now() WHERE id=$1", in.RoomID, doctor, pid); e != nil {
			return nil, e
		}
		if _, e = tx.Exec(r.Context(), "UPDATE appointments SET room_id=$2 WHERE id=$1", appointment, in.RoomID); e != nil {
			return nil, e
		}
		if _, e = tx.Exec(r.Context(), "UPDATE waiting_entries SET called_at=now() WHERE id=$1", id); e != nil {
			return nil, e
		}
		if _, e = tx.Exec(r.Context(), "INSERT INTO room_history(clinic_id,room_id,status) VALUES($1,$2,'ocupado')", a.ClinicID, in.RoomID); e != nil {
			return nil, e
		}
		room, e := roomJSON(r.Context(), tx, in.RoomID, a.ClinicID)
		return map[string]any{"room": room}, e
	})
}
func (s *Server) finishRoom(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	return s.mutate(w, r, a, "agenda.gestionar", struct{}{}, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var status string
		if e := tx.QueryRow(r.Context(), "SELECT status FROM rooms WHERE id=$1 AND clinic_id=$2 FOR UPDATE", id, a.ClinicID).Scan(&status); e != nil {
			return nil, e
		}
		if status != "ocupado" {
			return nil, fail(409, "room_not_occupied", "Box no ocupado")
		}
		var aid string
		e := tx.QueryRow(r.Context(), "UPDATE appointments SET status='Realizada' WHERE room_id=$1 AND clinic_id=$2 AND status IN ('Agendada','Confirmada') RETURNING id", id, a.ClinicID).Scan(&aid)
		if e != nil {
			return nil, e
		}
		if _, e = tx.Exec(r.Context(), "UPDATE rooms SET status='limpieza',doctor_id=NULL,patient_id=NULL,since=now() WHERE id=$1", id); e != nil {
			return nil, e
		}
		if _, e = tx.Exec(r.Context(), "INSERT INTO room_history(clinic_id,room_id,status) VALUES($1,$2,'limpieza')", a.ClinicID, id); e != nil {
			return nil, e
		}
		room, e := roomJSON(r.Context(), tx, id, a.ClinicID)
		if e != nil {
			return nil, e
		}
		ap, e := appointmentJSON(r.Context(), tx, aid, a.ClinicID)
		return map[string]any{"room": room, "appointment": ap}, e
	})
}
