package handler

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vetdata/api/internal/domain"
	"github.com/vetdata/api/internal/notifications"
)

type Options struct {
	Origin        string
	SecureCookies bool
	Mail          *notifications.Outbox
	Now           func() time.Time
	// StatusRules is the JSON PatientStatus policy (PATIENT_STATUS_RULES).
	// Empty means the compiled default; invalid falls back to it with a warning.
	StatusRules string
}
type Server struct {
	pool       *pgxpool.Pool
	log        *slog.Logger
	opt        Options
	statusRule domain.StatusRules
}
type Actor struct{ SessionID, UserID, ClinicID, Role string }
type apiError struct {
	Status        int
	Code, Message string
	Details       any
}

func (e *apiError) Error() string { return e.Message }
func fail(status int, code, message string) error {
	return &apiError{Status: status, Code: code, Message: message}
}

type endpoint func(http.ResponseWriter, *http.Request) error

func New(pool *pgxpool.Pool, logger *slog.Logger) http.Handler {
	return NewWithOptions(pool, logger, Options{Origin: "http://localhost:3000"})
}
func NewWithOptions(pool *pgxpool.Pool, logger *slog.Logger, opt Options) http.Handler {
	if opt.Now == nil {
		opt.Now = time.Now
	}
	s := &Server{pool: pool, log: logger, opt: opt}
	rules, err := domain.ParsePatientStatusRules(opt.StatusRules)
	if err != nil {
		logger.Warn("invalid status rules, using default", "error", err)
		rules = domain.DefaultPatientStatusRules()
	}
	s.statusRule = rules
	mux := http.NewServeMux()
	s.route(mux, "GET /healthz", s.health)
	s.route(mux, "GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) error {
		writeJSON(w, 200, map[string]string{"status": "ok", "service": "vetdata-api"})
		return nil
	})
	s.authRoutes(mux)
	s.settingsRoutes(mux)
	s.clinicalRoutes(mux)
	s.sharingRoutes(mux)
	s.tasksRoutes(mux)
	s.operationsRoutes(mux)
	s.supportRoutes(mux)
	s.adminRoutes(mux)
	s.route(mux, "/", func(w http.ResponseWriter, r *http.Request) error {
		return fail(404, "not_found", "Recurso no encontrado")
	})
	return s.middleware(mux)
}
func (s *Server) route(m *http.ServeMux, pattern string, f endpoint) {
	m.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
		if err := f(w, r); err != nil {
			s.respondError(w, err)
		}
	})
}
func (s *Server) respondError(w http.ResponseWriter, err error) {
	e := &apiError{Status: 500, Code: "internal_error", Message: "No fue posible completar la operación"}
	var known *apiError
	var pg *pgconn.PgError
	if errors.As(err, &known) {
		e = known
	} else if errors.Is(err, pgx.ErrNoRows) {
		e = &apiError{Status: 404, Code: "not_found", Message: "Recurso no encontrado"}
	} else if errors.As(err, &pg) {
		switch pg.Code {
		case "23505", "23P01", "40001", "40P01":
			e = &apiError{Status: 409, Code: "conflict", Message: "La operación entra en conflicto con el estado actual"}
		case "23503", "23514", "22P02":
			e = &apiError{Status: 400, Code: "invalid_input", Message: "Datos inválidos"}
		}
	}
	if e.Status == 500 {
		// Database error details can contain RUTs, emails or token hashes.
		code := "internal"
		if pg != nil {
			code = pg.Code
		}
		s.log.Error("request failed", "class", code, "requestId", w.Header().Get("X-Request-ID"))
	}
	body := map[string]any{"code": e.Code, "message": e.Message}
	if e.Details != nil {
		body["details"] = e.Details
	}
	writeJSON(w, e.Status, map[string]any{"error": body})
}
func decode(w http.ResponseWriter, r *http.Request, v any) error {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return fail(415, "content_type", "Se requiere application/json")
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return fail(400, "invalid_json", "JSON inválido o campos no permitidos")
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		return fail(400, "invalid_json", "Se requiere un único objeto JSON")
	}
	return nil
}
func (s *Server) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Request-ID", domain.UUID())
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		origin := r.Header.Get("Origin")
		if origin == s.opt.Origin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Add("Vary", "Origin")
		}
		if r.Method == "OPTIONS" {
			if origin != s.opt.Origin {
				s.respondError(w, fail(403, "origin", "Origen no permitido"))
				return
			}
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS")
			w.WriteHeader(204)
			return
		}
		if r.Method != "GET" && r.Method != "HEAD" && origin != s.opt.Origin {
			s.respondError(w, fail(403, "origin", "Origen no permitido"))
			return
		}
		ctx, cancel := context.WithTimeout(domain.WithNow(r.Context(), s.opt.Now()), 15*time.Second)
		defer cancel()
		defer func() {
			if recover() != nil {
				s.log.Error("request panic")
				s.respondError(w, errors.New("handler panic"))
			}
		}()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
func (s *Server) health(w http.ResponseWriter, r *http.Request) error {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.pool.Ping(ctx); err != nil {
		return fail(503, "database_unavailable", "Base de datos no disponible")
	}
	writeJSON(w, 200, map[string]string{"status": "ok"})
	return nil
}
func token() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func digest(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }
func (s *Server) actor(r *http.Request) (Actor, error) {
	var a Actor
	cookie, err := r.Cookie("vetdata_access")
	if err != nil {
		return a, fail(401, "unauthenticated", "Inicia sesión")
	}
	err = s.pool.QueryRow(r.Context(), `SELECT s.id,s.user_id,s.clinic_id,m.role FROM auth_sessions s
 JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=s.user_id AND m.clinic_id=s.clinic_id
 WHERE s.access_hash=$1 AND s.revoked_at IS NULL AND s.access_expires_at>now() AND s.expires_at>now() AND u.status='Activo' AND m.status='Activo'`, digest(cookie.Value)).Scan(&a.SessionID, &a.UserID, &a.ClinicID, &a.Role)
	if err == pgx.ErrNoRows {
		return a, fail(401, "unauthenticated", "Sesión inválida o expirada")
	}
	return a, err
}
func (s *Server) permitted(ctx context.Context, a Actor, perm string) error {
	var ok bool
	err := s.pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM role_permissions WHERE clinic_id=$1 AND role=$2 AND permission=$3)", a.ClinicID, a.Role, perm).Scan(&ok)
	if err != nil {
		return err
	}
	if !ok {
		return fail(403, "forbidden", "No tienes permiso para esta operación")
	}
	return nil
}
func (s *Server) limited(r *http.Request, category, subject string, limit int, window time.Duration) error {
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	key := category + ":" + digest(ip+":"+strings.ToLower(strings.TrimSpace(subject)))
	var hits int
	err := s.pool.QueryRow(r.Context(), `INSERT INTO rate_limits(key,hits,expires_at) VALUES($1,1,now()+$2::interval)
 ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.expires_at<=now() THEN 1 ELSE rate_limits.hits+1 END,
 expires_at=CASE WHEN rate_limits.expires_at<=now() THEN excluded.expires_at ELSE rate_limits.expires_at END RETURNING hits`, key, window.String()).Scan(&hits)
	if err != nil {
		return err
	}
	if hits > limit {
		return fail(429, "rate_limit", "Demasiados intentos; intenta más tarde")
	}
	return nil
}
func audit(ctx context.Context, tx pgx.Tx, a Actor, action, id string, details any) error {
	raw, err := json.Marshal(details)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, "INSERT INTO audit_events(clinic_id,actor_id,action,resource_id,details) VALUES($1,$2,$3,$4,$5)", a.ClinicID, a.UserID, action, id, raw)
	return err
}
func pathID(r *http.Request) (string, error) {
	id := r.PathValue("id")
	if !domain.ValidID(id) {
		return "", fail(400, "invalid_id", "Identificador inválido")
	}
	return id, nil
}
