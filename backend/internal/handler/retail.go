package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
)

func (s *Server) retailRoutes(m *http.ServeMux) {
	s.route(m, "GET /api/v1/retail/sales", s.listRetailSales)
	s.route(m, "POST /api/v1/retail/sales", s.checkoutRetail)
	s.route(m, "POST /api/v1/retail/transfers", s.transferToSala)
	s.route(m, "POST /api/v1/retail/adjustments", s.adjustRetail)
	s.route(m, "GET /api/v1/retail/shipments", s.listShipments)
	s.route(m, "POST /api/v1/retail/shipments/{id}/advance", s.advanceShipment)
}

const saleSelect = `SELECT s.id,s.number,s.owner_id AS "ownerId",s.payment,s.delivery_fee_net AS "deliveryFeeNet",
 s.net,s.vat,s.total,s.channel,s.actor_id AS "actorId",s.created_at AS "createdAt",
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',l.id,'itemId',l.item_id,'qty',l.qty,'unitPriceNet',l.unit_price_net) ORDER BY l.id),'[]') FROM retail_sale_lines l WHERE l.sale_id=s.id) AS items FROM retail_sales s`

const shipmentSelect = `SELECT h.id,h.sale_id AS "saleId",h.owner_id AS "ownerId",h.address,h.sector,h.courier,
 to_char(h.scheduled_for,'YYYY-MM-DD') AS "scheduledFor",h.delivered_at AS "deliveredAt",h.status,h.created_at AS "createdAt" FROM shipments h`

func saleJSON(ctx context.Context, tx pgx.Tx, clinic, id string) (json.RawMessage, error) {
	var raw []byte
	err := tx.QueryRow(ctx, "SELECT to_jsonb(v) FROM ("+saleSelect+" WHERE s.id=$1 AND s.clinic_id=$2) v", id, clinic).Scan(&raw)
	return raw, err
}

func shipmentJSON(ctx context.Context, tx pgx.Tx, clinic, id string) (json.RawMessage, error) {
	var raw []byte
	err := tx.QueryRow(ctx, "SELECT to_jsonb(v) FROM ("+shipmentSelect+" WHERE h.id=$1 AND h.clinic_id=$2) v", id, clinic).Scan(&raw)
	return raw, err
}

// deductLotsAt is deductLots scoped to one stock location (central or sala).
func deductLotsAt(ctx context.Context, tx pgx.Tx, clinic, item, location, reason, ref, actor string, qty int) error {
	rows, err := tx.Query(ctx, "SELECT id,qty FROM stock_lots WHERE item_id=$1 AND clinic_id=$2 AND location=$3 AND qty>0 ORDER BY expiry NULLS LAST,id FOR UPDATE", item, clinic, location)
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

type retailLineInput struct {
	ProductID string `json:"productId"`
	Qty       int    `json:"qty"`
}

type checkoutInput struct {
	Items    []retailLineInput `json:"items"`
	OwnerRUT string            `json:"ownerRut"`
	Payment  string            `json:"payment"`
	Delivery *struct {
		Courier string `json:"courier"`
		Address string `json:"address"`
	} `json:"delivery"`
}

var retailCouriers = map[string]bool{"Reparto propio": true, "Pedidos Ya Envíos": true, "Chilexpress": true}

// deliveryFeeNet is the fixed 3990 gross fee expressed in net CLP.
const deliveryFeeNet = int64(3353)

func (s *Server) listRetailSales(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	if err = s.permitted(r.Context(), a, "tienda.vender"); err != nil {
		// Sales history also feeds financial reports.
		if err2 := s.permitted(r.Context(), a, "reportes.financiero"); err2 != nil {
			return err
		}
	}
	q := saleSelect + ` WHERE s.clinic_id=$1`
	args := []any{a.ClinicID}
	if v := r.URL.Query().Get("ownerRut"); v != "" {
		rut, e := domain.NormalizeRUT(v)
		if e != nil {
			return fail(400, "invalid_rut", "RUT inválido")
		}
		var oid string
		if e = s.pool.QueryRow(r.Context(), "SELECT o.id FROM owners o JOIN clinic_owners co ON co.owner_id=o.id WHERE o.rut=$1 AND co.clinic_id=$2", rut, a.ClinicID).Scan(&oid); e != nil {
			return fail(404, "unknown_owner", "Dueño inexistente")
		}
		args = append(args, oid)
		q += " AND s.owner_id=$" + itoa(len(args))
	}
	if v := r.URL.Query().Get("payment"); v != "" {
		switch v {
		case "Efectivo", "Débito", "Crédito", "Transferencia":
		default:
			return fail(400, "invalid_method", "Medio de pago inválido")
		}
		args = append(args, v)
		q += " AND s.payment=$" + itoa(len(args))
	}
	if v := r.URL.Query().Get("from"); v != "" {
		if _, e := domain.CivilDate(v); e != nil {
			return fail(400, "invalid_date", "Fecha inválida")
		}
		args = append(args, v)
		q += " AND s.created_at>=$" + itoa(len(args)) + "::date"
	}
	if v := r.URL.Query().Get("to"); v != "" {
		if _, e := domain.CivilDate(v); e != nil {
			return fail(400, "invalid_date", "Fecha inválida")
		}
		args = append(args, v)
		q += " AND s.created_at<($" + itoa(len(args)) + "::date + interval '1 day')"
	}
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	var raw []byte
	err = s.pool.QueryRow(r.Context(), "SELECT coalesce(jsonb_agg(v),'[]') FROM ("+q+" ORDER BY s.number DESC,s.id LIMIT $"+itoa(len(args)+1)+" OFFSET $"+itoa(len(args)+2)+") v", append(args, limit, offset)...).Scan(&raw)
	if err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}

func itoa(n int) string {
	if n < 10 {
		return string(rune('0' + n))
	}
	return string(rune('0'+n/10)) + string(rune('0'+n%10))
}

func (s *Server) checkoutRetail(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in checkoutInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	switch in.Payment {
	case "Efectivo", "Débito", "Crédito", "Transferencia":
	default:
		return fail(400, "invalid_method", "Medio de pago inválido")
	}
	if len(in.Items) < 1 || len(in.Items) > 100 {
		return fail(400, "invalid_sale", "Venta inválida")
	}
	seen := map[string]bool{}
	for _, it := range in.Items {
		if !domain.ValidID(it.ProductID) || it.Qty < 1 || it.Qty > 1000000 || seen[it.ProductID] {
			return fail(400, "invalid_sale", "Líneas inválidas o duplicadas")
		}
		seen[it.ProductID] = true
	}
	var ownerID *string
	var ownerSector, ownerAddress string
	if in.OwnerRUT != "" {
		rut, e := domain.NormalizeRUT(in.OwnerRUT)
		if e != nil {
			return fail(400, "invalid_rut", "RUT inválido")
		}
		var oid string
		if e = s.pool.QueryRow(r.Context(), "SELECT o.id FROM owners o JOIN clinic_owners co ON co.owner_id=o.id WHERE o.rut=$1 AND co.clinic_id=$2", rut, a.ClinicID).Scan(&oid); e != nil {
			return fail(404, "unknown_owner", "Dueño inexistente")
		}
		if e = s.pool.QueryRow(r.Context(), "SELECT address,sector FROM owners WHERE id=$1", oid).Scan(&ownerAddress, &ownerSector); e != nil {
			return e
		}
		ownerID = &oid
	}
	fee := int64(0)
	var courier, address string
	if in.Delivery != nil {
		if !retailCouriers[in.Delivery.Courier] {
			return fail(400, "invalid_courier", "Courier desconocido")
		}
		if ownerID == nil {
			return fail(400, "delivery_owner_required", "El despacho exige cliente identificado")
		}
		fee = deliveryFeeNet
		courier = in.Delivery.Courier
		address = in.Delivery.Address
		if strings.TrimSpace(address) == "" {
			address = ownerAddress
		}
		if len(address) > 500 {
			return fail(400, "invalid_address", "Dirección inválida")
		}
	}
	return s.mutate(w, r, a, "tienda.vender", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		var net int64
		lines := make([]map[string]any, 0, len(in.Items))
		for _, it := range in.Items {
			var kind, name string
			var price int64
			var active bool
			if err := tx.QueryRow(r.Context(), "SELECT kind,name,price_net,active FROM catalog_items WHERE id=$1 AND clinic_id=$2", it.ProductID, a.ClinicID).Scan(&kind, &name, &price, &active); err != nil {
				if err == pgx.ErrNoRows {
					return nil, fail(404, "unknown_item", "Producto inexistente")
				}
				return nil, err
			}
			if kind != "product" {
				return nil, fail(404, "unknown_item", "Producto inexistente")
			}
			if !active {
				return nil, fail(409, "inactive_item", "Producto inactivo")
			}
			_ = name
			net += price * int64(it.Qty)
			lines = append(lines, map[string]any{"itemId": it.ProductID, "qty": it.Qty, "priceNet": price})
		}
		net += fee
		money, err := domain.MoneyFromNet(net)
		if err != nil {
			return nil, err
		}
		number, err := nextNumber(r.Context(), tx, a.ClinicID, "retail:sale")
		if err != nil {
			return nil, err
		}
		id := domain.UUID()
		if _, err = tx.Exec(r.Context(), "INSERT INTO retail_sales(id,clinic_id,number,owner_id,payment,delivery_fee_net,net,vat,total,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", id, a.ClinicID, number, ownerID, in.Payment, fee, money.Net, money.VAT, money.Total, a.UserID); err != nil {
			return nil, err
		}
		for _, ln := range lines {
			lid := domain.UUID()
			if _, err = tx.Exec(r.Context(), "INSERT INTO retail_sale_lines(id,sale_id,clinic_id,item_id,qty,unit_price_net) VALUES($1,$2,$3,$4,$5,$6)", lid, id, a.ClinicID, ln["itemId"], ln["qty"], ln["priceNet"]); err != nil {
				return nil, err
			}
			if err = deductLotsAt(r.Context(), tx, a.ClinicID, ln["itemId"].(string), "sala", "Venta", id, a.UserID, ln["qty"].(int)); err != nil {
				return nil, err
			}
		}
		if err = audit(r.Context(), tx, a, "sale.created", id, map[string]any{"number": number}); err != nil {
			return nil, err
		}
		saleRaw, err := saleJSON(r.Context(), tx, a.ClinicID, id)
		if err != nil {
			return nil, err
		}
		out := map[string]any{"sale": json.RawMessage(saleRaw)}
		if in.Delivery != nil {
			today := domain.LocalDate(domain.Now(r.Context()))
			scheduled, err := domain.AddDays(today, 1)
			if err != nil {
				return nil, err
			}
			hid := domain.UUID()
			if _, err = tx.Exec(r.Context(), "INSERT INTO shipments(id,clinic_id,sale_id,owner_id,address,sector,courier,scheduled_for) VALUES($1,$2,$3,$4,$5,$6,$7,$8::date)", hid, a.ClinicID, id, *ownerID, address, ownerSector, courier, scheduled); err != nil {
				return nil, err
			}
			if err = audit(r.Context(), tx, a, "shipment.created", hid, map[string]any{"sale": id}); err != nil {
				return nil, err
			}
			shipRaw, err := shipmentJSON(r.Context(), tx, a.ClinicID, hid)
			if err != nil {
				return nil, err
			}
			out["shipment"] = json.RawMessage(shipRaw)
		}
		return out, nil
	})
}

type transferInput struct {
	ProductID string `json:"productId"`
	Qty       int    `json:"qty"`
}

func (s *Server) transferToSala(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in transferInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if !domain.ValidID(in.ProductID) || in.Qty < 1 || in.Qty > 1000000 {
		return fail(400, "invalid_transfer", "Transferencia inválida")
	}
	return s.mutate(w, r, a, "tienda.inventario", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		var kind string
		var active bool
		if err := tx.QueryRow(r.Context(), "SELECT kind,active FROM catalog_items WHERE id=$1 AND clinic_id=$2", in.ProductID, a.ClinicID).Scan(&kind, &active); err != nil {
			if err == pgx.ErrNoRows {
				return nil, fail(404, "unknown_item", "Producto inexistente")
			}
			return nil, err
		}
		if kind != "product" {
			return nil, fail(404, "unknown_item", "Producto inexistente")
		}
		if !active {
			return nil, fail(409, "inactive_item", "Producto inactivo")
		}
		rows, err := tx.Query(r.Context(), "SELECT id,qty FROM stock_lots WHERE item_id=$1 AND clinic_id=$2 AND location='central' AND qty>0 ORDER BY expiry NULLS LAST,id FOR UPDATE", in.ProductID, a.ClinicID)
		if err != nil {
			return nil, err
		}
		need := in.Qty
		type take struct {
			lotID string
			qty   int
		}
		var takes []take
		for rows.Next() && need > 0 {
			var lotID string
			var have int
			if err = rows.Scan(&lotID, &have); err != nil {
				rows.Close()
				return nil, err
			}
			n := have
			if n > need {
				n = need
			}
			takes = append(takes, take{lotID, n})
			need -= n
		}
		rows.Close()
		if err = rows.Err(); err != nil {
			return nil, err
		}
		if need > 0 {
			return nil, fail(409, "insufficient_stock", "Sin saldo en central")
		}
		for _, t := range takes {
			if _, err = tx.Exec(r.Context(), "UPDATE stock_lots SET qty=qty-$2 WHERE id=$1", t.lotID, t.qty); err != nil {
				return nil, err
			}
			if _, err = tx.Exec(r.Context(), "INSERT INTO inventory_movements(clinic_id,item_id,lot_id,qty,reason,actor_id) VALUES($1,$2,$3,$4,'Transferencia',$5)", a.ClinicID, in.ProductID, t.lotID, -t.qty, a.UserID); err != nil {
				return nil, err
			}
		}
		// Merge into one sala lot per source lot label, or create it.
		for _, t := range takes {
			var lot, expiry any
			var cost int64
			if err = tx.QueryRow(r.Context(), "SELECT lot,expiry,unit_cost FROM stock_lots WHERE id=$1", t.lotID).Scan(&lot, &expiry, &cost); err != nil {
				return nil, err
			}
			var salaID string
			err = tx.QueryRow(r.Context(), `INSERT INTO stock_lots(clinic_id,item_id,location,lot,expiry,qty,unit_cost) VALUES($1,$2,'sala',$3,$4,$5,$6)
 ON CONFLICT(item_id,location,lot) DO UPDATE SET qty=stock_lots.qty+excluded.qty RETURNING id`, a.ClinicID, in.ProductID, lot, expiry, t.qty, cost).Scan(&salaID)
			if err != nil {
				return nil, err
			}
			if _, err = tx.Exec(r.Context(), "INSERT INTO inventory_movements(clinic_id,item_id,lot_id,qty,reason,actor_id) VALUES($1,$2,$3,$4,'Transferencia',$5)", a.ClinicID, in.ProductID, salaID, t.qty, a.UserID); err != nil {
				return nil, err
			}
		}
		if err = audit(r.Context(), tx, a, "inventory.transferred", in.ProductID, in); err != nil {
			return nil, err
		}
		return map[string]any{"productId": in.ProductID, "qty": in.Qty, "to": "sala"}, nil
	})
}

type retailAdjustInput struct {
	LotID  string `json:"lotId"`
	Qty    int    `json:"qty"`
	Reason string `json:"reason"`
}

func (s *Server) adjustRetail(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in retailAdjustInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if !domain.ValidID(in.LotID) || in.Qty == 0 || in.Qty < -1000000 || in.Qty > 1000000 {
		return fail(400, "invalid_adjustment", "Ajuste inválido")
	}
	if in.Reason != "Merma" && in.Reason != "Conteo" {
		return fail(400, "invalid_adjustment", "Solo Merma o Conteo")
	}
	if in.Reason == "Merma" && in.Qty >= 0 {
		return fail(400, "invalid_adjustment", "La merma es una salida")
	}
	return s.mutate(w, r, a, "tienda.inventario", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		var qty int
		var item string
		if err := tx.QueryRow(r.Context(), "SELECT l.qty,l.item_id FROM stock_lots l JOIN catalog_items c ON c.id=l.item_id WHERE l.id=$1 AND l.clinic_id=$2 AND c.kind='product' AND l.location IN ('central','sala') FOR UPDATE OF l", in.LotID, a.ClinicID).Scan(&qty, &item); err != nil {
			return nil, err
		}
		if qty+in.Qty < 0 {
			return nil, fail(409, "insufficient_stock", "Stock insuficiente")
		}
		if _, err := tx.Exec(r.Context(), "UPDATE stock_lots SET qty=qty+$2 WHERE id=$1", in.LotID, in.Qty); err != nil {
			return nil, err
		}
		id := domain.UUID()
		if _, err := tx.Exec(r.Context(), "INSERT INTO inventory_movements(id,clinic_id,item_id,lot_id,qty,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)", id, a.ClinicID, item, in.LotID, in.Qty, in.Reason, a.UserID); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "inventory.adjusted", id, in); err != nil {
			return nil, err
		}
		return map[string]any{"id": id, "lotId": in.LotID, "itemId": item, "qty": in.Qty, "reason": in.Reason}, nil
	})
}

func (s *Server) listShipments(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	if err = s.permitted(r.Context(), a, "tienda.inventario"); err != nil {
		return err
	}
	q := shipmentSelect + ` WHERE h.clinic_id=$1`
	args := []any{a.ClinicID}
	if v := r.URL.Query().Get("status"); v != "" {
		switch v {
		case "Por preparar", "Preparado", "En ruta", "Entregado":
		default:
			return fail(400, "invalid_status", "Estado inválido")
		}
		args = append(args, v)
		q += " AND h.status=$2"
	}
	if v := r.URL.Query().Get("date"); v != "" {
		if _, e := domain.CivilDate(v); e != nil {
			return fail(400, "invalid_date", "Fecha inválida")
		}
		args = append(args, v)
		q += " AND h.scheduled_for=$" + itoa(len(args)) + "::date"
	}
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	var raw []byte
	err = s.pool.QueryRow(r.Context(), "SELECT coalesce(jsonb_agg(v),'[]') FROM ("+q+" ORDER BY h.scheduled_for,h.created_at,h.id LIMIT $"+itoa(len(args)+1)+" OFFSET $"+itoa(len(args)+2)+") v", append(args, limit, offset)...).Scan(&raw)
	if err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}

var shipmentFlow = map[string]string{"Por preparar": "Preparado", "Preparado": "En ruta", "En ruta": "Entregado"}

func (s *Server) advanceShipment(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if !domain.ValidID(id) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	return s.mutate(w, r, a, "tienda.inventario", map[string]string{"id": id}, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var status string
		if err := tx.QueryRow(r.Context(), "SELECT status FROM shipments WHERE id=$1 AND clinic_id=$2 FOR UPDATE", id, a.ClinicID).Scan(&status); err != nil {
			return nil, err
		}
		next, ok := shipmentFlow[status]
		if !ok {
			return nil, fail(409, "already_delivered", "El despacho ya fue entregado")
		}
		if _, err := tx.Exec(r.Context(), "UPDATE shipments SET status=$2, delivered_at=CASE WHEN $2='Entregado' THEN now() ELSE delivered_at END WHERE id=$1", id, next); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "shipment.advanced", id, map[string]any{"status": next}); err != nil {
			return nil, err
		}
		return shipmentJSON(r.Context(), tx, a.ClinicID, id)
	})
}
