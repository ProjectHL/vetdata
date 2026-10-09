package handler

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/vetdata/api/internal/domain"
)

func TestPhaseThreeExitFullVetFlow(t *testing.T) {
	f, own, _, pid, oid := setupSharing(t)
	ctx := context.Background()
	today := time.Now().In(domain.Santiago).Format("2006-01-02")

	// Agenda: doctor, cita de urgencia, check-in, box, atención y finalización.
	doctor := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO doctors(id,clinic_id,name,specialty,initials) VALUES($1,$2,'Vet','General','VT')", doctor, f.clinic); e != nil {
		t.Fatal(e)
	}
	now := time.Now().In(domain.Santiago)
	w := f.request("POST", "/api/v1/appointments", appointmentInput{PatientID: pid, DoctorID: doctor, Date: now.Format("2006-01-02"), Time: now.Format("15:04"), Reason: "Control", Emergency: true}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var ap map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &ap)
	aid := ap["id"].(string)
	w = f.request("POST", "/api/v1/security/waiting", map[string]string{"appointmentId": aid}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var arrival struct{ Waiting struct{ ID string } }
	_ = json.Unmarshal(w.Body.Bytes(), &arrival)
	w = f.request("POST", "/api/v1/rooms", map[string]string{"name": "Box Salida", "kind": "box"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var room map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &room)
	rid := room["id"].(string)
	w = f.request("POST", "/api/v1/security/waiting/"+arrival.Waiting.ID+"/call", map[string]string{"roomId": rid}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("POST", "/api/v1/rooms/"+rid+"/finish", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w = f.request("PATCH", "/api/v1/rooms/"+rid, map[string]string{"status": "disponible"}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}

	// Atiende: receta en la ficha.
	supplier := responseID(t, f.request("POST", "/api/v1/pharmacy/suppliers", map[string]any{"name": "Proveedor", "rut": "12345678-5"}, own...), 201)
	med := responseID(t, f.request("POST", "/api/v1/pharmacy/medications", itemInput{Name: "SalidaMed", SupplierID: supplier, PriceNet: 8000, UnitCost: 3000, PrescriptionRequired: true}, own...), 201)
	service := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO catalog_items(id,clinic_id,kind,name,price_net) VALUES($1,$2,'service','Consulta',$3)", service, f.clinic, 5000); e != nil {
		t.Fatal(e)
	}
	lot := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO stock_lots(id,clinic_id,item_id,location,lot,qty,unit_cost) VALUES($1,$2,$3,'pharmacy','LOTE-S',10,3000)", lot, f.clinic, med); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO inventory_movements(clinic_id,item_id,lot_id,qty,reason,actor_id) VALUES($1,$2,$3,10,'Compra',$4)", f.clinic, med, lot, f.user); e != nil {
		t.Fatal(e)
	}
	_, rx := createRecord(t, f, own, pid, "prescription", map[string]any{"date": today, "drug": "SalidaMed", "dose": "1 comp", "duration": "10 días", "doctor": "Vet"}, nil)
	rxID := rx["id"].(string)

	// Deriva y dispensa.
	w = f.request("POST", "/api/v1/pharmacy/referrals", map[string]any{"patientId": pid, "prescriptionId": rxID, "items": []map[string]any{{"itemId": med, "qty": 2}}}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var ref map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &ref)
	refID := ref["id"].(string)
	w = f.request("POST", "/api/v1/pharmacy/referrals/"+refID+"/dispense", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}

	// Factura y abono total.
	code, inv := emitInvoice(f, "", invoiceBody(oid, pid, []map[string]any{{"itemId": med, "qty": 2}, {"itemId": service, "qty": 1}}...), own)
	if code != 201 {
		t.Fatal(code, inv)
	}
	if inv.Net != 21000 {
		t.Fatal("net", inv.Net)
	}
	w = f.request("POST", "/api/v1/invoices/"+inv.ID+"/payments", map[string]any{"amount": inv.Total, "method": "Transferencia"}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}

	// Evidencia SQL de atomicidad y cadena completa.
	checks := []struct {
		name  string
		query string
		args  []any
		want  int64
	}{
		{"appointment realizada", "SELECT count(*) FROM appointments WHERE id=$1 AND status='Realizada'", []any{aid}, 1},
		{"room disponible", "SELECT count(*) FROM rooms WHERE id=$1 AND status='disponible' AND doctor_id IS NULL", []any{rid}, 1},
		{"room historial", "SELECT count(*) FROM room_history WHERE room_id=$1", []any{rid}, 3},
		{"referral dispensada y facturada", "SELECT count(*) FROM referrals WHERE id=$1 AND status='Dispensada' AND invoiced_at IS NOT NULL", []any{refID}, 1},
		{"stock restante", "SELECT coalesce(sum(qty),0) FROM stock_lots WHERE item_id=$1", []any{med}, 6},
		{"kardex cuadra", "SELECT (SELECT coalesce(sum(qty),0) FROM stock_lots WHERE item_id=$1)-(SELECT coalesce(sum(qty),0) FROM inventory_movements WHERE item_id=$1)", []any{med}, 0},
		{"factura pagada", "SELECT count(*) FROM invoices WHERE id=$1 AND paid=total", []any{inv.ID}, 1},
		{"saldo dueño", "SELECT balance FROM clinic_owners WHERE clinic_id=$1 AND owner_id=$2", []any{f.clinic, oid}, 0},
		{"auditoría", "SELECT count(*) FROM audit_events WHERE action IN ('record.created','referral.created','referral.dispensed','invoice.created','payment.created')", nil, 5},
	}
	for _, c := range checks {
		var got int64
		if e := f.pool.QueryRow(ctx, c.query, c.args...).Scan(&got); e != nil || got != c.want {
			t.Fatal(c.name, got, c.want, e)
		}
	}
	var status string
	if e := f.pool.QueryRow(ctx, "SELECT CASE WHEN paid>=total THEN 'Pagada' ELSE 'Emitida' END FROM invoices WHERE id=$1", inv.ID).Scan(&status); e != nil || status != "Pagada" {
		t.Fatal(status, e)
	}
}
