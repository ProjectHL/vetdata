package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/vetdata/api/internal/domain"
)

type invoiceLineOut struct {
	ItemID   string `json:"itemId"`
	Kind     string `json:"kind"`
	Qty      int    `json:"qty"`
	PriceNet int64  `json:"priceNet"`
	Discount int    `json:"discount"`
	LineNet  int64  `json:"lineNet"`
}

type invoiceOut struct {
	ID     string           `json:"id"`
	Number int64            `json:"number"`
	Net    int64            `json:"net"`
	VAT    int64            `json:"vat"`
	Total  int64            `json:"total"`
	Paid   int64            `json:"paid"`
	Items  []invoiceLineOut `json:"items"`
}

func emitInvoice(f *fixture, key string, body any, cookies []*http.Cookie) (int, invoiceOut) {
	var w *httptest.ResponseRecorder
	if key == "" {
		w = f.request("POST", "/api/v1/invoices", body, cookies...)
	} else {
		w = f.requestKey("POST", "/api/v1/invoices", key, body, cookies...)
	}
	var out invoiceOut
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func invoiceBody(owner, patient string, lines ...map[string]any) map[string]any {
	body := map[string]any{"ownerId": owner, "lines": lines}
	if patient != "" {
		body["patientId"] = patient
	}
	return body
}

func TestInvoicesAtomicFolioStockAndRetry(t *testing.T) {
	f, own, other, pid, oid := setupSharing(t)
	ctx := context.Background()
	supplier := responseID(t, f.request("POST", "/api/v1/pharmacy/suppliers", map[string]any{"name": "Proveedor", "rut": "12345678-5"}, own...), 201)
	med := responseID(t, f.request("POST", "/api/v1/pharmacy/medications", itemInput{Name: "Amoxicilina", SupplierID: supplier, PriceNet: 10000, UnitCost: 3200}, own...), 201)
	service := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO catalog_items(id,clinic_id,kind,name,price_net) VALUES($1,$2,'service','Consulta',$3)", service, f.clinic, 5000); e != nil {
		t.Fatal(e)
	}
	order := responseID(t, f.request("POST", "/api/v1/pharmacy/purchase-orders", map[string]any{"supplierId": supplier, "items": []map[string]any{{"itemId": med, "qty": 10}}}, own...), 201)
	path := "/api/v1/pharmacy/purchase-orders/" + order
	if w := f.request("POST", path+"/send", nil, own...); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	expiry := time.Now().AddDate(1, 0, 0).Format("2006-01-02")
	receive := map[string]any{"items": []map[string]any{{"itemId": med, "qty": 10, "lot": "LOTE-T3", "expiry": expiry}}}
	if w := f.request("POST", path+"/receive", receive, own...); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}

	stock := func() int {
		var qty int
		if e := f.pool.QueryRow(ctx, "SELECT coalesce(sum(qty),0) FROM stock_lots WHERE item_id=$1", med).Scan(&qty); e != nil {
			t.Fatal(e)
		}
		return qty
	}
	lines := []map[string]any{{"itemId": med, "qty": 3}, {"itemId": service, "qty": 1}}
	key := domain.UUID()
	code, first := emitInvoice(f, key, invoiceBody(oid, pid, lines...), own)
	if code != 201 {
		t.Fatal(code, first)
	}
	if first.Number != 1 || first.Net != 35000 || first.Total != first.Net+first.VAT || first.Paid != 0 {
		t.Fatal(first)
	}
	if first.VAT != 6650 {
		t.Fatal("vat", first.VAT)
	}
	if len(first.Items) != 2 || first.Items[0].PriceNet != 10000 || first.Items[0].LineNet != 30000 {
		t.Fatal("catalog prices", first.Items)
	}
	if stock() != 7 {
		t.Fatal("stock", stock())
	}
	var movements int
	var ref *string
	if e := f.pool.QueryRow(ctx, "SELECT count(*) FROM inventory_movements WHERE item_id=$1 AND reason='Venta' AND qty=-3", med).Scan(&movements); e != nil || movements != 1 {
		t.Fatal(movements, e)
	}
	if e := f.pool.QueryRow(ctx, "SELECT reference_id FROM inventory_movements WHERE item_id=$1 AND reason='Venta' LIMIT 1", med).Scan(&ref); e != nil || ref == nil || *ref != first.ID {
		t.Fatal(ref, e)
	}
	// Reintento con la misma clave: misma factura, sin duplicar folio ni stock.
	code, retry := emitInvoice(f, key, invoiceBody(oid, pid, lines...), own)
	if code != 201 || retry.ID != first.ID || retry.Number != 1 {
		t.Fatal("retry", code, retry)
	}
	if stock() != 7 {
		t.Fatal("retry stock", stock())
	}
	// Segundo folio consecutivo.
	code, second := emitInvoice(f, "", invoiceBody(oid, "", []map[string]any{{"itemId": service, "qty": 2}}...), own)
	if code != 201 || second.Number != 2 || second.Net != 10000 {
		t.Fatal("folio", code, second)
	}
	// Concurrencia sobre stock 7: una de 5 prospera, la otra da 409.
	responses := make(chan int, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, _ := emitInvoice(f, "", invoiceBody(oid, "", []map[string]any{{"itemId": med, "qty": 5}}...), own)
			responses <- code
		}()
	}
	wg.Wait()
	close(responses)
	counts := map[int]int{}
	for c := range responses {
		counts[c]++
	}
	if counts[201] != 1 || counts[409] != 1 {
		t.Fatal("concurrent stock", counts)
	}
	if stock() != 2 {
		t.Fatal("concurrent remainder", stock())
	}
	var numbers []int64
	rows, e := f.pool.Query(ctx, "SELECT number FROM invoices WHERE clinic_id=$1 ORDER BY number", f.clinic)
	if e != nil {
		t.Fatal(e)
	}
	for rows.Next() {
		var n int64
		_ = rows.Scan(&n)
		numbers = append(numbers, n)
	}
	rows.Close()
	if len(numbers) != 3 || numbers[0] != 1 || numbers[1] != 2 || numbers[2] != 3 {
		t.Fatal("folios", numbers)
	}
	// Sin stock: 409 sin filas ni movimientos nuevos.
	code, _ = emitInvoice(f, "", invoiceBody(oid, "", []map[string]any{{"itemId": med, "qty": 100}}...), own)
	if code != 409 {
		t.Fatal("insufficient", code)
	}
	if stock() != 2 {
		t.Fatal("failed stock", stock())
	}
	// Validaciones.
	code, _ = emitInvoice(f, "", invoiceBody(oid, "", []map[string]any{{"itemId": domain.UUID(), "qty": 1}}...), own)
	if code != 404 {
		t.Fatal("unknown item", code)
	}
	if _, e := f.pool.Exec(ctx, "UPDATE catalog_items SET active=false WHERE id=$1", med); e != nil {
		t.Fatal(e)
	}
	code, _ = emitInvoice(f, "", invoiceBody(oid, "", []map[string]any{{"itemId": med, "qty": 1}}...), own)
	if code != 409 {
		t.Fatal("inactive item", code)
	}
	code, _ = emitInvoice(f, "", invoiceBody(domain.UUID(), "", []map[string]any{{"itemId": service, "qty": 1}}...), own)
	if code != 404 {
		t.Fatal("unknown owner", code)
	}
	code, _ = emitInvoice(f, "", invoiceBody(oid, pid, []map[string]any{{"itemId": service, "qty": 0}}...), own)
	if code != 400 {
		t.Fatal("qty", code)
	}
	// Otra clínica no ve ni emite sobre estos datos.
	w := f.request("GET", "/api/v1/invoices", nil, other...)
	if w.Code != 200 || strings.TrimSpace(w.Body.String()) != "[]" {
		t.Fatal("tenant list", w.Code, w.Body.String())
	}
	code, _ = emitInvoice(f, "", invoiceBody(oid, pid, lines...), other)
	if code != 404 {
		t.Fatal("tenant emit", code)
	}
}

func TestInvoiceLineDiscounts(t *testing.T) {
	f, own, _, _, oid := setupSharing(t)
	supplier := responseID(t, f.request("POST", "/api/v1/pharmacy/suppliers", map[string]any{"name": "Proveedor", "rut": "12345678-5"}, own...), 201)
	med := responseID(t, f.request("POST", "/api/v1/pharmacy/medications", itemInput{Name: "Amoxicilina", SupplierID: supplier, PriceNet: 10000, UnitCost: 3200}, own...), 201)
	service := domain.UUID()
	ctx := context.Background()
	if _, e := f.pool.Exec(ctx, "INSERT INTO catalog_items(id,clinic_id,kind,name,price_net) VALUES($1,$2,'service','Consulta',$3)", service, f.clinic, 5000); e != nil {
		t.Fatal(e)
	}
	body := invoiceBody(oid, "", []map[string]any{{"itemId": med, "qty": 2, "discount": 10}, {"itemId": service, "qty": 1}}...)
	// Stock inicial con su movimiento de compra para no romper el kardex.
	lot := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO stock_lots(id,clinic_id,item_id,location,lot,qty,unit_cost) VALUES($1,$2,$3,'pharmacy','LOTE-D',10,3200)", lot, f.clinic, med); e != nil {
		t.Fatal(e)
	}
	if _, e := f.pool.Exec(ctx, "INSERT INTO inventory_movements(clinic_id,item_id,lot_id,qty,reason,actor_id) VALUES($1,$2,$3,10,'Compra',$4)", f.clinic, med, lot, f.user); e != nil {
		t.Fatal(e)
	}
	code, inv := emitInvoice(f, "", body, own)
	if code != 201 {
		t.Fatal(code, inv)
	}
	if inv.Net != 23000 || inv.VAT != 4370 || inv.Total != 27370 {
		t.Fatal("totals", inv)
	}
	if len(inv.Items) != 2 || inv.Items[0].Discount != 10 || inv.Items[0].LineNet != 18000 || inv.Items[1].Discount != 0 {
		t.Fatal("lines", inv.Items)
	}
	// Descuento total deja la línea en cero.
	code, free := emitInvoice(f, "", invoiceBody(oid, "", []map[string]any{{"itemId": service, "qty": 1, "discount": 100}}...), own)
	if code != 201 || free.Net != 0 || free.Total != 0 {
		t.Fatal("free line", code, free)
	}
	// Descuento inválido y totales manipulados fallan.
	for _, bad := range []map[string]any{
		{"itemId": service, "qty": 1, "discount": 101},
		{"itemId": service, "qty": 1, "discount": -1},
		{"itemId": service, "qty": 1, "priceNet": 1},
	} {
		code, _ = emitInvoice(f, "", map[string]any{"ownerId": oid, "lines": []map[string]any{bad}}, own)
		if code != 400 {
			t.Fatal("discount validation", bad, code)
		}
	}
	code, _ = emitInvoice(f, "", map[string]any{"ownerId": oid, "lines": []map[string]any{{"itemId": service, "qty": 1}}, "net": 1}, own)
	if code != 400 {
		t.Fatal("manipulated total", code)
	}
}

func TestInvoicePaymentsPartialAndBalance(t *testing.T) {
	f, own, other, _, oid := setupSharing(t)
	ctx := context.Background()
	service := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO catalog_items(id,clinic_id,kind,name,price_net) VALUES($1,$2,'service','Consulta',$3)", service, f.clinic, 10000); e != nil {
		t.Fatal(e)
	}
	balance := func() int64 {
		var b int64
		if e := f.pool.QueryRow(ctx, "SELECT balance FROM clinic_owners WHERE clinic_id=$1 AND owner_id=$2", f.clinic, oid).Scan(&b); e != nil {
			t.Fatal(e)
		}
		return b
	}
	code, inv := emitInvoice(f, "", invoiceBody(oid, "", []map[string]any{{"itemId": service, "qty": 1}}...), own)
	if code != 201 || inv.Total != 11900 {
		t.Fatal(code, inv)
	}
	if balance() != 11900 {
		t.Fatal("balance after invoice", balance())
	}
	if inv.Items == nil {
		t.Fatal("items")
	}
	pay := func(key string, amount int64, method string) (int, map[string]any) {
		t.Helper()
		var w *httptest.ResponseRecorder
		body := map[string]any{"amount": amount, "method": method}
		if key == "" {
			w = f.request("POST", "/api/v1/invoices/"+inv.ID+"/payments", body, own...)
		} else {
			w = f.requestKey("POST", "/api/v1/invoices/"+inv.ID+"/payments", key, body, own...)
		}
		var out map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return w.Code, out
	}
	// Abono parcial con medio válido.
	code, first := pay("", 4000, "Efectivo")
	if code != 201 || first["remaining"] != float64(7900) {
		t.Fatal("partial", code, first)
	}
	if balance() != 7900 {
		t.Fatal("balance after partial", balance())
	}
	// Medio inválido, monto inválido y sobrepago fallan.
	for _, bad := range []map[string]any{{"amount": 100, "method": "Cheque"}, {"amount": 0, "method": "Efectivo"}, {"amount": 8000, "method": "Débito"}} {
		w := f.request("POST", "/api/v1/invoices/"+inv.ID+"/payments", bad, own...)
		if w.Code != 400 && w.Code != 409 {
			t.Fatal("payment validation", bad, w.Code)
		}
	}
	// Concurrencia: dos abonos de 7000 sobre saldo 7900, uno solo pasa.
	responses := make(chan int, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); code, _ := pay("", 7000, "Transferencia"); responses <- code }()
	}
	wg.Wait()
	close(responses)
	counts := map[int]int{}
	for c := range responses {
		counts[c]++
	}
	if counts[201] != 1 || counts[409] != 1 {
		t.Fatal("concurrent payments", counts)
	}
	// Completar hasta Pagada; después 409.
	var remaining int64
	if e := f.pool.QueryRow(ctx, "SELECT total-paid FROM invoices WHERE id=$1", inv.ID).Scan(&remaining); e != nil {
		t.Fatal(e)
	}
	code, done := pay("", remaining, "Débito")
	if code != 201 || done["remaining"] != float64(0) {
		t.Fatal("settle", code, done)
	}
	if balance() != 0 {
		t.Fatal("balance settled", balance())
	}
	w := f.request("GET", "/api/v1/invoices", nil, own...)
	var list []invoiceOut
	_ = json.Unmarshal(w.Body.Bytes(), &list)
	found := false
	for _, item := range list {
		if item.ID == inv.ID {
			found = true
		}
	}
	if !found {
		t.Fatal("invoice list", w.Body.String())
	}
	code, _ = pay("", 100, "Efectivo")
	if code != 409 {
		t.Fatal("already paid", code)
	}
	// Historial de abonos y aislamiento por clínica.
	w = f.request("GET", "/api/v1/invoices/"+inv.ID+"/payments", nil, own...)
	var history []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &history)
	if len(history) != 3 {
		t.Fatal("history", history)
	}
	w = f.request("POST", "/api/v1/invoices/"+inv.ID+"/payments", map[string]any{"amount": 100, "method": "Efectivo"}, other...)
	if w.Code != 404 {
		t.Fatal("tenant payment", w.Code)
	}
	w = f.request("GET", "/api/v1/invoices/"+inv.ID+"/payments", nil, other...)
	if w.Code != 404 {
		t.Fatal("tenant history", w.Code)
	}
}
