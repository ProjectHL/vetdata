package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
)

// Attachments are metadata only: the byte storage (S3/folder) is deferred.
// Visibility inherits the parent record rule: summary scope only reaches
// vaccine attachments, and shared clinics only see moderated (clean) files.
func (s *Server) attachmentRoutes(m *http.ServeMux) {
	s.route(m, "GET /api/v1/patients/{pid}/records/{rid}/attachments", s.listAttachments)
	s.route(m, "POST /api/v1/patients/{pid}/records/{rid}/attachments", s.registerAttachment)
	s.route(m, "PATCH /api/v1/attachments/{id}", s.moderateAttachment)
}

const attachmentSelect = `SELECT t.id,t.patient_id AS "patientId",t.record_id AS "recordId",t.storage_key AS "storageKey",t.mime_type AS "mimeType",t.size_bytes AS "sizeBytes",t.status,t.clinic_id AS "clinicId",t.actor_id AS "actorId",t.created_at AS "createdAt" FROM attachments t`

func (s *Server) listAttachments(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	pid := r.PathValue("pid")
	rid := r.PathValue("rid")
	if !domain.ValidID(pid) || !domain.ValidID(rid) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(r.Context())
	v, err := patientAccess(r.Context(), tx, a, pid)
	if err != nil {
		return err
	}
	var kind string
	if err = tx.QueryRow(r.Context(), "SELECT kind FROM clinical_records WHERE id=$1 AND patient_id=$2", rid, pid).Scan(&kind); err != nil {
		return err
	}
	query := attachmentSelect + ` JOIN clinical_records r ON r.id=t.record_id WHERE t.patient_id=$1 AND t.record_id=$2 AND ($3 OR r.kind='vaccine') AND ($4 OR t.status='clean') ORDER BY t.created_at,t.id`
	full := v.Level == "propio" || (v.Level == "compartido" && v.Scope == "Ficha completa")
	own := v.Level == "propio"
	limit, offset, err := page(r)
	if err != nil {
		return err
	}
	var raw []byte
	err = tx.QueryRow(r.Context(), "SELECT coalesce(jsonb_agg(v),'[]') FROM ("+query+" LIMIT $5 OFFSET $6) v", pid, rid, full, own, limit, offset).Scan(&raw)
	if err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	writeJSON(w, 200, json.RawMessage(raw))
	return nil
}

type attachmentInput struct {
	StorageKey string `json:"storageKey"`
	MimeType   string `json:"mimeType"`
	SizeBytes  int    `json:"sizeBytes"`
}

func (s *Server) registerAttachment(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	pid := r.PathValue("pid")
	rid := r.PathValue("rid")
	if !domain.ValidID(pid) || !domain.ValidID(rid) {
		return fail(400, "invalid_id", "Identificador inválido")
	}
	var in attachmentInput
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if len(strings.TrimSpace(in.StorageKey)) == 0 || len(in.StorageKey) > 512 {
		return fail(400, "invalid_attachment", "Clave de almacenamiento inválida")
	}
	if in.MimeType != "application/pdf" && in.MimeType != "image/jpeg" && in.MimeType != "image/png" {
		return fail(400, "invalid_attachment", "Tipo de archivo no permitido")
	}
	if in.SizeBytes < 1 || in.SizeBytes > 10485760 {
		return fail(400, "invalid_attachment", "Tamaño inválido")
	}
	return s.mutate(w, r, a, "ficha.editar", in, 201, func(tx pgx.Tx, a Actor) (any, error) {
		if err := writablePatient(r.Context(), tx, a, pid); err != nil {
			return nil, err
		}
		var kind string
		if err := tx.QueryRow(r.Context(), "SELECT kind FROM clinical_records WHERE id=$1 AND patient_id=$2", rid, pid).Scan(&kind); err != nil {
			return nil, err
		}
		id := domain.UUID()
		if _, err := tx.Exec(r.Context(), "INSERT INTO attachments(id,patient_id,record_id,clinic_id,storage_key,mime_type,size_bytes,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", id, pid, rid, a.ClinicID, in.StorageKey, in.MimeType, in.SizeBytes, a.UserID); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "attachment.registered", id, map[string]string{"record": rid}); err != nil {
			return nil, err
		}
		var raw []byte
		if err := tx.QueryRow(r.Context(), "SELECT to_jsonb(v) FROM ("+attachmentSelect+" WHERE t.id=$1 AND t.clinic_id=$2) v", id, a.ClinicID).Scan(&raw); err != nil {
			return nil, err
		}
		return json.RawMessage(raw), nil
	})
}

func (s *Server) moderateAttachment(w http.ResponseWriter, r *http.Request) error {
	a, err := s.actor(r)
	if err != nil {
		return err
	}
	id, err := pathID(r)
	if err != nil {
		return err
	}
	var in struct {
		Status string `json:"status"`
	}
	if err = decode(w, r, &in); err != nil {
		return err
	}
	if in.Status != "clean" && in.Status != "rejected" {
		return fail(400, "invalid_status", "Estado inválido")
	}
	return s.mutate(w, r, a, "ficha.editar", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		var pid, status string
		if err := tx.QueryRow(r.Context(), "SELECT patient_id,status FROM attachments WHERE id=$1 AND clinic_id=$2 FOR UPDATE", id, a.ClinicID).Scan(&pid, &status); err != nil {
			return nil, err
		}
		if status != "quarantine" {
			return nil, fail(409, "terminal_attachment", "El adjunto ya fue moderado")
		}
		if err := writablePatient(r.Context(), tx, a, pid); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(r.Context(), "UPDATE attachments SET status=$2 WHERE id=$1", id, in.Status); err != nil {
			return nil, err
		}
		if err := audit(r.Context(), tx, a, "attachment.moderated", id, map[string]string{"status": in.Status}); err != nil {
			return nil, err
		}
		var raw []byte
		if err := tx.QueryRow(r.Context(), "SELECT to_jsonb(v) FROM ("+attachmentSelect+" WHERE t.id=$1 AND t.clinic_id=$2) v", id, a.ClinicID).Scan(&raw); err != nil {
			return nil, err
		}
		return json.RawMessage(raw), nil
	})
}
