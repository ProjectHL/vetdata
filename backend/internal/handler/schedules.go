package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
)

type hoursInput struct {
	Weekday     int    `json:"weekday"`
	Start       string `json:"start"`
	End         string `json:"end"`
	SlotMinutes int    `json:"slotMinutes"`
}
type holidayInput struct {
	Date string `json:"date"`
	Name string `json:"name"`
}
type scheduleInput struct {
	Hours    []hoursInput   `json:"hours"`
	Holidays []holidayInput `json:"holidays"`
}

func (s *Server) scheduleRoutes(m *http.ServeMux) {
	s.route(m, "GET /api/v1/settings/schedule", s.getSchedule)
	s.route(m, "PUT /api/v1/settings/schedule", s.putSchedule)
	s.route(m, "GET /api/v1/doctors/{id}/schedule", s.getDoctorSchedule)
	s.route(m, "PUT /api/v1/doctors/{id}/schedule", s.putDoctorSchedule)
	s.route(m, "GET /api/v1/appointments/availability", s.availability)
}

func activeDoctor(ctx context.Context, tx pgx.Tx, clinic, id string) error {
	var active bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM doctors d LEFT JOIN memberships m ON m.user_id=d.user_id AND m.clinic_id=d.clinic_id
 LEFT JOIN users u ON u.id=d.user_id WHERE d.id=$1 AND d.clinic_id=$2
 AND (d.user_id IS NULL OR (m.status='Activo' AND m.role='Veterinario' AND u.status='Activo')))`, id, clinic).Scan(&active)
	if err != nil {
		return err
	}
	if !active {
		return fail(409, "inactive_doctor", "Profesional no disponible")
	}
	return nil
}
func validateHours(hours []hoursInput, clinic bool) error {
	if len(hours) > 70 {
		return fail(400, "invalid_hours", "Demasiados intervalos")
	}
	sorted := append([]hoursInput(nil), hours...)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].Weekday == sorted[j].Weekday {
			return sorted[i].Start < sorted[j].Start
		}
		return sorted[i].Weekday < sorted[j].Weekday
	})
	for i, h := range sorted {
		st, e1 := time.Parse("15:04", h.Start)
		en, e2 := time.Parse("15:04", h.End)
		if h.Weekday < 0 || h.Weekday > 6 || e1 != nil || e2 != nil || st.Format("15:04") != h.Start || en.Format("15:04") != h.End || !st.Before(en) {
			return fail(400, "invalid_hours", "Horario inválido")
		}
		if clinic && (h.SlotMinutes < 5 || h.SlotMinutes > 240 || int(en.Sub(st).Minutes()) < h.SlotMinutes) {
			return fail(400, "invalid_slot", "Duración de cita inválida")
		}
		if !clinic && h.SlotMinutes != 0 {
			return fail(400, "invalid_slot", "La duración se configura en la clínica")
		}
		if i > 0 && sorted[i-1].Weekday == h.Weekday && sorted[i-1].End > h.Start {
			return fail(400, "overlapping_hours", "Los horarios no pueden superponerse")
		}
	}
	return nil
}
func scheduleJSON(ctx context.Context, tx pgx.Tx, clinic string) (json.RawMessage, error) {
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT jsonb_build_object('timezone','America/Santiago','hours',
 (SELECT coalesce(jsonb_agg(jsonb_build_object('weekday',weekday,'start',to_char(starts_at,'HH24:MI'),'end',to_char(ends_at,'HH24:MI'),'slotMinutes',slot_minutes) ORDER BY weekday,starts_at),'[]') FROM clinic_hours WHERE clinic_id=$1),
 'holidays',(SELECT coalesce(jsonb_agg(jsonb_build_object('date',day::text,'name',name) ORDER BY day),'[]') FROM clinic_holidays WHERE clinic_id=$1))`, clinic).Scan(&raw)
	return raw, err
}
func doctorScheduleJSON(ctx context.Context, tx pgx.Tx, clinic, id string) (json.RawMessage, error) {
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT jsonb_build_object('doctorId',d.id,'inheritsClinicHours',NOT EXISTS(SELECT 1 FROM doctor_hours WHERE doctor_id=d.id),
 'hours',(SELECT coalesce(jsonb_agg(jsonb_build_object('weekday',weekday,'start',to_char(starts_at,'HH24:MI'),'end',to_char(ends_at,'HH24:MI')) ORDER BY weekday,starts_at),'[]') FROM doctor_hours WHERE doctor_id=d.id)) FROM doctors d WHERE d.id=$1 AND d.clinic_id=$2`, id, clinic).Scan(&raw)
	return raw, err
}
func (s *Server) getSchedule(w http.ResponseWriter, r *http.Request) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	if e = s.permitted(r.Context(), a, "agenda.gestionar"); e != nil {
		return e
	}
	tx, e := s.pool.Begin(r.Context())
	if e != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	raw, e := scheduleJSON(r.Context(), tx, a.ClinicID)
	if e != nil {
		return e
	}
	writeJSON(w, 200, raw)
	return nil
}
func (s *Server) putSchedule(w http.ResponseWriter, r *http.Request) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	var in scheduleInput
	if e = decode(w, r, &in); e != nil {
		return e
	}
	if in.Hours == nil || in.Holidays == nil {
		return fail(400, "schedule_required", "hours y holidays son obligatorios; usa [] para vaciar")
	}
	if e = validateHours(in.Hours, true); e != nil {
		return e
	}
	if len(in.Holidays) > 366 {
		return fail(400, "invalid_holidays", "Demasiados feriados")
	}
	seen := map[string]bool{}
	for _, h := range in.Holidays {
		if _, e = domain.CivilDate(h.Date); e != nil || strings.TrimSpace(h.Name) == "" || len(h.Name) > 120 || seen[h.Date] {
			return fail(400, "invalid_holiday", "Feriado inválido o duplicado")
		}
		seen[h.Date] = true
	}
	return s.mutate(w, r, a, "usuarios.administrar", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		if _, e := tx.Exec(r.Context(), "DELETE FROM clinic_hours WHERE clinic_id=$1", a.ClinicID); e != nil {
			return nil, e
		}
		if _, e := tx.Exec(r.Context(), "DELETE FROM clinic_holidays WHERE clinic_id=$1", a.ClinicID); e != nil {
			return nil, e
		}
		for _, h := range in.Hours {
			if _, e := tx.Exec(r.Context(), "INSERT INTO clinic_hours(clinic_id,weekday,starts_at,ends_at,slot_minutes) VALUES($1,$2,$3::time,$4::time,$5)", a.ClinicID, h.Weekday, h.Start, h.End, h.SlotMinutes); e != nil {
				return nil, e
			}
		}
		for _, h := range in.Holidays {
			if _, e := tx.Exec(r.Context(), "INSERT INTO clinic_holidays(clinic_id,day,name) VALUES($1,$2::date,$3)", a.ClinicID, h.Date, h.Name); e != nil {
				return nil, e
			}
		}
		if e := audit(r.Context(), tx, a, "schedule.changed", a.ClinicID, in); e != nil {
			return nil, e
		}
		return scheduleJSON(r.Context(), tx, a.ClinicID)
	})
}
func (s *Server) getDoctorSchedule(w http.ResponseWriter, r *http.Request) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	id, e := pathID(r)
	if e != nil {
		return e
	}
	if e = s.permitted(r.Context(), a, "agenda.gestionar"); e != nil {
		return e
	}
	tx, e := s.pool.Begin(r.Context())
	if e != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	raw, e := doctorScheduleJSON(r.Context(), tx, a.ClinicID, id)
	if e != nil {
		return e
	}
	writeJSON(w, 200, raw)
	return nil
}
func (s *Server) putDoctorSchedule(w http.ResponseWriter, r *http.Request) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	id, e := pathID(r)
	if e != nil {
		return e
	}
	var in struct {
		Hours []hoursInput `json:"hours"`
	}
	if e = decode(w, r, &in); e != nil {
		return e
	}
	if in.Hours == nil {
		return fail(400, "schedule_required", "hours es obligatorio; [] hereda el horario de clínica")
	}
	if e = validateHours(in.Hours, false); e != nil {
		return e
	}
	return s.mutate(w, r, a, "usuarios.administrar", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		if _, e := doctorScheduleJSON(r.Context(), tx, a.ClinicID, id); e != nil {
			return nil, e
		}
		if _, e := tx.Exec(r.Context(), "DELETE FROM doctor_hours WHERE doctor_id=$1", id); e != nil {
			return nil, e
		}
		for _, h := range in.Hours {
			if _, e := tx.Exec(r.Context(), "INSERT INTO doctor_hours(doctor_id,weekday,starts_at,ends_at) VALUES($1,$2,$3::time,$4::time)", id, h.Weekday, h.Start, h.End); e != nil {
				return nil, e
			}
		}
		if e := audit(r.Context(), tx, a, "doctor.schedule.changed", id, in); e != nil {
			return nil, e
		}
		return doctorScheduleJSON(r.Context(), tx, a.ClinicID, id)
	})
}
func (s *Server) availability(w http.ResponseWriter, r *http.Request) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	if e = s.permitted(r.Context(), a, "agenda.gestionar"); e != nil {
		return e
	}
	date, doctor := r.URL.Query().Get("date"), r.URL.Query().Get("doctorId")
	day, e := domain.CivilDate(date)
	if e != nil || !domain.ValidID(doctor) {
		return fail(400, "invalid_availability", "date y doctorId son obligatorios")
	}
	tx, e := s.pool.BeginTx(r.Context(), pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if e != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	if e = activeDoctor(r.Context(), tx, a.ClinicID, doctor); e != nil {
		return e
	}
	rows, e := tx.Query(r.Context(), `SELECT to_char(h.starts_at,'HH24:MI'),to_char(h.ends_at,'HH24:MI'),h.slot_minutes FROM clinic_hours h
 WHERE clinic_id=$1 AND weekday=$2 AND NOT EXISTS(SELECT 1 FROM clinic_holidays WHERE clinic_id=$1 AND day=$3::date) ORDER BY starts_at`, a.ClinicID, int(day.Weekday()), date)
	if e != nil {
		return e
	}
	var hours []hoursInput
	for rows.Next() {
		var h hoursInput
		if e = rows.Scan(&h.Start, &h.End, &h.SlotMinutes); e != nil {
			rows.Close()
			return e
		}
		hours = append(hours, h)
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return e
	}
	slots := []map[string]string{}
	for _, h := range hours {
		// Walk civil clock values and round-trip them to reject nonexistent DST times.
		start, _ := time.Parse("15:04", h.Start)
		end, _ := time.Parse("15:04", h.End)
		step := time.Duration(h.SlotMinutes) * time.Minute
		for clock := start; !clock.Add(step).After(end); clock = clock.Add(step) {
			civil := date + " " + clock.Format("15:04")
			at, e := time.ParseInLocation("2006-01-02 15:04", civil, domain.Santiago)
			if e != nil || at.Format("2006-01-02 15:04") != civil || !at.After(domain.Now(r.Context())) {
				continue
			}
			until := at.Add(step)
			if until.In(domain.Santiago).Format("2006-01-02 15:04") != date+" "+clock.Add(step).Format("15:04") {
				continue
			}
			var available bool
			e = tx.QueryRow(r.Context(), `SELECT NOT EXISTS(SELECT 1 FROM appointments WHERE doctor_id=$1 AND status IN ('Agendada','Confirmada') AND tstzrange(starts_at,ends_at,'[)') && tstzrange($2,$3,'[)'))
   AND (NOT EXISTS(SELECT 1 FROM doctor_hours WHERE doctor_id=$1) OR EXISTS(SELECT 1 FROM doctor_hours WHERE doctor_id=$1 AND weekday=$4 AND starts_at<=$5::time AND ends_at>=$6::time))`, doctor, at, until, int(day.Weekday()), clock.Format("15:04"), clock.Add(step).Format("15:04")).Scan(&available)
			if e != nil {
				return e
			}
			if available {
				slots = append(slots, map[string]string{"startsAt": at.Format(time.RFC3339), "endsAt": until.Format(time.RFC3339)})
			}
		}
	}
	writeJSON(w, 200, map[string]any{"date": date, "doctorId": doctor, "timezone": "America/Santiago", "slots": slots})
	return nil
}
