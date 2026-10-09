package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"testing"

	"github.com/vetdata/api/internal/domain"
)

func stockAt(t *testing.T, f *fixture, item, location string) int {
	t.Helper()
	var qty int
	if e := f.pool.QueryRow(context.Background(), "SELECT coalesce(sum(qty),0) FROM stock_lots WHERE item_id=$1 AND clinic_id=$2 AND location=$3", item, f.clinic, location).Scan(&qty); e != nil {
		t.Fatal(e)
	}
	return qty
}

func setupRetail(t *testing.T) (*fixture, []*http.Cookie, []*http.Cookie, string, string) {
	t.Helper()
	f, own, other, _, _ := setupSharing(t)
	supplier := responseID(t, f.request("POST", "/api/v1/retail/suppliers", map[string]any{"name": "Proveedor Retail", "rut": "12345678-5"}, own...), 201)
	product := responseID(t, f.request("POST", "/api/v1/retail/products", itemInput{Name: "Alimento Perro 3kg", SupplierID: supplier, PriceNet: 10000, UnitCost: 6000, Category: "Alimentos"}, own...), 201)
	return f, own, other, supplier, product
}

func receiveRetail(t *testing.T, f *fixture, own []*http.Cookie, supplier, product string, qty int, lot string) string {
	t.Helper()
	order := responseID(t, f.request("POST", "/api/v1/retail/purchase-orders", map[string]any{"supplierId": supplier, "items": []map[string]any{{"itemId": product, "qty": qty}}}, own...), 201)
	path := "/api/v1/retail/purchase-orders/" + order
	if w := f.request("POST", path+"/send", nil, own...); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w := f.request("POST", path+"/receive", map[string]any{"items": []map[string]any{{"itemId": product, "qty": qty, "lot": lot}}}, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	return order
}

func checkout(t *testing.T, f *fixture, key string, body map[string]any, cookies ...*http.Cookie) (int, map[string]any) {
	t.Helper()
	w := f.requestKey("POST", "/api/v1/retail/sales", key, body, cookies...)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func TestRetailCheckoutAtomicAndConcurrency(t *testing.T) {
	f, own, other, supplier, product := setupRetail(t)
	ctx := context.Background()

	// Receive 10 to central, move 5 to sala.
	receiveRetail(t, f, own, supplier, product, 10, "C-1")
	if stockAt(t, f, product, "central") != 10 {
		t.Fatal("central receipt")
	}
	w := f.request("POST", "/api/v1/retail/transfers", map[string]any{"productId": product, "qty": 5}, own...)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	if stockAt(t, f, product, "central") != 5 || stockAt(t, f, product, "sala") != 5 {
		t.Fatal("transfer split")
	}

	// Tenant isolation: other clinic cannot see or use the product.
	if code, _ := checkout(t, f, domain.UUID(), map[string]any{"items": []map[string]any{{"productId": product, "qty": 1}}, "payment": "Efectivo"}, other...); code != 404 {
		t.Fatal("cross-tenant checkout", code)
	}

	// Nominal checkout: 2 units, server price 10000 net.
	code, out := checkout(t, f, domain.UUID(), map[string]any{"items": []map[string]any{{"productId": product, "qty": 2}}, "payment": "Efectivo"}, own...)
	if code != 201 {
		t.Fatal(code, out)
	}
	sale := out["sale"].(map[string]any)
	if sale["net"] != float64(20000) || sale["vat"] != float64(3800) || sale["total"] != float64(23800) {
		t.Fatal("server totals", sale)
	}
	if sale["number"] != float64(1) {
		t.Fatal("sale number", sale)
	}
	if stockAt(t, f, product, "sala") != 3 {
		t.Fatal("sala after sale")
	}
	var moves int
	if e := f.pool.QueryRow(ctx, "SELECT count(*) FROM inventory_movements WHERE clinic_id=$1 AND reason='Venta'", f.clinic).Scan(&moves); e != nil || moves < 1 {
		t.Fatal("venta movements", moves, e)
	}

	// Idempotent retry with the same key returns the same sale.
	key := domain.UUID()
	code, first := checkout(t, f, key, map[string]any{"items": []map[string]any{{"productId": product, "qty": 1}}, "payment": "Débito"}, own...)
	if code != 201 {
		t.Fatal(code, first)
	}
	code, second := checkout(t, f, key, map[string]any{"items": []map[string]any{{"productId": product, "qty": 1}}, "payment": "Débito"}, own...)
	if code != 201 || second["sale"].(map[string]any)["number"] != first["sale"].(map[string]any)["number"] {
		t.Fatal("idempotent retry", code, second)
	}
	var sales int
	if e := f.pool.QueryRow(ctx, "SELECT count(*) FROM retail_sales WHERE clinic_id=$1", f.clinic).Scan(&sales); e != nil || sales != 2 {
		t.Fatal("duplicate sale", sales, e)
	}

	// Delivery without owner → 400; unknown courier → 400.
	if code, _ := checkout(t, f, domain.UUID(), map[string]any{"items": []map[string]any{{"productId": product, "qty": 1}}, "payment": "Efectivo", "delivery": map[string]any{"courier": "Reparto propio"}}, own...); code != 400 {
		t.Fatal("delivery without owner", code)
	}
	if code, _ := checkout(t, f, domain.UUID(), map[string]any{"items": []map[string]any{{"productId": product, "qty": 1}}, "payment": "Efectivo", "ownerRut": "12345678-5", "delivery": map[string]any{"courier": "Ovni Express"}}, own...); code != 400 {
		t.Fatal("unknown courier", code)
	}

	// Delivery with owner creates a shipment for tomorrow.
	code, out = checkout(t, f, domain.UUID(), map[string]any{"items": []map[string]any{{"productId": product, "qty": 1}}, "payment": "Transferencia", "ownerRut": "12345678-5", "delivery": map[string]any{"courier": "Reparto propio"}}, own...)
	if code != 201 {
		t.Fatal(code, out)
	}
	shipment, ok := out["shipment"].(map[string]any)
	if !ok || shipment["status"] != "Por preparar" {
		t.Fatal("shipment created", out)
	}
	today := domain.LocalDate(domain.Now(ctx))
	want, _ := domain.AddDays(today, 1)
	if shipment["scheduledFor"] != want {
		t.Fatal("scheduled tomorrow", shipment)
	}

	// Insufficient sala → 409, no partial sale.
	if code, _ := checkout(t, f, domain.UUID(), map[string]any{"items": []map[string]any{{"productId": product, "qty": 100}}, "payment": "Efectivo"}, own...); code != 409 {
		t.Fatal("insufficient sala", code)
	}

	// Concurrency: two checkouts of the last sala unit → 1x201 + 1x409.
	supplier2 := responseID(t, f.request("POST", "/api/v1/retail/suppliers", map[string]any{"name": "Proveedor 2", "rut": "11111111-1"}, own...), 201)
	racer := responseID(t, f.request("POST", "/api/v1/retail/products", itemInput{Name: "Juguete", SupplierID: supplier2, PriceNet: 5000, UnitCost: 2000}, own...), 201)
	receiveRetail(t, f, own, supplier2, racer, 1, "C-RACE")
	if w := f.request("POST", "/api/v1/retail/transfers", map[string]any{"productId": racer, "qty": 1}, own...); w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var mu sync.Mutex
	counts := map[int]int{}
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, _ := checkout(t, f, domain.UUID(), map[string]any{"items": []map[string]any{{"productId": racer, "qty": 1}}, "payment": "Efectivo"}, own...)
			mu.Lock()
			counts[code]++
			mu.Unlock()
		}()
	}
	wg.Wait()
	if counts[201] != 1 || counts[409] != 1 {
		t.Fatal("concurrent last unit", counts)
	}
	if stockAt(t, f, racer, "sala") != 0 || stockAt(t, f, racer, "central") != 0 {
		t.Fatal("racer remainder")
	}
	var neg int
	if e := f.pool.QueryRow(ctx, "SELECT count(*) FROM stock_lots WHERE clinic_id=$1 AND qty<0", f.clinic).Scan(&neg); e != nil || neg != 0 {
		t.Fatal("negative stock", neg, e)
	}
}

func TestRetailTransferReceiveAndAdjust(t *testing.T) {
	f, own, _, supplier, product := setupRetail(t)

	// Transfer without central balance → 409.
	if w := f.request("POST", "/api/v1/retail/transfers", map[string]any{"productId": product, "qty": 3}, own...); w.Code != 409 {
		t.Fatal(w.Code, w.Body.String())
	}

	// Receive then transfer preserves the total.
	receiveRetail(t, f, own, supplier, product, 6, "C-T")
	if w := f.request("POST", "/api/v1/retail/transfers", map[string]any{"productId": product, "qty": 4}, own...); w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	if stockAt(t, f, product, "central") != 2 || stockAt(t, f, product, "sala") != 4 {
		t.Fatal("transfer total")
	}
	var reasons string
	if e := f.pool.QueryRow(context.Background(), "SELECT string_agg(DISTINCT reason,',' ORDER BY reason) FROM inventory_movements WHERE clinic_id=$1", f.clinic).Scan(&reasons); e != nil {
		t.Fatal(e)
	}
	if reasons != "Compra,Transferencia" {
		t.Fatal("kardex reasons", reasons)
	}

	// Over-receive on the same order → 409.
	order := responseID(t, f.request("POST", "/api/v1/retail/purchase-orders", map[string]any{"supplierId": supplier, "items": []map[string]any{{"itemId": product, "qty": 2}}}, own...), 201)
	path := "/api/v1/retail/purchase-orders/" + order
	if w := f.request("POST", path+"/send", nil, own...); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if w := f.request("POST", path+"/receive", map[string]any{"items": []map[string]any{{"itemId": product, "qty": 3, "lot": "C-X"}}}, own...); w.Code != 409 {
		t.Fatal("excess receipt", w.Code, w.Body.String())
	}

	// Conteo adjust on a sala lot (+ and −), Merma only negative, never below zero.
	var lot string
	if e := f.pool.QueryRow(context.Background(), "SELECT id FROM stock_lots WHERE item_id=$1 AND clinic_id=$2 AND location='sala' LIMIT 1", product, f.clinic).Scan(&lot); e != nil {
		t.Fatal(e)
	}
	if w := f.request("POST", "/api/v1/retail/adjustments", map[string]any{"lotId": lot, "qty": 2, "reason": "Conteo"}, own...); w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	if stockAt(t, f, product, "sala") != 6 {
		t.Fatal("conteo up")
	}
	if w := f.request("POST", "/api/v1/retail/adjustments", map[string]any{"lotId": lot, "qty": -1, "reason": "Merma"}, own...); w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	if w := f.request("POST", "/api/v1/retail/adjustments", map[string]any{"lotId": lot, "qty": 1, "reason": "Merma"}, own...); w.Code != 400 {
		t.Fatal("merma positive", w.Code, w.Body.String())
	}
	if w := f.request("POST", "/api/v1/retail/adjustments", map[string]any{"lotId": lot, "qty": -100, "reason": "Conteo"}, own...); w.Code != 409 {
		t.Fatal("conteo below zero", w.Code, w.Body.String())
	}
}

func TestRetailShipmentsAdvance(t *testing.T) {
	f, own, other, supplier, product := setupRetail(t)
	receiveRetail(t, f, own, supplier, product, 4, "C-S")
	if w := f.request("POST", "/api/v1/retail/transfers", map[string]any{"productId": product, "qty": 2}, own...); w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	_, out := checkout(t, f, domain.UUID(), map[string]any{"items": []map[string]any{{"productId": product, "qty": 1}}, "payment": "Efectivo", "ownerRut": "12345678-5", "delivery": map[string]any{"courier": "Chilexpress"}}, own...)
	id := out["shipment"].(map[string]any)["id"].(string)

	advance := func(cookies []*http.Cookie, sid string) int {
		return f.request("POST", "/api/v1/retail/shipments/"+sid+"/advance", nil, cookies...).Code
	}
	for _, want := range []string{"Preparado", "En ruta", "Entregado"} {
		if code := advance(own, id); code != 200 {
			t.Fatal(code)
		}
		var status string
		if e := f.pool.QueryRow(context.Background(), "SELECT status FROM shipments WHERE id=$1", id).Scan(&status); e != nil || status != want {
			t.Fatal("advance to", want, status, e)
		}
	}
	if code := advance(own, id); code != 409 {
		t.Fatal("advance past delivered", code)
	}
	if code := advance(other, id); code != 404 {
		t.Fatal("cross-tenant shipment", code)
	}
	w := f.request("GET", "/api/v1/retail/shipments?status=Entregado", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var list []map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &list)
	if len(list) != 1 || list[0]["id"] != id {
		t.Fatal("shipments filter", w.Body.String())
	}
}
