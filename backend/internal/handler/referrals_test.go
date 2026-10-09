package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/vetdata/api/internal/domain"
)

func TestReferralsDispenseAndInvoiceGate(t *testing.T) {
	f, own, other, pid, oid := setupSharing(t)
	ctx := context.Background()
	today := time.Now().In(domain.Santiago).Format("2006-01-02")
	yesterday := time.Now().In(domain.Santiago).AddDate(0, 0, -1).Format("2006-01-02")

	supplier := responseID(t, f.request("POST", "/api/v1/pharmacy/suppliers", map[string]any{"name": "Proveedor", "rut": "12345678-5"}, own...), 201)
	controlled := responseID(t, f.request("POST", "/api/v1/pharmacy/medications", itemInput{Name: "Controlado", SupplierID: supplier, PriceNet: 10000, UnitCost: 4000, PrescriptionRequired: true}, own...), 201)
	plain := responseID(t, f.request("POST", "/api/v1/pharmacy/medications", itemInput{Name: "Común", SupplierID: supplier, PriceNet: 5000, UnitCost: 1000}, own...), 201)
	order := responseID(t, f.request("POST", "/api/v1/pharmacy/purchase-orders", map[string]any{"supplierId": supplier, "items": []map[string]any{{"itemId": controlled, "qty": 10}, {"itemId": plain, "qty": 10}}}, own...), 201)
	path := "/api/v1/pharmacy/purchase-orders/" + order
	if w := f.request("POST", path+"/send", nil, own...); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	expiry := time.Now().AddDate(1, 0, 0).Format("2006-01-02")
	receive := map[string]any{"items": []map[string]any{{"itemId": controlled, "qty": 10, "lot": "LOTE-R", "expiry": expiry}, {"itemId": plain, "qty": 10, "lot": "LOTE-P", "expiry": expiry}}}
	if w := f.request("POST", path+"/receive", receive, own...); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	stock := func(item string) int {
		var qty int
		if e := f.pool.QueryRow(ctx, "SELECT coalesce(sum(qty),0) FROM stock_lots WHERE item_id=$1", item).Scan(&qty); e != nil {
			t.Fatal(e)
		}
		return qty
	}
	_, rx := createRecord(t, f, own, pid, "prescription", map[string]any{"date": today, "drug": "Controlado", "dose": "1 comp", "duration": "10 días", "doctor": "Vet"}, nil)
	rxID := rx["id"].(string)

	newReferral := func(cookies []*http.Cookie, body map[string]any) (int, map[string]any) {
		t.Helper()
		w := f.request("POST", "/api/v1/pharmacy/referrals", body, cookies...)
		var out map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return w.Code, out
	}
	items := []map[string]any{{"itemId": controlled, "qty": 2}}
	code, ref := newReferral(own, map[string]any{"patientId": pid, "prescriptionId": rxID, "items": items})
	if code != 201 {
		t.Fatal(code, ref)
	}
	refID := ref["id"].(string)
	if ref["status"] != "Enviada" || ref["actorId"] != f.user {
		t.Fatal("referral", ref)
	}
	// Sin acceso no se deriva ni se dispensa.
	code, _ = newReferral(other, map[string]any{"patientId": pid, "prescriptionId": rxID, "items": items})
	if code != 404 {
		t.Fatal("cross tenant referral", code)
	}
	w := f.request("POST", "/api/v1/pharmacy/referrals/"+refID+"/dispense", nil, other...)
	if w.Code != 404 {
		t.Fatal("cross tenant dispense", w.Code)
	}
	// Dispensación atómica con firma del actor.
	w = f.request("POST", "/api/v1/pharmacy/referrals/"+refID+"/dispense", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var done map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &done)
	if done["status"] != "Dispensada" || done["actorId"] != f.user {
		t.Fatal("dispense", done)
	}
	if stock(controlled) != 8 {
		t.Fatal("stock", stock(controlled))
	}
	var dispensed int
	var refCheck *string
	if e := f.pool.QueryRow(ctx, "SELECT count(*) FROM inventory_movements WHERE item_id=$1 AND reason='Dispensación' AND qty=-2", controlled).Scan(&dispensed); e != nil || dispensed != 1 {
		t.Fatal(dispensed, e)
	}
	if e := f.pool.QueryRow(ctx, "SELECT reference_id FROM inventory_movements WHERE item_id=$1 AND reason='Dispensación' LIMIT 1", controlled).Scan(&refCheck); e != nil || refCheck == nil || *refCheck != refID {
		t.Fatal(refCheck, e)
	}
	w = f.request("POST", "/api/v1/pharmacy/referrals/"+refID+"/dispense", nil, own...)
	if w.Code != 409 {
		t.Fatal("double dispense", w.Code)
	}
	// Factura con receta: consume la derivación una sola vez.
	code, inv := emitInvoice(f, "", invoiceBody(oid, pid, []map[string]any{{"itemId": controlled, "qty": 1}}...), own)
	if code != 201 {
		t.Fatal("invoice with referral", code, inv)
	}
	code, _ = emitInvoice(f, "", invoiceBody(oid, pid, []map[string]any{{"itemId": controlled, "qty": 1}}...), own)
	if code != 409 {
		t.Fatal("referral reuse", code)
	}
	// Medicamento controlado sin derivación ni paciente: 409.
	controlled2 := responseID(t, f.request("POST", "/api/v1/pharmacy/medications", itemInput{Name: "Controlado 2", SupplierID: supplier, PriceNet: 7000, UnitCost: 2000, PrescriptionRequired: true}, own...), 201)
	if _, e := f.pool.Exec(ctx, "INSERT INTO stock_lots(clinic_id,item_id,location,lot,qty,unit_cost) VALUES($1,$2,'pharmacy','LOTE-R2',5,2000)", f.clinic, controlled2); e != nil {
		t.Fatal(e)
	}
	code, _ = emitInvoice(f, "", invoiceBody(oid, pid, []map[string]any{{"itemId": controlled2, "qty": 1}}...), own)
	if code != 409 {
		t.Fatal("missing prescription", code)
	}
	code, _ = emitInvoice(f, "", invoiceBody(oid, "", []map[string]any{{"itemId": controlled2, "qty": 1}}...), own)
	if code != 409 {
		t.Fatal("prescription without patient", code)
	}
	// Medicamento común factura sin receta.
	code, _ = emitInvoice(f, "", invoiceBody(oid, pid, []map[string]any{{"itemId": plain, "qty": 1}}...), own)
	if code != 201 {
		t.Fatal("plain invoice", code)
	}
	// Receta vencida y receta anulada bloquean la dispensación.
	code, ref2 := newReferral(own, map[string]any{"patientId": pid, "prescriptionId": rxID, "items": items})
	if code != 201 {
		t.Fatal(code, ref2)
	}
	if _, e := f.pool.Exec(ctx, "UPDATE referrals SET expires_on=$2 WHERE id=$1", ref2["id"], yesterday); e != nil {
		t.Fatal(e)
	}
	w = f.request("POST", "/api/v1/pharmacy/referrals/"+ref2["id"].(string)+"/dispense", nil, own...)
	if w.Code != 409 {
		t.Fatal("expired referral", w.Code, w.Body.String())
	}
	_, rx2 := createRecord(t, f, own, pid, "prescription", map[string]any{"date": today, "drug": "Común", "dose": "1 comp", "duration": "5 días", "doctor": "Vet"}, nil)
	rx2ID := rx2["id"].(string)
	code, ref3 := newReferral(own, map[string]any{"patientId": pid, "prescriptionId": rx2ID, "items": []map[string]any{{"itemId": plain, "qty": 1}}})
	if code != 201 {
		t.Fatal(code, ref3)
	}
	code, _ = createRecord(t, f, own, pid, "annulment", map[string]any{"note": "Error"}, &rx2ID)
	if code != 201 {
		t.Fatal("annulment", code)
	}
	w = f.request("POST", "/api/v1/pharmacy/referrals/"+ref3["id"].(string)+"/dispense", nil, own...)
	if w.Code != 409 {
		t.Fatal("annulled prescription", w.Code, w.Body.String())
	}
	// Validaciones de creación.
	code, _ = newReferral(own, map[string]any{"patientId": pid, "prescriptionId": rxID, "items": items, "expiresOn": yesterday})
	if code != 400 {
		t.Fatal("past expiry", code)
	}
	code, _ = newReferral(own, map[string]any{"patientId": pid, "prescriptionId": domain.UUID(), "items": items})
	if code != 404 {
		t.Fatal("unknown prescription", code)
	}
	code, _ = newReferral(own, map[string]any{"patientId": pid, "prescriptionId": rxID, "items": []map[string]any{{"itemId": plain, "qty": 0}}})
	if code != 400 {
		t.Fatal("zero qty", code)
	}
}
