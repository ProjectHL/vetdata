package handler

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/vetdata/api/internal/domain"
)

func responseID(t *testing.T, w *httptest.ResponseRecorder, status int) string {
	t.Helper()
	if w.Code != status {
		t.Fatal(w.Code, w.Body.String())
	}
	var v map[string]any
	if e := json.Unmarshal(w.Body.Bytes(), &v); e != nil {
		t.Fatal(e)
	}
	id, ok := v["id"].(string)
	if !ok {
		t.Fatal(w.Body.String())
	}
	return id
}
func TestPartialReceiptsIdempotencyRollbackAndConcurrentStock(t *testing.T) {
	f, own, other, _, _ := setupSharing(t)
	ctx := context.Background()
	supplier := responseID(t, f.request("POST", "/api/v1/pharmacy/suppliers", map[string]any{"name": "Proveedor", "rut": "12345678-5"}, own...), 201)
	item := responseID(t, f.request("POST", "/api/v1/pharmacy/medications", itemInput{Name: "Producto A", SupplierID: supplier, PriceNet: 10000, UnitCost: 3200, MinStock: 2}, own...), 201)
	input := map[string]any{"supplierId": supplier, "items": []map[string]any{{"itemId": item, "qty": 10}}}
	w := f.request("POST", "/api/v1/pharmacy/purchase-orders", input, other...)
	if w.Code != 404 {
		t.Fatal("tenant leak", w.Code, w.Body.String())
	}
	order := responseID(t, f.request("POST", "/api/v1/pharmacy/purchase-orders", input, own...), 201)
	path := "/api/v1/pharmacy/purchase-orders/" + order
	w = f.request("POST", path+"/send", nil, own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	expiry := time.Now().AddDate(1, 0, 0).Format("2006-01-02")
	receipt := func(qty int) map[string]any {
		return map[string]any{"items": []map[string]any{{"itemId": item, "qty": qty, "lot": "LOTE-A", "expiry": expiry}}}
	}
	key := domain.UUID()
	w = f.requestKey("POST", path+"/receive", key, receipt(4), own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var orderState struct {
		Status string
		Items  []struct {
			Received int
			Pending  int
			UnitCost int64
		}
	}
	_ = json.Unmarshal(w.Body.Bytes(), &orderState)
	if orderState.Status != "Parcialmente recibida" || len(orderState.Items) != 1 || orderState.Items[0].Received != 4 || orderState.Items[0].Pending != 6 || orderState.Items[0].UnitCost != 3200 {
		t.Fatal(w.Body.String())
	}
	w = f.requestKey("POST", path+"/receive", key, receipt(4), own...)
	if w.Code != 200 {
		t.Fatal("idempotent retry", w.Code, w.Body.String())
	}
	w = f.requestKey("POST", path+"/receive", key, receipt(5), own...)
	if w.Code != 409 {
		t.Fatal("key reuse", w.Code)
	}
	// First line is valid; second fails. Neither line may be committed.
	w = f.request("POST", path+"/receive", map[string]any{"items": []map[string]any{{"itemId": item, "qty": 2, "lot": "LOTE-A", "expiry": expiry}, {"itemId": item, "qty": 10, "lot": "LOTE-A", "expiry": expiry}}}, own...)
	if w.Code != 409 {
		t.Fatal("excess receipt", w.Code, w.Body.String())
	}
	var stock, movements int
	var lot string
	if e := f.pool.QueryRow(ctx, "SELECT id,qty FROM stock_lots WHERE item_id=$1", item).Scan(&lot, &stock); e != nil || stock != 4 {
		t.Fatal("rollback", stock, e)
	}
	if e := f.pool.QueryRow(ctx, "SELECT count(*) FROM inventory_movements WHERE item_id=$1", item).Scan(&movements); e != nil || movements != 1 {
		t.Fatal("duplicate movement", movements, e)
	}
	w = f.request("POST", path+"/receive", receipt(6), own...)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	_ = json.Unmarshal(w.Body.Bytes(), &orderState)
	if orderState.Status != "Recibida" {
		t.Fatal(w.Body.String())
	}
	w = f.request("POST", path+"/receive", receipt(1), own...)
	if w.Code != 409 {
		t.Fatal("closed order", w.Code)
	}
	// Two losses of seven race for ten units: exactly one succeeds.
	var wg sync.WaitGroup
	results := make(chan *httptest.ResponseRecorder, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results <- f.request("POST", "/api/v1/pharmacy/movements", map[string]any{"lotId": lot, "qty": -7, "reason": "Merma"}, own...)
		}()
	}
	wg.Wait()
	close(results)
	codes := map[int]int{}
	for result := range results {
		codes[result.Code]++
		if result.Code != 201 && result.Code != 409 {
			t.Fatal(result.Code, result.Body.String())
		}
	}
	if codes[201] != 1 || codes[409] != 1 {
		t.Fatal(codes)
	}
	if e := f.pool.QueryRow(ctx, "SELECT qty FROM stock_lots WHERE id=$1", lot).Scan(&stock); e != nil || stock != 3 {
		t.Fatal(stock, e)
	}
	var ledger int
	if e := f.pool.QueryRow(ctx, "SELECT sum(qty) FROM inventory_movements WHERE lot_id=$1", lot).Scan(&ledger); e != nil || ledger != stock {
		t.Fatal("ledger divergence", stock, ledger, e)
	}
	w = f.request("POST", "/api/v1/pharmacy/movements", map[string]any{"lotId": lot, "qty": -1, "reason": "Venta"}, own...)
	if w.Code != 400 {
		t.Fatal("forged sale", w.Code)
	}
	w = f.request("POST", "/api/v1/pharmacy/movements", map[string]any{"lotId": lot, "qty": -1, "reason": "Merma"}, other...)
	if w.Code != 404 {
		t.Fatal("foreign lot", w.Code)
	}
	if _, e := f.pool.Exec(ctx, "UPDATE inventory_movements SET qty=999 WHERE item_id=$1", item); e == nil {
		t.Fatal("mutable ledger")
	}
}

func TestInventoryRequiresPermission(t *testing.T) {
	f, _, _, _, _ := setupSharing(t)
	ctx := context.Background()
	// Recepción no tiene farmacia.inventario; POST /api/v1/pharmacy/movements lo exige vía mutate() en adjustInventory.
	recep := f.loginAs(t, "Recepción")
	item := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO catalog_items(id,clinic_id,kind,name,price_net,unit_cost) VALUES($1,$2,'medication','Insumo',1000,500)", item, f.clinic); e != nil {
		t.Fatal(e)
	}
	lot := domain.UUID()
	if _, e := f.pool.Exec(ctx, "INSERT INTO stock_lots(id,clinic_id,item_id,location,lot,qty,unit_cost) VALUES($1,$2,$3,'pharmacy','LOTE-403',10,500)", lot, f.clinic, item); e != nil {
		t.Fatal(e)
	}
	w := f.request("POST", "/api/v1/pharmacy/movements", map[string]any{"lotId": lot, "qty": -1, "reason": "Merma"}, recep...)
	if w.Code != 403 {
		t.Fatal("recepción sin farmacia.inventario", w.Code, w.Body.String())
	}
}
