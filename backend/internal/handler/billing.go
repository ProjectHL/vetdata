package handler

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
)

func (s *Server) billingRoutes(m *http.ServeMux) {
	s.route(m, "GET /api/v1/invoices", s.listInvoices)
	s.route(m, "POST /api/v1/invoices", s.createInvoice)
}

const invoiceSelect = `SELECT i.id,i.owner_id AS "ownerId",i.patient_id AS "patientId",i.number,i.net,i.vat,i.total,i.paid,i.items,i.created_at AS "createdAt",i.actor_id AS "actorId" FROM invoices i`

func (s *Server) listInvoices(w http.ResponseWriter, r *http.Request) error {
	return s.scopedList(w, r, "facturas.emitir", invoiceSelect+` WHERE i.clinic_id=$1 ORDER BY i.number DESC,i.id`)
}

type invoiceLineInput struct {
	ItemID   string `json:"itemId"`
	Qty      int    `json:"qty"`
	Discount int    `json:"discount"`
}

type invoiceInput struct {
	OwnerID   string             `json:"ownerId"`
	PatientID *string            `json:"patientId"`
	Lines     []invoiceLineInput `json:"lines"`
}

func (s *Server) createInvoice(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in invoiceInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if !domain.ValidID(in.OwnerID) || len(in.Lines) == 0 || len(in.Lines) > 100 {
		return fail(400, "invalid_invoice", "Factura inválida")
	}
	if in.PatientID != nil && !domain.ValidID(*in.PatientID) {
		return fail(400, "invalid_invoice", "Paciente inválido")
	}
	for _, line := range in.Lines {
		if !domain.ValidID(line.ItemID) || line.Qty < 1 || line.Qty > 1000000 || line.Discount < 0 || line.Discount > 100 {
			return fail(400, "invalid_invoice", "Línea inválida")
		}
	}
	return s.mutate(w, r, a, "facturas.emitir", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		var linked bool
		if err := tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM clinic_owners WHERE clinic_id=$1 AND owner_id=$2)", a.ClinicID, in.OwnerID).Scan(&linked); err != nil {
			return nil, err
		}
		if !linked {
			return nil, pgx.ErrNoRows
		}
		if in.PatientID != nil {
			if _, err := patientAccess(r.Context(), tx, a, *in.PatientID); err != nil {
				return nil, err
			}
			var owner string
			if err := tx.QueryRow(r.Context(), "SELECT owner_id FROM patients WHERE id=$1", *in.PatientID).Scan(&owner); err != nil {
				return nil, err
			}
			if owner != in.OwnerID {
				return nil, fail(400, "owner_mismatch", "La mascota no es de ese dueño")
			}
		}
		id := domain.UUID()
		var net int64
		snapshot := make([]map[string]any, 0, len(in.Lines))
		var controlled []string
		for _, line := range in.Lines {
			var kind, name string
			var price int64
			var active, rx bool
			if err := tx.QueryRow(r.Context(), "SELECT kind,name,price_net,active,prescription_required FROM catalog_items WHERE id=$1 AND clinic_id=$2", line.ItemID, a.ClinicID).Scan(&kind, &name, &price, &active, &rx); err != nil {
				if err == pgx.ErrNoRows {
					return nil, fail(404, "unknown_item", "Ítem inexistente")
				}
				return nil, err
			}
			if !active {
				return nil, fail(409, "inactive_item", "Ítem inactivo")
			}
			lineNet, err := domain.DiscountedLine(price, int64(line.Qty), int64(line.Discount))
			if err != nil {
				return nil, fail(400, "invalid_invoice", "Línea inválida")
			}
			net += lineNet
			snapshot = append(snapshot, map[string]any{"itemId": line.ItemID, "kind": kind, "name": name, "qty": line.Qty, "priceNet": price, "discount": line.Discount, "lineNet": lineNet})
			if kind == "service" {
				continue
			}
			if rx {
				controlled = append(controlled, line.ItemID)
			}
			if err := deductLots(r.Context(), tx, a.ClinicID, line.ItemID, "Venta", id, a.UserID, line.Qty); err != nil {
				return nil, err
			}
			continue
		}
		if len(controlled) > 0 {
			if in.PatientID == nil {
				return nil, fail(409, "prescription_patient_required", "El medicamento con receta exige mascota en la factura")
			}
			today := domain.LocalDate(domain.Now(r.Context()))
			consumed := make([]string, 0, len(controlled))
			for _, item := range controlled {
				var ref string
				err := tx.QueryRow(r.Context(), `SELECT r.id::text FROM referrals r WHERE r.clinic_id=$1 AND r.patient_id=$2
 AND r.status='Dispensada' AND r.expires_on>=$3::date AND r.invoiced_at IS NULL
 AND r.items @> jsonb_build_array(jsonb_build_object('itemId',$4::text))
 AND NOT EXISTS(SELECT 1 FROM clinical_records x WHERE x.corrects_id=r.prescription_id AND x.kind IN ('correction','annulment'))`,
					a.ClinicID, *in.PatientID, today, item).Scan(&ref)
				if err != nil {
					if err == pgx.ErrNoRows {
						return nil, fail(409, "missing_prescription", "Falta derivación dispensada y vigente para ese medicamento")
					}
					return nil, err
				}
				consumed = append(consumed, ref)
			}
			if _, err := tx.Exec(r.Context(), "UPDATE referrals SET invoiced_at=now() WHERE clinic_id=$1 AND id=ANY($2::uuid[])", a.ClinicID, consumed); err != nil {
				return nil, err
			}
		}
		money, err := domain.MoneyFromNet(net)
		if err != nil {
			return nil, err
		}
		number, err := nextNumber(r.Context(), tx, a.ClinicID, "invoice")
		if err != nil {
			return nil, err
		}
		itemsRaw, err := json.Marshal(snapshot)
		if err != nil {
			return nil, err
		}
		if _, err = tx.Exec(r.Context(), "INSERT INTO invoices(id,clinic_id,owner_id,patient_id,number,net,vat,total,items,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", id, a.ClinicID, in.OwnerID, in.PatientID, number, money.Net, money.VAT, money.Total, itemsRaw, a.UserID); err != nil {
			return nil, err
		}
		if err = audit(r.Context(), tx, a, "invoice.created", id, map[string]any{"number": number}); err != nil {
			return nil, err
		}
		var raw []byte
		if err = tx.QueryRow(r.Context(), "SELECT to_jsonb(v) FROM ("+invoiceSelect+" WHERE i.id=$1 AND i.clinic_id=$2) v", id, a.ClinicID).Scan(&raw); err != nil {
			return nil, err
		}
		return json.RawMessage(raw), nil
	})
}
