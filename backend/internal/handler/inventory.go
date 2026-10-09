package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/mail"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
)

type inventoryScope struct{ Kind, ItemKind, Location, Permission, PurchasePermission string }

func (s *Server) inventoryRoutes(m *http.ServeMux) {
	for _, sc := range []inventoryScope{{"pharmacy", "medication", "pharmacy", "farmacia.inventario", "farmacia.inventario"}, {"retail", "product", "central", "tienda.inventario", "tienda.compras"}} {
		base := "/api/v1/" + sc.Kind
		s.route(m, "GET "+base+"/suppliers", func(w http.ResponseWriter, r *http.Request) error {
			return s.scopedList(w, r, sc.Permission, `SELECT id,name,rut,email,phone FROM suppliers WHERE clinic_id=$1 AND kind='`+sc.Kind+`' ORDER BY name,id`)
		})
		s.route(m, "POST "+base+"/suppliers", func(w http.ResponseWriter, r *http.Request) error { return s.createSupplier(w, r, sc) })
		itemPath := "/products"
		if sc.Kind == "pharmacy" {
			itemPath = "/medications"
		}
		s.route(m, "GET "+base+itemPath, func(w http.ResponseWriter, r *http.Request) error {
			return s.scopedList(w, r, sc.Permission, itemSelect+` WHERE c.clinic_id=$1 AND c.kind='`+sc.ItemKind+`' ORDER BY c.name,c.id`)
		})
		s.route(m, "POST "+base+itemPath, func(w http.ResponseWriter, r *http.Request) error { return s.createItem(w, r, sc) })
		s.route(m, "GET "+base+"/movements", func(w http.ResponseWriter, r *http.Request) error {
			return s.scopedList(w, r, sc.Permission, `SELECT m.id,m.item_id AS "itemId",m.lot_id AS "lotId",m.qty,m.reason,m.reference_id AS "referenceId",m.actor_id AS "actorId",m.created_at AS at FROM inventory_movements m JOIN catalog_items c ON c.id=m.item_id WHERE m.clinic_id=$1 AND c.kind='`+sc.ItemKind+`' ORDER BY m.created_at DESC,m.id`)
		})
		s.route(m, "POST "+base+"/movements", func(w http.ResponseWriter, r *http.Request) error { return s.adjustInventory(w, r, sc) })
		s.route(m, "GET "+base+"/purchase-orders", func(w http.ResponseWriter, r *http.Request) error {
			return s.scopedList(w, r, sc.PurchasePermission, orderSelect+` WHERE p.clinic_id=$1 AND p.kind='`+sc.Kind+`' ORDER BY p.created_at DESC,p.id`)
		})
		s.route(m, "POST "+base+"/purchase-orders", func(w http.ResponseWriter, r *http.Request) error { return s.createOrder(w, r, sc) })
		s.route(m, "POST "+base+"/purchase-orders/{id}/send", func(w http.ResponseWriter, r *http.Request) error { return s.sendOrder(w, r, sc) })
		s.route(m, "POST "+base+"/purchase-orders/{id}/receive", func(w http.ResponseWriter, r *http.Request) error { return s.receiveOrder(w, r, sc) })
	}
}

const itemSelect = `SELECT c.id,c.name,c.kind,c.price_net AS "priceNet",c.unit_cost AS "unitCost",c.supplier_id AS "supplierId",c.category,c.details,c.min_stock AS "minStock",c.active,c.prescription_required AS "prescriptionRequired",
 (SELECT coalesce(sum(qty),0) FROM stock_lots WHERE item_id=c.id) AS stock,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'location',location,'lot',lot,'expiry',expiry,'qty',qty,'unitCost',unit_cost) ORDER BY expiry NULLS LAST,id),'[]') FROM stock_lots WHERE item_id=c.id) AS lots FROM catalog_items c`
const orderSelect = `SELECT p.id,p.number,p.supplier_id AS "supplierId",p.kind,p.status,p.created_at AS "createdAt",
 (SELECT jsonb_agg(jsonb_build_object('id',id,'itemId',item_id,'qty',qty,'received',received,'pending',qty-received,'unitCost',unit_cost) ORDER BY id) FROM purchase_order_lines WHERE order_id=p.id) AS items FROM purchase_orders p`

func itemJSON(ctx context.Context, tx pgx.Tx, clinic, id string) (json.RawMessage, error) {
	var raw []byte
	e := tx.QueryRow(ctx, "SELECT to_jsonb(v) FROM ("+itemSelect+" WHERE c.id=$1 AND c.clinic_id=$2) v", id, clinic).Scan(&raw)
	return raw, e
}
func orderJSON(ctx context.Context, tx pgx.Tx, clinic, id string) (json.RawMessage, error) {
	var raw []byte
	e := tx.QueryRow(ctx, "SELECT to_jsonb(v) FROM ("+orderSelect+" WHERE p.id=$1 AND p.clinic_id=$2) v", id, clinic).Scan(&raw)
	return raw, e
}
func (s *Server) createSupplier(w http.ResponseWriter, r *http.Request, sc inventoryScope) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	var in struct {
		Name  string `json:"name"`
		RUT   string `json:"rut"`
		Email string `json:"email"`
		Phone string `json:"phone"`
	}
	if e = decode(w, r, &in); e != nil {
		return e
	}
	in.RUT, e = domain.NormalizeRUT(in.RUT)
	if e != nil {
		return fail(400, "invalid_rut", "RUT inválido")
	}
	if strings.TrimSpace(in.Name) == "" || len(in.Name) > 200 || len(in.Phone) > 50 {
		return fail(400, "invalid_supplier", "Proveedor inválido")
	}
	if in.Email != "" {
		parsed, e := mail.ParseAddress(in.Email)
		if e != nil || parsed.Address != in.Email {
			return fail(400, "invalid_email", "Correo inválido")
		}
	}
	return s.mutate(w, r, a, sc.PurchasePermission, in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		id := domain.UUID()
		_, e := tx.Exec(r.Context(), "INSERT INTO suppliers(id,clinic_id,kind,name,rut,email,phone) VALUES($1,$2,$3,$4,$5,$6,$7)", id, a.ClinicID, sc.Kind, in.Name, in.RUT, in.Email, in.Phone)
		if e != nil {
			return nil, e
		}
		if e = audit(r.Context(), tx, a, "supplier.created", id, in); e != nil {
			return nil, e
		}
		return map[string]any{"id": id, "name": in.Name, "rut": in.RUT, "email": in.Email, "phone": in.Phone}, nil
	})
}

type itemInput struct {
	Name                 string `json:"name"`
	PriceNet             int64  `json:"priceNet"`
	UnitCost             int64  `json:"unitCost"`
	SupplierID           string `json:"supplierId"`
	Category             string `json:"category"`
	MinStock             int    `json:"minStock"`
	PrescriptionRequired bool   `json:"prescriptionRequired"`
}

func (s *Server) createItem(w http.ResponseWriter, r *http.Request, sc inventoryScope) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	var in itemInput
	if e = decode(w, r, &in); e != nil {
		return e
	}
	if strings.TrimSpace(in.Name) == "" || len(in.Name) > 200 || len(in.Category) > 100 || in.PriceNet < 0 || in.PriceNet > 1000000000 || in.UnitCost < 0 || in.UnitCost > 1000000000 || in.MinStock < 0 || in.MinStock > 1000000 || !domain.ValidID(in.SupplierID) {
		return fail(400, "invalid_item", "Datos de catálogo inválidos")
	}
	return s.mutate(w, r, a, sc.Permission, in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		var sid string
		if e := tx.QueryRow(r.Context(), "SELECT id FROM suppliers WHERE id=$1 AND clinic_id=$2 AND kind=$3", in.SupplierID, a.ClinicID, sc.Kind).Scan(&sid); e != nil {
			return nil, e
		}
		id := domain.UUID()
		if _, e := tx.Exec(r.Context(), "INSERT INTO catalog_items(id,clinic_id,kind,name,price_net,unit_cost,supplier_id,category,min_stock,prescription_required) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", id, a.ClinicID, sc.ItemKind, in.Name, in.PriceNet, in.UnitCost, in.SupplierID, in.Category, in.MinStock, in.PrescriptionRequired); e != nil {
			return nil, e
		}
		if e := audit(r.Context(), tx, a, "catalog.created", id, in); e != nil {
			return nil, e
		}
		return itemJSON(r.Context(), tx, a.ClinicID, id)
	})
}

type orderInput struct {
	SupplierID string `json:"supplierId"`
	Items      []struct {
		ItemID string `json:"itemId"`
		Qty    int    `json:"qty"`
	} `json:"items"`
}

func (s *Server) createOrder(w http.ResponseWriter, r *http.Request, sc inventoryScope) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	var in orderInput
	if e = decode(w, r, &in); e != nil {
		return e
	}
	if !domain.ValidID(in.SupplierID) || len(in.Items) < 1 || len(in.Items) > 100 {
		return fail(400, "invalid_order", "Orden inválida")
	}
	seen := map[string]bool{}
	for _, it := range in.Items {
		if !domain.ValidID(it.ItemID) || it.Qty < 1 || it.Qty > 1000000 || seen[it.ItemID] {
			return fail(400, "invalid_items", "Líneas inválidas o duplicadas")
		}
		seen[it.ItemID] = true
	}
	return s.mutate(w, r, a, sc.PurchasePermission, in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		var sid string
		if e := tx.QueryRow(r.Context(), "SELECT id FROM suppliers WHERE id=$1 AND clinic_id=$2 AND kind=$3", in.SupplierID, a.ClinicID, sc.Kind).Scan(&sid); e != nil {
			return nil, e
		}
		num, e := nextNumber(r.Context(), tx, a.ClinicID, "purchase:"+sc.Kind)
		if e != nil {
			return nil, e
		}
		id := domain.UUID()
		if _, e = tx.Exec(r.Context(), "INSERT INTO purchase_orders(id,clinic_id,kind,supplier_id,number) VALUES($1,$2,$3,$4,$5)", id, a.ClinicID, sc.Kind, in.SupplierID, num); e != nil {
			return nil, e
		}
		for _, it := range in.Items {
			var cost int64
			if e = tx.QueryRow(r.Context(), "SELECT unit_cost FROM catalog_items WHERE id=$1 AND clinic_id=$2 AND kind=$3 AND supplier_id=$4 AND active", it.ItemID, a.ClinicID, sc.ItemKind, in.SupplierID).Scan(&cost); e != nil {
				return nil, e
			}
			if _, e = tx.Exec(r.Context(), "INSERT INTO purchase_order_lines(order_id,clinic_id,item_id,qty,unit_cost) VALUES($1,$2,$3,$4,$5)", id, a.ClinicID, it.ItemID, it.Qty, cost); e != nil {
				return nil, e
			}
		}
		if e = audit(r.Context(), tx, a, "purchase.created", id, in); e != nil {
			return nil, e
		}
		return orderJSON(r.Context(), tx, a.ClinicID, id)
	})
}
func (s *Server) sendOrder(w http.ResponseWriter, r *http.Request, sc inventoryScope) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	id, e := pathID(r)
	if e != nil {
		return e
	}
	return s.mutate(w, r, a, sc.PurchasePermission, struct{}{}, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var status string
		if e := tx.QueryRow(r.Context(), "SELECT status FROM purchase_orders WHERE id=$1 AND clinic_id=$2 AND kind=$3 FOR UPDATE", id, a.ClinicID, sc.Kind).Scan(&status); e != nil {
			return nil, e
		}
		if status != "Borrador" {
			return nil, fail(409, "invalid_transition", "La orden ya fue enviada")
		}
		if _, e := tx.Exec(r.Context(), "UPDATE purchase_orders SET status='Enviada' WHERE id=$1", id); e != nil {
			return nil, e
		}
		if e := audit(r.Context(), tx, a, "purchase.sent", id, struct{}{}); e != nil {
			return nil, e
		}
		return orderJSON(r.Context(), tx, a.ClinicID, id)
	})
}

type receiptInput struct {
	Items []struct {
		ItemID string `json:"itemId"`
		Qty    int    `json:"qty"`
		Lot    string `json:"lot"`
		Expiry string `json:"expiry"`
	} `json:"items"`
}

func (s *Server) receiveOrder(w http.ResponseWriter, r *http.Request, sc inventoryScope) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	id, e := pathID(r)
	if e != nil {
		return e
	}
	var in receiptInput
	if e = decode(w, r, &in); e != nil {
		return e
	}
	if len(in.Items) < 1 || len(in.Items) > 100 {
		return fail(400, "invalid_receipt", "Entrega vacía o demasiado grande")
	}
	for _, it := range in.Items {
		if !domain.ValidID(it.ItemID) || it.Qty < 1 || it.Qty > 1000000 || strings.TrimSpace(it.Lot) == "" || len(it.Lot) > 120 {
			return fail(400, "invalid_receipt", "Lote o cantidad inválidos")
		}
		if sc.Kind == "pharmacy" && it.Expiry == "" {
			return fail(400, "expiry_required", "Vencimiento obligatorio para medicamentos")
		}
		if it.Expiry != "" {
			if _, e := domain.CivilDate(it.Expiry); e != nil || it.Expiry < domain.LocalDate(domain.Now(r.Context())) {
				return fail(400, "invalid_expiry", "Vencimiento inválido o pasado")
			}
		}
	}
	return s.mutate(w, r, a, sc.PurchasePermission, in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var status string
		if e := tx.QueryRow(r.Context(), "SELECT status FROM purchase_orders WHERE id=$1 AND clinic_id=$2 AND kind=$3 FOR UPDATE", id, a.ClinicID, sc.Kind).Scan(&status); e != nil {
			return nil, e
		}
		if status != "Enviada" && status != "Parcialmente recibida" {
			return nil, fail(409, "invalid_transition", "La orden no admite recepción")
		}
		for _, it := range in.Items {
			var cost int64
			var pending int
			if e := tx.QueryRow(r.Context(), "SELECT unit_cost,qty-received FROM purchase_order_lines WHERE order_id=$1 AND item_id=$2 FOR UPDATE", id, it.ItemID).Scan(&cost, &pending); e != nil {
				return nil, e
			}
			if it.Qty > pending {
				return nil, fail(409, "excess_receipt", "La cantidad supera el pendiente")
			}
			var expiry any
			if it.Expiry != "" {
				expiry = it.Expiry
			}
			var lotID string
			// The same physical lot cannot silently change expiry or historical cost.
			e := tx.QueryRow(r.Context(), `INSERT INTO stock_lots(clinic_id,item_id,location,lot,expiry,qty,unit_cost) VALUES($1,$2,$3,$4,$5::date,$6,$7)
   ON CONFLICT(item_id,location,lot) DO UPDATE SET qty=stock_lots.qty+excluded.qty
   WHERE stock_lots.expiry IS NOT DISTINCT FROM excluded.expiry AND stock_lots.unit_cost=excluded.unit_cost RETURNING id`, a.ClinicID, it.ItemID, sc.Location, it.Lot, expiry, it.Qty, cost).Scan(&lotID)
			if e == pgx.ErrNoRows {
				return nil, fail(409, "lot_mismatch", "El lote existente tiene otro costo o vencimiento")
			}
			if e != nil {
				return nil, e
			}
			if _, e = tx.Exec(r.Context(), "UPDATE purchase_order_lines SET received=received+$3 WHERE order_id=$1 AND item_id=$2", id, it.ItemID, it.Qty); e != nil {
				return nil, e
			}
			if _, e = tx.Exec(r.Context(), "INSERT INTO inventory_movements(clinic_id,item_id,lot_id,qty,reason,reference_id,actor_id) VALUES($1,$2,$3,$4,'Compra',$5,$6)", a.ClinicID, it.ItemID, lotID, it.Qty, id, a.UserID); e != nil {
				return nil, e
			}
		}
		if _, e := tx.Exec(r.Context(), `UPDATE purchase_orders SET status=CASE WHEN EXISTS(SELECT 1 FROM purchase_order_lines WHERE order_id=$1 AND received<qty) THEN 'Parcialmente recibida' ELSE 'Recibida' END WHERE id=$1`, id); e != nil {
			return nil, e
		}
		if e := audit(r.Context(), tx, a, "purchase.received", id, in); e != nil {
			return nil, e
		}
		return orderJSON(r.Context(), tx, a.ClinicID, id)
	})
}
func (s *Server) adjustInventory(w http.ResponseWriter, r *http.Request, sc inventoryScope) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	var in struct {
		LotID  string `json:"lotId"`
		Qty    int    `json:"qty"`
		Reason string `json:"reason"`
	}
	if e = decode(w, r, &in); e != nil {
		return e
	}
	if !domain.ValidID(in.LotID) || in.Qty >= 0 || in.Qty < -1000000 || (in.Reason != "Merma" && in.Reason != "Vencimiento") {
		return fail(400, "invalid_adjustment", "Solo salidas por Merma o Vencimiento")
	}
	return s.mutate(w, r, a, sc.Permission, in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		var qty int
		var item string
		if e := tx.QueryRow(r.Context(), "SELECT l.qty,l.item_id FROM stock_lots l JOIN catalog_items c ON c.id=l.item_id WHERE l.id=$1 AND l.clinic_id=$2 AND c.kind=$3 FOR UPDATE OF l", in.LotID, a.ClinicID, sc.ItemKind).Scan(&qty, &item); e != nil {
			return nil, e
		}
		if qty+in.Qty < 0 {
			return nil, fail(409, "insufficient_stock", "Stock insuficiente")
		}
		if _, e := tx.Exec(r.Context(), "UPDATE stock_lots SET qty=qty+$2 WHERE id=$1", in.LotID, in.Qty); e != nil {
			return nil, e
		}
		id := domain.UUID()
		if _, e := tx.Exec(r.Context(), "INSERT INTO inventory_movements(id,clinic_id,item_id,lot_id,qty,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)", id, a.ClinicID, item, in.LotID, in.Qty, in.Reason, a.UserID); e != nil {
			return nil, e
		}
		if e := audit(r.Context(), tx, a, "inventory.adjusted", id, in); e != nil {
			return nil, e
		}
		return map[string]any{"id": id, "lotId": in.LotID, "itemId": item, "qty": in.Qty, "reason": in.Reason}, nil
	})
}

// deductLots consumes qty units of an item FEFO across lots, locking rows.
// Each lot carries its own movement row (movement_lot model). It returns
// 409 when the aggregated stock does not cover the request.
func deductLots(ctx context.Context, tx pgx.Tx, clinic, item, reason, ref, actor string, qty int) error {
	rows, err := tx.Query(ctx, "SELECT id,qty FROM stock_lots WHERE item_id=$1 AND clinic_id=$2 AND qty>0 ORDER BY expiry NULLS LAST,id FOR UPDATE", item, clinic)
	if err != nil {
		return err
	}
	need := qty
	type allocation struct {
		lotID string
		qty   int
	}
	var lots []allocation
	for rows.Next() && need > 0 {
		var lotID string
		var have int
		if err = rows.Scan(&lotID, &have); err != nil {
			rows.Close()
			return err
		}
		take := have
		if take > need {
			take = need
		}
		lots = append(lots, allocation{lotID, take})
		need -= take
	}
	rows.Close()
	if err = rows.Err(); err != nil {
		return err
	}
	if need > 0 {
		return fail(409, "insufficient_stock", "Stock insuficiente")
	}
	for _, lot := range lots {
		if _, err = tx.Exec(ctx, "UPDATE stock_lots SET qty=qty-$2 WHERE id=$1", lot.lotID, lot.qty); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, "INSERT INTO inventory_movements(clinic_id,item_id,lot_id,qty,reason,reference_id,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)", clinic, item, lot.lotID, -lot.qty, reason, ref, actor); err != nil {
			return err
		}
	}
	return nil
}
