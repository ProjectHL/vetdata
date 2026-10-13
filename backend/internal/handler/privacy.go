package handler

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
	"net/http"
)

// Export contains only records authored/held by the active clinic. A grant is
// never an authorization to bulk export the origin clinic's clinical records.
func (s *Server) exportOwner(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		s.log.Info("privacy export denied", "reason", "session")
		return err
	}
	rut, err := domain.NormalizeRUT(r.PathValue("rut"))
	if err != nil {
		return fail(400, "invalid_rut", "RUT inválido")
	}
	tx, err := s.pool.BeginTx(r.Context(), pgx.TxOptions{IsoLevel: pgx.RepeatableRead})
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	deny := func(code int, reason string) error {
		if e := audit(r.Context(), tx, a, "privacy.export.denied", "", map[string]string{"reason": reason}); e != nil {
			return e
		}
		if e := tx.Commit(r.Context()); e != nil {
			return e
		}
		return fail(code, "export_denied", "Exportación no disponible")
	}
	if a.Role != "Admin" {
		return deny(403, "role")
	}
	var oid string
	err = tx.QueryRow(r.Context(), "SELECT o.id FROM owners o JOIN clinic_owners co ON co.owner_id=o.id WHERE co.clinic_id=$1 AND o.rut=$2", a.ClinicID, rut).Scan(&oid)
	if err == pgx.ErrNoRows {
		return deny(404, "scope")
	}
	if err != nil {
		return err
	}
	result := map[string]any{"version": "vetdata.owner-export.v1", "scope": "active-clinic", "clinicId": a.ClinicID, "generatedAt": domain.Now(r.Context())}
	queries := map[string]string{
		"dteDocuments":    `SELECT d.id,d.invoice_id,d.document_type,d.state,d.folio,d.document_ref,d.created_at FROM dte_documents d JOIN invoices i ON i.id=d.invoice_id AND i.clinic_id=d.clinic_id WHERE d.clinic_id=$1 AND i.owner_id=$2`,
		"owner":           `SELECT o.id,o.rut,o.first_name,o.last_name,o.email,o.phone,o.address,o.sector,o.region,o.birth_date,o.preferred_contact,co.balance,co.notes,co.reminder_opt_out FROM owners o JOIN clinic_owners co ON co.owner_id=o.id WHERE co.clinic_id=$1 AND o.id=$2`,
		"patients":        `SELECT p.* FROM patients p WHERE p.origin_clinic_id=$1 AND p.owner_id=$2`,
		"clinicalRecords": `SELECT c.* FROM clinical_records c JOIN patients p ON p.id=c.patient_id WHERE c.clinic_id=$1 AND p.owner_id=$2`,
		"appointments":    `SELECT a.* FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.clinic_id=$1 AND p.owner_id=$2`,
		"invoices":        `SELECT i.* FROM invoices i WHERE i.clinic_id=$1 AND i.owner_id=$2`,
		"payments":        `SELECT v.* FROM payments v JOIN invoices i ON i.id=v.invoice_id AND i.clinic_id=v.clinic_id WHERE v.clinic_id=$1 AND i.owner_id=$2`,
		"referrals":       `SELECT v.* FROM referrals v JOIN patients p ON p.id=v.patient_id WHERE v.clinic_id=$1 AND p.owner_id=$2`,
		"retailSales":     `SELECT v.* FROM retail_sales v WHERE v.clinic_id=$1 AND v.owner_id=$2`,
		"retailLines":     `SELECT v.* FROM retail_sale_lines v JOIN retail_sales s ON s.id=v.sale_id AND s.clinic_id=v.clinic_id WHERE v.clinic_id=$1 AND s.owner_id=$2`,
		"shipments":       `SELECT v.* FROM shipments v WHERE v.clinic_id=$1 AND v.owner_id=$2`,
		"attachments":     `SELECT v.id,v.patient_id,v.record_id,v.mime_type,v.size_bytes,v.status,v.created_at FROM attachments v JOIN patients p ON p.id=v.patient_id WHERE v.clinic_id=$1 AND p.owner_id=$2`,
	}
	counts := map[string]int{}
	totalBytes := 0
	for name, query := range queries {
		var raw []byte
		var rows, size int64
		bounded := "WITH export_rows AS MATERIALIZED (" + query + " ORDER BY 1 LIMIT 10001), stats AS (SELECT count(*) AS n,coalesce(sum(octet_length(row_to_json(v)::text)),0)::bigint AS bytes FROM export_rows v) SELECT n,bytes,CASE WHEN n<=10000 AND bytes<=20971520 THEN (SELECT coalesce(jsonb_agg(v),'[]'::jsonb) FROM export_rows v) ELSE '[]'::jsonb END FROM stats"
		if err = tx.QueryRow(r.Context(), bounded, a.ClinicID, oid).Scan(&rows, &size, &raw); err != nil {
			return err
		}
		totalBytes += len(raw)
		if rows > 10000 || size > 20<<20 || totalBytes > 20<<20 {
			return deny(409, "manual_export_required")
		}
		var items []json.RawMessage
		if err = json.Unmarshal(raw, &items); err != nil {
			return err
		}
		if len(items) > 10000 {
			return deny(409, "manual_export_required")
		}
		counts[name] = len(items)
		result[name] = items
	}
	if err = audit(r.Context(), tx, a, "privacy.export.completed", oid, map[string]any{"version": "v1", "counts": counts}); err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	w.Header().Set("Content-Disposition", `attachment; filename="owner-export.json"`)
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, result)
	return nil
}
