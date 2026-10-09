package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
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
	s.route(m, "GET /api/v1/analytics/vaccine-coverage", s.analyticsVaccineCoverage)
	s.route(m, "GET /api/v1/analytics/coverage-by-vaccine", s.analyticsCoverageByVaccine)
	s.route(m, "GET /api/v1/analytics/monthly-revenue", s.analyticsMonthlyRevenue)
	s.route(m, "GET /api/v1/analytics/revenue-by-line", s.analyticsRevenueByLine)
	s.route(m, "GET /api/v1/analytics/box-occupancy", s.analyticsBoxOccupancy)
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

// T4-4b cobertura e ingresos (D-04): denominadores exactos de cobertura
// vacunal por especie y por vacuna, ingresos mensuales y por línea de mi
// clínica (permiso reportes.financiero), y ocupación de boxes como
// aproximación por eventos de room_history.

type vaccineRec struct {
	patient  string
	species  string
	origin   string
	name     string
	nextDose *string
}

func (s *Server) analyticsVaccineRecords(ctx context.Context) ([]vaccineRec, error) {
	rows, err := s.pool.Query(ctx, `SELECT r.patient_id,p.species,p.origin_clinic_id,r.payload->>'name',r.payload->>'nextDose'
	 FROM clinical_records r JOIN patients p ON p.id=r.patient_id WHERE r.kind='vaccine' ORDER BY r.patient_id,r.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []vaccineRec{}
	for rows.Next() {
		var v vaccineRec
		if err = rows.Scan(&v.patient, &v.species, &v.origin, &v.name, &v.nextDose); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// vaccinePatient agrega los registros de vacuna de un paciente con su
// visibilidad: mine = origen propio o grant vigente a mi clínica (misma
// regla del listado de clinical.go), red = origen sin opt-out.
type vaccinePatient struct {
	species string
	mine    bool
	red     bool
	expired bool
	byName  map[string]bool
}

func (s *Server) analyticsVaccinePatients(ctx context.Context, clinic, today string) (map[string]*vaccinePatient, error) {
	recs, err := s.analyticsVaccineRecords(ctx)
	if err != nil {
		return nil, err
	}
	oos, err := analyticsOptOuts(ctx, s.pool)
	if err != nil {
		return nil, err
	}
	grants := map[string]bool{}
	rows, err := s.pool.Query(ctx, `SELECT patient_id FROM sharing_grants WHERE granted_to=$1 AND revoked_at IS NULL AND suspended_at IS NULL
	 AND since<=$2::date AND (until IS NULL OR until>=$2::date)`, clinic, today)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var pid string
		if err = rows.Scan(&pid); err != nil {
			rows.Close()
			return nil, err
		}
		grants[pid] = true
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return nil, err
	}
	out := map[string]*vaccinePatient{}
	for _, v := range recs {
		p := out[v.patient]
		if p == nil {
			p = &vaccinePatient{species: v.species, byName: map[string]bool{},
				mine: v.origin == clinic || grants[v.patient], red: !oos[v.origin]}
			out[v.patient] = p
		}
		expired := v.nextDose != nil && *v.nextDose != "" && *v.nextDose < today
		if expired {
			p.expired = true
			p.byName[v.name] = true
		} else if _, ok := p.byName[v.name]; !ok {
			p.byName[v.name] = false
		}
	}
	return out, nil
}

func analyticsPct(ok, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(ok) / float64(total) * 100
}

type vaccineCoverageOut struct {
	Species string   `json:"species"`
	Clinica float64  `json:"clinica"`
	Red     *float64 `json:"red"`
}

// analyticsVaccineCoverage: % al día por especie. Al día = tiene ≥1 vacuna
// y ninguna vencida (nextDose < hoy = vencida; null/sin nextDose = vigente).
// Denominador = pacientes con ≥1 registro kind=vaccine. Cada corte de red
// se suprime (null) con menos de analyticsK pacientes distintos.
func (s *Server) analyticsVaccineCoverage(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	today := domain.LocalDate(domain.Now(r.Context()))
	pats, err := s.analyticsVaccinePatients(r.Context(), a.ClinicID, today)
	if err != nil {
		return err
	}
	type agg struct{ total, ok int }
	mine := map[string]*agg{}
	red := map[string]*agg{}
	for _, p := range pats {
		if p.mine {
			g := mine[p.species]
			if g == nil {
				g = &agg{}
				mine[p.species] = g
			}
			g.total++
			if !p.expired {
				g.ok++
			}
		}
		if p.red {
			g := red[p.species]
			if g == nil {
				g = &agg{}
				red[p.species] = g
			}
			g.total++
			if !p.expired {
				g.ok++
			}
		}
	}
	keys := map[string]bool{}
	for k := range mine {
		keys[k] = true
	}
	for k := range red {
		keys[k] = true
	}
	sorted := make([]string, 0, len(keys))
	for k := range keys {
		sorted = append(sorted, k)
	}
	sort.Strings(sorted)
	out := []vaccineCoverageOut{}
	for _, k := range sorted {
		var redPct *float64
		if g := red[k]; g != nil && g.total >= analyticsK {
			p := analyticsPct(g.ok, g.total)
			redPct = &p
		}
		var clinica float64
		if g := mine[k]; g != nil {
			clinica = analyticsPct(g.ok, g.total)
		}
		out = append(out, vaccineCoverageOut{Species: k, Clinica: clinica, Red: redPct})
	}
	writeJSON(w, 200, out)
	return nil
}

type coverageByVaccineOut struct {
	Vaccine string   `json:"vaccine"`
	Clinica float64  `json:"clinica"`
	Red     *float64 `json:"red"`
}

// analyticsCoverageByVaccine: por nombre de vacuna (payload->>name), % con
// esa vacuna no vencida sobre los que la tienen registrada. Mismo gate k≥5.
func (s *Server) analyticsCoverageByVaccine(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	today := domain.LocalDate(domain.Now(r.Context()))
	pats, err := s.analyticsVaccinePatients(r.Context(), a.ClinicID, today)
	if err != nil {
		return err
	}
	type agg struct{ total, ok int }
	mine := map[string]*agg{}
	red := map[string]*agg{}
	for _, p := range pats {
		for name, expired := range p.byName {
			if name == "" {
				continue
			}
			if p.mine {
				g := mine[name]
				if g == nil {
					g = &agg{}
					mine[name] = g
				}
				g.total++
				if !expired {
					g.ok++
				}
			}
			if p.red {
				g := red[name]
				if g == nil {
					g = &agg{}
					red[name] = g
				}
				g.total++
				if !expired {
					g.ok++
				}
			}
		}
	}
	keys := map[string]bool{}
	for k := range mine {
		keys[k] = true
	}
	for k := range red {
		keys[k] = true
	}
	sorted := make([]string, 0, len(keys))
	for k := range keys {
		sorted = append(sorted, k)
	}
	sort.Strings(sorted)
	out := []coverageByVaccineOut{}
	for _, k := range sorted {
		var redPct *float64
		if g := red[k]; g != nil && g.total >= analyticsK {
			p := analyticsPct(g.ok, g.total)
			redPct = &p
		}
		var clinica float64
		if g := mine[k]; g != nil {
			clinica = analyticsPct(g.ok, g.total)
		}
		out = append(out, coverageByVaccineOut{Vaccine: k, Clinica: clinica, Red: redPct})
	}
	writeJSON(w, 200, out)
	return nil
}

type monthlyRevenueOut struct {
	Month    string `json:"month"`
	Ingresos int64  `json:"ingresos"`
}

// analyticsMonthlyRevenue: Σ invoices.net + Σ retail_sales.net del mes de
// MI clínica. Solo mi clínica, sin red. Requiere reportes.financiero.
func (s *Server) analyticsMonthlyRevenue(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	if err = s.permitted(r.Context(), a, "reportes.financiero"); err != nil {
		return err
	}
	months, err := analyticsMonths(r)
	if err != nil {
		return err
	}
	now := domain.Now(r.Context())
	first := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).AddDate(0, -(months - 1), 0)
	sums := map[string]int64{}
	add := func(net int64, at time.Time) {
		sums[at.In(domain.Santiago).Format("2006-01")] += net
	}
	rows, err := s.pool.Query(r.Context(), "SELECT net,created_at FROM invoices WHERE clinic_id=$1 AND created_at>=$2", a.ClinicID, first)
	if err != nil {
		return err
	}
	for rows.Next() {
		var net int64
		var at time.Time
		if err = rows.Scan(&net, &at); err != nil {
			rows.Close()
			return err
		}
		add(net, at)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	rows, err = s.pool.Query(r.Context(), "SELECT net,created_at FROM retail_sales WHERE clinic_id=$1 AND created_at>=$2", a.ClinicID, first)
	if err != nil {
		return err
	}
	for rows.Next() {
		var net int64
		var at time.Time
		if err = rows.Scan(&net, &at); err != nil {
			rows.Close()
			return err
		}
		add(net, at)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	out := []monthlyRevenueOut{}
	for i := 0; i < months; i++ {
		mk := first.AddDate(0, i, 0).Format("2006-01")
		out = append(out, monthlyRevenueOut{Month: mk, Ingresos: sums[mk]})
	}
	writeJSON(w, 200, out)
	return nil
}

type revenueByLineOut struct {
	Month     string `json:"month"`
	Servicios int64  `json:"servicios"`
	Farmacia  int64  `json:"farmacia"`
	Tienda    int64  `json:"tienda"`
}

// analyticsRevenueByLine: apertura mensual de mi clínica. servicios = Σ
// lineNet kind=service en invoices.items; farmacia = Σ lineNet
// kind=medication o kind=product; tienda = Σ retail_sales.net.
// Decisión: medication+product → farmacia porque en billing.go todo lo que
// no es service descuenta stock de farmacia (venta de mostrador), aunque
// viaje dentro de la factura; service nunca toca stock.
func (s *Server) analyticsRevenueByLine(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	if err = s.permitted(r.Context(), a, "reportes.financiero"); err != nil {
		return err
	}
	months, err := analyticsMonths(r)
	if err != nil {
		return err
	}
	now := domain.Now(r.Context())
	first := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).AddDate(0, -(months - 1), 0)
	type agg struct{ serv, farm, store int64 }
	byMonth := map[string]*agg{}
	get := func(mk string) *agg {
		g := byMonth[mk]
		if g == nil {
			g = &agg{}
			byMonth[mk] = g
		}
		return g
	}
	rows, err := s.pool.Query(r.Context(), "SELECT items,created_at FROM invoices WHERE clinic_id=$1 AND created_at>=$2", a.ClinicID, first)
	if err != nil {
		return err
	}
	for rows.Next() {
		var raw []byte
		var at time.Time
		if err = rows.Scan(&raw, &at); err != nil {
			rows.Close()
			return err
		}
		var items []struct {
			Kind    string `json:"kind"`
			LineNet int64  `json:"lineNet"`
		}
		if err = json.Unmarshal(raw, &items); err != nil {
			rows.Close()
			return err
		}
		g := get(at.In(domain.Santiago).Format("2006-01"))
		for _, it := range items {
			switch it.Kind {
			case "service":
				g.serv += it.LineNet
			case "medication", "product":
				g.farm += it.LineNet
			}
		}
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	rows, err = s.pool.Query(r.Context(), "SELECT net,created_at FROM retail_sales WHERE clinic_id=$1 AND created_at>=$2", a.ClinicID, first)
	if err != nil {
		return err
	}
	for rows.Next() {
		var net int64
		var at time.Time
		if err = rows.Scan(&net, &at); err != nil {
			rows.Close()
			return err
		}
		get(at.In(domain.Santiago).Format("2006-01")).store += net
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	out := []revenueByLineOut{}
	for i := 0; i < months; i++ {
		mk := first.AddDate(0, i, 0).Format("2006-01")
		g := byMonth[mk]
		var serv, farm, store int64
		if g != nil {
			serv, farm, store = g.serv, g.farm, g.store
		}
		out = append(out, revenueByLineOut{Month: mk, Servicios: serv, Farmacia: farm, Tienda: store})
	}
	writeJSON(w, 200, out)
	return nil
}

type boxOccupancyOut struct {
	Box       string  `json:"box"`
	Ocupacion float64 `json:"ocupacion"`
}

// analyticsBoxOccupancy: por sala kind!=comun de mi clínica, 100 *
// count(room_history ocupado) / count(total historia en ventana),
// redondeado a 1 decimal. Es una aproximación por eventos (sin minutos de
// horario real) hasta contar con tabla de horarios por clínica.
func (s *Server) analyticsBoxOccupancy(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	if err = s.permitted(r.Context(), a, "reportes.financiero"); err != nil {
		return err
	}
	today := domain.LocalDate(domain.Now(r.Context()))
	fromS := r.URL.Query().Get("from")
	toS := r.URL.Query().Get("to")
	if fromS == "" {
		d, err := domain.CivilDate(today)
		if err != nil {
			return err
		}
		fromS = d.AddDate(0, 0, -6).Format("2006-01-02")
	}
	if toS == "" {
		toS = today
	}
	from, err := domain.CivilDate(fromS)
	if err != nil {
		return fail(400, "invalid_from", "from debe ser YYYY-MM-DD")
	}
	to, err := domain.CivilDate(toS)
	if err != nil {
		return fail(400, "invalid_to", "to debe ser YYYY-MM-DD")
	}
	if from.After(to) {
		return fail(400, "invalid_range", "from no puede ser posterior a to")
	}
	type room struct{ id, name string }
	rooms := []room{}
	rows, err := s.pool.Query(r.Context(), "SELECT id,name FROM rooms WHERE clinic_id=$1 AND kind<>'comun' ORDER BY name", a.ClinicID)
	if err != nil {
		return err
	}
	for rows.Next() {
		var v room
		if err = rows.Scan(&v.id, &v.name); err != nil {
			rows.Close()
			return err
		}
		rooms = append(rooms, v)
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	type agg struct{ total, busy int }
	byRoom := map[string]*agg{}
	rows, err = s.pool.Query(r.Context(), `SELECT room_id,status FROM room_history
	 WHERE clinic_id=$1 AND created_at>=$2 AND created_at<$3`, a.ClinicID, from, to.AddDate(0, 0, 1))
	if err != nil {
		return err
	}
	for rows.Next() {
		var id, status string
		if err = rows.Scan(&id, &status); err != nil {
			rows.Close()
			return err
		}
		g := byRoom[id]
		if g == nil {
			g = &agg{}
			byRoom[id] = g
		}
		g.total++
		if status == "ocupado" {
			g.busy++
		}
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	out := []boxOccupancyOut{}
	for _, v := range rooms {
		var pct float64
		if g := byRoom[v.id]; g != nil && g.total > 0 {
			pct = math.Round(float64(g.busy)/float64(g.total)*100*10) / 10
		}
		out = append(out, boxOccupancyOut{Box: v.name, Ocupacion: pct})
	}
	writeJSON(w, 200, out)
	return nil
}
