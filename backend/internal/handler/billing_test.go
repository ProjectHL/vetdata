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
