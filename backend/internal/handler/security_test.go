package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
)

func createSecurityEvent(t *testing.T, f *fixture, cookies []*http.Cookie, body map[string]any) (int, map[string]any) {
	t.Helper()
	w := f.request("POST", "/api/v1/security/events", body, cookies...)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func securityEventBody() map[string]any {
	return map[string]any{"zone": "tienda", "type": "Puerta abierta", "severity": "Media", "note": "Puerta lateral abierta al cerrar"}
}

func TestSecurityEventsLifecycleAndClosure(t *testing.T) {
	f, own, other, _, _ := setupSharing(t)
	ctx := context.Background()

	// Create with seguridad.ver (own is Admin; also grant ver-only path below).
	code, out := createSecurityEvent(t, f, own, securityEventBody())
	if code != 201 {
		t.Fatal(code, out)
	}
	id := out["id"].(string)
	if out["status"] != "Nuevo" {
		t.Fatal("new event", out)
	}

	// Cross-tenant: invisible.
	if w := f.request("GET", "/api/v1/security/events/"+id, nil, other...); w.Code != 404 {
		t.Fatal("cross-tenant event", w.Code, w.Body.String())
	}

	// Assign moves Nuevo -> En revisión with seguridad.ver.
	w := f.request("PATCH", "/api/v1/security/events/"+id, map[string]any{"assignee": "self"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var updated map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &updated)
	if updated["status"] != "En revisión" {
		t.Fatal("assign review", updated)
	}

	// Note on the open event.
	w = f.request("POST", "/api/v1/security/events/"+id+"/notes", map[string]any{"text": "Se revisó la puerta, todo en orden"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}

	// Close requires seguridad.administrar: Recepción (ver only) gets 403.
	recep := f.loginAs(t, "Recepción")
	w = f.request("PATCH", "/api/v1/security/events/"+id, map[string]any{"status": "Resuelto"}, recep...)
	if w.Code != 403 {
		t.Fatal("close without administrar", w.Code, w.Body.String())
	}

	// Close with Admin: resolvedAt set, immutable afterwards.
	w = f.request("PATCH", "/api/v1/security/events/"+id, map[string]any{"status": "Resuelto"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	_ = json.Unmarshal(w.Body.Bytes(), &updated)
	if updated["status"] != "Resuelto" || updated["resolvedAt"] == nil {
		t.Fatal("close", updated)
	}

	// Reopen rejected 409; note on closed rejected 409.
	w = f.request("PATCH", "/api/v1/security/events/"+id, map[string]any{"status": "En revisión"}, own...)
	if w.Code != 409 {
		t.Fatal("reopen", w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/security/events/"+id+"/notes", map[string]any{"text": "tardía"}, own...)
	if w.Code != 409 {
		t.Fatal("note on closed", w.Code, w.Body.String())
	}

	// Linked follow-up event references the closed one.
	code, follow := createSecurityEvent(t, f, own, map[string]any{"zone": "tienda", "type": "Puerta abierta", "severity": "Baja", "linkedEventId": id})
	if code != 201 {
		t.Fatal(code, follow)
	}
	if follow["linkedEventId"] != id {
		t.Fatal("linked", follow)
	}

	// Falsa alarma path on a fresh event.
	_, second := createSecurityEvent(t, f, own, securityEventBody())
	sid := second["id"].(string)
	w = f.request("PATCH", "/api/v1/security/events/"+sid, map[string]any{"status": "Falsa alarma"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}

	// Server audit: no client POST needed; actions recorded.
	var audit int
	if e := f.pool.QueryRow(ctx, "SELECT count(*) FROM audit_events WHERE clinic_id=$1 AND action LIKE 'security.%'", f.clinic).Scan(&audit); e != nil || audit < 4 {
		t.Fatal("server audit", audit, e)
	}

	// Filters: open vs closed.
	w = f.request("GET", "/api/v1/security/events?status=Nuevo", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var open []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &open)
	if len(open) != 1 || open[0]["id"] != follow["id"] {
		t.Fatal("open filter", w.Body.String())
	}
}

func TestSecuritySettingsAndValidation(t *testing.T) {
	f, own, _, _, _ := setupSharing(t)

	// Defaults exist on first read.
	w := f.request("GET", "/api/v1/security/settings", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var settings map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &settings)
	if settings["retentionDays"] != float64(30) || settings["privacyInBoxes"] != true {
		t.Fatal("defaults", settings)
	}

	// Recepción cannot update (403); Admin can, except alarmArmed.
	recep := f.loginAs(t, "Recepción")
	w = f.request("PATCH", "/api/v1/security/settings", map[string]any{"retentionDays": 60}, recep...)
	if w.Code != 403 {
		t.Fatal("settings guard", w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/security/settings", map[string]any{"alarmArmed": true}, own...)
	if w.Code != 400 {
		t.Fatal("alarm via patch", w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/security/settings", map[string]any{"retentionDays": 45}, own...)
	if w.Code != 400 {
		t.Fatal("retention values", w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/security/settings", map[string]any{"retentionDays": 60, "privacyInBoxes": false}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}

	// Event validations.
	for _, body := range []map[string]any{
		{"zone": "parking", "type": "Puerta abierta", "severity": "Media"},
		{"zone": "tienda", "type": "Ovni", "severity": "Media"},
		{"zone": "tienda", "type": "Puerta abierta", "severity": "Grave"},
	} {
		if code, _ := createSecurityEvent(t, f, own, body); code != 400 {
			t.Fatal("event validation", code, body)
		}
	}
	if w := f.request("POST", "/api/v1/security/events/"+f.user+"/notes", map[string]any{"text": ""}, own...); w.Code != 400 && w.Code != 404 {
		t.Fatal("empty note", w.Code, w.Body.String())
	}
}
