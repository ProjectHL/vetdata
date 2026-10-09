package handler

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"
)

var diagnosisPatterns = []struct {
	name string
	re   *regexp.Regexp
}{
	{"Dermatológico", regexp.MustCompile(`(?i)derma|alopecia|piel|pulga`)},
	{"Digestivo", regexp.MustCompile(`(?i)gastro|estasis|digest|vómit`)},
	{"Osteoarticular", regexp.MustCompile(`(?i)displasia|artrosis|cadera|cojera`)},
	{"Respiratorio", regexp.MustCompile(`(?i)respirat|braquic|tos`)},
	{"Dental", regexp.MustCompile(`(?i)dental|periodont|incisivo`)},
	{"Renal / urinario", regexp.MustCompile(`(?i)renal|urin`)},
	{"Cardiológico", regexp.MustCompile(`(?i)card|soplo`)},
	{"Endocrino", regexp.MustCompile(`(?i)tiroid`)},
}

func diagnosisCategory(diagnosis string) string {
	for _, c := range diagnosisPatterns {
		if c.re.MatchString(diagnosis) {
			return c.name
		}
	}
	return "Preventivo / sano"
}

func recordString(payload map[string]any, key string, min, max int) (string, error) {
	v, ok := payload[key].(string)
	if !ok || len(strings.TrimSpace(v)) < min || len(v) > max {
		return "", fail(400, "invalid_record", "Campo "+key+" inválido")
	}
	return v, nil
}

func recordDate(ctx context.Context, payload map[string]any, key string, allowFuture bool) (string, error) {
	v, err := recordString(payload, key, 10, 10)
	if err != nil {
		return "", err
	}
	if _, err = domain.CivilDate(v); err != nil {
		return "", fail(400, "invalid_record", "Campo "+key+" inválido")
	}
	if !allowFuture && v > domain.LocalDate(domain.Now(ctx)) {
		return "", fail(400, "future_date", "La fecha no puede ser futura")
	}
	return v, nil
}

func validateRecordPayload(ctx context.Context, kind string, payload map[string]any) (map[string]any, error) {
	if payload == nil {
		payload = map[string]any{}
	}
	out := map[string]any{}
	switch kind {
	case "consultation":
		for _, key := range []string{"date", "doctor", "reason", "diagnosis", "treatment"} {
			if _, ok := payload[key]; !ok && key == "treatment" {
				out[key] = ""
				continue
			}
			v, err := recordString(payload, key, 1, 2000)
			if err != nil {
				return nil, err
			}
			out[key] = v
		}
		if _, err := recordDate(ctx, payload, "date", false); err != nil {
			return nil, err
		}
		out["date"] = payload["date"]
		if doctor, err := recordString(payload, "doctor", 1, 200); err != nil {
			return nil, err
		} else {
			out["doctor"] = doctor
		}
		out["category"] = diagnosisCategory(out["diagnosis"].(string))
	case "vaccine":
		name, err := recordString(payload, "name", 1, 200)
		if err != nil {
			return nil, err
		}
		out["name"] = name
		date, err := recordDate(ctx, payload, "date", false)
		if err != nil {
			return nil, err
		}
		out["date"] = date
		if raw, ok := payload["nextDose"]; ok && raw != nil && raw != "" {
			next, err := recordDate(ctx, map[string]any{"nextDose": raw}, "nextDose", true)
			if err != nil {
				return nil, err
			}
			out["nextDose"] = next
		}
	case "exam":
		name, err := recordString(payload, "name", 1, 200)
		if err != nil {
			return nil, err
		}
		out["name"] = name
		date, err := recordDate(ctx, payload, "date", false)
		if err != nil {
			return nil, err
		}
		out["date"] = date
		result, err := recordString(payload, "result", 1, 2000)
		if err != nil {
			return nil, err
		}
		out["result"] = result
	case "prescription":
		date, err := recordDate(ctx, payload, "date", false)
		if err != nil {
			return nil, err
		}
		out["date"] = date
		for _, key := range []string{"drug", "dose", "duration", "doctor"} {
			v, err := recordString(payload, key, 1, 200)
			if err != nil {
				return nil, err
			}
			out[key] = v
		}
	case "correction", "annulment":
		if raw, ok := payload["note"]; ok && raw != nil && raw != "" {
			note, err := recordString(payload, "note", 1, 2000)
			if err != nil {
				return nil, err
			}
			out["note"] = note
		}
	default:
		return nil, fail(400, "invalid_kind", "Tipo de registro inválido")
	}
	return out, nil
}

func (s *Server) createRecord(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	var in struct {
		Kind     string         `json:"kind"`
		Payload  map[string]any `json:"payload"`
		Corrects *string        `json:"correctsId"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	switch in.Kind {
	case "consultation", "vaccine", "exam", "prescription", "correction", "annulment":
	default:
		return fail(400, "invalid_kind", "Tipo de registro inválido")
	}
	return s.mutate(w, r, a, "ficha.editar", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		v, err := patientAccess(r.Context(), tx, a, id)
		if err != nil {
			return nil, err
		}
		if v.Level != "propio" && !(v.Level == "compartido" && v.Scope == "Ficha completa") {
			return nil, fail(403, "forbidden_write", "El alcance no permite registrar en esta ficha")
		}
		payload, err := validateRecordPayload(r.Context(), in.Kind, in.Payload)
		if err != nil {
			return nil, err
		}
		var corrects *string
		if in.Kind == "correction" || in.Kind == "annulment" {
			if in.Corrects == nil || !domain.ValidID(*in.Corrects) {
				return nil, fail(400, "corrects_required", "La corrección o anulación indica el registro que corrige")
			}
			var clinic, targetKind string
			if err = tx.QueryRow(r.Context(), "SELECT clinic_id,kind FROM clinical_records WHERE id=$1 AND patient_id=$2", *in.Corrects, id).Scan(&clinic, &targetKind); err != nil {
				if err == pgx.ErrNoRows {
					return nil, fail(404, "unknown_record", "Registro a corregir inexistente")
				}
				return nil, err
			}
			if clinic != a.ClinicID {
				return nil, fail(403, "foreign_record", "Solo la clínica autora corrige o anula sus registros")
			}
			if targetKind == "correction" || targetKind == "annulment" {
				return nil, fail(409, "invalid_target", "No se corrige una corrección; crea un evento nuevo")
			}
			corrects = in.Corrects
		} else if in.Corrects != nil {
			return nil, fail(400, "unexpected_corrects", "El evento nuevo no corrige otro registro")
		}
		rid := domain.UUID()
		raw, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		if _, err = tx.Exec(r.Context(), "INSERT INTO clinical_records(id,patient_id,clinic_id,actor_id,kind,payload,corrects_id) VALUES($1,$2,$3,$4,$5,$6,$7)", rid, id, a.ClinicID, a.UserID, in.Kind, raw, corrects); err != nil {
			return nil, err
		}
		if err = audit(r.Context(), tx, a, "record.created", rid, map[string]string{"kind": in.Kind}); err != nil {
			return nil, err
		}
		var created time.Time
		if err = tx.QueryRow(r.Context(), "SELECT created_at FROM clinical_records WHERE id=$1", rid).Scan(&created); err != nil {
			return nil, err
		}
		return map[string]any{"id": rid, "patientId": id, "clinicId": a.ClinicID, "actorId": a.UserID, "kind": in.Kind, "payload": payload, "correctsId": corrects, "createdAt": created.In(domain.Santiago)}, nil
	})
}

func (s *Server) clinicalRoutes(m *http.ServeMux) {
	s.route(m, "GET /api/v1/patients", s.listPatients)
	s.route(m, "GET /api/v1/patients/{id}", s.getPatient)
	s.route(m, "POST /api/v1/patients", s.createPatient)
	s.route(m, "POST /api/v1/patients/{id}/records", s.createRecord)
	s.route(m, "GET /api/v1/owners/{rut}/patients", s.listPatients)
	s.route(m, "GET /api/v1/owners", s.listOwners)
	s.route(m, "GET /api/v1/owners/{rut}", s.getOwner)
	s.route(m, "POST /api/v1/owners", s.createOwner)
	s.route(m, "GET /api/v1/network/search", s.searchNetwork)
}

type access struct{ Origin, Owner, Grant, Scope, Level string }

func patientAccess(ctx context.Context, tx pgx.Tx, a Actor, id string) (access, error) {
	var v access
	if err := tx.QueryRow(ctx, "SELECT origin_clinic_id,owner_id FROM patients WHERE id=$1", id).Scan(&v.Origin, &v.Owner); err != nil {
		return v, err
	}
	if v.Origin == a.ClinicID {
		v.Level = "propio"
		v.Scope = "Ficha completa"
		return v, nil
	}
	err := tx.QueryRow(ctx, `SELECT id,scope FROM sharing_grants WHERE patient_id=$1 AND granted_to=$2
 AND revoked_at IS NULL AND suspended_at IS NULL AND since<=$3::date AND (until IS NULL OR until>=$3::date)
 AND NOT EXISTS(SELECT 1 FROM sharing_grants x WHERE x.patient_id=$1 AND x.granted_to=$2 AND x.suspended_at IS NOT NULL AND x.revoked_at IS NULL)
 ORDER BY consent_at DESC LIMIT 1 FOR SHARE`, id, a.ClinicID, domain.LocalDate(domain.Now(ctx))).Scan(&v.Grant, &v.Scope)
	if err != nil {
		return v, err
	}
	v.Level = "compartido"
	return v, nil
}
func (s *Server) patientJSON(ctx context.Context, tx pgx.Tx, a Actor, id string) (json.RawMessage, error) {
	v, err := patientAccess(ctx, tx, a, id)
	if err != nil {
		return nil, err
	}
	var clinical bool
	if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM role_permissions WHERE clinic_id=$1 AND role=$2 AND permission='ficha.ver')", a.ClinicID, a.Role).Scan(&clinical); err != nil {
		return nil, err
	}
	full := v.Scope == "Ficha completa" && clinical
	var raw []byte
	err = tx.QueryRow(ctx, `SELECT jsonb_build_object('id',p.id,'name',p.name,'species',p.species,'breed',p.breed,
 'sex',p.sex,'birthDate',p.birth_date,'color',p.color,'sterilized',p.sterilized,'weightKg',p.weight_kg,
 'chip',CASE WHEN $2 THEN p.chip ELSE '' END,'ownerRut',CASE WHEN $2 THEN o.rut ELSE '' END,
 'clinic',c.name,'clinicId',p.origin_clinic_id,'status',NULL,'statusPending',true,
 'accessLevel',$3::text,'scope',$4::text,'allergies',p.allergies,'conditions',p.conditions)
 FROM patients p JOIN owners o ON o.id=p.owner_id JOIN clinics c ON c.id=p.origin_clinic_id WHERE p.id=$1`, id, full, v.Level, v.Scope).Scan(&raw)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err = json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	if !full {
		for _, key := range []string{"sex", "birthDate", "color", "sterilized", "weightKg", "chip", "ownerRut"} {
			delete(out, key)
		}
	}
	out["vaccines"] = []any{}
	if full {
		out["consultations"] = []any{}
		out["exams"] = []any{}
		out["prescriptions"] = []any{}
		out["corrections"] = []any{}
	}
	rows, err := tx.Query(ctx, `SELECT r.id,r.kind,r.payload,r.clinic_id,r.actor_id,r.corrects_id,r.created_at
 FROM clinical_records r WHERE patient_id=$1 AND ($2 OR kind='vaccine') ORDER BY created_at,id`, id, full)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var rid, kind, clinic, actor string
		var corrects *string
		var at time.Time
		var data []byte
		if err = rows.Scan(&rid, &kind, &data, &clinic, &actor, &corrects, &at); err != nil {
			rows.Close()
			return nil, err
		}
		var item map[string]any
		if err = json.Unmarshal(data, &item); err != nil {
			rows.Close()
			return nil, err
		}
		item["id"] = rid
		item["clinicId"] = clinic
		item["actorId"] = actor
		item["createdAt"] = at.In(domain.Santiago)
		item["correctsId"] = corrects
		key := map[string]string{"consultation": "consultations", "vaccine": "vaccines", "exam": "exams", "prescription": "prescriptions", "correction": "corrections", "annulment": "corrections"}[kind]
		if key != "" {
			out[key] = append(out[key].([]any), item)
		}
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if v.Level == "compartido" {
		if _, err = tx.Exec(ctx, "INSERT INTO shared_read_audit(patient_id,grant_id,owner_id,origin_clinic_id,reader_clinic_id,reader_user_id,scope) VALUES($1,$2,$3,$4,$5,$6,$7)", id, v.Grant, v.Owner, v.Origin, a.ClinicID, a.UserID, v.Scope); err != nil {
			return nil, err
		}
	}
	raw, err = json.Marshal(out)
	return raw, err
}
func (s *Server) getPatient(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
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
	raw, err := s.patientJSON(r.Context(), tx, a, id)
	if err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	writeJSON(w, 200, raw)
	return nil
}
func (s *Server) listPatients(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	rut := r.PathValue("rut")
	if rut != "" {
		rut, err = domain.NormalizeRUT(rut)
		if err != nil {
			return fail(400, "invalid_rut", err.Error())
		}
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	rows, err := tx.Query(r.Context(), `SELECT p.id FROM patients p JOIN owners o ON o.id=p.owner_id WHERE ($2='' OR o.rut=$2)
 AND (p.origin_clinic_id=$1 OR EXISTS(SELECT 1 FROM sharing_grants g WHERE g.patient_id=p.id AND g.granted_to=$1 AND g.revoked_at IS NULL AND g.suspended_at IS NULL AND g.since<=$3::date AND (g.until IS NULL OR g.until>=$3::date)))
 AND ($6='' OR strpos(lower(p.name||' '||o.rut),lower($6))>0) AND ($7='' OR p.species=$7)
 ORDER BY p.id LIMIT $4 OFFSET $5`, a.ClinicID, rut, domain.LocalDate(domain.Now(r.Context())), limit, offset, r.URL.Query().Get("q"), r.URL.Query().Get("species"))
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
	result := []json.RawMessage{}
	for _, id := range ids {
		raw, e := s.patientJSON(r.Context(), tx, a, id)
		if e == pgx.ErrNoRows {
			continue
		}
		if e != nil {
			return e
		}
		result = append(result, raw)
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	writeJSON(w, 200, result)
	return nil
}

type ownerInput struct {
	RUT              string `json:"rut"`
	FirstName        string `json:"firstName"`
	LastName         string `json:"lastName"`
	Email            string `json:"email"`
	Phone            string `json:"phone"`
	Address          string `json:"address"`
	Sector           string `json:"sector"`
	Region           string `json:"region"`
	BirthDate        string `json:"birthDate"`
	PreferredContact string `json:"preferredContact"`
}

func (s *Server) createOwner(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in ownerInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	in.RUT, err = domain.NormalizeRUT(in.RUT)
	if err != nil {
		return fail(400, "invalid_rut", err.Error())
	}
	if _, err = domain.CivilDate(in.BirthDate); err != nil || in.BirthDate > domain.LocalDate(domain.Now(r.Context())) {
		return fail(400, "invalid_date", "Fecha inválida")
	}
	if strings.TrimSpace(in.FirstName) == "" || strings.TrimSpace(in.LastName) == "" {
		return fail(400, "invalid_name", "Nombre requerido")
	}
	if address, e := mail.ParseAddress(in.Email); e != nil || address.Address != in.Email {
		return fail(400, "invalid_email", "Correo inválido")
	}
	if in.PreferredContact != "WhatsApp" && in.PreferredContact != "Teléfono" && in.PreferredContact != "Email" {
		return fail(400, "invalid_contact", "Canal inválido")
	}
	return s.mutate(w, r, a, "ficha.editar", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		id := domain.UUID()
		if _, err := tx.Exec(r.Context(), `INSERT INTO owners(id,rut,first_name,last_name,email,phone,address,sector,region,birth_date,registered_at,preferred_contact)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, id, in.RUT, in.FirstName, in.LastName, in.Email, in.Phone, in.Address, in.Sector, in.Region, in.BirthDate, domain.LocalDate(domain.Now(r.Context())), in.PreferredContact); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(r.Context(), "INSERT INTO clinic_owners(clinic_id,owner_id) VALUES($1,$2)", a.ClinicID, id); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "owner.created", id, map[string]string{}); err != nil {
			return nil, err
		}
		var raw []byte
		err := tx.QueryRow(r.Context(), "SELECT to_jsonb(v) FROM ("+ownerProjection+" AND o.id=$2) v", a.ClinicID, id).Scan(&raw)
		return json.RawMessage(raw), err
	})
}

const ownerProjection = `SELECT o.id,o.rut,o.first_name AS "firstName",o.last_name AS "lastName",o.email,o.phone,o.alt_phone AS "altPhone",o.address,o.sector,o.region,
 o.birth_date AS "birthDate",o.registered_at AS "registeredAt",o.preferred_contact AS "preferredContact",o.emergency_contact AS "emergencyContact",
 co.balance,co.notes FROM owners o JOIN clinic_owners co ON co.owner_id=o.id WHERE co.clinic_id=$1`

func (s *Server) listOwners(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	var raw []byte
	err = s.pool.QueryRow(r.Context(), "SELECT coalesce(jsonb_agg(v),'[]') FROM ("+ownerProjection+" AND ($4='' OR strpos(lower(o.first_name||' '||o.last_name||' '||o.rut),lower($4))>0) ORDER BY o.id LIMIT $2 OFFSET $3) v", a.ClinicID, limit, offset, r.URL.Query().Get("q")).Scan(&raw)
	if err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}
func (s *Server) getOwner(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	rut, err := domain.NormalizeRUT(r.PathValue("rut"))
	if err != nil {
		return fail(400, "invalid_rut", err.Error())
	}
	var raw []byte
	err = s.pool.QueryRow(r.Context(), "SELECT to_jsonb(v) FROM ("+ownerProjection+" AND o.rut=$2) v", a.ClinicID, rut).Scan(&raw)
	if err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}

type patientInput struct {
	OwnerID    string   `json:"ownerId"`
	Name       string   `json:"name"`
	Species    string   `json:"species"`
	Breed      string   `json:"breed"`
	Sex        string   `json:"sex"`
	BirthDate  string   `json:"birthDate"`
	Color      string   `json:"color"`
	Sterilized bool     `json:"sterilized"`
	WeightKG   float64  `json:"weightKg"`
	Chip       string   `json:"chip"`
	Allergies  []string `json:"allergies"`
	Conditions []string `json:"conditions"`
}

func (s *Server) createPatient(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in patientInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if !domain.ValidID(in.OwnerID) || strings.TrimSpace(in.Name) == "" || len(in.Name) > 120 || in.WeightKG < 0 || in.WeightKG > 10000 {
		return fail(400, "invalid_patient", "Datos de paciente inválidos")
	}
	if _, err = domain.CivilDate(in.BirthDate); err != nil || in.BirthDate > domain.LocalDate(domain.Now(r.Context())) {
		return fail(400, "invalid_date", "Fecha de nacimiento inválida")
	}
	if in.Allergies == nil {
		in.Allergies = []string{}
	}
	if in.Conditions == nil {
		in.Conditions = []string{}
	}
	return s.mutate(w, r, a, "ficha.editar", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		var linked bool
		if err := tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM clinic_owners WHERE clinic_id=$1 AND owner_id=$2)", a.ClinicID, in.OwnerID).Scan(&linked); err != nil {
			return nil, err
		}
		if !linked {
			return nil, pgx.ErrNoRows
		}
		id := domain.UUID()
		if _, err := tx.Exec(r.Context(), `INSERT INTO patients(id,owner_id,origin_clinic_id,name,species,breed,sex,birth_date,color,sterilized,weight_kg,chip,allergies,conditions)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, id, in.OwnerID, a.ClinicID, in.Name, in.Species, in.Breed, in.Sex, in.BirthDate, in.Color, in.Sterilized, in.WeightKG, in.Chip, in.Allergies, in.Conditions); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "patient.created", id, map[string]string{}); err != nil {
			return nil, err
		}
		return s.patientJSON(r.Context(), tx, a, id)
	})
}
func (s *Server) searchNetwork(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	if err = s.permitted(r.Context(), a, "red.solicitar"); err != nil {
		return err
	}
	if err = s.limited(r, "network-search", a.UserID, 20, time.Minute); err != nil {
		return err
	}
	rut, err := domain.NormalizeRUT(r.URL.Query().Get("rut"))
	if err != nil {
		return fail(400, "invalid_rut", err.Error())
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	var raw []byte
	err = tx.QueryRow(r.Context(), `SELECT coalesce(jsonb_agg(v),'[]') FROM (
 SELECT p.id,p.name,p.species,p.breed,c.name AS clinic,p.origin_clinic_id AS "clinicId",
 jsonb_build_object('name',o.first_name||' '||o.last_name,'sector',o.sector) AS owner
 FROM patients p JOIN owners o ON o.id=p.owner_id JOIN clinics c ON c.id=p.origin_clinic_id WHERE o.rut=$1 ORDER BY p.id LIMIT 50) v`, rut).Scan(&raw)
	if err != nil {
		return err
	}
	if err = audit(r.Context(), tx, a, "network.searched", "", map[string]string{"queryHash": digest(rut)}); err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}
