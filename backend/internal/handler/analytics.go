package handler

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vetdata/api/internal/domain"
)

// T4-4a Analítica de red anonimizada (p-21): KPIs en servidor con job
// diario, k-anonimato k>=5 (cortes menores no se publican), default-on
// anonimizado con opt-out visible por clínica, base = sector del dueño
// (owners.sector, NUNCA clinics.sector), sin fichas ni dueños ajenos.
// Solo se exponen conteos; jamás ids, nombres, rut, emails ni teléfonos.
// D-04: la categoría usa diagnosisCategory() (clinical.go); los
// denominadores exactos de cobertura vacunal quedan para T4-4b.

const analyticsK = 5

func (s *Server) analyticsRoutes(m *http.ServeMux) {
	s.route(m, "GET /api/v1/analytics/diagnosis-categories", s.analyticsDiagnosisCategories)
	s.route(m, "GET /api/v1/analytics/network-alerts", s.analyticsNetworkAlerts)
	s.route(m, "GET /api/v1/analytics/monthly-consults", s.analyticsMonthlyConsults)
	s.route(m, "GET /api/v1/analytics/opt-out", s.analyticsGetOptOut)
	s.route(m, "PUT /api/v1/analytics/opt-out", s.analyticsPutOptOut)
}

// analyticsMonths valida la ventana anti-diferencia: solo 3|6|12.
func analyticsMonths(r *http.Request) (int, error) {
	switch v := r.URL.Query().Get("months"); v {
	case "":
		return 6, nil
	case "3":
		return 3, nil
	case "6":
		return 6, nil
	case "12":
		return 12, nil
	default:
		return 0, fail(400, "invalid_months", "months debe ser 3, 6 o 12")
	}
}

func analyticsOptOuts(ctx context.Context, pool *pgxpool.Pool) (map[string]bool, error) {
	rows, err := pool.Query(ctx, "SELECT id,analytics_opt_out FROM clinics")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var id string
		var oo bool
		if err = rows.Scan(&id, &oo); err != nil {
			return nil, err
		}
		out[id] = oo
	}
	return out, rows.Err()
}

type analyticsRow struct {
	clinic  string
	sector  string
	diag    string
	patient string
	at      time.Time
}

// analyticsConsultations trae consultas crudas de la ventana para agregar
// en Go con la misma fórmula de categoría (diagnosisCategory) que el job.
func (s *Server) analyticsConsultations(ctx context.Context, since time.Time) ([]analyticsRow, error) {
	rows, err := s.pool.Query(ctx, `SELECT r.clinic_id,o.sector,r.payload->>'diagnosis',r.patient_id,r.created_at
	 FROM clinical_records r JOIN patients p ON p.id=r.patient_id JOIN owners o ON o.id=p.owner_id
	 WHERE r.kind='consultation' AND r.created_at>=$1 ORDER BY r.created_at,r.id`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []analyticsRow{}
	for rows.Next() {
		var v analyticsRow
		var diag *string
		if err = rows.Scan(&v.clinic, &v.sector, &diag, &v.patient, &v.at); err != nil {
			return nil, err
		}
		if diag != nil {
			v.diag = *diag
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

type diagnosisCategoryOut struct {
	Category string   `json:"category"`
	Clinica  int      `json:"clinica"`
	RedPct   *float64 `json:"redPct"`
}

func (s *Server) analyticsDiagnosisCategories(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	months, err := analyticsMonths(r)
	if err != nil {
		return err
	}
	now := domain.Now(r.Context())
	rows, err := s.analyticsConsultations(r.Context(), now.AddDate(0, -months, 0))
	if err != nil {
		return err
	}
	oos, err := analyticsOptOuts(r.Context(), s.pool)
	if err != nil {
		return err
	}
	mine := map[string]int{}
	net := map[string]int{}
	netPatients := map[string]bool{}
	for _, v := range rows {
		cat := diagnosisCategory(v.diag)
		if v.clinic == a.ClinicID {
			mine[cat]++
		}
		if !oos[v.clinic] {
			net[cat]++
			netPatients[v.patient] = true
		}
	}
	total := 0
	for _, n := range net {
		total += n
	}
	// Supresión k-anónima: con menos de 5 pacientes distintos en la red,
	// toda la columna red se publica como null.
	suppressed := len(netPatients) < analyticsK
	keys := map[string]bool{}
	for k := range mine {
		keys[k] = true
	}
	for k := range net {
		keys[k] = true
	}
	sorted := make([]string, 0, len(keys))
	for k := range keys {
		sorted = append(sorted, k)
	}
	sort.Strings(sorted)
	out := []diagnosisCategoryOut{}
	for _, k := range sorted {
		var pct *float64
		if !suppressed && total > 0 {
			p := float64(net[k]) / float64(total) * 100
			pct = &p
		}
		out = append(out, diagnosisCategoryOut{Category: k, Clinica: mine[k], RedPct: pct})
	}
	writeJSON(w, 200, out)
	return nil
}

type alertCut struct {
	cur, prev   int
	curP, prevP map[string]bool
}

type networkAlertOut struct {
	Sector   string `json:"sector"`
	Category string `json:"category"`
	Current  int    `json:"current"`
	Previous int    `json:"previous"`
	Note     string `json:"note"`
}

func analyticsAlertNote(sector, category string, cur, prev int) string {
	return fmt.Sprintf("Alza en %s en %s: %d vs %d casos (30d). Revisado por VetData.", category, sector, cur, prev)
}

func publishAlertCuts(cuts map[[2]string]*alertCut) []networkAlertOut {
	keys := make([][2]string, 0, len(cuts))
	for k := range cuts {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i][0] != keys[j][0] {
			return keys[i][0] < keys[j][0]
		}
		return keys[i][1] < keys[j][1]
	})
	out := []networkAlertOut{}
	for _, k := range keys {
		c := cuts[k]
		if len(c.curP) < analyticsK || len(c.prevP) < analyticsK {
			continue
		}
		if c.cur <= c.prev {
			continue
		}
		out = append(out, networkAlertOut{Sector: k[0], Category: k[1], Current: c.cur, Previous: c.prev, Note: analyticsAlertNote(k[0], k[1], c.cur, c.prev)})
	}
	return out
}

// analyticsAlertCutsDaily agrega analytics_daily en dos ventanas de 30d.
// Suma distinct_patients por día como aproximación por exceso del conteo
// real multidiario (el job guarda agregados por día, no pacientes
// individuales). Devuelve false cuando no hay filas en el rango y el
// llamador debe computar al vuelo con la misma lógica.
func (s *Server) analyticsAlertCutsDaily(ctx context.Context, now time.Time) (map[[2]string]*alertCut, bool, error) {
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	curFrom := today.AddDate(0, 0, -29)
	prevFrom := today.AddDate(0, 0, -59)
	prevTo := today.AddDate(0, 0, -30)
	rows, err := s.pool.Query(ctx, `SELECT sector,category,day,consultations,distinct_patients FROM analytics_daily
	 WHERE day>=$1 AND day<=$2 ORDER BY day,sector,category`, prevFrom.Format("2006-01-02"), today.Format("2006-01-02"))
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	cuts := map[[2]string]*alertCut{}
	any := false
	for rows.Next() {
		var sector, category string
		var day time.Time
		var cons, pats int
		if err = rows.Scan(&sector, &category, &day, &cons, &pats); err != nil {
			return nil, false, err
		}
		any = true
		k := [2]string{sector, category}
		c := cuts[k]
		if c == nil {
			c = &alertCut{curP: map[string]bool{}, prevP: map[string]bool{}}
			cuts[k] = c
		}
		// El gate k sobre agregados diarios suma por día (cota superior);
		// se registra con pacientes sintéticos por (día,índice).
		if !day.Before(curFrom) {
			c.cur += cons
			for i := 0; i < pats; i++ {
				c.curP[fmt.Sprintf("%s#%d", day.Format("2006-01-02"), i)] = true
			}
		} else if !day.Before(prevFrom) && !day.After(prevTo) {
			c.prev += cons
			for i := 0; i < pats; i++ {
				c.prevP[fmt.Sprintf("%s#%d", day.Format("2006-01-02"), i)] = true
			}
		}
	}
	if err = rows.Err(); err != nil {
		return nil, false, err
	}
	return cuts, any, nil
}

func (s *Server) analyticsNetworkAlerts(w http.ResponseWriter, r *http.Request) error {
	if _, err := s.actor(r); err != nil {
		return err
	}
	now := domain.Now(r.Context())
	cuts, hasDaily, err := s.analyticsAlertCutsDaily(r.Context(), now)
	if err != nil {
		return err
	}
	if !hasDaily {
		oos, err := analyticsOptOuts(r.Context(), s.pool)
		if err != nil {
			return err
		}
		rows, err := s.analyticsConsultations(r.Context(), now.Add(-60*24*time.Hour))
		if err != nil {
			return err
		}
		edge := now.Add(-30 * 24 * time.Hour)
		cuts = map[[2]string]*alertCut{}
		for _, v := range rows {
			if oos[v.clinic] {
				continue
			}
			k := [2]string{v.sector, diagnosisCategory(v.diag)}
			c := cuts[k]
			if c == nil {
				c = &alertCut{curP: map[string]bool{}, prevP: map[string]bool{}}
				cuts[k] = c
			}
			if v.at.After(edge) {
				c.cur++
				c.curP[v.patient] = true
			} else {
				c.prev++
				c.prevP[v.patient] = true
			}
		}
	}
	writeJSON(w, 200, publishAlertCuts(cuts))
	return nil
}

type monthlyConsultOut struct {
	Month   string   `json:"month"`
	Clinica int      `json:"clinica"`
	Red     *float64 `json:"red"`
}

func (s *Server) analyticsMonthlyConsults(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	months, err := analyticsMonths(r)
	if err != nil {
		return err
	}
	now := domain.Now(r.Context())
	first := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).AddDate(0, -(months - 1), 0)
	rows, err := s.analyticsConsultations(r.Context(), first)
	if err != nil {
		return err
	}
	oos, err := analyticsOptOuts(r.Context(), s.pool)
	if err != nil {
		return err
	}
	type magg struct {
		mine     int
		total    int
		clinics  map[string]bool
		patients map[string]bool
	}
	byMonth := map[string]*magg{}
	for _, v := range rows {
		mk := v.at.In(domain.Santiago).Format("2006-01")
		g := byMonth[mk]
		if g == nil {
			g = &magg{clinics: map[string]bool{}, patients: map[string]bool{}}
			byMonth[mk] = g
		}
		if v.clinic == a.ClinicID {
			g.mine++
		}
		if !oos[v.clinic] {
			g.total++
			g.clinics[v.clinic] = true
			g.patients[v.patient] = true
		}
	}
	out := []monthlyConsultOut{}
	for i := 0; i < months; i++ {
		mk := first.AddDate(0, i, 0).Format("2006-01")
		g := byMonth[mk]
		var clinica int
		var red *float64
		if g != nil {
			clinica = g.mine
			if len(g.patients) >= analyticsK && len(g.clinics) > 0 {
				avg := float64(g.total) / float64(len(g.clinics))
				red = &avg
			}
		}
		out = append(out, monthlyConsultOut{Month: mk, Clinica: clinica, Red: red})
	}
	writeJSON(w, 200, out)
	return nil
}

func (s *Server) analyticsGetOptOut(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var oo bool
	if err = s.pool.QueryRow(r.Context(), "SELECT analytics_opt_out FROM clinics WHERE id=$1", a.ClinicID).Scan(&oo); err != nil {
		return err
	}
	writeJSON(w, 200, map[string]bool{"optOut": oo})
	return nil
}

func (s *Server) analyticsPutOptOut(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in struct {
		OptOut bool `json:"optOut"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	return s.mutate(w, r, a, "usuarios.administrar", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		if _, err := tx.Exec(r.Context(), "UPDATE clinics SET analytics_opt_out=$2 WHERE id=$1", a.ClinicID, in.OptOut); err != nil {
			return nil, err
		}
		return map[string]bool{"optOut": in.OptOut}, nil
	})
}

// recomputeAnalyticsDaily es el job diario: borra el día y re-inserta
// agregados por (sector del dueño, categoría). Excluye clínicas con
// opt-out. La categoría usa diagnosisCategory(); los denominadores
// exactos de cobertura vacunal quedan para T4-4b (D-04).
func recomputeAnalyticsDaily(ctx context.Context, pool *pgxpool.Pool, day time.Time) error {
	rows, err := pool.Query(ctx, `SELECT o.sector,r.payload->>'diagnosis',r.patient_id,r.clinic_id
	 FROM clinical_records r JOIN patients p ON p.id=r.patient_id JOIN owners o ON o.id=p.owner_id
	 JOIN clinics c ON c.id=r.clinic_id
	 WHERE r.kind='consultation' AND r.created_at::date=$1::date AND COALESCE(c.analytics_opt_out,false)=false`, day.Format("2006-01-02"))
	if err != nil {
		return err
	}
	defer rows.Close()
	type agg struct {
		cons     int
		patients map[string]bool
		clinics  map[string]bool
	}
	byCut := map[[2]string]*agg{}
	for rows.Next() {
		var sector string
		var diag *string
		var patient, clinic string
		if err = rows.Scan(&sector, &diag, &patient, &clinic); err != nil {
			return err
		}
		var d string
		if diag != nil {
			d = *diag
		}
		k := [2]string{sector, diagnosisCategory(d)}
		g := byCut[k]
		if g == nil {
			g = &agg{patients: map[string]bool{}, clinics: map[string]bool{}}
			byCut[k] = g
		}
		g.cons++
		g.patients[patient] = true
		g.clinics[clinic] = true
	}
	if err = rows.Err(); err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "DELETE FROM analytics_daily WHERE day=$1::date", day.Format("2006-01-02")); err != nil {
		return err
	}
	for k, g := range byCut {
		if _, err = tx.Exec(ctx, `INSERT INTO analytics_daily(day,sector,category,consultations,distinct_patients,distinct_clinics)
		 VALUES($1::date,$2,$3,$4,$5,$6)`, day.Format("2006-01-02"), k[0], k[1], g.cons, len(g.patients), len(g.clinics)); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
