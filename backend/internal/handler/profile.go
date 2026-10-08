package handler

import (
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"github.com/vetdata/api/internal/domain"
	"net/http"
	"net/mail"
	"strings"
)

type profileInput struct {
	LegalName string `json:"legalName"`
	RUT       string `json:"rut"`
	Address   string `json:"address"`
	Sector    string `json:"sector"`
	Phone     string `json:"phone"`
	Email     string `json:"email"`
}

func profileJSON(ctx context.Context, tx pgx.Tx, clinic string) (json.RawMessage, error) {
	var raw []byte
	e := tx.QueryRow(ctx, `SELECT jsonb_build_object('clinicId',c.id,'name',c.name,'legalName',p.legal_name,'rut',p.rut,'address',c.address,'sector',c.sector,'phone',c.phone,'email',c.email)
 FROM clinics c LEFT JOIN clinic_profiles p ON p.clinic_id=c.id WHERE c.id=$1`, clinic).Scan(&raw)
	return raw, e
}
func (s *Server) getProfile(w http.ResponseWriter, r *http.Request) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	tx, e := s.pool.Begin(r.Context())
	if e != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	raw, e := profileJSON(r.Context(), tx, a.ClinicID)
	if e != nil {
		return e
	}
	writeJSON(w, 200, raw)
	return nil
}
func (s *Server) putProfile(w http.ResponseWriter, r *http.Request) error {
	a, e := s.actor(r)
	if e != nil {
		return e
	}
	var in profileInput
	if e = decode(w, r, &in); e != nil {
		return e
	}
	in.RUT, e = domain.NormalizeRUT(in.RUT)
	if e != nil {
		return fail(400, "invalid_rut", "RUT inválido")
	}
	if strings.TrimSpace(in.LegalName) == "" || len(in.LegalName) > 200 || len(in.Address) > 500 || len(in.Sector) > 120 || len(in.Phone) > 50 {
		return fail(400, "invalid_profile", "Datos del perfil inválidos")
	}
	if address, e := mail.ParseAddress(in.Email); e != nil || address.Address != in.Email {
		return fail(400, "invalid_email", "Correo inválido")
	}
	return s.mutate(w, r, a, "usuarios.administrar", in, 200, func(tx pgx.Tx, a Actor) (any, error) {
		if _, e := tx.Exec(r.Context(), `INSERT INTO clinic_profiles(clinic_id,legal_name,rut) VALUES($1,$2,$3) ON CONFLICT(clinic_id) DO UPDATE SET legal_name=excluded.legal_name,rut=excluded.rut,updated_at=now()`, a.ClinicID, in.LegalName, in.RUT); e != nil {
			return nil, e
		}
		if _, e := tx.Exec(r.Context(), "UPDATE clinics SET address=$2,sector=$3,phone=$4,email=$5,updated_at=now() WHERE id=$1", a.ClinicID, in.Address, in.Sector, in.Phone, in.Email); e != nil {
			return nil, e
		}
		if e := audit(r.Context(), tx, a, "clinic.profile.changed", a.ClinicID, struct{}{}); e != nil {
			return nil, e
		}
		return profileJSON(r.Context(), tx, a.ClinicID)
	})
}
