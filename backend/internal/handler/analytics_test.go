package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/vetdata/api/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

var analyticsRUTSeq int64

// seedAnalyticsPatient creates one owner+patient pair and returns the
// patient id, so a test can attach several records to the same patient.
func seedAnalyticsPatient(t *testing.T, f *fixture, clinicID, sector string) string {
	t.Helper()
	ctx := context.Background()
	n := atomic.AddInt64(&analyticsRUTSeq, 1)
	oid, pid := domain.UUID(), domain.UUID()
	rut := fmt.Sprintf("199%05d-%d", n%100000, n%10)
	if _, err := f.pool.Exec(ctx, `INSERT INTO owners(id,rut,first_name,last_name,email,phone,address,sector,region,birth_date,registered_at,preferred_contact)
	 VALUES($1,$2,'Secret','Owner','owner-secret@example.test','+56912345678','Calle 1',$3,'RM','1990-01-01',current_date,'Email')`, oid, rut, sector); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, `INSERT INTO patients(id,owner_id,origin_clinic_id,name,species,breed,sex,birth_date,color,sterilized,weight_kg,chip,allergies,conditions)
	 VALUES($1,$2,$3,'Firulais Secreto','Perro','','Macho','2020-01-01','',false,10,'', '{}','{}')`, pid, oid, clinicID); err != nil {
		t.Fatal(err)
	}
	return pid
}

func seedAnalyticsRecord(t *testing.T, f *fixture, pid, clinicID, diagnosis string, createdAt time.Time) {
	t.Helper()
	payload, _ := json.Marshal(map[string]string{"diagnosis": diagnosis})
	if _, err := f.pool.Exec(context.Background(), `INSERT INTO clinical_records(patient_id,clinic_id,actor_id,kind,payload,created_at)
	 VALUES($1,$2,$3,'consultation',$4,$5)`, pid, clinicID, f.user, payload, createdAt); err != nil {
		t.Fatal(err)
	}
}

// seedAnalyticsConsultation inserts one consultation record with its own
// distinct owner+patient, so each call adds one distinct patient.
func seedAnalyticsConsultation(t *testing.T, f *fixture, clinicID, sector, diagnosis string, createdAt time.Time) {
	t.Helper()
	pid := seedAnalyticsPatient(t, f, clinicID, sector)
	seedAnalyticsRecord(t, f, pid, clinicID, diagnosis, createdAt)
}

// seedAnalyticsVaccine registra una vacuna (kind=vaccine) para el paciente.
// nextDose vacío = vigente sin refuerzo programado.
func seedAnalyticsVaccine(t *testing.T, f *fixture, pid, clinicID, name, nextDose string) {
	t.Helper()
	payload := map[string]string{"name": name, "date": "2026-01-01"}
	if nextDose != "" {
		payload["nextDose"] = nextDose
	}
	raw, _ := json.Marshal(payload)
	if _, err := f.pool.Exec(context.Background(), `INSERT INTO clinical_records(patient_id,clinic_id,actor_id,kind,payload)
	 VALUES($1,$2,$3,'vaccine',$4)`, pid, clinicID, f.user, raw); err != nil {
		t.Fatal(err)
	}
}

// grantFinanciero otorga reportes.financiero al Admin de la clínica propia.
func grantFinanciero(t *testing.T, f *fixture) {
	t.Helper()
	if _, err := f.pool.Exec(context.Background(), "INSERT INTO role_permissions(clinic_id,role,permission) VALUES($1,'Admin','reportes.financiero') ON CONFLICT DO NOTHING", f.clinic); err != nil {
		t.Fatal(err)
	}
}

func analyticsCut(t *testing.T, f *fixture, path string, cookies []*http.Cookie) []map[string]any {
	t.Helper()
	w := f.request("GET", path, nil, cookies...)
	if w.Code != 200 {
		t.Fatal(path, w.Code, w.Body.String())
	}
	var out []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(path, err)
	}
	return out
}

func analyticsByKey(out []map[string]any, key string) map[string]map[string]any {
	m := map[string]map[string]any{}
	for _, row := range out {
		m[row[key].(string)] = row
	}
	return m
}

func TestAnalyticsVaccineCoverage(t *testing.T) {
	f := newFixture(t)
	own := f.login(t)
	future := time.Now().AddDate(1, 0, 0).Format("2006-01-02")
	past := time.Now().AddDate(-1, 0, 0).Format("2006-01-02")
	// Mi clínica: un Perro al día, un Perro vencido, un Gato vigente sin nextDose.
	p1 := seedAnalyticsPatient(t, f, f.clinic, "Norte")
	seedAnalyticsVaccine(t, f, p1, f.clinic, "Antirrábica", future)
	p2 := seedAnalyticsPatient(t, f, f.clinic, "Norte")
	seedAnalyticsVaccine(t, f, p2, f.clinic, "Antirrábica", past)
	p3 := seedAnalyticsPatient(t, f, f.clinic, "Norte")
	if _, err := f.pool.Exec(context.Background(), "UPDATE patients SET species='Gato' WHERE id=$1", p3); err != nil {
		t.Fatal(err)
	}
	seedAnalyticsVaccine(t, f, p3, f.clinic, "Leucemia", "")

	out := analyticsCut(t, f, "/api/v1/analytics/vaccine-coverage", own)
	m := analyticsByKey(out, "species")
	if m["Perro"]["clinica"] != 50.0 {
		t.Fatal("Perro clinica debe ser 50", out)
	}
	if m["Gato"]["clinica"] != 100.0 {
		t.Fatal("Gato sin nextDose es vigente", out)
	}
	if m["Perro"]["red"] != nil || m["Gato"]["red"] != nil {
		t.Fatal("red con <5 pacientes debe suprimirse", out)
	}
	// 5 pacientes vigentes de otra clínica adherida → red publicada (7 distintos).
	for i := 0; i < 5; i++ {
		pid := seedAnalyticsPatient(t, f, f.other, "Norte")
		seedAnalyticsVaccine(t, f, pid, f.other, "Antirrábica", future)
	}
	out = analyticsCut(t, f, "/api/v1/analytics/vaccine-coverage", own)
	m = analyticsByKey(out, "species")
	red, ok := m["Perro"]["red"].(float64)
	if !ok || red < 85.7 || red > 85.72 {
		t.Fatal("red Perro debe ser 6/7*100", out)
	}
	if m["Gato"]["red"] != nil {
		t.Fatal("Gato en red sigue bajo k=5", out)
	}
	if w := f.request("GET", "/api/v1/analytics/vaccine-coverage", nil); w.Code != 401 {
		t.Fatal("coverage requiere sesión", w.Code)
	}
}

func TestAnalyticsCoverageByVaccine(t *testing.T) {
	f := newFixture(t)
	own := f.login(t)
	future := time.Now().AddDate(1, 0, 0).Format("2006-01-02")
	past := time.Now().AddDate(-1, 0, 0).Format("2006-01-02")
	p1 := seedAnalyticsPatient(t, f, f.clinic, "Norte")
	seedAnalyticsVaccine(t, f, p1, f.clinic, "Antirrábica", future)
	seedAnalyticsVaccine(t, f, p1, f.clinic, "Leucemia", future)
	p2 := seedAnalyticsPatient(t, f, f.clinic, "Norte")
	seedAnalyticsVaccine(t, f, p2, f.clinic, "Antirrábica", past)

	out := analyticsCut(t, f, "/api/v1/analytics/coverage-by-vaccine", own)
	m := analyticsByKey(out, "vaccine")
	if m["Antirrábica"]["clinica"] != 50.0 {
		t.Fatal("Antirrábica clinica debe ser 50", out)
	}
	if m["Leucemia"]["clinica"] != 100.0 {
		t.Fatal("Leucemia clinica debe ser 100", out)
	}
	if m["Antirrábica"]["red"] != nil {
		t.Fatal("red bajo k=5 debe suprimirse", out)
	}
	for i := 0; i < 5; i++ {
		pid := seedAnalyticsPatient(t, f, f.other, "Norte")
		seedAnalyticsVaccine(t, f, pid, f.other, "Antirrábica", future)
	}
	out = analyticsCut(t, f, "/api/v1/analytics/coverage-by-vaccine", own)
	m = analyticsByKey(out, "vaccine")
	red, ok := m["Antirrábica"]["red"].(float64)
	if !ok || red < 85.7 || red > 85.72 {
		t.Fatal("red Antirrábica debe ser 6/7*100", out)
	}
	if m["Leucemia"]["red"] != nil {
		t.Fatal("Leucemia en red sigue bajo k=5", out)
	}
}

func TestAnalyticsRevenueGuards(t *testing.T) {
	f := newFixture(t)
	grantFinanciero(t, f)
	own := f.login(t)
	recep := f.loginAs(t, "Recepción")
	for _, path := range []string{
		"/api/v1/analytics/monthly-revenue",
		"/api/v1/analytics/revenue-by-line",
		"/api/v1/analytics/box-occupancy",
	} {
		if w := f.request("GET", path, nil, recep...); w.Code != 403 {
			t.Fatal(path, "recepción sin reportes.financiero debe ser 403", w.Code)
		}
		if w := f.request("GET", path, nil); w.Code != 401 {
			t.Fatal(path, "requiere sesión", w.Code)
		}
	}
	// Ingresos del mes: factura (servicio 5000 + medicamento 3000) + boleta 2000.
	ctx := context.Background()
	pid := seedAnalyticsPatient(t, f, f.clinic, "Norte")
	var oid string
	if err := f.pool.QueryRow(ctx, "SELECT owner_id FROM patients WHERE id=$1", pid).Scan(&oid); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, "INSERT INTO clinic_owners(clinic_id,owner_id) VALUES($1,$2)", f.clinic, oid); err != nil {
		t.Fatal(err)
	}
	invMoney, err := domain.MoneyFromNet(8000)
	if err != nil {
		t.Fatal(err)
	}
	items := `[{"kind":"service","name":"Consulta","qty":1,"priceNet":5000,"discount":0,"lineNet":5000},{"kind":"medication","name":"Amoxicilina","qty":1,"priceNet":3000,"discount":0,"lineNet":3000}]`
	if _, err := f.pool.Exec(ctx, `INSERT INTO invoices(id,clinic_id,owner_id,patient_id,number,net,vat,total,items,actor_id)
	 VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9)`, domain.UUID(), f.clinic, oid, pid, invMoney.Net, invMoney.VAT, invMoney.Total, items, f.user); err != nil {
		t.Fatal(err)
	}
	retMoney, err := domain.MoneyFromNet(2000)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, `INSERT INTO retail_sales(id,clinic_id,number,owner_id,payment,delivery_fee_net,net,vat,total,actor_id)
	 VALUES($1,$2,1,$3,'Efectivo',0,$4,$5,$6,$7)`, domain.UUID(), f.clinic, oid, retMoney.Net, retMoney.VAT, retMoney.Total, f.user); err != nil {
		t.Fatal(err)
	}
	// Mes anterior: factura de servicios 7000. Otra clínica no suma.
	prevFirst := time.Date(time.Now().Year(), time.Now().Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -1, 0)
	prevAt := prevFirst.AddDate(0, 0, 15).Add(12 * time.Hour)
	prevMoney, err := domain.MoneyFromNet(7000)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, `INSERT INTO invoices(id,clinic_id,owner_id,patient_id,number,net,vat,total,items,actor_id,created_at)
	 VALUES($1,$2,$3,$4,2,$5,$6,$7,'[{"kind":"service","name":"Control","qty":1,"priceNet":7000,"discount":0,"lineNet":7000}]',$8,$9)`,
		domain.UUID(), f.clinic, oid, pid, prevMoney.Net, prevMoney.VAT, prevMoney.Total, f.user, prevAt); err != nil {
		t.Fatal(err)
	}
	opid := seedAnalyticsPatient(t, f, f.other, "Norte")
	var ooid string
	if err := f.pool.QueryRow(ctx, "SELECT owner_id FROM patients WHERE id=$1", opid).Scan(&ooid); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, "INSERT INTO clinic_owners(clinic_id,owner_id) VALUES($1,$2)", f.other, ooid); err != nil {
		t.Fatal(err)
	}
	bigMoney, err := domain.MoneyFromNet(999000)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, `INSERT INTO invoices(id,clinic_id,owner_id,number,net,vat,total,items,actor_id)
	 VALUES($1,$2,$3,1,$4,$5,$6,'[]',$7)`, domain.UUID(), f.other, ooid, bigMoney.Net, bigMoney.VAT, bigMoney.Total, f.user); err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	curKey := domain.LocalDate(now)[:7]
	prevKey := domain.LocalDate(prevAt)[:7]
	out := analyticsCut(t, f, "/api/v1/analytics/monthly-revenue", own)
	if len(out) != 6 {
		t.Fatal("default months=6", len(out), out)
	}
	byMonth := analyticsByKey(out, "month")
	if byMonth[curKey]["ingresos"] != 10000.0 {
		t.Fatal("mes actual = factura + boleta", out)
	}
	if byMonth[prevKey]["ingresos"] != 7000.0 {
		t.Fatal("mes anterior solo factura servicios", out)
	}
	var total float64
	for _, row := range out {
		total += row["ingresos"].(float64)
	}
	if total != 17000.0 {
		t.Fatal("otra clínica no suma", out)
	}

	lines := analyticsCut(t, f, "/api/v1/analytics/revenue-by-line", own)
	lm := analyticsByKey(lines, "month")
	if lm[curKey]["servicios"] != 5000.0 || lm[curKey]["farmacia"] != 3000.0 || lm[curKey]["tienda"] != 2000.0 {
		t.Fatal("apertura por línea del mes", lines)
	}
	if lm[prevKey]["servicios"] != 7000.0 || lm[prevKey]["farmacia"] != 0.0 || lm[prevKey]["tienda"] != 0.0 {
		t.Fatal("mes anterior solo servicios", lines)
	}
	if w := f.request("GET", "/api/v1/analytics/monthly-revenue?months=7", nil, own...); w.Code != 400 {
		t.Fatal("months=7 debe ser 400", w.Code)
	}
	if w := f.request("GET", "/api/v1/analytics/monthly-revenue?months=3", nil, own...); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	} else {
		var three []map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &three); err != nil || len(three) != 3 {
			t.Fatal("months=3", w.Body.String())
		}
	}
}

func TestAnalyticsBoxOccupancy(t *testing.T) {
	f := newFixture(t)
	grantFinanciero(t, f)
	own := f.login(t)
	ctx := context.Background()
	boxA, boxB, comun := domain.UUID(), domain.UUID(), domain.UUID()
	for _, rr := range []struct {
		id, name, kind string
	}{{boxA, "Box A", "box"}, {boxB, "Box B", "box"}, {comun, "Sala común", "comun"}} {
		if _, err := f.pool.Exec(ctx, "INSERT INTO rooms(id,clinic_id,name,kind) VALUES($1,$2,$3,$4)", rr.id, f.clinic, rr.name, rr.kind); err != nil {
			t.Fatal(err)
		}
	}
	// Box A: 3 ocupado + 1 disponible en ventana → 75.0; historial viejo no cuenta.
	for i := 0; i < 3; i++ {
		if _, err := f.pool.Exec(ctx, "INSERT INTO room_history(clinic_id,room_id,status) VALUES($1,$2,'ocupado')", f.clinic, boxA); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := f.pool.Exec(ctx, "INSERT INTO room_history(clinic_id,room_id,status) VALUES($1,$2,'disponible')", f.clinic, boxA); err != nil {
		t.Fatal(err)
	}
	old := time.Now().AddDate(0, 0, -20)
	for i := 0; i < 5; i++ {
		if _, err := f.pool.Exec(ctx, "INSERT INTO room_history(clinic_id,room_id,status,created_at) VALUES($1,$2,'ocupado',$3)", f.clinic, boxA, old); err != nil {
			t.Fatal(err)
		}
	}
	out := analyticsCut(t, f, "/api/v1/analytics/box-occupancy", own)
	m := analyticsByKey(out, "box")
	if m["Box A"]["ocupacion"] != 75.0 {
		t.Fatal("Box A debe ser 75.0", out)
	}
	if v, ok := m["Box B"]; ok && v["ocupacion"] != 0.0 {
		t.Fatal("Box B sin historia debe ser 0 o ausente", out)
	}
	if _, ok := m["Sala común"]; ok {
		t.Fatal("salas kind=comun se excluyen", out)
	}
	today := domain.LocalDate(time.Now())
	from := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	out = analyticsCut(t, f, "/api/v1/analytics/box-occupancy?from="+from+"&to="+today, own)
	if analyticsByKey(out, "box")["Box A"]["ocupacion"] != 75.0 {
		t.Fatal("ventana explícita", out)
	}
	if w := f.request("GET", "/api/v1/analytics/box-occupancy?from=no-fecha", nil, own...); w.Code != 400 {
		t.Fatal("from inválido debe ser 400", w.Code)
	}
}

func loginOtherAnalytics(t *testing.T, f *fixture) []*http.Cookie {
	t.Helper()
	ctx := context.Background()
	hash, _ := bcrypt.GenerateFromPassword([]byte("Test-password-123"), 4)
	uid := domain.UUID()
	if _, err := f.pool.Exec(ctx, "INSERT INTO users(id,name,email,password_hash,status) VALUES($1,'Other','other-analytics@example.test',$2,'Activo')", uid, string(hash)); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, "INSERT INTO memberships(user_id,clinic_id,role) VALUES($1,$2,'Admin')", uid, f.other); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, "INSERT INTO role_permissions(clinic_id,role,permission) VALUES($1,'Admin','usuarios.administrar') ON CONFLICT DO NOTHING", f.other); err != nil {
		t.Fatal(err)
	}
	w := f.request("POST", "/api/v1/auth/login", map[string]string{"email": "other-analytics@example.test", "password": "Test-password-123", "clinicId": f.other})
	if w.Code != 200 {
		t.Fatalf("login other %d %s", w.Code, w.Body.String())
	}
	return w.Result().Cookies()
}

func TestAnalyticsKAnonymityFourVsFive(t *testing.T) {
	f := newFixture(t)
	own := f.login(t)
	now := time.Now()
	recent, previous := now.Add(-time.Hour), now.Add(-40*24*time.Hour)
	// 4 distinct patients, same sector/category, records in both windows.
	for i := 0; i < 4; i++ {
		pid := seedAnalyticsPatient(t, f, f.other, "Norte")
		seedAnalyticsRecord(t, f, pid, f.other, "dermatitis alérgica", recent)
		seedAnalyticsRecord(t, f, pid, f.other, "dermatitis alérgica", previous)
	}

	w := f.request("GET", "/api/v1/analytics/diagnosis-categories", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var cats []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &cats); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, c := range cats {
		if c["category"] == "Dermatológico" {
			found = true
			if c["clinica"] != float64(0) {
				t.Fatal("own clinic should have 0 dermatologic consults", w.Body.String())
			}
			if c["redPct"] != nil {
				t.Fatal("network with 4 patients must be suppressed", w.Body.String())
			}
		}
		if c["redPct"] != nil {
			t.Fatal("no network cut reaches k=5 yet", w.Body.String())
		}
	}
	if !found {
		t.Fatal("missing Dermatológico row", w.Body.String())
	}
	w = f.request("GET", "/api/v1/analytics/network-alerts", nil, own...)
	if w.Code != 200 || strings.TrimSpace(w.Body.String()) != "[]" {
		t.Fatal("alerts must be empty below k=5", w.Code, w.Body.String())
	}

	// 5th distinct patient in both windows (2 recent consults -> alza).
	fifth := seedAnalyticsPatient(t, f, f.other, "Norte")
	seedAnalyticsRecord(t, f, fifth, f.other, "dermatitis alérgica", previous)
	seedAnalyticsRecord(t, f, fifth, f.other, "dermatitis alérgica", recent)
	seedAnalyticsRecord(t, f, fifth, f.other, "dermatitis alérgica", recent.Add(time.Minute))

	w = f.request("GET", "/api/v1/analytics/diagnosis-categories", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	cats = nil
	if err := json.Unmarshal(w.Body.Bytes(), &cats); err != nil {
		t.Fatal(err)
	}
	found = false
	for _, c := range cats {
		if c["category"] == "Dermatológico" {
			found = true
			if c["redPct"] == nil || c["redPct"].(float64) <= 0 {
				t.Fatal("network with >=5 patients must publish redPct", w.Body.String())
			}
		}
	}
	if !found {
		t.Fatal("missing Dermatológico row", w.Body.String())
	}
	w = f.request("GET", "/api/v1/analytics/network-alerts", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var alerts []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &alerts); err != nil {
		t.Fatal(err)
	}
	if len(alerts) != 1 || alerts[0]["sector"] != "Norte" || alerts[0]["category"] != "Dermatológico" {
		t.Fatal("expected one Norte/Dermatológico alert", w.Body.String())
	}

	// months only allows 3|6|12.
	w = f.request("GET", "/api/v1/analytics/diagnosis-categories?months=7", nil, own...)
	if w.Code != 400 {
		t.Fatal("months=7 must be 400", w.Code, w.Body.String())
	}
}

func TestAnalyticsOptOutExcluded(t *testing.T) {
	f := newFixture(t)
	own := f.login(t)
	other := loginOtherAnalytics(t, f)
	now := time.Now()
	for i := 0; i < 5; i++ {
		seedAnalyticsConsultation(t, f, f.other, "Sur", "tos crónica", now.Add(-time.Hour))
	}
	w := f.request("GET", "/api/v1/analytics/diagnosis-categories", nil, own...)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "redPct") {
		t.Fatal(w.Code, w.Body.String())
	}
	var cats []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &cats); err != nil {
		t.Fatal(err)
	}
	published := false
	for _, c := range cats {
		if c["category"] == "Respiratorio" && c["redPct"] != nil {
			published = true
		}
	}
	if !published {
		t.Fatal("opted-in network must publish", w.Body.String())
	}

	w = f.request("GET", "/api/v1/analytics/opt-out", nil, other...)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "false") {
		t.Fatal("default opt-out must be false", w.Code, w.Body.String())
	}
	w = f.request("PUT", "/api/v1/analytics/opt-out", map[string]bool{"optOut": true}, other...)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "true") {
		t.Fatal("opt-out PUT", w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/analytics/diagnosis-categories", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	cats = nil
	if err := json.Unmarshal(w.Body.Bytes(), &cats); err != nil {
		t.Fatal(err)
	}
	for _, c := range cats {
		if c["redPct"] != nil {
			t.Fatal("opted-out clinic must be excluded from network", w.Body.String())
		}
	}
	w = f.request("GET", "/api/v1/analytics/monthly-consults", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), `"red":`) && !strings.Contains(w.Body.String(), `"red":null`) {
		t.Fatal("monthly red must be suppressed after opt-out", w.Body.String())
	}
	// Opt back in restores publication.
	w = f.request("PUT", "/api/v1/analytics/opt-out", map[string]bool{"optOut": false}, other...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("GET", "/api/v1/analytics/diagnosis-categories", nil, own...)
	if w.Code != 200 || strings.Contains(w.Body.String(), `"redPct":null`) {
		t.Fatal("opt-in must restore publication", w.Code, w.Body.String())
	}

	// Role without usuarios.administrar cannot change opt-out.
	recep := f.loginAs(t, "Recepción")
	w = f.request("PUT", "/api/v1/analytics/opt-out", map[string]bool{"optOut": true}, recep...)
	if w.Code != 403 {
		t.Fatal("opt-out without permission must be 403", w.Code, w.Body.String())
	}
	// Unauthenticated reads fail.
	w = f.request("GET", "/api/v1/analytics/diagnosis-categories", nil)
	if w.Code != 401 {
		t.Fatal("analytics requires session", w.Code, w.Body.String())
	}
}

func TestAnalyticsNoIdentifiableData(t *testing.T) {
	f := newFixture(t)
	own := f.login(t)
	grantFinanciero(t, f)
	now := time.Now()
	for i := 0; i < 5; i++ {
		seedAnalyticsConsultation(t, f, f.other, "Norte", "dermatitis alérgica", now.Add(-time.Hour))
		seedAnalyticsConsultation(t, f, f.other, "Norte", "dermatitis alérgica", now.Add(-40*24*time.Hour))
	}
	// A vaccine record must not leak into consultation KPIs.
	ctx := context.Background()
	var pid string
	if err := f.pool.QueryRow(ctx, "SELECT id FROM patients LIMIT 1").Scan(&pid); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, "INSERT INTO clinical_records(patient_id,clinic_id,actor_id,kind,payload) VALUES($1,$2,$3,'vaccine',$4)", pid, f.other, f.user, []byte(`{"name":"Antirrábica","date":"2026-01-01"}`)); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{
		"/api/v1/analytics/diagnosis-categories",
		"/api/v1/analytics/network-alerts",
		"/api/v1/analytics/monthly-consults",
		"/api/v1/analytics/opt-out",
		"/api/v1/analytics/vaccine-coverage",
		"/api/v1/analytics/coverage-by-vaccine",
		"/api/v1/analytics/monthly-revenue",
		"/api/v1/analytics/revenue-by-line",
		"/api/v1/analytics/box-occupancy",
	} {
		w := f.request("GET", path, nil, own...)
		if w.Code != 200 {
			t.Fatal(path, w.Code, w.Body.String())
		}
		body := strings.ToLower(w.Body.String())
		for _, banned := range []string{"owner-secret", "firulais", "+56912345678", "@", "owner", "patientid", "ficha", "rut", "email", "phone", "chip"} {
			if strings.Contains(body, banned) {
				t.Fatalf("%s leaks %q: %s", path, banned, w.Body.String())
			}
		}
	}
}

func TestAnalyticsSectorBase(t *testing.T) {
	f := newFixture(t)
	own := f.login(t)
	now := time.Now()
	recent, previous := now.Add(-time.Hour), now.Add(-40*24*time.Hour)
	for i := 0; i < 5; i++ {
		seedAnalyticsConsultation(t, f, f.other, "Norte", "dermatitis alérgica", previous)
		seedAnalyticsConsultation(t, f, f.other, "Norte", "dermatitis alérgica", recent)
		seedAnalyticsConsultation(t, f, f.other, "Sur", "tos crónica", previous)
		seedAnalyticsConsultation(t, f, f.other, "Sur", "tos crónica", recent)
	}
	// Extra recent consults so both sectors show an alza.
	seedAnalyticsConsultation(t, f, f.other, "Norte", "dermatitis alérgica", recent)
	seedAnalyticsConsultation(t, f, f.other, "Sur", "tos crónica", recent)
	w := f.request("GET", "/api/v1/analytics/network-alerts", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var alerts []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &alerts); err != nil {
		t.Fatal(err)
	}
	bySector := map[string]string{}
	for _, a := range alerts {
		bySector[a["sector"].(string)] = a["category"].(string)
		note, _ := a["note"].(string)
		if !strings.Contains(note, a["sector"].(string)) || !strings.Contains(note, "Revisado por VetData") {
			t.Fatal("editorial note must mention sector and VetData review", w.Body.String())
		}
		if _, ok := a["current"]; !ok {
			t.Fatal("alert needs current/previous", w.Body.String())
		}
		if _, ok := a["previous"]; !ok {
			t.Fatal("alert needs current/previous", w.Body.String())
		}
	}
	if bySector["Norte"] != "Dermatológico" || bySector["Sur"] != "Respiratorio" {
		t.Fatal("alerts must split by owner sector", w.Body.String(), bySector)
	}
}

func TestAnalyticsDailyJob(t *testing.T) {
	f := newFixture(t)
	own := f.login(t)
	now := time.Now()
	dayRecent, dayPrev := now.Add(-10*24*time.Hour), now.Add(-40*24*time.Hour)
	for i := 0; i < 5; i++ {
		seedAnalyticsConsultation(t, f, f.other, "Norte", "dermatitis alérgica", dayPrev)
		seedAnalyticsConsultation(t, f, f.other, "Norte", "dermatitis alérgica", dayRecent)
	}
	seedAnalyticsConsultation(t, f, f.other, "Norte", "dermatitis alérgica", dayRecent)
	ctx := context.Background()
	if err := recomputeAnalyticsDaily(ctx, f.pool, dayRecent); err != nil {
		t.Fatal(err)
	}
	if err := recomputeAnalyticsDaily(ctx, f.pool, dayPrev); err != nil {
		t.Fatal(err)
	}
	var consults, patients, clinics int
	if err := f.pool.QueryRow(ctx, "SELECT consultations,distinct_patients,distinct_clinics FROM analytics_daily WHERE day=$1 AND sector='Norte' AND category='Dermatológico'",
		dayRecent.Format("2006-01-02")).Scan(&consults, &patients, &clinics); err != nil {
		t.Fatal(err)
	}
	if consults != 6 || patients != 6 || clinics != 1 {
		t.Fatal("daily aggregate mismatch", consults, patients, clinics)
	}
	// Alerts read the daily aggregates first.
	w := f.request("GET", "/api/v1/analytics/network-alerts", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var alerts []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &alerts); err != nil {
		t.Fatal(err)
	}
	if len(alerts) != 1 || int(alerts[0]["current"].(float64)) != 6 || int(alerts[0]["previous"].(float64)) != 5 {
		t.Fatal("alerts must use daily aggregates", w.Body.String())
	}
	// Recompute is idempotent per day.
	if err := recomputeAnalyticsDaily(ctx, f.pool, dayRecent); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := f.pool.QueryRow(ctx, "SELECT count(*) FROM analytics_daily WHERE day=$1", dayRecent.Format("2006-01-02")).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatal("recompute must replace the day", n)
	}
}
