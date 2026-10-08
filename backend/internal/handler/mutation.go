package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
)

type mutation func(pgx.Tx, Actor) (any, error)

// Serialize writes per clinic for the initial single-VPS deployment. This also
// makes last-admin checks and multi-resource operations safe against races.
func (s *Server) mutate(w http.ResponseWriter, r *http.Request, a Actor, permission string, input any, status int, fn mutation) error {
	key := r.Header.Get("Idempotency-Key")
	if len(key) < 8 || len(key) > 128 || strings.ContainsAny(key, "\r\n") {
		return fail(400, "idempotency_required", "Envía Idempotency-Key de 8 a 128 caracteres")
	}
	body, err := json.Marshal(input)
	if err != nil {
		return err
	}
	hash := digest(string(body))
	op := r.Method + " " + r.URL.Path
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	cookie, err := r.Cookie("vetdata_access")
	if err != nil {
		return fail(401, "unauthenticated", "Inicia sesión")
	}
	if _, err = tx.Exec(r.Context(), "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", a.ClinicID); err != nil {
		return err
	}
	err = tx.QueryRow(r.Context(), `SELECT m.role FROM auth_sessions s JOIN users u ON u.id=s.user_id
 JOIN memberships m ON m.user_id=s.user_id AND m.clinic_id=s.clinic_id
 WHERE s.id=$1 AND s.clinic_id=$2 AND s.access_hash=$3 AND s.revoked_at IS NULL AND s.access_expires_at>now() AND s.expires_at>now() AND u.status='Activo' AND m.status='Activo'`, a.SessionID, a.ClinicID, digest(cookie.Value)).Scan(&a.Role)
	if err == pgx.ErrNoRows {
		return fail(401, "unauthenticated", "Sesión inválida")
	}
	if err != nil {
		return err
	}
	if permission != "" {
		var ok bool
		if err = tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM role_permissions WHERE clinic_id=$1 AND role=$2 AND permission=$3)", a.ClinicID, a.Role, permission).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return fail(403, "forbidden", "No tienes permiso para esta operación")
		}
	}
	var savedHash string
	var response []byte
	var savedStatus int
	err = tx.QueryRow(r.Context(), "SELECT request_hash,response,status FROM idempotency_keys WHERE clinic_id=$1 AND actor_id=$2 AND operation=$3 AND key=$4", a.ClinicID, a.UserID, op, key).Scan(&savedHash, &response, &savedStatus)
	if err == nil {
		if savedHash != hash {
			return fail(409, "idempotency_conflict", "La clave ya se usó con otros datos")
		}
		writeJSON(w, savedStatus, json.RawMessage(response))
		return nil
	}
	if err != pgx.ErrNoRows {
		return err
	}
	result, err := fn(tx, a)
	if err != nil {
		return err
	}
	response, err = json.Marshal(result)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(r.Context(), "INSERT INTO idempotency_keys(clinic_id,actor_id,key,operation,request_hash,response,status) VALUES($1,$2,$3,$4,$5,$6,$7)", a.ClinicID, a.UserID, key, op, hash, response, status); err != nil {
		return err
	}
	if err = tx.Commit(r.Context()); err != nil {
		return err
	}
	writeJSON(w, status, json.RawMessage(response))
	return nil
}
func page(r *http.Request) (limit, offset int, err error) {
	limit = 50
	if s := r.URL.Query().Get("limit"); s != "" {
		limit, err = strconv.Atoi(s)
		if err != nil || limit < 1 || limit > 200 {
			return 0, 0, fail(400, "pagination", "limit debe estar entre 1 y 200")
		}
	}
	if s := r.URL.Query().Get("offset"); s != "" {
		offset, err = strconv.Atoi(s)
		if err != nil || offset < 0 || offset > 100000 {
			return 0, 0, fail(400, "pagination", "offset inválido")
		}
	}
	return limit, offset, nil
}
func nextNumber(ctx context.Context, tx pgx.Tx, clinic, kind string) (int64, error) {
	var n int64
	err := tx.QueryRow(ctx, "INSERT INTO counters(clinic_id,kind,value) VALUES($1,$2,1) ON CONFLICT(clinic_id,kind) DO UPDATE SET value=counters.value+1 RETURNING value", clinic, kind).Scan(&n)
	return n, err
}
