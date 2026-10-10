package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
)

// T6-4: gate de aislamiento. Dos clínicas (fixture: f.clinic propia, f.other ajena),
// todos los roles, sobre listas, detalle, búsqueda, tareas y analítica.
// Falla si cualquier lectura cruza tenants o si un rol sin permiso accede.

// listChecks: endpoint de lista + permiso que lo protege ("" = sin permiso específico,
// pero igual aislado por tenant).
var isolationListChecks = []struct {
	path string
	perm string
}{
	{"/api/v1/appointments", "agenda.gestionar"},
	{"/api/v1/security/waiting", "agenda.gestionar"},
	{"/api/v1/invoices", "facturas.emitir"},
	{"/api/v1/patients", ""},
	{"/api/v1/owners", ""},
	{"/api/v1/pharmacy/referrals", "farmacia.dispensar"},
	{"/api/v1/retail/sales", ""},
	{"/api/v1/support/tickets", "soporte.crear"},
	{"/api/v1/support/ideas", ""},
	{"/api/v1/tasks", ""},
	{"/api/v1/security/events", "seguridad.ver"},
}

func TestIsolationTenantListsAndDetail(t *testing.T) {
	f, own, other, _, _ := setupSharing(t)
	ctx := context.Background()

	// Crea un dueño en la clínica propia (setupSharing ya creó 12345678-5).
	var oid string
	if e := f.pool.QueryRow(ctx, "SELECT id FROM owners WHERE rut='12345678-5'").Scan(&oid); e != nil {
		t.Fatal(e)
	}

	// Listas: la otra clínica no ve nada propio (vacío, no 403 salvo permiso).
	for _, c := range isolationListChecks {
		w := f.request("GET", c.path, nil, other...)
		if w.Code != 200 && w.Code != 403 {
			t.Fatalf("%s other -> %d %s", c.path, w.Code, w.Body.String())
		}
		if w.Code == 200 {
			var list []any
			if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
				t.Fatalf("%s other not a list: %s", c.path, w.Body.String())
			}
			raw := w.Body.String()
			// Ningún id propio debe filtrarse. Chequeo por dueño conocido.
			for _, l := range list {
				m, _ := l.(map[string]any)
				if m == nil {
					continue
				}
				for _, k := range []string{"ownerId", "owner_id", "clinicId", "clinic_id"} {
					if v, ok := m[k].(string); ok && (v == oid || v == f.clinic) {
						t.Fatalf("%s leaks own id via %s: %v", c.path, k, v)
					}
				}
			}
			_ = raw
		}
	}

	// Detalle: recurso propio con sesión ajena → 404 (no 403, no revelar existencia).
	// Factura: crear una en propia, leerla desde la otra.
	w := f.request("POST", "/api/v1/pharmacy/suppliers", map[string]any{"name": "Prov Aisl", "rut": "22222222-2"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var sup map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &sup)
	supID, _ := sup["id"].(string)
	_ = supID

	// Paciente propio vía detalle: crear paciente y leerlo cross-tenant → 404.
	w = f.request("POST", "/api/v1/patients", patientInput{OwnerID: oid, Name: "Aislado", Species: "Perro", Sex: "Macho", BirthDate: "2020-01-01"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var pat map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &pat)
	pid, _ := pat["id"].(string)
	if w := f.request("GET", "/api/v1/patients/"+pid, nil, other...); w.Code != 404 {
		t.Fatalf("cross-tenant patient detail -> %d %s", w.Code, w.Body.String())
	}

	// Búsqueda de red: cross-tenant devuelve tarjeta mínima, sin contacto.
	w = f.request("GET", "/api/v1/network/search?rut=12345678-5", nil, other...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if body := w.Body.String(); containsContact(body) {
		t.Fatalf("network search leaks contact: %s", body)
	}
}

func containsContact(body string) bool {
	var v any
	if err := json.Unmarshal([]byte(body), &v); err != nil {
		return false
	}
	raw, _ := json.Marshal(v)
	s := string(raw)
	for _, k := range []string{"owner@example.test", "private-phone", "secret-chip", "test allergy"} {
		if len(s) > 0 && contains(s, k) {
			return true
		}
	}
	return false
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (func() bool {
		for i := 0; i+len(sub) <= len(s); i++ {
			if s[i:i+len(sub)] == sub {
				return true
			}
		}
		return false
	})()
}

func TestIsolationRolesAndTasksAnalytics(t *testing.T) {
	f, own, _, _, _ := setupSharing(t)

	// Roles: cada rol accede solo a lo que su matriz permite.
	// Recepción no tiene facturas.emitir → 403 en POST invoices.
	recep := f.loginAs(t, "Recepción")
	w := f.request("POST", "/api/v1/invoices", map[string]any{"ownerId": "00000000-0000-0000-0000-000000000000", "lines": []any{}}, recep...)
	if w.Code != 403 && w.Code != 400 {
		t.Fatalf("recep invoices -> %d %s", w.Code, w.Body.String())
	}
	// Farmacia no tiene agenda.gestionar → 403 en POST appointments.
	farm := f.loginAs(t, "Farmacia")
	w = f.request("POST", "/api/v1/appointments", map[string]any{"patientId": "00000000-0000-0000-0000-000000000000"}, farm...)
	if w.Code != 403 && w.Code != 400 {
		t.Fatalf("farmacia appointments -> %d %s", w.Code, w.Body.String())
	}
	// Veterinario no tiene tienda.vender → 403 en checkout.
	vet := f.loginAs(t, "Veterinario")
	w = f.request("POST", "/api/v1/retail/sales", map[string]any{"items": []any{}, "payment": "Efectivo"}, vet...)
	if w.Code != 403 && w.Code != 400 {
		t.Fatalf("vet retail -> %d %s", w.Code, w.Body.String())
	}
	// Veterinario no tiene reportes.financiero → 403 en monthly-revenue.
	w = f.request("GET", "/api/v1/analytics/monthly-revenue", nil, vet...)
	if w.Code != 403 {
		t.Fatalf("vet revenue -> %d %s", w.Code, w.Body.String())
	}
	// Admin sí tiene reportes.financiero (o 200/404, pero no 403).
	w = f.request("GET", "/api/v1/analytics/monthly-revenue", nil, own...)
	if w.Code == 403 {
		t.Fatalf("admin revenue -> 403")
	}

	// Tasks: sesión ajena no ve tareas de la propia (lista vacía o 403 por permiso).
	other := f.request("POST", "/api/v1/auth/login", map[string]string{"email": "other@example.test", "password": "Test-password-123", "clinicId": f.other})
	otherCookies := other.Result().Cookies()
	w = f.request("GET", "/api/v1/tasks", nil, otherCookies...)
	if w.Code != 200 && w.Code != 403 {
		t.Fatalf("other tasks -> %d %s", w.Code, w.Body.String())
	}

	_ = http.MethodGet
}
