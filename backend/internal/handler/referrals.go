package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
)

func (s *Server) referralRoutes(m *http.ServeMux) {
	s.route(m, "GET /api/v1/pharmacy/referrals", s.listReferrals)
	s.route(m, "POST /api/v1/pharmacy/referrals", s.createReferral)
	s.route(m, "POST /api/v1/pharmacy/referrals/{id}/dispense", s.dispenseReferral)
}

const referralSelect = `SELECT r.id,r.patient_id AS "patientId",r.prescription_id AS "prescriptionId",r.items,r.status,r.expires_on AS "expiresOn",r.actor_id AS "actorId",r.dispensed_at AS "dispensedAt",r.invoiced_at AS "invoicedAt",r.created_at AS "createdAt" FROM referrals r`

func referralJSON(ctx context.Context, tx pgx.Tx, clinic, id string) (json.RawMessage, error) {
	var raw []byte
	err := tx.QueryRow(ctx, "SELECT to_jsonb(v) FROM ("+referralSelect+" WHERE r.id=$1 AND r.clinic_id=$2) v", id, clinic).Scan(&raw)
	return raw, err
}

type referralItemInput struct {
	ItemID string `json:"itemId"`
	Qty    int    `json:"qty"`
}

type referralInput struct {
	PatientID      string              `json:"patientId"`
	PrescriptionID string              `json:"prescriptionId"`
	Items          []referralItemInput `json:"items"`
	ExpiresOn      string              `json:"expiresOn"`
}

func (s *Server) listReferrals(w http.ResponseWriter, r *http.Request) error {
	return s.scopedList(w, r, "farmacia.dispensar", referralSelect+` WHERE r.clinic_id=$1 ORDER BY r.created_at DESC,r.id`)
}

func (s *Server) createReferral(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	var in referralInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if !domain.ValidID(in.PatientID) || !domain.ValidID(in.PrescriptionID) || len(in.Items) == 0 || len(in.Items) > 50 {
		return fail(400, "invalid_referral", "Derivación inválida")
	}
	seen := map[string]bool{}
	for _, it := range in.Items {
		if !domain.ValidID(it.ItemID) || it.Qty < 1 || it.Qty > 1000000 || seen[it.ItemID] {
			return fail(400, "invalid_referral", "Líneas inválidas o duplicadas")
		}
		seen[it.ItemID] = true
	}
	return s.mutate(w, r, a, "medicamentos.derivar", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		if err := writablePatient(r.Context(), tx, a, in.PatientID); err != nil {
			return nil, err
		}
		var kind, patient string
		if err := tx.QueryRow(r.Context(), "SELECT kind,patient_id FROM clinical_records WHERE id=$1", in.PrescriptionID).Scan(&kind, &patient); err != nil {
			if err == pgx.ErrNoRows {
				return nil, fail(404, "unknown_prescription", "Receta inexistente")
			}
			return nil, err
		}
		if kind != "prescription" || patient != in.PatientID {
			return nil, fail(400, "prescription_mismatch", "La receta no corresponde a esa mascota")
		}
		for _, it := range in.Items {
			var itemKind string
			var active bool
			if err := tx.QueryRow(r.Context(), "SELECT kind,active FROM catalog_items WHERE id=$1 AND clinic_id=$2", it.ItemID, a.ClinicID).Scan(&itemKind, &active); err != nil {
				if err == pgx.ErrNoRows {
					return nil, fail(404, "unknown_item", "Ítem inexistente")
				}
				return nil, err
			}
			if itemKind != "medication" || !active {
				return nil, fail(409, "invalid_referral_item", "Solo medicamentos activos")
			}
		}
		today := domain.LocalDate(domain.Now(r.Context()))
		expires := in.ExpiresOn
		if expires == "" {
			var err error
			if expires, err = domain.AddDays(today, 30); err != nil {
				return nil, err
			}
		} else {
			if _, err := domain.CivilDate(expires); err != nil || expires < today {
				return nil, fail(400, "invalid_expiry", "Vencimiento inválido")
			}
		}
		itemsRaw, err := json.Marshal(in.Items)
		if err != nil {
			return nil, err
		}
		id := domain.UUID()
		if _, err = tx.Exec(r.Context(), "INSERT INTO referrals(id,clinic_id,patient_id,prescription_id,items,expires_on,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)", id, a.ClinicID, in.PatientID, in.PrescriptionID, itemsRaw, expires, a.UserID); err != nil {
			return nil, err
		}
		if err = audit(r.Context(), tx, a, "referral.created", id, map[string]string{}); err != nil {
			return nil, err
		}
		return referralJSON(r.Context(), tx, a.ClinicID, id)
	})
}

func (s *Server) dispenseReferral(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	return s.mutate(w, r, a, "farmacia.dispensar", struct{}{}, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var patient, prescription, status string
		var expires time.Time
		var items []byte
		if err := tx.QueryRow(r.Context(), "SELECT patient_id,prescription_id,status,expires_on,items FROM referrals WHERE id=$1 AND clinic_id=$2 FOR UPDATE", id, a.ClinicID).Scan(&patient, &prescription, &status, &expires, &items); err != nil {
			return nil, err
		}
		if status != "Enviada" {
			return nil, fail(409, "already_dispensed", "La derivación ya fue dispensada")
		}
		if domain.LocalDate(expires) < domain.LocalDate(domain.Now(r.Context())) {
			return nil, fail(409, "expired_referral", "La receta venció")
		}
		if err := writablePatient(r.Context(), tx, a, patient); err != nil {
			return nil, err
		}
		var annulled bool
		if err := tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM clinical_records WHERE corrects_id=$1 AND kind IN ('correction','annulment'))", prescription).Scan(&annulled); err != nil {
			return nil, err
		}
		if annulled {
			return nil, fail(409, "annulled_prescription", "La receta fue anulada o corregida")
		}
		var lines []referralItemInput
		if err := json.Unmarshal(items, &lines); err != nil {
			return nil, err
		}
		for _, line := range lines {
			var active bool
			if err := tx.QueryRow(r.Context(), "SELECT active FROM catalog_items WHERE id=$1 AND clinic_id=$2 AND kind='medication'", line.ItemID, a.ClinicID).Scan(&active); err != nil || !active {
				if err == pgx.ErrNoRows || !active {
					return nil, fail(409, "invalid_referral_item", "Ítem no disponible")
				}
				return nil, err
			}
			if err := deductLots(r.Context(), tx, a.ClinicID, line.ItemID, "Dispensación", id, a.UserID, line.Qty); err != nil {
				return nil, err
			}
		}
		if _, err := tx.Exec(r.Context(), "UPDATE referrals SET status='Dispensada',dispensed_at=now() WHERE id=$1", id); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "referral.dispensed", id, map[string]string{}); err != nil {
			return nil, err
		}
		return referralJSON(r.Context(), tx, a.ClinicID, id)
	})
}
